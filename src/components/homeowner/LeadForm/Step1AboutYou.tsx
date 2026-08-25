import { CountryCodeSelect } from './CountryCodeSelect';

type Step1Props = {
  onNext: () => void;
  data: Record<string, unknown>;
  updateData: (patch: Record<string, unknown>) => void;
};

export function Step1AboutYou({ onNext, data, updateData }: Step1Props) {
  const firstName = String(data.firstName || '').trim();
  const lastName = String(data.lastName || '').trim();
  const email = String(data.email || '').trim();
  const phone = String(data.phone || '').trim();
  const countryCode = String(data.countryCode || '+1').trim();

  const digitsOnly = phone.replace(/\D/g, '');

  const handleContinue = () => {
    if (!firstName || !lastName) {
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return;
    }
    if (!phone || digitsOnly.length < 7) {
      return;
    }
    if (!data.countryCode) {
      updateData({ countryCode: '+1' });
    }
    onNext();
  };

  const canContinue =
    firstName &&
    lastName &&
    email &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    digitsOnly.length >= 7;

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-white mb-4">First, tell us about yourself.</h3>
      <p className="text-white/60 text-sm mb-6">
        Enter your contact details so we can follow up about your solar report.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <input
          className="form-input-base"
          placeholder="First Name *"
          value={String(data.firstName || '')}
          onChange={(e) => updateData({ firstName: e.target.value })}
        />
        <input
          className="form-input-base"
          placeholder="Last Name *"
          value={String(data.lastName || '')}
          onChange={(e) => updateData({ lastName: e.target.value })}
        />
      </div>
      <input
        className="form-input-base"
        placeholder="Email Address *"
        type="email"
        value={String(data.email || '')}
        onChange={(e) => updateData({ email: e.target.value })}
      />
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

      <button
        type="button"
        onClick={handleContinue}
        disabled={!canContinue}
        className="w-full mt-6 bg-cyan-500 text-navy-dark font-bold py-4 rounded-xl hover:bg-cyan-400 transition-colors disabled:opacity-50"
      >
        CONTINUE →
      </button>
    </div>
  );
}

