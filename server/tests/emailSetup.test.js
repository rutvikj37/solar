import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

describe('Email OAuth setup helpers', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    delete process.env.EMAIL_OAUTH_PUBLIC_URL;
    delete process.env.GOOGLE_MAIL_CLIENT_ID;
    delete process.env.GOOGLE_MAIL_CLIENT_SECRET;
    delete process.env.MICROSOFT_MAIL_CLIENT_ID;
    delete process.env.MICROSOFT_MAIL_CLIENT_SECRET;
    process.env.NODE_ENV = 'development';
    process.env.PORT = '5002';
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('defaults OAuth public base to localhost in development', async () => {
    const { getEmailOAuthPublicBase } = await import('../services/email/userEmailConnections.js');
    assert.equal(getEmailOAuthPublicBase(), 'http://localhost:5002');
  });

  it('uses EMAIL_OAUTH_PUBLIC_URL when set', async () => {
    process.env.EMAIL_OAUTH_PUBLIC_URL = 'https://api.example.com';
    const { getEmailOAuthPublicBase, getEmailSetupStatus } = await import('../services/email/userEmailConnections.js');
    assert.equal(getEmailOAuthPublicBase(), 'https://api.example.com');
    const setup = getEmailSetupStatus(true);
    assert.equal(setup.gmailRedirectUri, 'https://api.example.com/api/email/integrations/callback/gmail');
    assert.equal(setup.ready, false);
    assert.ok(setup.missingEnv.includes('GOOGLE_MAIL_CLIENT_ID'));
  });

  it('marks ready when Gmail credentials are configured', async () => {
    process.env.GOOGLE_MAIL_CLIENT_ID = 'google-id';
    process.env.GOOGLE_MAIL_CLIENT_SECRET = 'google-secret';
    const { getEmailSetupStatus } = await import('../services/email/userEmailConnections.js');
    const { isGmailOAuthConfigured } = await import('../services/email/platformEmailSettings.js');
    assert.equal(isGmailOAuthConfigured(), true);
    assert.equal(getEmailSetupStatus().ready, true);
    assert.equal(getEmailSetupStatus().gmailConfigured, true);
  });
});
