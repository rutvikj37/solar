import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  CRM_PROVIDERS,
  listUserCrmConnections,
  disconnectProvider,
  createOAuthState,
  consumeOAuthState,
  isHubSpotConfigured,
  isSalesforceConfigured,
  oauthSuccessRedirect,
  oauthErrorRedirect,
} from '../services/crm/crmConnections.js';
import { ensurePlatformCrmSettingsLoaded } from '../services/crm/platformCrmSettings.js';
import { getHubSpotAuthorizeUrl, completeHubSpotOAuth } from '../services/crm/hubspotService.js';
import {
  getSalesforceAuthorizeUrl,
  completeSalesforceOAuth,
} from '../services/crm/salesforceService.js';
import { pushLeadToCrm, pushBulkLeadsToCrm } from '../services/crm/pushLead.js';

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const data = await listUserCrmConnections(req.user.id);
    res.json(data);
  } catch (err) {
    console.error('CRM integrations list error:', err);
    res.status(500).json({ error: 'Failed to load CRM integrations' });
  }
});

router.get('/connect/hubspot', authenticateToken, async (req, res) => {
  try {
    await ensurePlatformCrmSettingsLoaded();
    if (!isHubSpotConfigured()) {
      return res.status(503).json({ error: 'HubSpot OAuth is not configured on this server' });
    }
    const state = await createOAuthState(req.user.id, 'hubspot', req.query.returnTo);
    res.json({ authorizeUrl: getHubSpotAuthorizeUrl(state) });
  } catch (err) {
    console.error('HubSpot connect error:', err);
    res.status(500).json({ error: 'Failed to start HubSpot connection' });
  }
});

router.get('/connect/salesforce', authenticateToken, async (req, res) => {
  try {
    await ensurePlatformCrmSettingsLoaded();
    if (!isSalesforceConfigured()) {
      return res.status(503).json({ error: 'Salesforce OAuth is not configured on this server' });
    }
    const state = await createOAuthState(req.user.id, 'salesforce', req.query.returnTo);
    res.json({ authorizeUrl: getSalesforceAuthorizeUrl(state) });
  } catch (err) {
    console.error('Salesforce connect error:', err);
    res.status(500).json({ error: 'Failed to start Salesforce connection' });
  }
});

router.get('/callback/hubspot', async (req, res) => {
  let returnTo = null;
  try {
    const { code, state, error: oauthError } = req.query;
    if (oauthError) {
      return res.redirect(oauthErrorRedirect(String(oauthError), returnTo));
    }
    if (!code || !state) {
      return res.redirect(oauthErrorRedirect('Missing OAuth code or state', returnTo));
    }
    const row = await consumeOAuthState(String(state));
    returnTo = row?.return_to || null;
    if (!row || row.provider !== 'hubspot') {
      return res.redirect(oauthErrorRedirect('Invalid or expired OAuth state', returnTo));
    }
    await completeHubSpotOAuth(row.user_id, String(code));
    res.redirect(oauthSuccessRedirect('hubspot', row.return_to));
  } catch (err) {
    console.error('HubSpot callback error:', err);
    res.redirect(oauthErrorRedirect(err.message || 'HubSpot connection failed', returnTo));
  }
});

router.get('/callback/salesforce', async (req, res) => {
  let returnTo = null;
  try {
    const { code, state, error: oauthError } = req.query;
    if (oauthError) {
      return res.redirect(oauthErrorRedirect(String(oauthError), returnTo));
    }
    if (!code || !state) {
      return res.redirect(oauthErrorRedirect('Missing OAuth code or state', returnTo));
    }
    const row = await consumeOAuthState(String(state));
    returnTo = row?.return_to || null;
    if (!row || row.provider !== 'salesforce') {
      return res.redirect(oauthErrorRedirect('Invalid or expired OAuth state', returnTo));
    }
    await completeSalesforceOAuth(row.user_id, String(code));
    res.redirect(oauthSuccessRedirect('salesforce', row.return_to));
  } catch (err) {
    console.error('Salesforce callback error:', err);
    res.redirect(oauthErrorRedirect(err.message || 'Salesforce connection failed', returnTo));
  }
});

router.delete('/:provider', authenticateToken, async (req, res) => {
  try {
    const { provider } = req.params;
    if (!CRM_PROVIDERS.includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider' });
    }
    await disconnectProvider(req.user.id, provider);
    res.json({ success: true, message: `${provider} disconnected.` });
  } catch (err) {
    console.error('CRM disconnect error:', err);
    res.status(500).json({ error: 'Failed to disconnect CRM' });
  }
});

router.post('/push-bulk', authenticateToken, async (req, res) => {
  try {
    const { provider, leadIds } = req.body;
    if (!CRM_PROVIDERS.includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider. Use hubspot or salesforce.' });
    }
    const result = await pushBulkLeadsToCrm({
      userId: req.user.id,
      role: req.user.role,
      leadIds,
      provider,
    });
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('CRM bulk push error:', err);
    res.status(status).json({ error: err.message || 'CRM bulk push failed' });
  }
});

router.post('/push/:leadId', authenticateToken, async (req, res) => {
  try {
    const { provider } = req.body;
    if (!CRM_PROVIDERS.includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider. Use hubspot or salesforce.' });
    }
    const result = await pushLeadToCrm({
      userId: req.user.id,
      role: req.user.role,
      leadId: req.params.leadId,
      provider,
    });
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('CRM push error:', err);
    res.status(status).json({ error: err.message || 'CRM push failed' });
  }
});

export default router;
