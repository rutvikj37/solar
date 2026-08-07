/**
 * Twilio Voice Service — outbound call initiation, TwiML generation,
 * recording management, warm transfer, and webhook helpers.
 */
import { trackedFetch } from '../apiUsage.js';

const isKeyValid = (k) => k && k.trim() !== '' && !k.toLowerCase().includes('your_');

function getTwilioCreds() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  return { sid, token, from, live: isKeyValid(sid) && isKeyValid(token) && isKeyValid(from) };
}

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Place an outbound call via Twilio REST API.
 */
export async function initiateOutboundCall(toNumber, statusCallbackUrl, options = {}) {
  const { sid, token, from, live } = getTwilioCreds();

  if (!live) {
    const mockSid = `CAsim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[Twilio-SIM] Simulated outbound call to ${toNumber} → ${mockSid}`);
    return { ok: true, callSid: mockSid, simulated: true };
  }

  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const params = new URLSearchParams({
    To: toNumber,
    From: options.callerId || from,
    StatusCallback: statusCallbackUrl,
    StatusCallbackMethod: 'POST',
    Record: options.record !== false ? 'true' : 'false',
    RecordingStatusCallback: options.recordingCallbackUrl || '',
    RecordingStatusCallbackMethod: 'POST',
    Timeout: String(options.timeout || 30),
    MachineDetection: 'DetectMessageEnd',
    MachineDetectionTimeout: '5',
    AsyncAmd: 'true',
  });

  if (options.amdStatusCallbackUrl) {
    params.set('AsyncAmdStatusCallback', options.amdStatusCallbackUrl);
    params.set('AsyncAmdStatusCallbackMethod', 'POST');
  }

  params.append('StatusCallbackEvent', 'initiated');
  params.append('StatusCallbackEvent', 'ringing');
  params.append('StatusCallbackEvent', 'answered');
  params.append('StatusCallbackEvent', 'completed');

  if (options.twiml) {
    params.set('Twiml', options.twiml);
  } else if (options.url) {
    params.set('Url', options.url);
  }

  try {
    const response = await trackedFetch(
      'twilio',
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      console.warn('[Twilio API Warning]', data.message || response.statusText, '— Falling back to simulation mode.');
      const mockSid = `CAsim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      return { ok: true, callSid: mockSid, simulated: true, warning: data.message };
    }

    return { ok: true, callSid: data.sid, simulated: false };
  } catch (err) {
    console.warn('[Twilio API Error]', err.message, '— Falling back to simulation mode.');
    const mockSid = `CAsim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return { ok: true, callSid: mockSid, simulated: true, warning: err.message };
  }
}

export function generateMediaStreamTwiML(websocketUrl, callRecordId) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${websocketUrl}">
      <Parameter name="callRecordId" value="${callRecordId}" />
    </Stream>
  </Connect>
</Response>`;
}

export function generateVoicemailTwiML(voicemailText, audioUrl = null) {
  if (audioUrl) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${escapeXml(audioUrl)}</Play>
  <Hangup/>
</Response>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${escapeXml(voicemailText)}</Say>
  <Hangup/>
</Response>`;
}

export function generateWarmTransferTwiML(transferTo, announceText) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${escapeXml(announceText || 'Please hold while I connect you with a specialist.')}</Say>
  <Dial>${escapeXml(transferTo)}</Dial>
</Response>`;
}

/**
 * Redirect an in-progress call to new TwiML (used for AMD voicemail + warm transfer).
 */
export async function updateCallTwiml(callSid, twiml) {
  const { sid, token, live } = getTwilioCreds();
  if (!live || !callSid) return { ok: true, simulated: true };

  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const response = await trackedFetch(
    'twilio',
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls/${callSid}.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ Twiml: twiml }).toString(),
    }
  );
  return { ok: response.ok, simulated: false };
}

export async function warmTransferCall(callSid, transferTo, options = {}) {
  if (!callSid || !transferTo) return { ok: false, error: 'missing_params' };
  const twiml = generateWarmTransferTwiML(transferTo, options.announceText);
  return updateCallTwiml(callSid, twiml);
}

export async function getRecordingUrl(callSid) {
  const { sid, token, live } = getTwilioCreds();
  if (!live) return null;

  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls/${callSid}/Recordings.json`,
    { headers: { Authorization: `Basic ${auth}` } }
  );
  const data = await response.json();
  if (data.recordings && data.recordings.length > 0) {
    const rec = data.recordings[0];
    return `https://api.twilio.com/2010-04-01/Accounts/${sid}/Recordings/${rec.sid}.mp3`;
  }
  return null;
}

export async function endCall(callSid) {
  const { sid, token, live } = getTwilioCreds();
  if (!live) return { ok: true, simulated: true };
  if (!callSid) return { ok: false, error: 'missing_call_sid' };

  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const response = await trackedFetch(
    'twilio',
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls/${callSid}.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ Status: 'completed' }).toString(),
    }
  );
  return { ok: response.ok, simulated: false };
}
