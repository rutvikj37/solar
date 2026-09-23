/**
 * Professional HTML + plain-text templates for auth transactional email.
 */
import {
  BRAND_DISPLAY,
  BRAND_EMAIL,
  BRAND_MONOGRAM,
  BRAND_NAME,
  BRAND_TAGLINE,
  BRAND_URL,
} from '../../config/brand.js';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function firstName(name) {
  const raw = String(name || '').trim();
  if (!raw) return 'there';
  return raw.split(/\s+/)[0];
}

/**
 * Shared branded shell — table layout for email clients.
 * Colors: deep slate + warm solar amber (not purple).
 */
function wrapAuthEmail({ preheader, title, greeting, paragraphs, ctaLabel, ctaUrl, footnote }) {
  const safeTitle = escapeHtml(title);
  const safeGreeting = escapeHtml(greeting);
  const safeCta = escapeHtml(ctaLabel);
  const safeUrl = escapeHtml(ctaUrl);
  const safePreheader = escapeHtml(preheader);
  const bodyParas = (paragraphs || [])
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3f4654;">${escapeHtml(p)}</p>`,
    )
    .join('');
  const safeFoot = escapeHtml(footnote || '');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background:#eef1f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safePreheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e6ee;box-shadow:0 8px 28px rgba(15,23,42,0.06);">
          <tr>
            <td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:28px 32px;text-align:center;">
              <div style="display:inline-block;width:44px;height:44px;line-height:44px;border-radius:12px;background:#f59e0b;color:#0f172a;font-weight:700;font-size:15px;letter-spacing:0.04em;">${escapeHtml(BRAND_MONOGRAM)}</div>
              <div style="margin-top:14px;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">${escapeHtml(BRAND_NAME)}<span style="color:#fbbf24;">.com</span></div>
              <div style="margin-top:6px;font-size:12px;color:#94a3b8;letter-spacing:0.04em;text-transform:uppercase;">${escapeHtml(BRAND_TAGLINE)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 32px 28px;">
              <h1 style="margin:0 0 8px;font-size:22px;line-height:1.3;color:#0f172a;font-weight:700;">${safeTitle}</h1>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#3f4654;">Hi ${safeGreeting},</p>
              ${bodyParas}
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;">
                <tr>
                  <td align="center" style="border-radius:10px;background:#f59e0b;">
                    <a href="${safeUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#0f172a;text-decoration:none;border-radius:10px;">${safeCta}</a>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:12px;line-height:1.55;color:#64748b;">
                Or paste this link into your browser:<br />
                <a href="${safeUrl}" style="color:#b45309;word-break:break-all;">${safeUrl}</a>
              </p>
              ${
                safeFoot
                  ? `<p style="margin:24px 0 0;padding-top:20px;border-top:1px solid #e8ecf2;font-size:12px;line-height:1.55;color:#64748b;">${safeFoot}</p>`
                  : ''
              }
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px 24px;background:#f8fafc;border-top:1px solid #e8ecf2;text-align:center;">
              <p style="margin:0;font-size:11px;line-height:1.5;color:#94a3b8;">
                © ${new Date().getFullYear()} ${escapeHtml(BRAND_DISPLAY)} ·
                <a href="${escapeHtml(BRAND_URL)}" style="color:#64748b;text-decoration:none;">${escapeHtml(BRAND_URL.replace(/^https?:\/\//, ''))}</a>
                · <a href="mailto:${escapeHtml(BRAND_EMAIL)}" style="color:#64748b;text-decoration:none;">${escapeHtml(BRAND_EMAIL)}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return html;
}

export function buildPasswordResetEmail({ name, resetUrl }) {
  const who = firstName(name);
  const subject = `Reset your ${BRAND_DISPLAY} password`;
  const text = [
    `Hi ${who},`,
    '',
    `We received a request to reset the password for your ${BRAND_DISPLAY} account.`,
    '',
    `Reset your password (link expires in 2 hours):`,
    resetUrl,
    '',
    `If you did not request this, you can ignore this email — your password will stay the same.`,
    '',
    `If you signed in with Google before, you can keep using Google, or set a password with this link to also sign in with email.`,
    '',
    `— ${BRAND_DISPLAY}`,
    BRAND_URL,
  ].join('\n');

  const html = wrapAuthEmail({
    preheader: `Reset your ${BRAND_DISPLAY} password — link expires in 2 hours.`,
    title: 'Reset your password',
    greeting: who,
    paragraphs: [
      `We received a request to reset the password for your ${BRAND_DISPLAY} account.`,
      'Click the button below to choose a new password. This link expires in 2 hours for your security.',
      'If you usually sign in with Google, you can keep using Google — or set a password here to also sign in with email.',
    ],
    ctaLabel: 'Reset password',
    ctaUrl: resetUrl,
    footnote:
      'Didn’t request this? You can safely ignore this email. Your password will not change.',
  });

  return { subject, text, html };
}

export function buildEmailVerificationEmail({ name, verifyUrl }) {
  const who = firstName(name);
  const subject = `Verify your ${BRAND_DISPLAY} account`;
  const text = [
    `Hi ${who},`,
    '',
    `Welcome to ${BRAND_DISPLAY}. Please verify your email to activate your account:`,
    verifyUrl,
    '',
    `This link expires in 48 hours.`,
    '',
    `— ${BRAND_DISPLAY}`,
    BRAND_URL,
  ].join('\n');

  const html = wrapAuthEmail({
    preheader: `Verify your ${BRAND_DISPLAY} email to finish setting up your account.`,
    title: 'Verify your email',
    greeting: who,
    paragraphs: [
      `Welcome to ${BRAND_DISPLAY}. Confirm your email address to activate your account and start managing solar leads.`,
      'This verification link expires in 48 hours.',
    ],
    ctaLabel: 'Verify email',
    ctaUrl: verifyUrl,
    footnote: 'If you did not create an account, you can ignore this email.',
  });

  return { subject, text, html };
}

export function buildTeamInvitationEmail({ name, email, inviterName, companyName, roleName, acceptUrl }) {
  const who = name ? firstName(name) : 'there';
  const orgName = companyName || (inviterName ? `${inviterName}'s Workspace` : 'our Workspace');
  const roleDisplay = roleName ? roleName.replace(/_/g, ' ') : 'Team Member';
  const subject = `You've been invited to join ${orgName} on ${BRAND_DISPLAY}`;
  
  const text = [
    `Hi ${who},`,
    '',
    `${inviterName || 'An administrator'} has invited you to join ${orgName} on ${BRAND_DISPLAY} as a ${roleDisplay}.`,
    '',
    `To accept your invitation, activate your account, and set your password, visit:`,
    acceptUrl,
    '',
    `This invitation link is valid for 7 days.`,
    '',
    `— The ${BRAND_DISPLAY} Team`,
    BRAND_URL,
  ].join('\n');

  const html = wrapAuthEmail({
    preheader: `You have been invited to join ${orgName} as ${roleDisplay} on ${BRAND_DISPLAY}.`,
    title: `You're invited to join ${orgName}`,
    greeting: who,
    paragraphs: [
      `${inviterName || 'A team administrator'} has invited you to collaborate in ${orgName} on ${BRAND_DISPLAY} with the role of ${roleDisplay}.`,
      'Accept your invitation now to set your secure password and access live solar pipeline intelligence, maps, and proposals.',
      'This invitation link expires in 7 days.',
    ],
    ctaLabel: 'Accept Invitation & Set Password',
    ctaUrl: acceptUrl,
    footnote: 'If you were not expecting this invitation, you can safely ignore this message.',
  });

  return { subject, text, html };
}

