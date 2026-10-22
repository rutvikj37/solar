import { getUserEmailConnection } from './userEmailConnections.js';
import { sendViaGmail } from './gmailService.js';
import { sendViaOutlook } from './outlookService.js';
import { sendViaSmtp } from './smtpService.js';

export async function sendUserEmail(userId, { to, subject, body, headers = null }) {
  const conn = await getUserEmailConnection(userId);
  if (!conn) {
    const err = new Error('Connect your email in Integrations before sending');
    err.code = 'EMAIL_NOT_CONNECTED';
    throw err;
  }

  const payload = { to, subject, body, headers };
  switch (conn.provider) {
    case 'gmail':
      return sendViaGmail(userId, payload);
    case 'outlook':
      return sendViaOutlook(userId, payload);
    case 'smtp':
      return sendViaSmtp(userId, payload);
    default:
      throw new Error('Unsupported email provider');
  }
}
