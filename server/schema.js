import db from './db.js';

async function columnExists(table, column) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows[0].cnt > 0;
}

async function ensureColumn(table, column, definition) {
  if (!(await columnExists(table, column))) {
    await db.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    console.log(`[Schema] Added ${table}.${column}`);
  }
}

export async function migrateSchema() {
  console.log('[Schema] Ensuring Tier-1 tables and columns...');

  await ensureColumn('leads', 'notes', 'TEXT NULL');
  await ensureColumn('leads', 'assigned_to', 'INT UNSIGNED NULL');
  await ensureColumn('leads', 'updated_at', 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
  await ensureColumn('leads', 'solar_json', 'LONGTEXT NULL');
  await ensureColumn('leads', 'property_json', 'LONGTEXT NULL');
  await ensureColumn('leads', 'image_url', 'VARCHAR(1024) NULL');
  await ensureColumn('users', 'account_status', "VARCHAR(50) NOT NULL DEFAULT 'active'");
  await ensureColumn('users', 'stripe_customer_id', 'VARCHAR(255) NULL');

  await db.query(`
    CREATE TABLE IF NOT EXISTS lead_activities (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      lead_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      type VARCHAR(50) NOT NULL,
      content TEXT NULL,
      meta JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_lead_activities_lead (lead_id),
      INDEX idx_lead_activities_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS appointments (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      lead_id INT UNSIGNED NULL,
      title VARCHAR(255) NOT NULL,
      scheduled_at DATETIME NOT NULL,
      duration_minutes INT NOT NULL DEFAULT 60,
      status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
      location VARCHAR(255) NULL,
      notes TEXT NULL,
      reminder_sent TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_appointments_user (user_id),
      INDEX idx_appointments_lead (lead_id),
      INDEX idx_appointments_when (scheduled_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      stripe_session_id VARCHAR(255) NULL,
      package_id VARCHAR(50) NOT NULL,
      amount_cents INT NOT NULL DEFAULT 0,
      credits INT NOT NULL DEFAULT 0,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      method VARCHAR(100) NULL DEFAULT 'card',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_invoices_user (user_id),
      INDEX idx_invoices_session (stripe_session_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS outreach_messages (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      lead_id INT UNSIGNED NOT NULL,
      channel VARCHAR(20) NOT NULL,
      direction VARCHAR(20) NOT NULL DEFAULT 'outbound',
      subject VARCHAR(255) NULL,
      body TEXT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'queued',
      external_id VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_outreach_user (user_id),
      INDEX idx_outreach_lead (lead_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS scheduled_calls (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      lead_id INT UNSIGNED NOT NULL,
      scheduled_at DATETIME NOT NULL,
      script TEXT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
      summary TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_calls_user (user_id),
      INDEX idx_calls_lead (lead_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Ensure packages table exists
  await db.query(`
    CREATE TABLE IF NOT EXISTS packages (
      id VARCHAR(50) NOT NULL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      lead_limit INT NOT NULL DEFAULT 0,
      price DECIMAL(10,2) NOT NULL DEFAULT 0,
      description TEXT NULL,
      features TEXT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      stripe_price_id VARCHAR(255) NULL,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Seed package catalog if empty
  const [pkgRows] = await db.query('SELECT COUNT(*) AS cnt FROM packages');
  if (pkgRows[0].cnt === 0) {
    await db.query(
      `INSERT INTO packages (id, name, lead_limit, price, description, features, is_active, is_subscription, billing_interval) VALUES
       ('Starter', 'Starter', 20, 499.00, 'Essential monthly plan', '["20 High-Intent Leads/month","Basic Address Verification","CSV Download"]', 1, 1, 'month'),
       ('Growth', 'Growth', 50, 1199.00, 'Performance monthly plan', '["50 Verified Leads/month","Roof Analysis","Direct API Push"]', 1, 1, 'month'),
       ('Enterprise', 'Enterprise', 100, 2249.00, 'Scale monthly plan', '["100 Premium Leads/month","Bulk Area Scan","Priority Support"]', 1, 1, 'month')`
    );
    console.log('[Schema] Seeded packages catalog');
  }

  // Packages: admin-managed plan columns
  await ensureColumn('packages', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1');
  await ensureColumn('packages', 'stripe_price_id', 'VARCHAR(255) NULL');
  await ensureColumn('packages', 'razorpay_plan_id', 'VARCHAR(255) NULL');
  await ensureColumn('packages', 'billing_interval', "VARCHAR(20) NOT NULL DEFAULT 'month'");
  await ensureColumn('packages', 'is_subscription', 'TINYINT(1) NOT NULL DEFAULT 1');
  await ensureColumn('packages', 'created_at', 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP');
  await ensureColumn('packages', 'updated_at', 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

  // Mark existing paid plans as monthly subscriptions
  await db.query(
    `UPDATE packages SET is_subscription = 1, billing_interval = 'month'
     WHERE id != 'Free' AND price > 0`
  );

  await db.query(`
    CREATE TABLE IF NOT EXISTS user_subscriptions (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      package_id VARCHAR(50) NOT NULL,
      stripe_customer_id VARCHAR(255) NULL,
      stripe_subscription_id VARCHAR(255) NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'active',
      current_period_start DATETIME NULL,
      current_period_end DATETIME NULL,
      cancel_at_period_end TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_user_subscription (user_id),
      INDEX idx_sub_stripe (stripe_subscription_id),
      INDEX idx_sub_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await ensureColumn('invoices', 'stripe_subscription_id', 'VARCHAR(255) NULL');
  await ensureColumn('invoices', 'stripe_invoice_id', 'VARCHAR(255) NULL');
  await ensureColumn('invoices', 'billing_reason', "VARCHAR(50) NULL DEFAULT 'initial'");
  await ensureColumn('invoices', 'razorpay_payment_id', 'VARCHAR(255) NULL');
  await ensureColumn('user_subscriptions', 'razorpay_subscription_id', 'VARCHAR(255) NULL');
  await ensureColumn('user_subscriptions', 'payment_provider', "VARCHAR(20) NULL DEFAULT 'stripe'");

  // Ensure Free plan exists (signup grant reference)
  const [freeRows] = await db.query(`SELECT id FROM packages WHERE id = 'Free' LIMIT 1`);
  if (freeRows.length === 0) {
    await db.query(
      `INSERT INTO packages (id, name, lead_limit, price, description, features, is_active)
       VALUES ('Free', 'Free Trial', 5, 0, 'Signup free credits', '["5 free lead unlocks"]', 0)`
    );
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS api_usage_daily (
      provider VARCHAR(64) NOT NULL,
      usage_date DATE NOT NULL,
      success_count INT UNSIGNED NOT NULL DEFAULT 0,
      error_count INT UNSIGNED NOT NULL DEFAULT 0,
      total_ms BIGINT UNSIGNED NOT NULL DEFAULT 0,
      call_count INT UNSIGNED NOT NULL DEFAULT 0,
      PRIMARY KEY (provider, usage_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      subject VARCHAR(255) NOT NULL,
      category VARCHAR(100) NOT NULL DEFAULT 'general',
      status VARCHAR(50) NOT NULL DEFAULT 'open',
      priority VARCHAR(50) NOT NULL DEFAULT 'normal',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_tickets_user (user_id),
      INDEX idx_tickets_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS support_messages (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      ticket_id INT UNSIGNED NOT NULL,
      sender_id INT UNSIGNED NOT NULL,
      sender_role VARCHAR(20) NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_messages_ticket (ticket_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS marketing_inquiries (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      company VARCHAR(160) NULL,
      email VARCHAR(190) NOT NULL,
      phone VARCHAR(40) NULL,
      country VARCHAR(80) NULL,
      intent VARCHAR(40) NOT NULL DEFAULT 'demo',
      message TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_inquiries_created (created_at),
      INDEX idx_inquiries_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Ensure techx admin role if account exists
  await db.query(
    `UPDATE users SET role = 'super_admin'
     WHERE email = 'admin@techxsolutions.com'
       AND (role IS NULL OR role = '' OR role = 'solar_company')`
  );

  console.log('[Schema] Migration complete');
}
