import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { emailToastFromSearchParams } from '../../lib/emailIntegrations.js';
import EmailIntegrationsSection from '../../components/EmailIntegrationsSection.jsx';

export default function IntegrationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [toast, setToast] = useState('');

  useEffect(() => {
    const msg = emailToastFromSearchParams(searchParams, setSearchParams);
    if (msg) setToast(msg);
  }, [searchParams, setSearchParams]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="font-headline-lg text-2xl font-bold text-primary">Integrations</h2>
        <p className="text-on-surface-variant text-sm mt-1">
          Connect company SMTP to send email as yourself — we meter your plan quota.
        </p>
      </div>

      {toast && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold flex justify-between gap-2 border ${
            toast.toLowerCase().includes('fail') || toast.toLowerCase().includes('error')
              ? 'bg-red-500/10 text-red-400 border-red-500/25'
              : 'bg-green-500/10 text-green-400 border-green-500/25'
          }`}
        >
          <span>{toast}</span>
          <button type="button" onClick={() => setToast('')} className="opacity-70 hover:opacity-100 shrink-0">
            ✕
          </button>
        </div>
      )}

      <EmailIntegrationsSection onToast={setToast} />
    </div>
  );
}
