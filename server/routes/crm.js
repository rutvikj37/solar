import express from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { fetchLeadForUser } from '../utils/leadAccess.js';
import { getAllowedStatusKeys } from './pipeline.js';

const router = express.Router();

export const PIPELINE_STATUSES = [
  'new',
  'contacted',
  'appointment',
  'proposal',
  'won',
  'lost',
  'qualified',
  'in_progress'
];

async function logActivity(leadId, userId, type, content, meta = null) {
  await db.query(
    'INSERT INTO lead_activities (lead_id, user_id, type, content, meta) VALUES (?, ?, ?, ?, ?)',
    [leadId, userId, type, content, meta ? JSON.stringify(meta) : null]
  );
}

// Pipeline summary counts (must be before /:id routes)
router.get('/pipeline/summary', authenticateToken, async (req, res) => {
  try {
    const { resolveWorkspaceContext } = await import('../utils/workspaceContext.js');
    const workspace = await resolveWorkspaceContext(req.user.id);
    const [rows] = await db.query(
      `SELECT status, COUNT(*) AS count FROM leads WHERE user_id = ? GROUP BY status`,
      [workspace.ownerUserId]
    );
    const summary = Object.fromEntries(PIPELINE_STATUSES.map((s) => [s, 0]));
    rows.forEach((r) => {
      summary[r.status] = r.count;
    });
    res.json(summary);
  } catch (error) {
    console.error('Pipeline summary error:', error);
    res.status(500).json({ error: 'Server error fetching pipeline summary' });
  }
});

// Update lead status / notes / assignee
router.patch('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { status, notes, assigned_to } = req.body;

  try {
    const lead = await fetchLeadForUser(id, req.user.id, req.user.role);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const updates = [];
    const values = [];

    if (status !== undefined) {
      const allowed = await getAllowedStatusKeys(req.user.id);
      if (!allowed.includes(status) && !PIPELINE_STATUSES.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Allowed: ${allowed.join(', ')}` });
      }
      updates.push('status = ?');
      values.push(status);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes);
    }
    if (assigned_to !== undefined) {
      updates.push('assigned_to = ?');
      values.push(assigned_to || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id, lead.user_id);
    await db.query(`UPDATE leads SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values);

    if (status !== undefined && status !== lead.status) {
      await logActivity(id, req.user.id, 'status_change', `Status changed from ${lead.status} to ${status}`, {
        from: lead.status,
        to: status
      });
    }
    if (notes !== undefined && notes !== lead.notes) {
      await logActivity(id, req.user.id, 'note', notes);
    }
    if (assigned_to !== undefined && String(assigned_to) !== String(lead.assigned_to || '')) {
      await logActivity(id, req.user.id, 'assignment', `Assigned to user ${assigned_to || 'unassigned'}`, {
        assigned_to
      });
    }

    const [updated] = await db.query('SELECT * FROM leads WHERE id = ? AND user_id = ?', [id, lead.user_id]);
    res.json(updated[0]);
  } catch (error) {
    console.error('Lead update error:', error);
    res.status(500).json({ error: 'Server error updating lead' });
  }
});

// Add a note / activity
router.post('/:id/activities', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { type = 'note', content } = req.body;
  if (!content) return res.status(400).json({ error: 'content is required' });

  try {
    const lead = await fetchLeadForUser(id, req.user.id, req.user.role);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    await logActivity(id, req.user.id, type, content);
    if (type === 'note') {
      await db.query('UPDATE leads SET notes = ? WHERE id = ? AND user_id = ?', [content, id, lead.user_id]);
    }

    const [activities] = await db.query(
      'SELECT * FROM lead_activities WHERE lead_id = ? ORDER BY created_at DESC LIMIT 50',
      [id]
    );
    res.status(201).json({ activities });
  } catch (error) {
    console.error('Activity create error:', error);
    res.status(500).json({ error: 'Server error adding activity' });
  }
});

// List activities for a lead
router.get('/:id/activities', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const lead = await fetchLeadForUser(id, req.user.id, req.user.role);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const [activities] = await db.query(
      'SELECT * FROM lead_activities WHERE lead_id = ? ORDER BY created_at DESC LIMIT 100',
      [id]
    );
    res.json(activities);
  } catch (error) {
    console.error('Activity fetch error:', error);
    res.status(500).json({ error: 'Server error fetching activities' });
  }
});

// CRM export (stores activity + returns payload)
router.post('/:id/export-crm', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { target = 'generic' } = req.body;
  try {
    const lead = await fetchLeadForUser(id, req.user.id, req.user.role);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const payload = {
      id: lead.id,
      owner_name: lead.owner_name,
      address: lead.address,
      phone: lead.phone,
      email: lead.email,
      lead_score: lead.lead_score,
      status: lead.status,
      property_value: lead.property_value,
      estimated_savings: lead.estimated_savings,
      exported_at: new Date().toISOString(),
      target
    };

    await logActivity(id, req.user.id, 'crm_export', `Exported to ${target}`, { target });

    res.json({ success: true, payload });
  } catch (error) {
    console.error('CRM export error:', error);
    res.status(500).json({ error: 'Server error exporting lead' });
  }
});

export { logActivity };
export default router;
