import db from '../db.js';
import { leadAddressHash } from '../utils/leadAddressHash.js';

async function columnExists(table, column) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  return rows[0].cnt > 0;
}

async function indexExists(table, indexName) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName],
  );
  return rows[0].cnt > 0;
}

async function ensureColumn(table, column, definition) {
  if (!(await columnExists(table, column))) {
    await db.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    console.log(`[Schema] Added ${table}.${column}`);
  }
}

/**
 * Backfill leads.address_hash and create UNIQUE(user_id, address_hash).
 * Existing duplicate rows are kept: the oldest row per (user_id, address) keeps the hash,
 * newer duplicates get address_hash = NULL (logged) so the unique index can be created.
 */
async function migrateLeadAddressHash() {
  await ensureColumn('leads', 'address_hash', 'CHAR(40) NULL');
  if (await indexExists('leads', 'uniq_leads_user_address_hash')) return;

  const [rows] = await db.query(
    'SELECT id, user_id, address FROM leads WHERE address_hash IS NULL ORDER BY created_at ASC, id ASC',
  );
  const [hashed] = await db.query(
    'SELECT user_id, address_hash FROM leads WHERE address_hash IS NOT NULL',
  );
  const seen = new Set(hashed.map((r) => `${r.user_id}|${r.address_hash}`));
  const duplicates = [];
  for (const row of rows) {
    const hash = leadAddressHash(row.address);
    if (!hash) continue;
    const key = `${row.user_id}|${hash}`;
    if (seen.has(key)) {
      duplicates.push({ id: row.id, userId: row.user_id, address: row.address });
      continue;
    }
    seen.add(key);
    await db.query('UPDATE leads SET address_hash = ? WHERE id = ?', [hash, row.id]);
  }
  if (duplicates.length) {
    console.warn(
      `[Schema] leads.address_hash: ${duplicates.length} pre-existing duplicate lead(s) left with address_hash NULL (rows kept, oldest copy is canonical):`,
      duplicates.map((d) => `#${d.id} (user ${d.userId})`).join(', '),
    );
  }
  await db.query(
    'ALTER TABLE leads ADD UNIQUE INDEX uniq_leads_user_address_hash (user_id, address_hash)',
  );
  console.log('[Schema] Added unique index uniq_leads_user_address_hash on leads');
}

async function migrateInvoiceStripeIdUnique() {
  if (await indexExists('invoices', 'uniq_invoices_stripe_invoice_id')) return;
  const [dupes] = await db.query(
    `SELECT stripe_invoice_id, COUNT(*) AS cnt, GROUP_CONCAT(id ORDER BY id) AS ids
     FROM invoices WHERE stripe_invoice_id IS NOT NULL
     GROUP BY stripe_invoice_id HAVING cnt > 1`,
  );
  if (dupes.length) {
    console.warn(
      '[Schema] invoices.stripe_invoice_id has duplicates; unique index NOT created until resolved:',
      dupes.map((d) => `${d.stripe_invoice_id} -> invoices ${d.ids}`).join('; '),
    );
    return;
  }
  await db.query(
    'ALTER TABLE invoices ADD UNIQUE INDEX uniq_invoices_stripe_invoice_id (stripe_invoice_id)',
  );
  console.log('[Schema] Added unique index uniq_invoices_stripe_invoice_id on invoices');
}

export async function migrateSecurityHardening() {
  await ensureColumn('users', 'token_version', 'INT UNSIGNED NOT NULL DEFAULT 0');

  await db.query(`
    CREATE TABLE IF NOT EXISTS stripe_events (
      event_id VARCHAR(255) NOT NULL PRIMARY KEY,
      event_type VARCHAR(100) NOT NULL,
      status ENUM('processing','processed') NOT NULL DEFAULT 'processing',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      processed_at DATETIME NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  try {
    await migrateLeadAddressHash();
  } catch (err) {
    console.error('[Schema] leads.address_hash migration failed:', err.message);
  }
  try {
    await migrateInvoiceStripeIdUnique();
  } catch (err) {
    console.error('[Schema] invoices.stripe_invoice_id unique migration failed:', err.message);
  }
}
