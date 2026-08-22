import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

describe('CRM OAuth setup helpers', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    delete process.env.CRM_OAUTH_PUBLIC_URL;
    delete process.env.HUBSPOT_CLIENT_ID;
    delete process.env.HUBSPOT_CLIENT_SECRET;
    delete process.env.SALESFORCE_CLIENT_ID;
    delete process.env.SALESFORCE_CLIENT_SECRET;
    process.env.NODE_ENV = 'development';
    process.env.PORT = '5002';
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('defaults OAuth public base to localhost in development', async () => {
    const { getCrmOAuthPublicBase } = await import('../services/crm/crmConnections.js');
    assert.equal(getCrmOAuthPublicBase(), 'http://localhost:5002');
  });

  it('uses CRM_OAUTH_PUBLIC_URL when set', async () => {
    process.env.CRM_OAUTH_PUBLIC_URL = 'https://api.example.com';
    process.env.HUBSPOT_CLIENT_ID = '';
    process.env.HUBSPOT_CLIENT_SECRET = '';
    const { getCrmOAuthPublicBase, getCrmSetupStatus } = await import('../services/crm/crmConnections.js');
    assert.equal(getCrmOAuthPublicBase(), 'https://api.example.com');
    const setup = getCrmSetupStatus(true);
    assert.equal(setup.hubspotRedirectUri, 'https://api.example.com/api/crm/integrations/callback/hubspot');
    assert.equal(setup.ready, false);
    assert.ok(setup.missingEnv.includes('HUBSPOT_CLIENT_ID'));
  });

  it('marks ready when HubSpot credentials are configured', async () => {
    process.env.HUBSPOT_CLIENT_ID = 'abc123';
    process.env.HUBSPOT_CLIENT_SECRET = 'secret456';
    const { getCrmSetupStatus, isHubSpotConfigured } = await import('../services/crm/crmConnections.js');
    assert.equal(isHubSpotConfigured(), true);
    assert.equal(getCrmSetupStatus().ready, true);
    assert.equal(getCrmSetupStatus().hubspotConfigured, true);
  });
});
