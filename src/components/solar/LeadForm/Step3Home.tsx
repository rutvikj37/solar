export function Step3Home({ onNext, onBack, data, updateData }: any) {
  const roofTypes = [
    'Asphalt Shingle', 'Metal', 'Tile', 'Flat', 
    'Wood Shake', 'Slate', 'Other', 'Not Sure'
  ];
  
  const ownershipOptions = [
    { label: 'Yes, I own it', value: 'own' },
    { label: 'No, I rent it', value: 'rent' }
  ];
  
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xl font-bold text-white mb-4">Do you own this home?</h3>
        <div className="grid grid-cols-2 gap-3">
          {ownershipOptions.map((opt) => (
            <button
              key={opt.value}
              className={`form-chip py-4 ${data.ownership === opt.value ? 'form-chip-active' : ''}`}
              onClick={() => updateData({ ownership: opt.value })}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xl font-bold text-white mb-4">What type of roof do you have?</h3>
        <div className="grid grid-cols-2 gap-3">
          {roofTypes.map((type) => (
            <button
              key={type}
              className={`form-chip min-h-[60px] flex flex-col items-center justify-center p-3 text-xs sm:text-sm ${
                data.roofType === type ? 'form-chip-active' : ''
              }`}
              onClick={() => updateData({ roofType: type })}
            >
              <span className="font-semibold">{type}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-4 pt-4 border-t border-white/5">
        <button onClick={onBack} className="w-1/3 bg-white/5 text-white font-bold py-4 rounded-xl hover:bg-white/10 transition-colors">← Back</button>
        <button 
          onClick={onNext} 
          disabled={!data.ownership || !data.roofType}
          className="w-2/3 bg-cyan-500 text-navy-dark font-bold py-4 rounded-xl hover:bg-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}