import express from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireWorkspacePermission } from '../middleware/workspacePermissions.js';
import { workspaceHasPermission } from '../utils/workspaceContext.js';
import { fetchLeadForUser } from '../utils/leadAccess.js';

const router = express.Router();

export const TASK_STATUSES = ['open', 'done', 'cancelled'];
export const TASK_PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const MAX_TITLE = 255;
const MAX_NOTES = 4000;

const canSeeAllTasks = (ws) => Boolean(ws?.isOwner || workspaceHasPermission(ws, 'team_manage'));

function parseDueAt(raw) {
  if (raw === null || raw === '') return { value: null };
  if (raw === undefined) return { value: undefined };
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return { error: 'dueAt must be an ISO date/time' };
  return { value: d };
}

/** Client local-day boundaries from Date#getTimezoneOffset() minutes. */
function localDayBounds(tzOffsetRaw) {
  const tzOffset = Number.isFinite(Number(tzOffsetRaw)) ? Math.max(-840, Math.min(840, Number(tzOffsetRaw))) : 0;
  const now = new Date();
  const local = new Date(now.getTime() - tzOffset * 60000);
  const startUtcMs = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + tzOffset * 60000;
  return { now, dayStart: new Date(startUtcMs), dayEnd: new Date(startUtcMs + 86400000) };
}

/** Owner + active team members who have a user account. */
async function listWorkspaceUsers(ownerUserId) {
  const [rows] = await db.query(
    `SELECT u.id, u.name, u.email FROM users u WHERE u.id = ?
     UNION
     SELECT u.id, u.name, u.email
       FROM team_members tm
       JOIN users u ON LOWER(u.email) = LOWER(tm.member_email)
      WHERE tm.owner_user_id = ? AND tm.status = 'active'`,
    [ownerUserId, ownerUserId],
  );
  return rows.map((r) => ({ id: Number(r.id), name: r.name || r.email, email: r.email }));
}

async function assertAssignee(ownerUserId, assigneeId) {
  if (assigneeId == null) return true;
  const users = await listWorkspaceUsers(ownerUserId);
  return users.some((u) => u.id === Number(assigneeId));
}

async function logTaskActivity(leadId, userId, type, content, meta) {
  if (!leadId) return;
  try {
    await db.query('INSERT INTO lead_activities (lead_id, user_id, type, content, meta) VALUES (?, ?, ?, ?, ?)', [
      leadId,
      userId,
      type,
      content,
      meta ? JSON.stringify(meta) : null,
    ]);
  } catch (err) {
    console.warn('[Tasks] activity log failed:', err.message);
  }
}

const TASK_SELECT = `
  SELECT t.*, l.owner_name AS lead_name, l.address AS lead_address, l.status AS lead_status,
         au.name AS assignee_name, au.email AS assignee_email, cu.name AS created_by_name,
         (t.status = 'open' AND t.due_at IS NOT NULL AND t.due_at < NOW()) AS is_overdue
    FROM crm_tasks t
    LEFT JOIN leads l ON l.id = t.lead_id
    LEFT JOIN users au ON au.id = t.assignee_user_id
    LEFT JOIN users cu ON cu.id = t.created_by`;

function serializeTask(r) {
  return {
    id: r.id,
    leadId: r.lead_id,
    leadName: r.lead_name || null,
    leadAddress: r.lead_address || null,
    leadStatus: r.lead_status || null,
    assigneeUserId: r.assignee_user_id,
    assigneeName: r.assignee_name || r.assignee_email || null,
    title: r.title,
    notes: r.notes,
    dueAt: r.due_at ? new Date(r.due_at).toISOString() : null,
    status: r.status,
    priority: r.priority,
    createdBy: r.created_by,
    createdByName: r.created_by_name || null,
    completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : null,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
    isOverdue: Boolean(Number(r.is_overdue)),
  };
}

/** Visibility: workspace pool; members limited to their own tasks unless viewing a lead they can access. */
function scopeClause(ws, scope) {
  const where = ['t.owner_user_id = ?', '(t.lead_id IS NULL OR l.id IS NOT NULL)'];
  const params = [ws.ownerUserId];
  if (scope !== 'all' || !canSeeAllTasks(ws)) {
    where.push('(t.assignee_user_id = ? OR (t.assignee_user_id IS NULL AND t.created_by = ?))');
    params.push(ws.actorUserId, ws.actorUserId);
  }
  return { where, params };
}

async function loadTaskForActor(taskId, ws, role) {
  const [rows] = await db.query(`${TASK_SELECT} WHERE t.id = ? AND t.owner_user_id = ? LIMIT 1`, [
    taskId,
    ws.ownerUserId,
  ]);
  const task = rows[0];
  if (!task) return null;
  if (canSeeAllTasks(ws)) return task;
  if (task.assignee_user_id === ws.actorUserId || task.created_by === ws.actorUserId) return task;
  if (task.lead_id && (await fetchLeadForUser(task.lead_id, ws.actorUserId, role, 'l.id'))) return task;
  return null;
}

router.get('/assignees', authenticateToken, requireWorkspacePermission('leads_view'), async (req, res) => {
  try {
    res.json({ users: await listWorkspaceUsers(req.workspace.ownerUserId), me: req.workspace.actorUserId });
  } catch (err) {
    console.error('[Tasks] assignees failed:', err);
    res.status(500).json({ error: 'Failed to load assignees' });
  }
});

/** Counts for badges: overdue / due today / open, plus lead ids with overdue tasks. */
router.get('/summary', authenticateToken, requireWorkspacePermission('leads_view'), async (req, res) => {
  try {
    const ws = req.workspace;
    const { dayStart, dayEnd } = localDayBounds(req.query.tzOffset);
    const { where, params } = scopeClause(ws, String(req.query.scope || 'mine'));
    where.push("t.status = 'open'");
    const [[counts]] = await db.query(
      `SELECT COUNT(*) AS open_count,
              SUM(t.due_at IS NOT NULL AND t.due_at < NOW()) AS overdue,
              SUM(t.due_at >= ? AND t.due_at < ?) AS due_today
         FROM crm_tasks t LEFT JOIN leads l ON l.id = t.lead_id
        WHERE ${where.join(' AND ')}`,
      [dayStart, dayEnd, ...params],
    );
    const [leadRows] = await db.query(
      `SELECT t.lead_id, COUNT(*) AS n
         FROM crm_tasks t JOIN leads l ON l.id = t.lead_id
        WHERE t.owner_user_id = ? AND t.status = 'open' AND t.due_at IS NOT NULL AND t.due_at < NOW()
        GROUP BY t.lead_id`,
      [ws.ownerUserId],
    );
    res.json({
      open: Number(counts.open_count) || 0,
      overdue: Number(counts.overdue) || 0,
      dueToday: Number(counts.due_today) || 0,
      overdueByLead: Object.fromEntries(leadRows.map((r) => [r.lead_id, Number(r.n)])),
    });
  } catch (err) {
    console.error('[Tasks] summary failed:', err);
    res.status(500).json({ error: 'Failed to load task summary' });
  }
});

/**
 * GET /api/tasks?scope=mine|all&status=open|done|cancelled|all&leadId=&tzOffset=
 * Open tasks come back bucketed into overdue / today / upcoming / noDate.
 */
router.get('/', authenticateToken, requireWorkspacePermission('leads_view'), async (req, res) => {
  try {
    const ws = req.workspace;
    const leadId = req.query.leadId ? Number(req.query.leadId) : null;
    const status = String(req.query.status || 'open');
    let where;
    let params;
    if (leadId) {
      const lead = await fetchLeadForUser(leadId, ws.actorUserId, req.user.role, 'l.id');
      if (!lead) return res.status(404).json({ error: 'Lead not found' });
      where = ['t.lead_id = ?'];
      params = [leadId];
    } else {
      ({ where, params } = scopeClause(ws, String(req.query.scope || 'mine')));
    }
    if (status !== 'all') {
      if (!TASK_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });
      where.push('t.status = ?');
      params.push(status);
    }
    const [rows] = await db.query(
      `${TASK_SELECT} WHERE ${where.join(' AND ')}
        ORDER BY t.status = 'open' DESC, t.due_at IS NULL, t.due_at ASC,
                 FIELD(t.priority, 'urgent', 'high', 'normal', 'low'), t.id DESC
        LIMIT 500`,
      params,
    );
    const tasks = rows.map(serializeTask);
    const { dayEnd } = localDayBounds(req.query.tzOffset);
    const buckets = { overdue: [], today: [], upcoming: [], noDate: [] };
    for (const t of tasks) {
      if (t.status !== 'open') continue;
      if (!t.dueAt) buckets.noDate.push(t);
      else if (t.isOverdue) buckets.overdue.push(t);
      else if (new Date(t.dueAt) < dayEnd) buckets.today.push(t);
      else buckets.upcoming.push(t);
    }
    res.json({ tasks, buckets, canSeeAll: canSeeAllTasks(ws) });
  } catch (err) {
    console.error('[Tasks] list failed:', err);
    res.status(500).json({ error: 'Failed to load tasks' });
  }
});

router.post('/', authenticateToken, requireWorkspacePermission('leads_edit'), async (req, res) => {
  try {
    const ws = req.workspace;
    const title = String(req.body?.title || '').trim().slice(0, MAX_TITLE);
    if (!title) return res.status(400).json({ error: 'Title is required' });
    const notes = req.body?.notes ? String(req.body.notes).slice(0, MAX_NOTES) : null;
    const priority = req.body?.priority || 'normal';
    if (!TASK_PRIORITIES.includes(priority)) return res.status(400).json({ error: 'Invalid priority' });
    const due = parseDueAt(req.body?.dueAt);
    if (due.error) return res.status(400).json({ error: due.error });

    let leadId = null;
    if (req.body?.leadId) {
      const lead = await fetchLeadForUser(Number(req.body.leadId), ws.actorUserId, req.user.role, 'l.id');
      if (!lead) return res.status(404).json({ error: 'Lead not found' });
      leadId = Number(lead.id);
    }

    let assignee = req.body?.assigneeUserId === undefined ? ws.actorUserId : req.body.assigneeUserId;
    assignee = assignee === null || assignee === '' ? null : Number(assignee);
    if (assignee !== null && assignee !== ws.actorUserId && !canSeeAllTasks(ws)) {
      return res.status(403).json({ error: 'Only managers can assign tasks to others', code: 'WORKSPACE_PERMISSION_DENIED' });
    }
    if (!(await assertAssignee(ws.ownerUserId, assignee))) {
      return res.status(400).json({ error: 'Assignee is not in this workspace' });
    }

    const [result] = await db.query(
      `INSERT INTO crm_tasks (owner_user_id, lead_id, assignee_user_id, title, notes, due_at, priority, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [ws.ownerUserId, leadId, assignee, title, notes, due.value ?? null, priority, ws.actorUserId],
    );
    await logTaskActivity(leadId, ws.actorUserId, 'task_created', `Task: ${title}`, {
      taskId: result.insertId,
      dueAt: due.value ? due.value.toISOString() : null,
      assigneeUserId: assignee,
    });
    const [rows] = await db.query(`${TASK_SELECT} WHERE t.id = ?`, [result.insertId]);
    res.status(201).json({ task: serializeTask(rows[0]) });
  } catch (err) {
    console.error('[Tasks] create failed:', err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

router.patch('/:id', authenticateToken, requireWorkspacePermission('leads_edit'), async (req, res) => {
  try {
    const ws = req.workspace;
    const task = await loadTaskForActor(Number(req.params.id), ws, req.user.role);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const sets = [];
    const params = [];
    const body = req.body || {};
    if (body.title !== undefined) {
      const title = String(body.title || '').trim().slice(0, MAX_TITLE);
      if (!title) return res.status(400).json({ error: 'Title is required' });
      sets.push('title = ?');
      params.push(title);
    }
    if (body.notes !== undefined) {
      sets.push('notes = ?');
      params.push(body.notes ? String(body.notes).slice(0, MAX_NOTES) : null);
    }
    if (body.priority !== undefined) {
      if (!TASK_PRIORITIES.includes(body.priority)) return res.status(400).json({ error: 'Invalid priority' });
      sets.push('priority = ?');
      params.push(body.priority);
    }
    if (body.dueAt !== undefined) {
      const due = parseDueAt(body.dueAt);
      if (due.error) return res.status(400).json({ error: due.error });
      sets.push('due_at = ?');
      params.push(due.value);
    }
    if (body.assigneeUserId !== undefined) {
      const assignee = body.assigneeUserId === null || body.assigneeUserId === '' ? null : Number(body.assigneeUserId);
      if (assignee !== task.assignee_user_id) {
        if (assignee !== ws.actorUserId && !canSeeAllTasks(ws)) {
          return res.status(403).json({ error: 'Only managers can assign tasks to others', code: 'WORKSPACE_PERMISSION_DENIED' });
        }
        if (!(await assertAssignee(ws.ownerUserId, assignee))) {
          return res.status(400).json({ error: 'Assignee is not in this workspace' });
        }
      }
      sets.push('assignee_user_id = ?');
      params.push(assignee);
    }
    let statusChange = null;
    if (body.status !== undefined && body.status !== task.status) {
      if (!TASK_STATUSES.includes(body.status)) return res.status(400).json({ error: 'Invalid status' });
      statusChange = body.status;
      sets.push('status = ?');
      params.push(body.status);
      if (body.status === 'done') {
        sets.push('completed_at = NOW()', 'completed_by = ?');
        params.push(ws.actorUserId);
      } else {
        sets.push('completed_at = NULL', 'completed_by = NULL');
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });

    await db.query(`UPDATE crm_tasks SET ${sets.join(', ')} WHERE id = ?`, [...params, task.id]);
    if (statusChange === 'done') {
      await logTaskActivity(task.lead_id, ws.actorUserId, 'task_completed', `Completed task: ${task.title}`, {
        taskId: task.id,
      });
    }
    const [rows] = await db.query(`${TASK_SELECT} WHERE t.id = ?`, [task.id]);
    res.json({ task: serializeTask(rows[0]) });
  } catch (err) {
    console.error('[Tasks] update failed:', err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

router.delete('/:id', authenticateToken, requireWorkspacePermission('leads_edit'), async (req, res) => {
  try {
    const ws = req.workspace;
    const task = await loadTaskForActor(Number(req.params.id), ws, req.user.role);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (!canSeeAllTasks(ws) && task.created_by !== ws.actorUserId) {
      return res.status(403).json({ error: 'Only the task creator or a manager can delete it', code: 'WORKSPACE_PERMISSION_DENIED' });
    }
    await db.query('DELETE FROM crm_tasks WHERE id = ?', [task.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[Tasks] delete failed:', err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

export default router;
