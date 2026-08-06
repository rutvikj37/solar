import express from 'express';
import db from '../db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

async function attachRole(req, res, next) {
  try {
    const [users] = await db.query('SELECT id, role FROM users WHERE id = ?', [req.user.id]);
    if (!users.length) return res.status(404).json({ error: 'User not found' });
    req.user.role = users[0].role;
    next();
  } catch {
    res.status(500).json({ error: 'Failed to verify role' });
  }
}

function isAdminRole(role) {
  return ['admin', 'platform_admin', 'super_admin'].includes(role);
}

// --- User tickets ---
router.get('/mine', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM support_tickets WHERE user_id = ? ORDER BY updated_at DESC LIMIT 100`,
      [req.user.id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list tickets' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  const { subject, category, priority, body } = req.body;
  if (!subject || !body) return res.status(400).json({ error: 'subject and body required' });

  try {
    const [result] = await db.query(
      `INSERT INTO support_tickets (user_id, subject, category, priority, status)
       VALUES (?, ?, ?, ?, 'open')`,
      [req.user.id, subject.slice(0, 255), category || 'general', priority || 'normal']
    );
    const ticketId = result.insertId;
    await db.query(
      `INSERT INTO support_messages (ticket_id, sender_id, sender_role, body) VALUES (?, ?, 'user', ?)`,
      [ticketId, req.user.id, body]
    );
    const [tickets] = await db.query('SELECT * FROM support_tickets WHERE id = ?', [ticketId]);
    res.status(201).json(tickets[0]);
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

router.get('/:id', authenticateToken, attachRole, async (req, res) => {
  try {
    const [tickets] = await db.query('SELECT * FROM support_tickets WHERE id = ?', [req.params.id]);
    if (!tickets.length) return res.status(404).json({ error: 'Ticket not found' });
    const ticket = tickets[0];
    if (ticket.user_id !== req.user.id && !isAdminRole(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const [messages] = await db.query(
      `SELECT m.*, u.name AS sender_name, u.email AS sender_email
       FROM support_messages m
       LEFT JOIN users u ON u.id = m.sender_id
       WHERE m.ticket_id = ?
       ORDER BY m.created_at ASC`,
      [ticket.id]
    );
    res.json({ ticket, messages });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load ticket' });
  }
});

router.post('/:id/messages', authenticateToken, attachRole, async (req, res) => {
  const { body } = req.body;
  if (!body) return res.status(400).json({ error: 'body required' });

  try {
    const [tickets] = await db.query('SELECT * FROM support_tickets WHERE id = ?', [req.params.id]);
    if (!tickets.length) return res.status(404).json({ error: 'Ticket not found' });
    const ticket = tickets[0];
    const admin = isAdminRole(req.user.role);
    if (ticket.user_id !== req.user.id && !admin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (['closed', 'resolved'].includes(ticket.status) && !admin) {
      return res.status(400).json({ error: 'Ticket is closed' });
    }

    const role = admin ? 'admin' : 'user';
    await db.query(
      `INSERT INTO support_messages (ticket_id, sender_id, sender_role, body) VALUES (?, ?, ?, ?)`,
      [ticket.id, req.user.id, role, body]
    );
    if (admin && ticket.status === 'open') {
      await db.query(`UPDATE support_tickets SET status = 'in_progress' WHERE id = ?`, [ticket.id]);
    } else {
      await db.query(`UPDATE support_tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [ticket.id]);
    }

    const [messages] = await db.query(
      `SELECT m.*, u.name AS sender_name FROM support_messages m
       LEFT JOIN users u ON u.id = m.sender_id
       WHERE m.ticket_id = ? ORDER BY m.created_at ASC`,
      [ticket.id]
    );
    res.status(201).json({ messages });
  } catch (error) {
    res.status(500).json({ error: 'Failed to post message' });
  }
});

// --- Admin queue ---
router.get('/', authenticateToken, attachRole, requireAdmin, async (req, res) => {
  const status = (req.query.status || '').toString();
  try {
    let sql = `
      SELECT t.*, u.name AS user_name, u.email AS user_email, u.company_name
      FROM support_tickets t
      JOIN users u ON u.id = t.user_id
    `;
    const params = [];
    if (status) {
      sql += ' WHERE t.status = ?';
      params.push(status);
    }
    sql += ' ORDER BY t.updated_at DESC LIMIT 200';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list tickets' });
  }
});

router.patch('/:id/status', authenticateToken, attachRole, requireAdmin, async (req, res) => {
  const { status } = req.body;
  if (!['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    await db.query('UPDATE support_tickets SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true, id: Number(req.params.id), status });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

export default router;
