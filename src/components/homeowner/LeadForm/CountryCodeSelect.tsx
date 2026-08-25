import { ChevronDown } from 'lucide-react';
import { COUNTRY_CODES } from '@/data/countryCodes';

type CountryCodeSelectProps = {
  value?: string;
  onChange: (dialCode: string) => void;
  className?: string;
};

export function CountryCodeSelect({ value = '+1', onChange, className = '' }: CountryCodeSelectProps) {
  const activeDialCode = value || '+1';

  return (
    <div className={`relative inline-block ${className}`}>
      <select
        value={activeDialCode}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Country Dialing Code"
        className="form-input-base pr-8 pl-3 py-3.5 appearance-none bg-[#090D1F] text-white text-sm font-medium border border-white/10 rounded-xl cursor-pointer hover:border-cyan-500/50 focus:border-cyan-400 focus:outline-none transition-colors w-full"
      >
        {COUNTRY_CODES.map((c) => (
          <option key={`${c.code}-${c.dialCode}`} value={c.dialCode} className="bg-[#0D1226] text-white py-1">
            {c.flag} {c.dialCode} ({c.name})
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
    </div>
  );
}
