import express from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { logActivity } from './crm.js';
import { fetchLeadForUser } from '../utils/leadAccess.js';
import { sendEmail } from '../services/outreachDelivery.js';
import { requirePlanFeature } from '../services/planEntitlements.js';
import {
  buildAppointmentIcs,
  buildCalendarLinks,
  isValidAppointmentStatus,
} from '../utils/appointmentCalendar.js';
import { syncAppointmentCalendarsWithin } from '../services/calendar/appointmentCalendarSync.js';

const router = express.Router();

async function assertLeadOwnership(leadId, userId, role) {
  if (!leadId) return null;
  return fetchLeadForUser(leadId, userId, role);
}

async function fetchAppointmentForUser(id, userId) {
  const [rows] = await db.query(
    `SELECT a.*, l.owner_name, l.address, l.phone, l.email
     FROM appointments a
     LEFT JOIN leads l ON l.id = a.lead_id
     WHERE a.id = ? AND a.user_id = ?
     LIMIT 1`,
    [id, userId]
  );
  return rows[0] || null;
}

function formatWhen(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value || '');
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

async function sendConfirmationEmail({ userId, userRole, lead, appt }) {
  const toEmail = lead?.email;
  if (!toEmail) return { emailSent: false, reason: 'no_email' };

  const links = buildCalendarLinks({
    ...appt,
    owner_name: lead.owner_name,
    address: lead.address || appt.location,
    phone: lead.phone,
    email: lead.email,
  });

  const when = formatWhen(appt.scheduled_at || appt.scheduledAt);
  const duration = appt.duration_minutes || appt.durationMinutes || 60;
  const location = appt.location || lead.address || null;
  const notes = appt.notes || null;
  const title = appt.title || 'Appointment';

  await sendEmail({
    userId,
    userRole,
    to: toEmail,
    subject: `Appointment confirmation: ${title}`,
    source: 'meeting',
    body: [
      `Hi ${lead.owner_name || 'there'},`,
      '',
      'Your appointment is confirmed.',
      `Title: ${title}`,
      `When: ${when}`,
      `Duration: ${duration} minutes`,
      location ? `Location: ${location}` : null,
      notes ? `Notes: ${notes}` : null,
      '',
      'Add this to your calendar:',
      links.google ? `Google Calendar: ${links.google}` : null,
      links.outlook ? `Outlook: ${links.outlook}` : null,
      '',
      'We look forward to meeting you.',
    ]
      .filter(Boolean)
      .join('\n'),
  });

  return { emailSent: true };
}

// List appointments (optional ?leadId=)
router.get('/', authenticateToken, requirePlanFeature('appointments'), async (req, res) => {
  try {
    const leadId = req.query.leadId ? Number(req.query.leadId) : null;
    const params = [req.user.id];
    let sql = `SELECT a.*, l.owner_name, l.address, l.phone, l.email
       FROM appointments a
       LEFT JOIN leads l ON l.id = a.lead_id
       WHERE a.user_id = ?`;
    if (leadId) {
      sql += ' AND a.lead_id = ?';
      params.push(leadId);
    }
    sql += ' ORDER BY a.scheduled_at ASC';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('List appointments error:', error);
    res.status(500).json({ error: 'Failed to list appointments' });
  }
});

// Create appointment
router.post('/', authenticateToken, requirePlanFeature('appointments'), async (req, res) => {
  const {
    leadId,
    title,
    scheduledAt,
    durationMinutes = 60,
    location,
    notes,
    sendConfirmation = true,
  } = req.body;
  if (!title || !scheduledAt) {
    return res.status(400).json({ error: 'title and scheduledAt required' });
  }

  try {
    let lead = null;
    if (leadId) {
      lead = await assertLeadOwnership(leadId, req.user.id, req.user.role);
      if (!lead) return res.status(404).json({ error: 'Lead not found' });
    }

    const [ins] = await db.query(
      `INSERT INTO appointments (user_id, lead_id, title, scheduled_at, duration_minutes, location, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled')`,
      [req.user.id, leadId || null, title, new Date(scheduledAt), durationMinutes, location || null, notes || null]
    );

    if (leadId) {
      await logActivity(leadId, req.user.id, 'appointment', `Appointment booked: ${title} at ${scheduledAt}`);
      await db.query('UPDATE leads SET status = ? WHERE id = ? AND user_id = ?', [
        'appointment',
        leadId,
        req.user.id
      ]);
    }

    const appt = await fetchAppointmentForUser(ins.insertId, req.user.id);
    const calendarSync = appt ? await syncAppointmentCalendarsWithin(appt) : null;
    let emailSent = false;
    let emailSkippedReason = null;

    if (sendConfirmation !== false && lead?.email) {
      try {
        const result = await sendConfirmationEmail({
          userId: req.user.id,
          userRole: req.user.role,
          lead,
          appt: appt || {
            id: ins.insertId,
            title,
            scheduled_at: scheduledAt,
            duration_minutes: durationMinutes,
            location,
            notes,
          },
        });
        emailSent = Boolean(result.emailSent);
        emailSkippedReason = result.reason || null;
      } catch (mailErr) {
        console.warn('[Appointments] confirmation email failed:', mailErr.message || mailErr);
        emailSkippedReason = 'send_failed';
      }
    } else if (sendConfirmation !== false && lead && !lead.email) {
      emailSkippedReason = 'no_email';
    }

    const links = buildCalendarLinks(appt || {
      id: ins.insertId,
      title,
      scheduled_at: scheduledAt,
      duration_minutes: durationMinutes,
      location,
      notes,
      owner_name: lead?.owner_name,
      address: lead?.address,
    });

    res.status(201).json({
      ...(appt || { id: ins.insertId }),
      emailSent,
      emailSkippedReason,
      calendarLinks: links,
      calendarSync,
    });
  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

// Download ICS for one appointment
router.get('/:id/ics', authenticateToken, requirePlanFeature('appointments'), async (req, res) => {
  try {
    const appt = await fetchAppointmentForUser(req.params.id, req.user.id);
    if (!appt) return res.status(404).json({ error: 'Appointment not found' });

    const ics = buildAppointmentIcs(appt);
    const safeTitle = String(appt.title || 'appointment')
      .replace(/[^\w\-]+/g, '-')
      .slice(0, 40);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeTitle || 'appointment'}-${appt.id}.ics"`
    );
    res.send(ics);
  } catch (error) {
    console.error('ICS download error:', error);
    res.status(500).json({ error: 'Failed to generate calendar file' });
  }
});

// Resend confirmation email (with calendar links)
router.post('/:id/resend-confirmation', authenticateToken, requirePlanFeature('appointments'), async (req, res) => {
  try {
    const appt = await fetchAppointmentForUser(req.params.id, req.user.id);
    if (!appt) return res.status(404).json({ error: 'Appointment not found' });
    if (!appt.lead_id) {
      return res.status(400).json({ error: 'Appointment has no linked lead' });
    }
    if (!appt.email) {
      return res.status(400).json({ error: 'Lead has no email address' });
    }
    if (String(appt.status).toLowerCase() === 'cancelled') {
      return res.status(400).json({ error: 'Cannot confirm a cancelled appointment' });
    }

    await sendConfirmationEmail({
      userId: req.user.id,
      userRole: req.user.role,
      lead: {
        owner_name: appt.owner_name,
        email: appt.email,
        address: appt.address,
        phone: appt.phone,
      },
      appt,
    });

    if (appt.lead_id) {
      await logActivity(
        appt.lead_id,
        req.user.id,
        'appointment',
        `Confirmation email resent for: ${appt.title}`
      );
    }

    res.json({ success: true, emailSent: true, calendarLinks: buildCalendarLinks(appt) });
  } catch (error) {
    console.error('Resend confirmation error:', error);
    res.status(500).json({ error: error.message || 'Failed to resend confirmation' });
  }
});

// Update appointment
router.patch('/:id', authenticateToken, requirePlanFeature('appointments'), async (req, res) => {
  const { id } = req.params;
  const { title, scheduledAt, durationMinutes, location, notes, status, sendConfirmation } = req.body;

  if (status != null && !isValidAppointmentStatus(status)) {
    return res.status(400).json({
      error: `Invalid status. Allowed: scheduled, completed, cancelled, no_show`,
    });
  }

  try {
    const existing = await fetchAppointmentForUser(id, req.user.id);
    if (!existing) return res.status(404).json({ error: 'Appointment not found' });

    await db.query(
      `UPDATE appointments SET
        title = COALESCE(?, title),
        scheduled_at = COALESCE(?, scheduled_at),
        duration_minutes = COALESCE(?, duration_minutes),
        location = COALESCE(?, location),
        notes = COALESCE(?, notes),
        status = COALESCE(?, status)
       WHERE id = ? AND user_id = ?`,
      [
        title ?? null,
        scheduledAt ? new Date(scheduledAt) : null,
        durationMinutes ?? null,
        location ?? null,
        notes ?? null,
        status ?? null,
        id,
        req.user.id
      ]
    );

    let appt = await fetchAppointmentForUser(id, req.user.id);
    const calendarSync = await syncAppointmentCalendarsWithin(appt);
    if (calendarSync.status !== 'not_connected') appt = (await fetchAppointmentForUser(id, req.user.id)) || appt;

    if (existing.lead_id) {
      const bits = [];
      if (scheduledAt && new Date(scheduledAt).getTime() !== new Date(existing.scheduled_at).getTime()) {
        bits.push(`rescheduled to ${formatWhen(scheduledAt)}`);
      }
      if (status && status !== existing.status) {
        bits.push(`status → ${status}`);
      }
      if (bits.length) {
        await logActivity(
          existing.lead_id,
          req.user.id,
          'appointment',
          `Appointment updated (${appt.title}): ${bits.join(', ')}`
        );
      }
    }

    let emailSent = false;
    if (
      sendConfirmation &&
      appt?.email &&
      String(appt.status).toLowerCase() !== 'cancelled'
    ) {
      try {
        await sendConfirmationEmail({
          userId: req.user.id,
          userRole: req.user.role,
          lead: {
            owner_name: appt.owner_name,
            email: appt.email,
            address: appt.address,
            phone: appt.phone,
          },
          appt,
        });
        emailSent = true;
      } catch (mailErr) {
        console.warn('[Appointments] update confirmation email failed:', mailErr.message || mailErr);
      }
    }

    res.json({ ...appt, emailSent, calendarLinks: buildCalendarLinks(appt), calendarSync });
  } catch (error) {
    console.error('Update appointment error:', error);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// Delete / cancel appointment
router.delete('/:id', authenticateToken, requirePlanFeature('appointments'), async (req, res) => {
  try {
    const existing = await fetchAppointmentForUser(req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ error: 'Appointment not found' });

    const [result] = await db.query('DELETE FROM appointments WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id
    ]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Appointment not found' });
    const calendarSync = await syncAppointmentCalendarsWithin(existing, { action: 'delete' });

    if (existing.lead_id) {
      await logActivity(
        existing.lead_id,
        req.user.id,
        'appointment',
        `Appointment deleted: ${existing.title}`
      );
    }

    res.json({ success: true, calendarSync });
  } catch (error) {
    console.error('Delete appointment error:', error);
    res.status(500).json({ error: 'Failed to delete appointment' });
  }
});

export default router;
