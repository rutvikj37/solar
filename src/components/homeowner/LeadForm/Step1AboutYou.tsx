import { useState } from 'react';
import { CountryCodeSelect } from './CountryCodeSelect';

type Step1Props = {
  onNext: () => void;
  data: Record<string, unknown>;
  updateData: (patch: Record<string, unknown>) => void;
};

export function Step1AboutYou({ onNext, data, updateData }: Step1Props) {
  const [touched, setTouched] = useState(false);
  const firstName = String(data.firstName || '').trim();
  const lastName = String(data.lastName || '').trim();
  const email = String(data.email || '').trim();
  const phone = String(data.phone || '').trim();
  const countryCode = String(data.countryCode || '+1').trim();

  const digitsOnly = phone.replace(/\D/g, '');
  const emailOk = Boolean(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  const phoneOk = digitsOnly.length >= 7;
  const nameOk = Boolean(firstName && lastName);

  const handleContinue = () => {
    setTouched(true);
    if (!nameOk || !emailOk || !phoneOk) return;
    if (!data.countryCode) {
      updateData({ countryCode: '+1' });
    }
    onNext();
  };

  const canContinue = nameOk && emailOk && phoneOk;

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-white mb-4">First, tell us about yourself.</h3>
      <p className="text-white/60 text-sm mb-6">
        Enter your contact details so we can follow up about your solar report.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <input
            className="form-input-base"
            placeholder="First Name *"
            value={String(data.firstName || '')}
            onChange={(e) => updateData({ firstName: e.target.value })}
          />
          {touched && !firstName && (
            <p className="text-[11px] text-red-300 mt-1">First name is required.</p>
          )}
        </div>
        <div>
          <input
            className="form-input-base"
            placeholder="Last Name *"
            value={String(data.lastName || '')}
            onChange={(e) => updateData({ lastName: e.target.value })}
          />
          {touched && !lastName && (
            <p className="text-[11px] text-red-300 mt-1">Last name is required.</p>
          )}
        </div>
      </div>
      <div>
        <input
          className="form-input-base"
          placeholder="Email Address *"
          type="email"
          value={String(data.email || '')}
          onChange={(e) => updateData({ email: e.target.value })}
        />
        {touched && !emailOk && (
          <p className="text-[11px] text-red-300 mt-1">Enter a valid email address.</p>
        )}
      </div>
      <div>
        <div className="flex gap-2.5 items-center">
          <CountryCodeSelect
            value={countryCode}
            onChange={(code) => updateData({ countryCode: code })}
            className="w-[145px] shrink-0"
          />
          <input
            className="form-input-base flex-1"
            placeholder="Mobile Number *"
            type="tel"
            value={String(data.phone || '')}
            onChange={(e) => updateData({ phone: e.target.value })}
          />
        </div>
        {touched && !phoneOk && (
          <p className="text-[11px] text-red-300 mt-1">Enter a valid mobile number (at least 7 digits).</p>
        )}
      </div>

      <button
        type="button"
        onClick={handleContinue}
        disabled={!canContinue && touched}
        className="w-full mt-6 bg-cyan-500 text-navy-dark font-bold py-4 rounded-xl hover:bg-cyan-400 transition-colors disabled:opacity-50"
      >
        CONTINUE →
      </button>
    </div>
  );
}
