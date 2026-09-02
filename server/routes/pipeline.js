import express from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import {
  DEFAULT_STAGES,
  normalizeStages,
  validateStagesPayload,
  RESERVED_STAGE_KEYS,
} from '../services/pipelineStages.js';

const router = express.Router();

async function loadUserStages(userId) {
  const [rows] = await db.query(
    'SELECT stages_json FROM user_pipeline_settings WHERE user_id = ? LIMIT 1',
    [userId],
  );
  if (!rows.length || !rows[0].stages_json) {
    return normalizeStages(DEFAULT_STAGES);
  }
  let parsed = rows[0].stages_json;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = null;
    }
  }
  return normalizeStages(parsed);
}

export async function getAllowedStatusKeys(userId) {
  const stages = await loadUserStages(userId);
  return stages.map((s) => s.key);
}

// GET /api/pipeline/stages
router.get(
  '/stages',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const stages = await loadUserStages(req.user.id);
    res.json({
      stages,
      reservedKeys: RESERVED_STAGE_KEYS,
      defaults: DEFAULT_STAGES,
    });
  }),
);

// PUT /api/pipeline/stages
router.put(
  '/stages',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const result = validateStagesPayload(req.body?.stages);
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }

    await db.query(
      `INSERT INTO user_pipeline_settings (user_id, stages_json)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE stages_json = VALUES(stages_json), updated_at = CURRENT_TIMESTAMP`,
      [req.user.id, JSON.stringify(result.stages)],
    );

    res.json({ success: true, stages: result.stages });
  }),
);

// POST /api/pipeline/stages/reset
router.post(
  '/stages/reset',
  authenticateToken,
  asyncHandler(async (req, res) => {
    await db.query('DELETE FROM user_pipeline_settings WHERE user_id = ?', [req.user.id]);
    res.json({ success: true, stages: normalizeStages(DEFAULT_STAGES) });
  }),
);

export default router;
