import express from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = express.Router();

// Get presets for logged-in user
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const [presets] = await db.query(
    'SELECT * FROM user_filter_presets WHERE user_id = ? ORDER BY created_at DESC',
    [req.user.id]
  );
  const parsed = presets.map((p) => {
    let filters = {};
    try {
      filters = JSON.parse(p.filters_json);
    } catch (_) {
      filters = {};
    }
    return {
      id: p.id,
      name: p.name,
      filters,
      isDefault: Boolean(p.is_default),
      createdAt: p.created_at
    };
  });
  res.json(parsed);
}));

// Create a new filter preset
router.post('/', authenticateToken, asyncHandler(async (req, res) => {
  const { name, filters, isDefault } = req.body;
  if (!name || !filters) {
    return res.status(400).json({ error: 'Name and filters required' });
  }

  if (isDefault) {
    await db.query('UPDATE user_filter_presets SET is_default = 0 WHERE user_id = ?', [req.user.id]);
  }

  const [result] = await db.query(
    'INSERT INTO user_filter_presets (user_id, name, filters_json, is_default) VALUES (?, ?, ?, ?)',
    [req.user.id, name, JSON.stringify(filters), isDefault ? 1 : 0]
  );

  res.status(201).json({
    id: result.insertId,
    name,
    filters,
    isDefault: Boolean(isDefault)
  });
}));

// Delete a filter preset
router.delete('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  await db.query('DELETE FROM user_filter_presets WHERE id = ? AND user_id = ?', [id, req.user.id]);
  res.json({ success: true, message: 'Preset deleted successfully' });
}));

export default router;
