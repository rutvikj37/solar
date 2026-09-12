import db from "./db.js";

async function columnExists(table, column) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  return rows[0].cnt > 0;
}

async function ensureColumn(table, column, definition) {
  if (!(await columnExists(table, column))) {
    await db.query(
      `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`,
    );
    console.log(`[Schema] Added ${table}.${column}`);
  }
}

export async function migrateSchema() {
  console.log("[Schema] Ensuring Tier-1 tables and columns...");

  await ensureColumn("leads", "notes", "TEXT NULL");
  await ensureColumn("leads", "assigned_to", "INT UNSIGNED NULL");
  await ensureColumn(
    "leads",
    "updated_at",
    "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
  );
  await ensureColumn("leads", "solar_json", "LONGTEXT NULL");
  await ensureColumn("leads", "property_json", "LONGTEXT NULL");
  await ensureColumn("leads", "image_url", "VARCHAR(1024) NULL");
  await ensureColumn(
    "users",
    "account_status",
    "VARCHAR(50) NOT NULL DEFAULT 'active'",
  );
  await ensureColumn("users", "stripe_customer_id", "VARCHAR(255) NULL");
  await ensureColumn("users", "firebase_uid", "VARCHAR(128) NULL");
  await ensureColumn("users", "auth_provider", "VARCHAR(50) NULL");
  await ensureColumn("users", "job_title", "VARCHAR(255) NULL");
  await ensureColumn("users", "lead_volume", "VARCHAR(100) NULL");
  await ensureColumn("users", "email_verified", "TINYINT(1) NOT NULL DEFAULT 1");
  await ensureColumn("users", "email_verification_token", "VARCHAR(128) NULL");
  await ensureColumn("users", "email_verification_expires", "DATETIME NULL");
  await ensureColumn("users", "password_reset_token", "VARCHAR(128) NULL");
  await ensureColumn("users", "password_reset_expires", "DATETIME NULL");
  await ensureColumn("users", "developer_api_key", "VARCHAR(64) NULL");

  // OAuth users may not have a local password
  try {
    await db.query(
      "ALTER TABLE users MODIFY COLUMN password_hash VARCHAR(255) NULL",
    );
  } catch (err) {
    console.error("[Schema] password_hash nullable migration:", err.message);
  }

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
  const [pkgRows] = await db.query("SELECT COUNT(*) AS cnt FROM packages");
  if (pkgRows[0].cnt === 0) {
    await db.query(
      `INSERT INTO packages (id, name, lead_limit, price, description, features, is_active, is_subscription, billing_interval) VALUES
       ('Starter', 'Starter', 20, 499.00, 'Essential monthly plan', '["20 High-Intent Leads/month","Basic Address Verification","CSV Download"]', 1, 1, 'month'),
       ('Growth', 'Growth', 50, 1199.00, 'Performance monthly plan', '["50 Verified Leads/month","Roof Analysis","Direct API Push"]', 1, 1, 'month'),
       ('Enterprise', 'Enterprise', 100, 2249.00, 'Scale monthly plan', '["100 Premium Leads/month","Bulk Area Scan","Priority Support"]', 1, 1, 'month')`,
    );
    console.log("[Schema] Seeded packages catalog");
  }

  // Packages: admin-managed plan columns
  await ensureColumn("packages", "is_active", "TINYINT(1) NOT NULL DEFAULT 1");
  await ensureColumn("packages", "stripe_price_id", "VARCHAR(255) NULL");
  await ensureColumn("packages", "razorpay_plan_id", "VARCHAR(255) NULL");
  await ensureColumn(
    "packages",
    "billing_interval",
    "VARCHAR(20) NOT NULL DEFAULT 'month'",
  );
  await ensureColumn(
    "packages",
    "is_subscription",
    "TINYINT(1) NOT NULL DEFAULT 1",
  );
  await ensureColumn(
    "packages",
    "created_at",
    "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP",
  );
  await ensureColumn(
    "packages",
    "updated_at",
    "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
  );

  // Mark existing paid plans as monthly subscriptions
  await db.query(
    `UPDATE packages SET is_subscription = 1, billing_interval = 'month'
     WHERE id != 'Free' AND price > 0`,
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

  await ensureColumn("invoices", "stripe_subscription_id", "VARCHAR(255) NULL");
  await ensureColumn("invoices", "stripe_invoice_id", "VARCHAR(255) NULL");
  await ensureColumn(
    "invoices",
    "billing_reason",
    "VARCHAR(50) NULL DEFAULT 'initial'",
  );
  await ensureColumn("invoices", "razorpay_payment_id", "VARCHAR(255) NULL");
  await ensureColumn("invoices", "description", "TEXT NULL");
  await ensureColumn("invoices", "admin_id", "INT UNSIGNED NULL");
  await ensureColumn(
    "user_subscriptions",
    "razorpay_subscription_id",
    "VARCHAR(255) NULL",
  );
  await ensureColumn(
    "user_subscriptions",
    "payment_provider",
    "VARCHAR(20) NULL DEFAULT 'stripe'",
  );

  // Ensure Free plan exists (signup grant reference)
  const [freeRows] = await db.query(
    `SELECT id FROM packages WHERE id = 'Free' LIMIT 1`,
  );
  if (freeRows.length === 0) {
    await db.query(
      `INSERT INTO packages (id, name, lead_limit, price, description, features, is_active)
       VALUES ('Free', 'Free Trial', 5, 0, 'Signup free credits', '["5 free lead unlocks"]', 0)`,
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

  // Legacy support_tickets may only have subject/message/status — align columns
  await ensureColumn(
    "support_tickets",
    "category",
    "VARCHAR(100) NOT NULL DEFAULT 'general'",
  );
  await ensureColumn(
    "support_tickets",
    "priority",
    "VARCHAR(50) NOT NULL DEFAULT 'normal'",
  );
  await ensureColumn(
    "support_tickets",
    "updated_at",
    "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
  );
  // Older schema required message inline; new flow stores body in support_messages
  try {
    await db.query(
      "ALTER TABLE support_tickets MODIFY COLUMN message TEXT NULL",
    );
  } catch (err) {
    // Column may not exist on fresh installs
    if (!/Unknown column|check that.+exists/i.test(err.message || "")) {
      console.error(
        "[Schema] support_tickets.message nullable migration:",
        err.message,
      );
    }
  }

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
    CREATE TABLE IF NOT EXISTS support_attachments (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      ticket_id INT UNSIGNED NOT NULL,
      message_id INT UNSIGNED NULL,
      filename VARCHAR(255) NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(120) NOT NULL,
      size INT UNSIGNED NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_attachments_ticket (ticket_id),
      INDEX idx_attachments_message (message_id)
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

  await db.query(`
    CREATE TABLE IF NOT EXISTS user_filter_presets (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      name VARCHAR(100) NOT NULL,
      filters_json TEXT NOT NULL,
      is_default TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_presets_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS drip_campaigns (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      name VARCHAR(100) NOT NULL,
      status ENUM('active', 'paused') NOT NULL DEFAULT 'active',
      trigger_min_score INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_drip_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS drip_steps (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      campaign_id INT UNSIGNED NOT NULL,
      step_order INT NOT NULL,
      delay_days INT NOT NULL DEFAULT 0,
      action_type ENUM('sms', 'email', 'ai_call') NOT NULL,
      subject VARCHAR(200) NULL,
      template_content TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_drip_steps_campaign (campaign_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS drip_enrollments (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      campaign_id INT UNSIGNED NOT NULL,
      lead_id INT UNSIGNED NOT NULL,
      current_step INT NOT NULL DEFAULT 1,
      next_run_at TIMESTAMP NULL,
      status ENUM('active', 'completed', 'cancelled') NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_enroll_user_lead (user_id, lead_id),
      INDEX idx_enroll_status_next (status, next_run_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS team_members (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      owner_user_id INT UNSIGNED NOT NULL,
      member_email VARCHAR(190) NOT NULL,
      role ENUM('manager', 'canvasser', 'sales_rep') NOT NULL DEFAULT 'sales_rep',
      status ENUM('pending', 'active') NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_team_owner (owner_user_id),
      INDEX idx_team_email (member_email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Ensure techx admin role if account exists — gated (never auto-promote in production unless explicitly allowed)
  const allowBootstrapSuperAdmin =
    process.env.ALLOW_BOOTSTRAP_SUPER_ADMIN === '1' ||
    process.env.ALLOW_BOOTSTRAP_SUPER_ADMIN === 'true';
  if (allowBootstrapSuperAdmin) {
    await db.query(
      `UPDATE users SET role = 'super_admin'
       WHERE email = 'admin@techxsolutions.com'
         AND (role IS NULL OR role = '' OR role = 'solar_company')`,
    );
  }

  // Ensure indices for performance
  async function ensureIndex(table, indexName, columns) {
    try {
      const [rows] = await db.query(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
        [table, indexName],
      );
      if (rows[0].cnt === 0) {
        await db.query(
          `ALTER TABLE \`${table}\` ADD INDEX \`${indexName}\` (${columns})`,
        );
        console.log(`[Schema] Added index ${indexName} on ${table}`);
      }
    } catch (err) {
      console.error(
        `[Schema] Index creation error (${table}.${indexName}):`,
        err.message,
      );
    }
  }

  await ensureIndex("users", "idx_users_email", "email");
  await ensureIndex("users", "idx_users_firebase_uid", "firebase_uid");
  await ensureIndex("leads", "idx_leads_user_status", "user_id, status");
  await ensureIndex("leads", "idx_leads_user_created", "user_id, created_at");
  await ensureIndex(
    "user_packages",
    "idx_user_packages_user_status",
    "user_id, status",
  );

  await db.query(`
    CREATE TABLE IF NOT EXISTS admin_credit_adjustments (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      admin_id INT UNSIGNED NOT NULL,
      amount INT NOT NULL,
      balance_after INT NOT NULL,
      mode VARCHAR(10) NOT NULL DEFAULT 'add',
      note TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_credit_adj_user (user_id),
      INDEX idx_credit_adj_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      admin_id INT UNSIGNED NULL,
      action VARCHAR(100) NOT NULL,
      target_type VARCHAR(50) NULL,
      target_id INT UNSIGNED NULL,
      details JSON NULL,
      ip_address VARCHAR(45) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_aal_created (created_at),
      INDEX idx_aal_admin (admin_id, created_at),
      INDEX idx_aal_action (action, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // ===== AI CALLING AUTOMATION MODULE TABLES =====

  await db.query(`
    CREATE TABLE IF NOT EXISTS ai_calling_campaigns (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      name VARCHAR(255) NOT NULL,
      status ENUM('draft','active','paused','completed','cancelled') NOT NULL DEFAULT 'draft',
      caller_name VARCHAR(100) NULL,
      business_name VARCHAR(255) NULL,
      twilio_number VARCHAR(20) NULL,
      elevenlabs_voice_id VARCHAR(100) NULL,
      elevenlabs_agent_id VARCHAR(100) NULL,
      timezone VARCHAR(50) NOT NULL DEFAULT 'America/New_York',
      calling_window_start TIME NOT NULL DEFAULT '09:00:00',
      calling_window_end TIME NOT NULL DEFAULT '20:00:00',
      calling_days JSON NULL,
      retry_attempts INT NOT NULL DEFAULT 3,
      retry_delay_minutes INT NOT NULL DEFAULT 60,
      max_call_duration_seconds INT NOT NULL DEFAULT 300,
      appointment_duration_minutes INT NOT NULL DEFAULT 30,
      system_prompt TEXT NULL,
      greeting_script TEXT NULL,
      qualification_questions JSON NULL,
      objection_responses JSON NULL,
      booking_script TEXT NULL,
      closing_script TEXT NULL,
      total_leads INT NOT NULL DEFAULT 0,
      completed_calls INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_ai_camp_user (user_id),
      INDEX idx_ai_camp_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS ai_calling_queue (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      campaign_id INT UNSIGNED NOT NULL,
      lead_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      priority INT NOT NULL DEFAULT 0,
      status ENUM('pending','calling','answered','completed','no_answer',
                  'voicemail','callback','failed','do_not_call') NOT NULL DEFAULT 'pending',
      attempt_count INT NOT NULL DEFAULT 0,
      max_attempts INT NOT NULL DEFAULT 3,
      next_attempt_at DATETIME NULL,
      last_attempt_at DATETIME NULL,
      callback_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_aiq_campaign (campaign_id),
      INDEX idx_aiq_status_next (status, next_attempt_at),
      INDEX idx_aiq_lead (lead_id),
      UNIQUE KEY uniq_campaign_lead (campaign_id, lead_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS ai_call_records (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      campaign_id INT UNSIGNED NULL,
      queue_id INT UNSIGNED NULL,
      lead_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      twilio_call_sid VARCHAR(64) NULL,
      direction ENUM('outbound','inbound') NOT NULL DEFAULT 'outbound',
      status ENUM('initiated','ringing','in_progress','completed',
                  'no_answer','busy','failed','voicemail','transferred') NOT NULL DEFAULT 'initiated',
      disposition ENUM('qualified','not_interested','callback','appointment_booked',
                       'wrong_number','do_not_call','voicemail_left','no_disposition') NOT NULL DEFAULT 'no_disposition',
      duration_seconds INT NOT NULL DEFAULT 0,
      recording_url VARCHAR(1024) NULL,
      recording_sid VARCHAR(64) NULL,
      transcript LONGTEXT NULL,
      ai_summary TEXT NULL,
      ai_notes TEXT NULL,
      sentiment ENUM('positive','neutral','negative','unknown') NOT NULL DEFAULT 'unknown',
      lead_score_delta INT NOT NULL DEFAULT 0,
      qualification_data JSON NULL,
      voice_provider VARCHAR(32) NULL DEFAULT 'openai',
      elevenlabs_agent_id VARCHAR(100) NULL,
      qa_score INT NULL,
      qa_notes JSON NULL,
      started_at DATETIME NULL,
      ended_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_acr_campaign (campaign_id),
      INDEX idx_acr_lead (lead_id),
      INDEX idx_acr_user_date (user_id, created_at),
      INDEX idx_acr_twilio (twilio_call_sid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS ai_calling_appointments (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      call_record_id INT UNSIGNED NOT NULL,
      lead_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      appointment_id INT UNSIGNED NULL,
      agency_name VARCHAR(255) NULL,
      agency_zip VARCHAR(10) NULL,
      scheduled_at DATETIME NOT NULL,
      duration_minutes INT NOT NULL DEFAULT 30,
      confirmation_sms_sent TINYINT(1) NOT NULL DEFAULT 0,
      confirmation_email_sent TINYINT(1) NOT NULL DEFAULT 0,
      google_calendar_event_id VARCHAR(255) NULL,
      outlook_event_id VARCHAR(255) NULL,
      invite_link VARCHAR(512) NULL,
      agency_id INT UNSIGNED NULL,
      reminder_24h_sent TINYINT(1) NOT NULL DEFAULT 0,
      reminder_1h_sent TINYINT(1) NOT NULL DEFAULT 0,
      status ENUM('confirmed','cancelled','rescheduled','completed','no_show') NOT NULL DEFAULT 'confirmed',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_aia_lead (lead_id),
      INDEX idx_aia_call (call_record_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS ai_knowledge_base (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      category VARCHAR(100) NOT NULL,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_akb_user_cat (user_id, category)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS ai_calling_settings (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      twilio_phone_number VARCHAR(20) NULL,
      elevenlabs_api_key_encrypted VARCHAR(512) NULL,
      elevenlabs_voice_id VARCHAR(100) NULL,
      elevenlabs_agent_id VARCHAR(100) NULL,
      openai_api_key_encrypted VARCHAR(512) NULL,
      openai_model VARCHAR(50) NOT NULL DEFAULT 'gpt-4o',
      google_calendar_token JSON NULL,
      outlook_calendar_token JSON NULL,
      default_business_name VARCHAR(255) NULL,
      default_caller_name VARCHAR(100) NULL,
      default_timezone VARCHAR(50) NOT NULL DEFAULT 'America/New_York',
      business_hours_start TIME NOT NULL DEFAULT '09:00:00',
      business_hours_end TIME NOT NULL DEFAULT '20:00:00',
      daily_call_limit INT NOT NULL DEFAULT 100,
      concurrent_call_limit INT NOT NULL DEFAULT 5,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_acs_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS ai_solar_agencies (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      name VARCHAR(255) NOT NULL,
      zip_codes JSON NULL,
      states JSON NULL,
      phone VARCHAR(20) NULL,
      email VARCHAR(190) NULL,
      calendar_link VARCHAR(512) NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_asa_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS ai_calling_audit_log (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      action VARCHAR(100) NOT NULL,
      entity_type VARCHAR(50) NULL,
      entity_id INT UNSIGNED NULL,
      details JSON NULL,
      ip_address VARCHAR(45) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_acal_user_date (user_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS ai_voicemail_templates (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      name VARCHAR(100) NOT NULL,
      script TEXT NOT NULL,
      is_default TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_avt_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // AI Calling column upgrades
  await ensureColumn(
    "ai_calling_campaigns",
    "elevenlabs_agent_id",
    "VARCHAR(100) NULL",
  );
  await ensureColumn("ai_calling_campaigns", "goals_json", "JSON NULL");
  await ensureColumn(
    "ai_call_records",
    "voice_provider",
    "VARCHAR(32) NULL DEFAULT 'elevenlabs'",
  );
  await ensureColumn(
    "ai_call_records",
    "elevenlabs_agent_id",
    "VARCHAR(100) NULL",
  );
  await ensureColumn("ai_call_records", "qa_score", "INT NULL");
  await ensureColumn("ai_call_records", "qa_notes", "JSON NULL");
  await ensureColumn("ai_call_records", "stream_token", "VARCHAR(64) NULL");
  await ensureColumn(
    "ai_calling_appointments",
    "reminder_24h_sent",
    "TINYINT(1) NOT NULL DEFAULT 0",
  );
  await ensureColumn(
    "ai_calling_appointments",
    "reminder_1h_sent",
    "TINYINT(1) NOT NULL DEFAULT 0",
  );
  await ensureColumn(
    "ai_calling_appointments",
    "invite_link",
    "VARCHAR(512) NULL",
  );
  await ensureColumn(
    "ai_calling_appointments",
    "agency_id",
    "INT UNSIGNED NULL",
  );

  // Company profile fields on ai_calling_settings
  await ensureColumn("ai_calling_settings", "default_greeting", "TEXT NULL");
  await ensureColumn(
    "ai_calling_settings",
    "transfer_phone",
    "VARCHAR(20) NULL",
  );
  await ensureColumn("ai_calling_settings", "service_zip_codes", "JSON NULL");
  await ensureColumn("ai_calling_settings", "languages", "JSON NULL");
  await ensureColumn("ai_calling_settings", "goals_json", "JSON NULL");
  await ensureColumn(
    "ai_calling_settings",
    "google_calendar_token",
    "JSON NULL",
  );
  await ensureColumn(
    "ai_calling_settings",
    "outlook_calendar_token",
    "JSON NULL",
  );
  await db.query(`
    CREATE TABLE IF NOT EXISTS proposals (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      slug VARCHAR(64) NOT NULL UNIQUE,
      lead_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      company_name VARCHAR(255) NULL DEFAULT 'SpaceToRoof Energy Solutions',
      system_size_kw DECIMAL(6,2) NOT NULL DEFAULT 8.50,
      panel_count INT NOT NULL DEFAULT 20,
      gross_cost DECIMAL(10,2) NOT NULL DEFAULT 25500.00,
      financing_type ENUM('cash', 'loan', 'lease') NOT NULL DEFAULT 'cash',
      loan_term_years INT NOT NULL DEFAULT 20,
      loan_interest_rate DECIMAL(4,2) NOT NULL DEFAULT 5.99,
      down_payment DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      include_itc_30 TINYINT(1) NOT NULL DEFAULT 1,
      state_rebate DECIMAL(10,2) NOT NULL DEFAULT 1000.00,
      battery_type VARCHAR(50) NULL DEFAULT 'none',
      battery_count INT NOT NULL DEFAULT 0,
      battery_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      utility_escalation DECIMAL(4,2) NOT NULL DEFAULT 4.50,
      est_25yr_savings DECIMAL(10,2) NOT NULL DEFAULT 38500.00,
      payback_years DECIMAL(4,1) NOT NULL DEFAULT 6.2,
      status ENUM('draft', 'sent', 'viewed', 'signed', 'rejected') NOT NULL DEFAULT 'sent',
      signed_name VARCHAR(255) NULL,
      signed_email VARCHAR(255) NULL,
      signed_signature_data LONGTEXT NULL,
      signed_at DATETIME NULL,
      viewed_at DATETIME NULL,
      view_count INT UNSIGNED NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_prop_lead (lead_id),
      INDEX idx_prop_user (user_id),
      INDEX idx_prop_slug (slug),
      INDEX idx_prop_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // ===== DRIP AUTOMATION UPGRADES =====
  await ensureColumn(
    "drip_campaigns",
    "enrollment_mode",
    "ENUM('all_leads','score_gated','manual') NOT NULL DEFAULT 'score_gated'",
  );
  await ensureColumn("drip_campaigns", "description", "TEXT NULL");
  await ensureColumn(
    "drip_campaigns",
    "timezone",
    "VARCHAR(50) NOT NULL DEFAULT 'America/New_York'",
  );
  await ensureColumn(
    "drip_campaigns",
    "quiet_hours_start",
    "TIME NOT NULL DEFAULT '09:00:00'",
  );
  await ensureColumn(
    "drip_campaigns",
    "quiet_hours_end",
    "TIME NOT NULL DEFAULT '20:00:00'",
  );
  await ensureColumn(
    "drip_campaigns",
    "stop_on_reply",
    "TINYINT(1) NOT NULL DEFAULT 1",
  );
  await ensureColumn("drip_campaigns", "stop_on_statuses", "JSON NULL");
  await ensureColumn("drip_steps", "delay_hours", "INT NOT NULL DEFAULT 0");

  await db.query(`
    CREATE TABLE IF NOT EXISTS drip_step_executions (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      enrollment_id INT UNSIGNED NOT NULL,
      step_id INT UNSIGNED NOT NULL,
      lead_id INT UNSIGNED NOT NULL,
      channel ENUM('sms','email','ai_call') NOT NULL,
      status ENUM('sent','failed','skipped') NOT NULL,
      error_message TEXT NULL,
      external_id VARCHAR(255) NULL,
      executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_drip_exec_enrollment (enrollment_id),
      INDEX idx_drip_exec_lead (lead_id),
      INDEX idx_drip_exec_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS drip_triggers (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      campaign_id INT UNSIGNED NOT NULL,
      trigger_type ENUM('lead_created','status_change','min_score','has_phone','has_email','territory') NOT NULL,
      trigger_config JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_drip_trigger_campaign (campaign_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  async function ensureUniqueIndex(table, indexName, columns) {
    try {
      const [rows] = await db.query(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
        [table, indexName],
      );
      if (rows[0].cnt === 0) {
        await db.query(
          `ALTER TABLE \`${table}\` ADD UNIQUE INDEX \`${indexName}\` (${columns})`,
        );
        console.log(`[Schema] Added unique index ${indexName} on ${table}`);
      }
    } catch (err) {
      console.error(
        `[Schema] Unique index error (${table}.${indexName}):`,
        err.message,
      );
    }
  }

  await ensureUniqueIndex(
    "drip_enrollments",
    "uniq_campaign_lead",
    "campaign_id, lead_id",
  );
  await ensureUniqueIndex(
    "invoices",
    "uniq_razorpay_payment_id",
    "razorpay_payment_id",
  );
  await ensureUniqueIndex(
    "invoices",
    "uniq_stripe_session_id",
    "stripe_session_id",
  );

  // ── SpaceToRoof Marketplace ──────────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS marketplace_settings (
      id INT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
      default_bid_window_hours INT UNSIGNED NOT NULL DEFAULT 48,
      default_min_bid DECIMAL(12,2) NOT NULL DEFAULT 25.00,
      max_expansion_stages INT UNSIGNED NOT NULL DEFAULT 3,
      expansion_radius_miles_json JSON NULL,
      min_bid_reduction_pct DECIMAL(5,2) NOT NULL DEFAULT 20.00,
      low_price_min_bid DECIMAL(12,2) NOT NULL DEFAULT 10.00,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await db.query(`
    INSERT IGNORE INTO marketplace_settings
      (id, default_bid_window_hours, default_min_bid, max_expansion_stages,
       expansion_radius_miles_json, min_bid_reduction_pct, low_price_min_bid)
    VALUES (1, 48, 25.00, 3, '[25,50,100]', 20.00, 10.00)
  `);
  await db.query(`
    UPDATE marketplace_settings
    SET default_bid_window_hours = 48
    WHERE id = 1 AND default_bid_window_hours = 24
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS marketplace_leads (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      lead_code VARCHAR(32) NOT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'new',
      homeowner_name VARCHAR(255) NOT NULL,
      phone VARCHAR(64) NOT NULL,
      email VARCHAR(255) NOT NULL,
      address VARCHAR(512) NOT NULL,
      zip VARCHAR(20) NULL,
      city VARCHAR(128) NULL,
      state VARCHAR(64) NULL,
      monthly_bill DECIMAL(12,2) NULL,
      bill_range VARCHAR(64) NULL,
      homeowner_status VARCHAR(64) NULL,
      installation_timeline VARCHAR(128) NULL,
      project_details TEXT NULL,
      property_type VARCHAR(64) NULL DEFAULT 'residential',
      opportunity_score INT UNSIGNED NOT NULL DEFAULT 0,
      solar_potential_score INT UNSIGNED NOT NULL DEFAULT 0,
      score_breakdown JSON NULL,
      enrichment_json LONGTEXT NULL,
      estimated_roof_sqft DECIMAL(12,2) NULL,
      estimated_solar_kw DECIMAL(12,2) NULL,
      solar_potential_label VARCHAR(64) NULL,
      existing_solar_likely TINYINT(1) NOT NULL DEFAULT 0,
      bidding_opens_at DATETIME NULL,
      bidding_closes_at DATETIME NULL,
      min_bid DECIMAL(12,2) NOT NULL DEFAULT 25.00,
      expansion_stage INT UNSIGNED NOT NULL DEFAULT 0,
      expansion_radius_miles INT UNSIGNED NOT NULL DEFAULT 25,
      winning_bid_id INT UNSIGNED NULL,
      winner_user_id INT UNSIGNED NULL,
      winning_amount DECIMAL(12,2) NULL,
      unlocked_at DATETIME NULL,
      crm_lead_id INT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_mkt_lead_code (lead_code),
      INDEX idx_mkt_leads_status (status),
      INDEX idx_mkt_leads_zip (zip),
      INDEX idx_mkt_leads_bidding (status, bidding_closes_at),
      INDEX idx_mkt_leads_winner (winner_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS marketplace_bids (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      lead_id INT UNSIGNED NOT NULL,
      installer_user_id INT UNSIGNED NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      status ENUM('active','outbid','won','lost','withdrawn') NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_mkt_bids_lead (lead_id),
      INDEX idx_mkt_bids_installer (installer_user_id),
      INDEX idx_mkt_bids_lead_status (lead_id, status),
      UNIQUE KEY uniq_mkt_bid_active (lead_id, installer_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS installer_profiles (
      user_id INT UNSIGNED NOT NULL PRIMARY KEY,
      company_name VARCHAR(255) NULL,
      verification_status ENUM('pending','verified','rejected','suspended') NOT NULL DEFAULT 'pending',
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_installer_verify (verification_status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS installer_service_areas (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      zip VARCHAR(20) NULL,
      state VARCHAR(64) NULL,
      radius_miles INT UNSIGNED NULL,
      center_lat DECIMAL(10,7) NULL,
      center_lng DECIMAL(10,7) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_isa_user (user_id),
      INDEX idx_isa_zip (zip),
      INDEX idx_isa_state (state)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS marketplace_wallets (
      user_id INT UNSIGNED NOT NULL PRIMARY KEY,
      balance DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS marketplace_wallet_ledger (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      entry_type ENUM('top_up','win_debit','refund','admin_adjust') NOT NULL,
      amount DECIMAL(14,2) NOT NULL,
      balance_after DECIMAL(14,2) NOT NULL,
      lead_id INT UNSIGNED NULL,
      dispute_id INT UNSIGNED NULL,
      admin_id INT UNSIGNED NULL,
      note VARCHAR(512) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_mkt_ledger_user (user_id),
      INDEX idx_mkt_ledger_lead (lead_id),
      INDEX idx_mkt_ledger_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS marketplace_disputes (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      lead_id INT UNSIGNED NOT NULL,
      installer_user_id INT UNSIGNED NOT NULL,
      claim_type ENUM('wrong_number','duplicate','already_has_solar','invalid_property','wrong_property_type') NOT NULL,
      details TEXT NULL,
      status ENUM('pending','approved','denied') NOT NULL DEFAULT 'pending',
      refund_amount DECIMAL(12,2) NULL,
      reviewed_by INT UNSIGNED NULL,
      review_note TEXT NULL,
      reviewed_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_mkt_disputes_lead (lead_id),
      INDEX idx_mkt_disputes_status (status),
      INDEX idx_mkt_disputes_installer (installer_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // ── CRM OAuth integrations (HubSpot / Salesforce) ─────
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_crm_connections (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      provider VARCHAR(32) NOT NULL,
      access_token TEXT NULL,
      refresh_token TEXT NULL,
      token_expires_at DATETIME NULL,
      instance_url VARCHAR(512) NULL,
      portal_id VARCHAR(64) NULL,
      webhook_url VARCHAR(1024) NULL,
      metadata JSON NULL,
      connected_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_user_crm_provider (user_id, provider),
      INDEX idx_user_crm_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS user_crm_oauth_states (
      state VARCHAR(64) NOT NULL PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      provider VARCHAR(32) NOT NULL,
      expires_at DATETIME NOT NULL,
      return_to VARCHAR(512) NULL,
      INDEX idx_crm_oauth_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await ensureColumn('user_crm_oauth_states', 'return_to', 'VARCHAR(512) NULL');

  await db.query(`
    CREATE TABLE IF NOT EXISTS platform_crm_settings (
      id INT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
      hubspot_client_id VARCHAR(255) NULL,
      hubspot_client_secret VARCHAR(512) NULL,
      salesforce_client_id VARCHAR(255) NULL,
      salesforce_client_secret VARCHAR(512) NULL,
      oauth_public_url VARCHAR(512) NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await db.query(`INSERT IGNORE INTO platform_crm_settings (id) VALUES (1)`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS lead_crm_pushes (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      lead_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      provider VARCHAR(32) NOT NULL,
      external_id VARCHAR(128) NULL,
      external_url VARCHAR(512) NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'success',
      error_message TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_lead_crm_pushes_lead (lead_id),
      INDEX idx_lead_crm_pushes_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // ── User email integrations (Gmail / Outlook / SMTP) ───────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS platform_email_settings (
      id INT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
      google_client_id VARCHAR(255) NULL,
      google_client_secret VARCHAR(512) NULL,
      microsoft_client_id VARCHAR(255) NULL,
      microsoft_client_secret VARCHAR(512) NULL,
      oauth_public_url VARCHAR(512) NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await db.query(`INSERT IGNORE INTO platform_email_settings (id) VALUES (1)`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS user_email_connections (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      provider VARCHAR(32) NOT NULL,
      access_token TEXT NULL,
      refresh_token TEXT NULL,
      token_expires_at DATETIME NULL,
      from_email VARCHAR(255) NULL,
      from_name VARCHAR(255) NULL,
      smtp_host VARCHAR(255) NULL,
      smtp_port INT UNSIGNED NULL,
      smtp_secure TINYINT(1) NOT NULL DEFAULT 1,
      smtp_username VARCHAR(255) NULL,
      smtp_password_encrypted TEXT NULL,
      connected_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_user_email (user_id),
      INDEX idx_user_email_provider (provider)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS user_email_oauth_states (
      state VARCHAR(64) NOT NULL PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      provider VARCHAR(32) NOT NULL,
      expires_at DATETIME NOT NULL,
      return_to VARCHAR(512) NULL,
      INDEX idx_email_oauth_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  console.log(
    "[Schema] Migration complete (including AI Calling, Proposals, Drip & Marketplace)",
  );

  await ensureColumn("marketplace_leads", "latitude", "DECIMAL(10,7) NULL");
  await ensureColumn("marketplace_leads", "longitude", "DECIMAL(10,7) NULL");
  await ensureColumn("marketplace_leads", "email_status", "VARCHAR(128) NULL");
  await ensureColumn("marketplace_leads", "phone_type", "VARCHAR(64) NULL");
  await ensureColumn(
    "marketplace_leads",
    "solar_potential_score",
    "INT UNSIGNED NOT NULL DEFAULT 0",
  );
  await ensureColumn("marketplace_leads", "payment_due_at", "DATETIME NULL");
  await ensureColumn("leads", "follow_up_at", "DATETIME NULL");
  await ensureColumn("leads", "next_action", "VARCHAR(255) NULL");
  await ensureColumn("leads", "conversation_notes", "TEXT NULL");

  // ===== PLAN EMAIL QUOTA (SES) =====
  await ensureColumn(
    "packages",
    "email_limit",
    "INT NOT NULL DEFAULT 0",
  );

  // Seed plan email quotas (idempotent updates for known plans)
  await db.query(
    `UPDATE packages SET email_limit = CASE id
       WHEN 'Free' THEN 100
       WHEN 'Starter' THEN 1000
       WHEN 'Growth' THEN 5000
       WHEN 'Enterprise' THEN 25000
       ELSE GREATEST(COALESCE(email_limit, 0), 0)
     END
     WHERE id IN ('Free', 'Starter', 'Growth', 'Enterprise')
       AND (email_limit IS NULL OR email_limit = 0)`,
  );

  await db.query(`
    CREATE TABLE IF NOT EXISTS email_usage_monthly (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      period_key VARCHAR(64) NOT NULL,
      sent_count INT UNSIGNED NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_email_usage_user_period (user_id, period_key),
      INDEX idx_email_usage_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS email_send_log (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      to_email VARCHAR(255) NOT NULL,
      subject VARCHAR(500) NULL,
      source VARCHAR(40) NOT NULL DEFAULT 'other',
      status VARCHAR(40) NOT NULL DEFAULT 'sent',
      ses_message_id VARCHAR(255) NULL,
      error_message VARCHAR(500) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_email_log_user (user_id),
      INDEX idx_email_log_created (created_at),
      INDEX idx_email_log_source (source)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // ===== LEAD CRM: custom pipeline stages + proposal engagement =====
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_pipeline_settings (
      user_id INT UNSIGNED NOT NULL PRIMARY KEY,
      stages_json JSON NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await ensureColumn('proposals', 'sent_at', 'DATETIME NULL');
  await ensureColumn('proposals', 'first_viewed_at', 'DATETIME NULL');
  await ensureColumn(
    'proposals',
    'financing_viewed_at',
    'DATETIME NULL',
  );
  await ensureColumn(
    'proposals',
    'equipment_viewed_at',
    'DATETIME NULL',
  );
  await ensureColumn(
    'proposals',
    'downloaded_at',
    'DATETIME NULL',
  );
  await ensureColumn(
    'proposals',
    'download_count',
    'INT UNSIGNED NOT NULL DEFAULT 0',
  );

  await db.query(`
    CREATE TABLE IF NOT EXISTS proposal_events (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      proposal_id INT UNSIGNED NOT NULL,
      lead_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      event_type VARCHAR(40) NOT NULL,
      session_id VARCHAR(64) NULL,
      meta JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_pe_proposal (proposal_id),
      INDEX idx_pe_lead (lead_id),
      INDEX idx_pe_type (event_type),
      INDEX idx_pe_session (proposal_id, session_id, event_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // ===== LEAD CRM: conversion + source + call outcome =====
  await ensureColumn('leads', 'lead_source', 'VARCHAR(100) NULL');
  await ensureColumn('leads', 'sale_system_size_kw', 'DECIMAL(8,2) NULL');
  await ensureColumn('leads', 'sale_value', 'DECIMAL(12,2) NULL');
  await ensureColumn('leads', 'sale_equipment', 'VARCHAR(255) NULL');
  await ensureColumn('leads', 'sale_financing', 'VARCHAR(100) NULL');
  await ensureColumn('leads', 'sale_closed_at', 'DATETIME NULL');
  await ensureColumn('leads', 'sale_rep_name', 'VARCHAR(255) NULL');
  await ensureColumn('leads', 'call_outcome', 'VARCHAR(40) NULL');
  await ensureColumn('leads', 'outreach_opt_out', 'TINYINT(1) NOT NULL DEFAULT 0');
}
