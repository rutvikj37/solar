import express from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { logActivity } from './crm.js';
import { trackedFetch } from '../services/apiUsage.js';

const router = express.Router();

function isKeyValid(key) {
  return key && key.trim() !== '' && !key.toLowerCase().includes('your_');
}

async function assertLeadOwnership(leadId, userId) {
  const [rows] = await db.query('SELECT * FROM leads WHERE id = ? AND user_id = ?', [leadId, userId]);
  return rows[0] || null;
}

async function sendTwilioSms(to, body) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!isKeyValid(sid) || !isKeyValid(token) || !isKeyValid(from)) {
    return { ok: false, simulated: true, sid: `sim_${Date.now()}` };
  }

  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const params = new URLSearchParams({ To: to, From: from, Body: body });
  const response = await trackedFetch('twilio', `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Twilio SMS failed');
  }
  return { ok: true, sid: data.sid, simulated: false };
}

async function sendEmail(to, subject, body) {
  const apiKey = process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY;
  const from = process.env.OUTREACH_FROM_EMAIL || 'leads@solarvelocity.app';

  if (!isKeyValid(apiKey)) {
    return { ok: false, simulated: true, id: `sim_email_${Date.now()}` };
  }

  // Prefer Resend-style API
  if (process.env.RESEND_API_KEY && isKeyValid(process.env.RESEND_API_KEY)) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from, to: [to], subject, text: body })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Email send failed');
    return { ok: true, id: data.id, simulated: false };
  }

  // SendGrid fallback
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from },
      subject,
      content: [{ type: 'text/plain', value: body }]
    })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'SendGrid failed');
  }
  return { ok: true, id: response.headers.get('x-message-id') || `sg_${Date.now()}`, simulated: false };
}

function defaultSolarScript(lead) {
  return `Hi ${lead.owner_name || 'there'}, this is calling from your local solar team about ${lead.address}. Based on your roof, you could save roughly $${Number(lead.estimated_savings || 0).toLocaleString()} over 25 years. Do you have 2 minutes to schedule a free site assessment?`;
}

// Send SMS to a lead
router.post('/sms', authenticateToken, async (req, res) => {
  const { leadId, message } = req.body;
  if (!leadId || !message) return res.status(400).json({ error: 'leadId and message required' });

  try {
    const lead = await assertLeadOwnership(leadId, req.user.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (!lead.phone || lead.phone === 'Not Available') {
      return res.status(400).json({ error: 'Lead has no phone number' });
    }

    const result = await sendTwilioSms(lead.phone, message);
    const status = result.simulated ? 'simulated' : 'sent';

    const [ins] = await db.query(
      `INSERT INTO outreach_messages (user_id, lead_id, channel, body, status, external_id)
       VALUES (?, ?, 'sms', ?, ?, ?)`,
      [req.user.id, leadId, message, status, result.sid]
    );

    await logActivity(leadId, req.user.id, 'sms', message, { status, external_id: result.sid });
    if (lead.status === 'new' || lead.status === 'qualified') {
      await db.query('UPDATE leads SET status = ? WHERE id = ?', ['contacted', leadId]);
    }

    res.status(201).json({ id: ins.insertId, status, simulated: !!result.simulated });
  } catch (error) {
    console.error('SMS outreach error:', error);
    res.status(500).json({ error: error.message || 'Failed to send SMS' });
  }
});

// Send email to a lead
router.post('/email', authenticateToken, async (req, res) => {
  const { leadId, subject, message } = req.body;
  if (!leadId || !message) return res.status(400).json({ error: 'leadId and message required' });

  try {
    const lead = await assertLeadOwnership(leadId, req.user.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (!lead.email || lead.email === 'Not Available') {
      return res.status(400).json({ error: 'Lead has no email' });
    }

    const emailSubject = subject || `Solar savings estimate for ${lead.address}`;
    const result = await sendEmail(lead.email, emailSubject, message);
    const status = result.simulated ? 'simulated' : 'sent';

    const [ins] = await db.query(
      `INSERT INTO outreach_messages (user_id, lead_id, channel, subject, body, status, external_id)
       VALUES (?, ?, 'email', ?, ?, ?, ?)`,
      [req.user.id, leadId, emailSubject, message, status, result.id]
    );

    await logActivity(leadId, req.user.id, 'email', message, { subject: emailSubject, status });
    if (lead.status === 'new' || lead.status === 'qualified') {
      await db.query('UPDATE leads SET status = ? WHERE id = ?', ['contacted', leadId]);
    }

    res.status(201).json({ id: ins.insertId, status, simulated: !!result.simulated });
  } catch (error) {
    console.error('Email outreach error:', error);
    res.status(500).json({ error: error.message || 'Failed to send email' });
  }
});

// Bulk SMS to multiple leads
router.post('/bulk-sms', authenticateToken, async (req, res) => {
  const { leadIds, message } = req.body;
  if (!Array.isArray(leadIds) || leadIds.length === 0 || !message) {
    return res.status(400).json({ error: 'leadIds[] and message required' });
  }

  const results = [];
  for (const leadId of leadIds.slice(0, 50)) {
    try {
      const lead = await assertLeadOwnership(leadId, req.user.id);
      if (!lead || !lead.phone || lead.phone === 'Not Available') {
        results.push({ leadId, status: 'skipped' });
        continue;
      }
      const result = await sendTwilioSms(lead.phone, message);
      const status = result.simulated ? 'simulated' : 'sent';
      await db.query(
        `INSERT INTO outreach_messages (user_id, lead_id, channel, body, status, external_id)
         VALUES (?, ?, 'sms', ?, ?, ?)`,
        [req.user.id, leadId, message, status, result.sid]
      );
      await logActivity(leadId, req.user.id, 'sms', message, { bulk: true, status });
      results.push({ leadId, status });
    } catch (err) {
      results.push({ leadId, status: 'error', error: err.message });
    }
  }

  res.json({ results });
});

// Schedule a call
router.post('/calls', authenticateToken, async (req, res) => {
  const { leadId, scheduledAt, script } = req.body;
  if (!leadId || !scheduledAt) return res.status(400).json({ error: 'leadId and scheduledAt required' });

  try {
    const lead = await assertLeadOwnership(leadId, req.user.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const callScript = script || defaultSolarScript(lead);
    const [ins] = await db.query(
      `INSERT INTO scheduled_calls (user_id, lead_id, scheduled_at, script, status)
       VALUES (?, ?, ?, ?, 'scheduled')`,
      [req.user.id, leadId, new Date(scheduledAt), callScript]
    );

    await logActivity(leadId, req.user.id, 'call_scheduled', `Call scheduled for ${scheduledAt}`);
    res.status(201).json({ id: ins.insertId, script: callScript });
  } catch (error) {
    console.error('Schedule call error:', error);
    res.status(500).json({ error: 'Failed to schedule call' });
  }
});

// List scheduled calls
router.get('/calls', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT sc.*, l.owner_name, l.phone, l.address, l.lead_score
       FROM scheduled_calls sc
       JOIN leads l ON l.id = sc.lead_id
       WHERE sc.user_id = ?
       ORDER BY sc.scheduled_at ASC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (error) {
    console.error('List calls error:', error);
    res.status(500).json({ error: 'Failed to list calls' });
  }
});

// Complete a call with AI-style summary (heuristic if no LLM key)
router.patch('/calls/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { status = 'completed', notes } = req.body;

  try {
    const [rows] = await db.query('SELECT * FROM scheduled_calls WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Call not found' });

    const call = rows[0];
    const [leads] = await db.query('SELECT * FROM leads WHERE id = ?', [call.lead_id]);
    const lead = leads[0];

    let summary = notes || '';
    if (!summary) {
      summary = `Call with ${lead?.owner_name || 'homeowner'} regarding solar at ${lead?.address || 'property'}. Status marked ${status}. Follow up recommended within 48 hours.`;
    }

    // Optional OpenAI summary enrichment
    if (isKeyValid(process.env.OPENAI_API_KEY) && notes) {
      try {
        const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'Summarize this solar sales call in 2 sentences with next action.'
              },
              { role: 'user', content: notes }
            ],
            max_tokens: 120
          })
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          summary = aiData.choices?.[0]?.message?.content || summary;
        }
      } catch (err) {
        console.error('[AI Call Summary] failed:', err.message);
      }
    }

    await db.query('UPDATE scheduled_calls SET status = ?, summary = ? WHERE id = ?', [status, summary, id]);
    await logActivity(call.lead_id, req.user.id, 'call', summary, { status });

    if (status === 'completed' && lead && (lead.status === 'new' || lead.status === 'contacted' || lead.status === 'qualified')) {
      await db.query('UPDATE leads SET status = ? WHERE id = ?', ['in_progress', call.lead_id]);
    }

    res.json({ id: Number(id), status, summary });
  } catch (error) {
    console.error('Update call error:', error);
    res.status(500).json({ error: 'Failed to update call' });
  }
});

// Outreach history for a lead
router.get('/history/:leadId', authenticateToken, async (req, res) => {
  try {
    const lead = await assertLeadOwnership(req.params.leadId, req.user.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const [rows] = await db.query(
      'SELECT * FROM outreach_messages WHERE lead_id = ? AND user_id = ? ORDER BY created_at DESC',
      [req.params.leadId, req.user.id]
    );
    res.json(rows);
  } catch (error) {
    console.error('Outreach history error:', error);
    res.status(500).json({ error: 'Failed to load outreach history' });
  }
});

// AI call center: generate script for a lead
router.get('/script/:leadId', authenticateToken, async (req, res) => {
  try {
    const lead = await assertLeadOwnership(req.params.leadId, req.user.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json({ script: defaultSolarScript(lead), leadId: lead.id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate script' });
  }
});

export default router;
