import React from 'react';

export default function BulkScanDialog({
  show,
  onClose,
  scanRadius,
  hasPolygon,
  polygonAreaSqMiles,
  leadsToCapture,
  setLeadsToCapture,
  scanPackage,
  setScanPackage,
  handleExecuteScan
}) {
  if (!show) return null;

  const costPerLead = scanPackage === 'data' ? 0.5 : 1.2;
  const totalCost = (leadsToCapture * costPerLead).toFixed(2);

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0D111E] border border-white/10 rounded-2xl shadow-2xl overflow-hidden text-left flex flex-col animate-fade-in">
        {/* Modal Header */}
        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#0A0D16]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">radar</span>
            <div>
              <h3 className="font-bold text-white text-sm">Deploy AI Satellite Scan</h3>
              <p className="text-[10px] text-slate-400">Configure parameters for bulk lead capture</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 text-xs">
          {/* Target Area Summary */}
          <div className="p-3 bg-white/5 border border-white/5 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-primary">
                {hasPolygon ? 'polyline' : 'location_on'}
              </span>
              <span className="font-semibold text-[11px] text-white">
                {hasPolygon ? 'Custom Lasso Territory' : 'Target Radius'}
              </span>
            </div>
            <span className="font-mono text-white text-[11px]">
              {hasPolygon
                ? `${polygonAreaSqMiles || '> 0'} sq mi enclosed`
                : `~${((scanRadius * 2) / 1000).toFixed(1)}km × ${((scanRadius * 2) / 1000).toFixed(1)}km`}
            </span>
          </div>

          {/* Leads Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <span>LEADS TO CAPTURE</span>
              <span className="text-primary font-mono text-[11px] font-bold">{leadsToCapture} leads</span>
            </div>
            <input
              type="range"
              min="1"
              max="100"
              value={leadsToCapture}
              onChange={(e) => setLeadsToCapture(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary outline-none"
            />
          </div>

          {/* Package Selection */}
          <div className="space-y-2.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PACKAGE</p>
            <div className="grid grid-cols-2 gap-2.5">
              <div
                onClick={() => setScanPackage('data')}
                className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                  scanPackage === 'data'
                    ? 'border-primary bg-primary/5'
                    : 'border-white/5 bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className="text-white font-bold text-xs">Data Only</span>
                  <span className="text-primary font-bold text-xs">$0.50</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Owner info & solar details</p>
              </div>

              <div
                onClick={() => setScanPackage('ai')}
                className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                  scanPackage === 'ai'
                    ? 'border-primary bg-primary/5'
                    : 'border-white/5 bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className="text-white font-bold text-xs">AI Call + Data</span>
                  <span className="text-primary font-bold text-xs">$1.20</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Includes AI qualification</p>
              </div>
            </div>
          </div>

          {/* Cost Summary */}
          <div className="p-4 bg-white/5 border border-white/5 rounded-xl flex justify-between items-center">
            <span className="text-white font-semibold">Total Cost</span>
            <span className="text-2xl font-black text-primary font-mono">${totalCost}</span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/5 bg-[#0A0D16] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 font-bold py-3 rounded-lg text-xs transition-colors"
          >
            CANCEL
          </button>
          <button
            onClick={handleExecuteScan}
            className="flex-1 bg-primary text-white font-bold py-3 px-6 rounded-lg text-xs hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-primary/20"
          >
            <span className="material-symbols-outlined text-sm leading-none">play_arrow</span>
            START SCAN – ${totalCost}
          </button>
        </div>
      </div>
    </div>
  );
}
