import React from 'react';

const PRESETS = [10, 25, 50];

export default function BulkScanDialog({
  show,
  onClose,
  hasPolygon,
  polygonAreaSqMiles,
  zipLabel,
  leadsToCapture,
  setLeadsToCapture,
  leadCredits,
  unlimitedCredits,
  onStartScan,
  busy = false,
}) {
  if (!show) return null;

  const creditCost = leadsToCapture;
  const hasEnough = unlimitedCredits || leadCredits >= creditCost;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-[#0D111E] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden text-left flex flex-col animate-fade-in max-h-[90vh]">
        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#0A0D16]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">radar</span>
            <div>
              <h3 className="font-bold text-white text-sm">Scan this area</h3>
              <p className="text-[10px] text-slate-400">Unlock multiple leads in one run</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white p-1 transition-colors">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        <div className="p-5 space-y-5 text-xs overflow-y-auto">
          <div className="p-3 bg-white/5 border border-white/5 rounded-xl flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-[16px] text-primary shrink-0">
                {hasPolygon ? 'polyline' : 'location_on'}
              </span>
              <span className="font-semibold text-[11px] text-white truncate">
                {hasPolygon ? 'Custom territory' : zipLabel || 'Map search area'}
              </span>
            </div>
            {hasPolygon && polygonAreaSqMiles > 0 && (
              <span className="font-mono text-white text-[11px] shrink-0">{polygonAreaSqMiles} sq mi</span>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <span>Leads to capture</span>
              <span className="text-primary font-mono text-[11px]">{leadsToCapture} leads</span>
            </div>
            <div className="flex gap-2">
              {PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setLeadsToCapture(n)}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                    leadsToCapture === n
                      ? 'bg-primary/20 border-primary text-primary'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <input
              type="range"
              min="1"
              max="50"
              value={leadsToCapture}
              onChange={(e) => setLeadsToCapture(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary outline-none"
            />
            <p className="text-[10px] text-on-surface-variant">Maximum 50 leads per scan</p>
          </div>

          <div className="p-4 bg-white/5 border border-white/5 rounded-xl space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-white font-semibold">Uses</span>
              <span className="text-lg font-black text-primary font-mono">
                {creditCost} credit{creditCost === 1 ? '' : 's'}
              </span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-on-surface-variant">Your balance</span>
              <span className={`font-bold ${hasEnough ? 'text-green-400' : 'text-red-400'}`}>
                {unlimitedCredits ? 'Unlimited' : `${leadCredits} credits`}
              </span>
            </div>
            {!hasEnough && (
              <p className="text-[10px] text-red-300/90 pt-1">
                You need {creditCost - leadCredits} more credits. Upgrade your plan or reduce lead count.
              </p>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-white/5 bg-[#0A0D16] flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 font-bold py-3 rounded-lg text-xs transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onStartScan}
            disabled={busy || !hasEnough}
            className="flex-1 bg-primary text-white font-bold py-3 px-6 rounded-lg text-xs hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-sm leading-none">play_arrow</span>
            {busy ? 'Starting…' : `Start scan (${creditCost} credits)`}
          </button>
        </div>
      </div>
    </div>
  );
}
