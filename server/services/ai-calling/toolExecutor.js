/**
 * Tool Executor — CRM actions during live voice conversations.
 */
import db from '../../db.js';
import { bookAppointmentWithIntegrations, findAvailableSlots } from './calendarService.js';
import {
  sendAppointmentConfirmation,
  sendAppointmentInviteEmail,
  sendCallbackReminder,
  notifySalesRep,
  sendSms,
} from './smsNotificationService.js';
import { updateCallRecord } from './callFlowManager.js';
import { scheduleCallback as scheduleQueueCallback } from './campaignEngine.js';
import { endCall, warmTransferCall } from './twilioVoiceService.js';

/**
 * Execute a tool call from the AI during a live conversation.
 */
export async function executeTool(toolName, args, context) {
  const { callRecordId, leadId, userId, streamSid, twilioCallSid } = context;

  try {
    switch (toolName) {
      case 'verify_homeowner': {
        const isHomeowner = args.is_homeowner !== false;
        await db.query(
          `UPDATE leads SET status = ? WHERE id = ? AND user_id = ?`,
          [isHomeowner ? 'homeowner_verified' : 'not_homeowner', leadId, userId]
        );
        console.log(`[ToolExecutor] verify_homeowner: Lead ${leadId} → ${isHomeowner ? 'verified' : 'not homeowner'}`);
        return {
          success: true,
          message: isHomeowner
            ? 'Homeowner verified successfully. Continue qualifying the lead.'
            : 'Not a homeowner. Thank them politely and end the call.',
        };
      }

      case 'book_appointment': {
        const { date, time, duration_minutes } = args;
        const scheduledAt = `${date} ${time}:00`;

        const [leads] = await db.query(
          'SELECT phone, owner_name, email, address, property_json, mailing_address FROM leads WHERE id = ?',
          [leadId]
        );
        const { enrichLeadGeo } = await import('./leadGeo.js');
        const lead = enrichLeadGeo(leads[0] || {});

        const booked = await bookAppointmentWithIntegrations({
          userId,
          leadId,
          scheduledAt,
          durationMinutes: duration_minutes || 30,
          title: 'AI-Booked Solar Consultation',
          notes: `Booked by AI caller during live conversation. Call Record: ${callRecordId}`,
          lead,
        });

        await db.query(
          `UPDATE leads SET status = 'appointment_booked' WHERE id = ? AND user_id = ?`,
          [leadId, userId]
        );

        await updateCallRecord(callRecordId, {
          disposition: 'appointment_booked',
          qualification_data: {
            appointmentId: booked.appointmentId,
            scheduledAt,
            duration_minutes: duration_minutes || 30,
            agency: booked.agency?.name || null,
            inviteLink: booked.inviteLink || null,
          },
        });

        await db.query(
          `INSERT INTO ai_calling_appointments
           (call_record_id, lead_id, user_id, appointment_id, agency_name, agency_zip, scheduled_at,
            duration_minutes, status, google_calendar_event_id, outlook_event_id, invite_link,
            agency_id, confirmation_sms_sent, confirmation_email_sent)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?, 0, 0)`,
          [
            callRecordId,
            leadId,
            userId,
            booked.appointmentId,
            booked.agency?.name || null,
            booked.agency?.zip_codes ? String(lead.zip || '') : null,
            scheduledAt,
            duration_minutes || 30,
            booked.googleEventId,
            booked.outlookEventId,
            booked.inviteLink,
            booked.agency?.id || null,
          ]
        );

        let smsOk = false;
        let emailOk = false;
        try {
          if (lead.phone) {
            await sendAppointmentConfirmation(lead, {
              scheduledAt,
              durationMinutes: duration_minutes || 30,
              agencyName: booked.agency?.name,
              inviteLink: booked.inviteLink,
            });
            smsOk = true;
          }
        } catch (smsErr) {
          console.error('[ToolExecutor] SMS confirmation failed:', smsErr.message);
        }

        try {
          const emailResult = await sendAppointmentInviteEmail(lead, {
            scheduledAt,
            durationMinutes: duration_minutes || 30,
            agencyName: booked.agency?.name,
            inviteLink: booked.inviteLink,
          });
          emailOk = !!emailResult?.ok && !emailResult?.simulated;
          if (emailResult?.simulated) emailOk = true; // count sim as attempted
        } catch (emailErr) {
          console.error('[ToolExecutor] Email invite failed:', emailErr.message);
        }

        if (smsOk || emailOk) {
          await db.query(
            `UPDATE ai_calling_appointments
             SET confirmation_sms_sent = ?, confirmation_email_sent = ?
             WHERE call_record_id = ?`,
            [smsOk ? 1 : 0, emailOk ? 1 : 0, callRecordId]
          );
        }

        if (booked.agency?.phone) {
          try {
            await notifySalesRep(booked.agency.phone, lead.owner_name || 'Lead', {
              scheduledAt,
              address: lead.address,
            });
          } catch (err) {
            console.error('[ToolExecutor] Rep notify failed:', err.message);
          }
        }

        const dateFormatted = new Date(scheduledAt).toLocaleString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });

        console.log(`[ToolExecutor] book_appointment: Lead ${leadId} booked for ${dateFormatted}`);
        return {
          success: true,
          appointment_id: booked.appointmentId,
          scheduled_at: dateFormatted,
          agency: booked.agency?.name || null,
          invite_link: booked.inviteLink || null,
          message: `Appointment successfully booked for ${dateFormatted}${booked.agency ? ` with ${booked.agency.name}` : ''}. Confirmation sent. Confirm this with the customer.`,
        };
      }

      case 'check_availability': {
        const { date } = args;
        const slots = await findAvailableSlots(userId, date, 30);
        const availableSlots = slots.slice(0, 6).map((s) => {
          const t = new Date(s.time);
          return t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        });

        console.log(`[ToolExecutor] check_availability: ${availableSlots.length} slots on ${date}`);
        return {
          success: true,
          date,
          available_times: availableSlots,
          message:
            availableSlots.length > 0
              ? `Available times on ${date}: ${availableSlots.join(', ')}. Suggest 2-3 options to the customer.`
              : `No available slots on ${date}. Suggest a different day.`,
        };
      }

      case 'schedule_callback': {
        const { callback_date, callback_time, reason } = args;
        const callbackAt = `${callback_date} ${callback_time}:00`;

        await updateCallRecord(callRecordId, {
          disposition: 'callback',
          ai_notes: `Callback requested: ${reason || 'Customer asked to call back later'}`,
        });

        const [records] = await db.query('SELECT queue_id FROM ai_call_records WHERE id = ?', [callRecordId]);
        if (records.length && records[0].queue_id) {
          await scheduleQueueCallback(records[0].queue_id, callbackAt);
        }

        try {
          const [leads] = await db.query('SELECT phone, owner_name FROM leads WHERE id = ?', [leadId]);
          if (leads.length && leads[0].phone) {
            await sendCallbackReminder(leads[0], callbackAt);
          }
        } catch (smsErr) {
          console.error('[ToolExecutor] Callback SMS failed:', smsErr.message);
        }

        const dateFormatted = new Date(callbackAt).toLocaleString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });

        console.log(`[ToolExecutor] schedule_callback: Lead ${leadId} callback at ${dateFormatted}`);
        return {
          success: true,
          callback_at: dateFormatted,
          message: `Callback scheduled for ${dateFormatted}. Confirm this with the customer and end the call politely.`,
        };
      }

      case 'send_sms': {
        const { message } = args;
        try {
          const [leads] = await db.query('SELECT phone, owner_name FROM leads WHERE id = ?', [leadId]);
          if (leads.length && leads[0].phone) {
            await sendSms(leads[0].phone, message);
            console.log(`[ToolExecutor] send_sms: Sent to ${leads[0].phone}`);
          }
        } catch (smsErr) {
          console.error('[ToolExecutor] SMS failed:', smsErr.message);
          return { success: false, error: smsErr.message };
        }
        return { success: true, message: 'SMS sent to customer.' };
      }

      case 'transfer_to_human': {
        const reason = args.reason || 'Customer requested human';
        // Prefer agency phone, then env TRANSFER_NUMBER / HUMAN_CLOSER_PHONE
        const [leads] = await db.query(
          'SELECT address, property_json, mailing_address FROM leads WHERE id = ?',
          [leadId]
        );
        const { enrichLeadGeo } = await import('./leadGeo.js');
        const lead = enrichLeadGeo(leads[0] || {});
        const { routeToAgency } = await import('./calendarService.js');
        const agency = await routeToAgency(userId, lead.zip, lead.state);
        const transferTo =
          agency?.phone || process.env.HUMAN_CLOSER_PHONE || process.env.TRANSFER_NUMBER || null;

        if (!transferTo) {
          return {
            success: false,
            error: 'No human closer phone configured. Apologize and offer a callback instead.',
          };
        }

        // Resolve Twilio call SID
        let callSid = twilioCallSid;
        if (!callSid && callRecordId) {
          const [recs] = await db.query('SELECT twilio_call_sid FROM ai_call_records WHERE id = ?', [
            callRecordId,
          ]);
          callSid = recs[0]?.twilio_call_sid;
        }

        const result = await warmTransferCall(callSid, transferTo, {
          announceText: 'Please hold while I connect you with a solar specialist.',
        });

        await updateCallRecord(callRecordId, {
          status: 'transferred',
          disposition: 'qualified',
          ai_notes: `Warm transfer to ${transferTo}. Reason: ${reason}`,
        });

        console.log(`[ToolExecutor] transfer_to_human: ${callSid} → ${transferTo}`);
        return {
          success: !!result.ok,
          transferred_to: transferTo,
          message: result.ok
            ? 'Transfer initiated. Briefly tell the customer you are connecting them now.'
            : 'Transfer failed. Offer to schedule a callback with a specialist.',
        };
      }

      case 'end_call': {
        const { disposition, summary } = args;
        await updateCallRecord(callRecordId, {
          disposition: disposition || 'no_disposition',
          ai_summary: summary || '',
        });

        let callSid = twilioCallSid;
        if (!callSid && callRecordId) {
          const [recs] = await db.query('SELECT twilio_call_sid FROM ai_call_records WHERE id = ?', [
            callRecordId,
          ]);
          callSid = recs[0]?.twilio_call_sid;
        }

        // Hang up after a short delay so goodbye can play
        if (callSid) {
          setTimeout(() => {
            endCall(callSid).catch((err) =>
              console.error('[ToolExecutor] endCall failed:', err.message)
            );
          }, 4000);
        }

        console.log(`[ToolExecutor] end_call: CallRecord ${callRecordId} → ${disposition}`);
        return {
          success: true,
          message: 'Call disposition recorded. Say goodbye warmly and naturally; the line will disconnect shortly.',
        };
      }

      default:
        console.warn(`[ToolExecutor] Unknown tool: ${toolName}`);
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    console.error(`[ToolExecutor] Error executing ${toolName}:`, err.message);
    return { success: false, error: err.message };
  }
}
