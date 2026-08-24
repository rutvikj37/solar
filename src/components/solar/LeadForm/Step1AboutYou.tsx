import { useState } from 'react';
import { API_BASE } from '@/config.js';

type Step1Props = {
  onNext: () => void;
  data: Record<string, unknown>;
  updateData: (patch: Record<string, unknown>) => void;
};

export function Step1AboutYou({ onNext, data, updateData }: Step1Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [emailStatus, setEmailStatus] = useState(
    data.emailVerified ? String(data.emailClassification || 'Verified') : '',
  );
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [info, setInfo] = useState('');

  const firstName = String(data.firstName || '').trim();
  const lastName = String(data.lastName || '').trim();
  const email = String(data.email || '').trim();
  const phone = String(data.phone || '').trim();

  const onEmailChange = (value: string) => {
    setEmailStatus('');
    setOtpSent(false);
    setOtpCode('');
    setInfo('');
    setError('');
    updateData({
      email: value,
      emailVerified: false,
      emailClassification: null,
      phoneVerified: false,
    });
  };

  const onPhoneChange = (value: string) => {
    setOtpSent(false);
    setOtpCode('');
    setInfo('');
    setError('');
    updateData({
      phone: value,
      phoneE164: null,
      phoneVerified: false,
      verifiedPhone: null,
    });
  };

  const runVerifyAndContinue = async () => {
    setError('');
    setInfo('');

    if (!firstName || !lastName) {
      setError('First and last name are required.');
      return;
    }
    if (!email) {
      setError('Email address is required.');
      return;
    }
    if (!phone) {
      setError('Mobile number is required.');
      return;
    }

    setBusy(true);
    try {
      // 1) Verifalia email verification
      const emailRes = await fetch(`${API_BASE}/api/marketplace/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const emailData = await emailRes.json().catch(() => ({}));
      if (!emailRes.ok || !emailData.ok) {
        setEmailStatus('');
        setError(emailData.error || 'Email could not be verified.');
        return;
      }
      setEmailStatus(String(emailData.classification || 'Verified'));
      updateData({ emailVerified: true, emailClassification: emailData.classification });

      // Already verified this phone in-session
      if (data.phoneVerified && data.verifiedPhone === phone) {
        onNext();
        return;
      }

      // 2) Twilio SMS OTP
      const sendRes = await fetch(`${API_BASE}/api/marketplace/verify-phone/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const sendData = await sendRes.json().catch(() => ({}));
      if (!sendRes.ok || !sendData.ok) {
        setError(sendData.error || 'Could not send SMS verification code.');
        return;
      }

      setOtpSent(true);
      setInfo(sendData.message || 'Verification code sent by SMS.');
      updateData({
        phoneE164: sendData.phone,
        ...(sendData.formatted ? { phone: sendData.formatted } : {}),
      });
    } catch (err) {
      console.error('[Step1AboutYou] verify failed:', err);
      setError('Network error while verifying your contact details. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const confirmOtpAndContinue = async () => {
    setError('');
    setInfo('');
    if (!/^\d{6}$/.test(otpCode.trim())) {
      setError('Enter the 6-digit code from your SMS.');
      return;
    }

    setBusy(true);
    try {
      const phoneForConfirm = String(data.phoneE164 || data.phone || '').trim();
      const res = await fetch(`${API_BASE}/api/marketplace/verify-phone/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneForConfirm, code: otpCode.trim() }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.ok) {
        setError(payload.error || 'Incorrect verification code.');
        return;
      }

      updateData({
        phoneVerified: true,
        verifiedPhone: payload.formatted || phone,
        phoneE164: payload.phone,
        phone: payload.formatted || phone,
      });
      setInfo('Mobile number verified.');
      onNext();
    } catch (err) {
      console.error('[Step1AboutYou] OTP confirm failed:', err);
      setError('Network error while confirming your code. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-white mb-4">First, tell us about yourself.</h3>
      <p className="text-white/60 text-sm mb-6">
        We verify your email with Verifalia and your mobile number with a Twilio SMS code before continuing.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <input
          className="form-input-base"
          placeholder="First Name *"
          value={String(data.firstName || '')}
          onChange={(e) => updateData({ firstName: e.target.value })}
          disabled={busy}
        />
        <input
          className="form-input-base"
          placeholder="Last Name *"
          value={String(data.lastName || '')}
          onChange={(e) => updateData({ lastName: e.target.value })}
          disabled={busy}
        />
      </div>
      <input
        className="form-input-base"
        placeholder="Email Address *"
        type="email"
        value={String(data.email || '')}
        onChange={(e) => onEmailChange(e.target.value)}
        disabled={busy || otpSent}
      />
      {emailStatus ? (
        <p className="text-[11px] text-emerald-300/90 font-semibold">Email verified · {emailStatus}</p>
      ) : null}

      <input
        className="form-input-base"
        placeholder="Mobile Number (+1) *"
        type="tel"
        value={String(data.phone || '')}
        onChange={(e) => onPhoneChange(e.target.value)}
        disabled={busy || otpSent}
      />

      {otpSent ? (
        <div className="space-y-2">
          <input
            className="form-input-base tracking-[0.35em] text-center text-lg"
            placeholder="6-DIGIT SMS CODE"
            inputMode="numeric"
            maxLength={6}
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            disabled={busy}
          />
          <button
            type="button"
            className="text-[11px] text-cyan-300/80 font-bold underline disabled:opacity-50"
            disabled={busy}
            onClick={runVerifyAndContinue}
          >
            Resend SMS code
          </button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {info && !error ? <p className="text-sm text-cyan-200/80">{info}</p> : null}

      {!otpSent ? (
        <button
          type="button"
          onClick={runVerifyAndContinue}
          disabled={busy}
          className="w-full mt-6 bg-cyan-500 text-navy-dark font-bold py-4 rounded-xl hover:bg-cyan-400 transition-colors disabled:opacity-50"
        >
          {busy ? 'VERIFYING…' : 'VERIFY & CONTINUE →'}
        </button>
      ) : (
        <button
          type="button"
          onClick={confirmOtpAndContinue}
          disabled={busy || otpCode.trim().length !== 6}
          className="w-full mt-6 bg-cyan-500 text-navy-dark font-bold py-4 rounded-xl hover:bg-cyan-400 transition-colors disabled:opacity-50"
        >
          {busy ? 'CONFIRMING…' : 'CONFIRM SMS CODE →'}
        </button>
      )}
    </div>
  );
}
