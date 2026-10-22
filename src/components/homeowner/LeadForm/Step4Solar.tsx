import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { CONTACT_CONSENT_TEXT } from '@/lib/contactConsent.js';

export function Step4Solar({ onBack, data, updateData, onSubmit, submitting = false }: any) {
  const billValue = data.monthlyBill || 250;
  
  const timelineOptions = [
    '0–3 months',
    '3–6 months',
    '6–12 months',
    'Just researching',
  ];

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateData({ monthlyBill: parseInt(e.target.value) });
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xl font-bold text-white mb-2">What's your average monthly electricity bill?</h3>
        
        <div className="py-6 px-2">
          <div className="flex justify-between items-end mb-6">
            <span className="text-white/40 text-[10px] uppercase font-bold tracking-widest">$50</span>
            <div className="text-center">
              <span className="text-4xl font-black text-cyan-400 tracking-tighter">
                ${billValue >= 1000 ? '1,000+' : billValue}
              </span>
              <span className="block text-[10px] font-bold text-white/30 uppercase tracking-widest mt-1">/ month</span>
            </div>
            <span className="text-white/40 text-[10px] uppercase font-bold tracking-widest">$1,000+</span>
          </div>
          
          <input
            type="range"
            min="50"
            max="1000"
            step="50"
            value={billValue}
            onChange={handleSliderChange}
            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-white/60 uppercase tracking-widest mb-3">When are you considering solar?</h3>
        <div className="flex flex-wrap gap-2">
          {timelineOptions.map(opt => (
            <button 
              key={opt}
              className={`form-chip px-4 py-2 text-xs ${data.timeline === opt ? 'form-chip-active' : ''}`}
              onClick={() => updateData({ timeline: opt })}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={Boolean(data.contactConsent)}
          onChange={(e) => updateData({ contactConsent: e.target.checked })}
          className="mt-1 h-4 w-4 shrink-0 accent-cyan-500"
          aria-describedby="contact-consent-text"
        />
        <span id="contact-consent-text" className="text-[11px] leading-relaxed text-white/60">
          {CONTACT_CONSENT_TEXT}{' '}
          <Link to="/privacy" className="text-cyan-400 hover:underline">Privacy Policy</Link>
          {' · '}
          <Link to="/terms" className="text-cyan-400 hover:underline">Terms</Link>
        </span>
      </label>

      <div className="flex gap-4 pt-4 border-t border-white/5">
        <button onClick={onBack} className="w-1/3 bg-white/5 text-white font-bold py-4 rounded-xl hover:bg-white/10 transition-colors">← Back</button>
        <button
          onClick={onSubmit}
          disabled={!data.timeline || !data.contactConsent || submitting}
          className="w-2/3 bg-cyan-500 text-navy-dark font-black py-4 rounded-xl hover:bg-cyan-400 transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] disabled:opacity-50 disabled:shadow-none"
        >
          {submitting ? 'VALIDATING…' : 'GET MY FREE SOLAR REPORT →'}
        </button>
      </div>
    </div>
  );
}
