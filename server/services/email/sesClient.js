/**
 * Amazon SES v2 send helper (platform-managed outbound mail).
 */
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { BRAND_NOREPLY } from '../../config/brand.js';

let client = null;

function isKeyValid(key) {
  return key && String(key).trim() !== '' && !String(key).toLowerCase().includes('your_');
}

export function isSesConfigured() {
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
  const key = process.env.AWS_ACCESS_KEY_ID;
  const secret = process.env.AWS_SECRET_ACCESS_KEY;
  return Boolean(
    isKeyValid(region) && isKeyValid(key) && isKeyValid(secret),
  );
}

function getClient() {
  if (!client) {
    client = new SESv2Client({
      region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1',
    });
  }
  return client;
}

export function getSesFromAddress() {
  return (
    process.env.SES_FROM_EMAIL ||
    process.env.OUTREACH_FROM_EMAIL ||
    BRAND_NOREPLY
  );
}

/**
 * @param {{ to: string, subject: string, body: string, html?: string, replyTo?: string }} opts
 */
export async function sendViaSes({ to, subject, body, html, replyTo }) {
  if (!isSesConfigured()) {
    const err = new Error('Amazon SES is not configured');
    err.code = 'SES_NOT_CONFIGURED';
    throw err;
  }

  const from = getSesFromAddress();
  const content = {
    Simple: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: {
        Text: { Data: body || '', Charset: 'UTF-8' },
      },
    },
  };
  if (html) {
    content.Simple.Body.Html = { Data: html, Charset: 'UTF-8' };
  }

  const input = {
    FromEmailAddress: from,
    Destination: { ToAddresses: [to] },
    Content: content,
  };

  const configSet = (process.env.SES_CONFIGURATION_SET || '').trim();
  if (configSet) {
    input.ConfigurationSetName = configSet;
  }
  if (replyTo) {
    input.ReplyToAddresses = [replyTo];
  }

  const result = await getClient().send(new SendEmailCommand(input));
  return {
    ok: true,
    id: result.MessageId || `ses_${Date.now()}`,
    simulated: false,
    provider: 'ses',
  };
}
