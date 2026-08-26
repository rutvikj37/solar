import express from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { logActivity } from './crm.js';
import { fetchLeadForUser } from '../utils/leadAccess.js';
import { sendEmail } from '../services/outreachDelivery.js';

const router = express.Router();

async function assertLeadOwnership(leadId, userId, role) {
  if (!leadId) return null;
  return fetchLeadForUser(leadId, userId, role);
}

// List appointments
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT a.*, l.owner_name, l.address, l.phone, l.email
       FROM appointments a
       LEFT JOIN leads l ON l.id = a.lead_id
       WHERE a.user_id = ?
       ORDER BY a.scheduled_at ASC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (error) {
    console.error('List appointments error:', error);
    res.status(500).json({ error: 'Failed to list appointments' });
  }
});

// Create appointment
router.post('/', authenticateToken, async (req, res) => {
  const { leadId, title, scheduledAt, durationMinutes = 60, location, notes } = req.body;
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

    let emailSent = false;
    const toEmail = lead?.email;
    if (toEmail) {
      try {
        const when = new Date(scheduledAt).toLocaleString();
        await sendEmail({
          userId: req.user.id,
          to: toEmail,
          subject: `Appointment confirmation: ${title}`,
          body: [
            `Hi ${lead.owner_name || 'there'},`,
            '',
            `Your appointment is confirmed.`,
            `Title: ${title}`,
            `When: ${when}`,
            `Duration: ${durationMinutes} minutes`,
            location ? `Location: ${location}` : null,
            notes ? `Notes: ${notes}` : null,
            '',
            'We look forward to meeting you.',
          ]
            .filter(Boolean)
            .join('\n'),
        });
        emailSent = true;
      } catch (mailErr) {
        console.warn('[Appointments] confirmation email failed:', mailErr.message || mailErr);
      }
    }

    const [rows] = await db.query('SELECT * FROM appointments WHERE id = ?', [ins.insertId]);
    res.status(201).json({ ...rows[0], emailSent });
  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

// Update appointment
router.patch('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { title, scheduledAt, durationMinutes, location, notes, status } = req.body;

  try {
    const [existing] = await db.query('SELECT * FROM appointments WHERE id = ? AND user_id = ?', [
      id,
      req.user.id
    ]);
    if (existing.length === 0) return res.status(404).json({ error: 'Appointment not found' });

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

    const [rows] = await db.query('SELECT * FROM appointments WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (error) {
    console.error('Update appointment error:', error);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// Delete / cancel appointment
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM appointments WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id
    ]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Appointment not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete appointment error:', error);
    res.status(500).json({ error: 'Failed to delete appointment' });
  }
});

export default router;
