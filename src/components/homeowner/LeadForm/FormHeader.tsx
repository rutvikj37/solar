export function FormHeader({ step }: { step: number }) {
  const steps = ['YOU', 'PROPERTY', 'HOME', 'SOLAR'];

  return (
    <div className="mb-8">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400 mb-2">
        FREE SOLAR ANALYSIS
      </p>
      <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tighter text-white mb-2">
        Let&apos;s Find Your Home&apos;s Solar Potential.
      </h2>
      <p className="text-white/60 text-sm mb-6">
        Answer a few simple questions and we&apos;ll analyze your property and prepare your free
        solar report.
      </p>

      <div className="flex flex-wrap gap-x-3 gap-y-2 items-center text-[11px] sm:text-sm">
        {steps.map((s, i) => (
          <div
            key={s}
            className={`flex items-center gap-2 ${i === step ? 'text-white' : 'text-white/30'}`}
          >
            <span className={`form-step-indicator ${i === step ? 'text-cyan-400' : ''}`}>
              0{i + 1} {s}
            </span>
            {i < steps.length - 1 && <span className="text-white/20 hidden sm:inline">→</span>}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-white/40 mt-2 sm:hidden">
        Step {step + 1} of {steps.length}
      </p>
    </div>
  );
}
