import { useState } from 'react';

export function Step1AboutYou({ onNext, data, updateData }: any) {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-white mb-4">First, tell us about yourself.</h3>
      <p className="text-white/60 text-sm mb-6">We'll use these details to prepare your report and contact you about your solar options.</p>
      
      <div className="grid grid-cols-2 gap-4">
        <input className="form-input-base" placeholder="First Name *" value={data.firstName || ''} onChange={(e) => updateData({ firstName: e.target.value })} />
        <input className="form-input-base" placeholder="Last Name *" value={data.lastName || ''} onChange={(e) => updateData({ lastName: e.target.value })} />
      </div>
      <input className="form-input-base" placeholder="Email Address *" value={data.email || ''} onChange={(e) => updateData({ email: e.target.value })} />
      <input className="form-input-base" placeholder="Mobile Number (+1) *" value={data.phone || ''} onChange={(e) => updateData({ phone: e.target.value })} />

      <button onClick={onNext} className="w-full mt-6 bg-cyan-500 text-navy-dark font-bold py-4 rounded-xl hover:bg-cyan-400 transition-colors">
        Continue →
      </button>
    </div>
  );
}