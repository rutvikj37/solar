import db from '../../db.js';

export async function ensureWallet(userId, conn = db) {
  await conn.query(
    `INSERT IGNORE INTO marketplace_wallets (user_id, balance) VALUES (?, 0)`,
    [userId],
  );
}

export async function getWalletBalance(userId, conn = db) {
  await ensureWallet(userId, conn);
  const [rows] = await conn.query(
    `SELECT balance FROM marketplace_wallets WHERE user_id = ?`,
    [userId],
  );
  return Number(rows[0]?.balance) || 0;
}

/**
 * Adjust wallet balance and append ledger entry.
 * @param {object} opts
 * @param {number} opts.userId
 * @param {'top_up'|'win_debit'|'refund'|'admin_adjust'} opts.entryType
 * @param {number} opts.amount signed: positive credits wallet, negative debits
 * @param {number|null} [opts.leadId]
 * @param {number|null} [opts.disputeId]
 * @param {number|null} [opts.adminId]
 * @param {string|null} [opts.note]
 * @param {import('mysql2').Pool|import('mysql2').PoolConnection} [opts.conn]
 */
export async function adjustWallet({
  userId,
  entryType,
  amount,
  leadId = null,
  disputeId = null,
  adminId = null,
  note = null,
  conn = null,
}) {
  const delta = Number(amount);
  if (!Number.isFinite(delta) || delta === 0) {
    throw new Error('Invalid wallet amount');
  }

  const ownsConnection = !conn;
  const connection = conn || (await db.getConnection());

  try {
    if (ownsConnection) await connection.beginTransaction();

    await ensureWallet(userId, connection);

    const [rows] = await connection.query(
      `SELECT balance FROM marketplace_wallets WHERE user_id = ? FOR UPDATE`,
      [userId],
    );
    const current = Number(rows[0]?.balance) || 0;
    const next = Math.round((current + delta) * 100) / 100;
    if (next < 0) {
      const err = new Error('Insufficient marketplace wallet balance');
      err.code = 'INSUFFICIENT_FUNDS';
      throw err;
    }

    await connection.query(
      `UPDATE marketplace_wallets SET balance = ? WHERE user_id = ?`,
      [next, userId],
    );
    await connection.query(
      `INSERT INTO marketplace_wallet_ledger
        (user_id, entry_type, amount, balance_after, lead_id, dispute_id, admin_id, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, entryType, delta, next, leadId, disputeId, adminId, note],
    );

    if (ownsConnection) await connection.commit();
    return { previous: current, balance: next };
  } catch (err) {
    if (ownsConnection) {
      try {
        await connection.rollback();
      } catch {
        /* ignore */
      }
    }
    throw err;
  } finally {
    if (ownsConnection) connection.release();
  }
}

export async function getLedger(userId, { limit = 50 } = {}) {
  const [rows] = await db.query(
    `SELECT id, entry_type, amount, balance_after, lead_id, dispute_id, note, created_at
     FROM marketplace_wallet_ledger
     WHERE user_id = ?
     ORDER BY id DESC
     LIMIT ?`,
    [userId, Math.min(Number(limit) || 50, 200)],
  );
  return rows;
}
