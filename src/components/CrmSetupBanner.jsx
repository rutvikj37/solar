/** Admin-only CRM OAuth setup instructions (never shown to end users). */
export default function CrmSetupBanner({ setup }) {
  if (!setup) return null;

  const copy = (text) => {
    navigator.clipboard?.writeText(text);
  };

  return (
    <div className="p-4 rounded-xl bg-surface-container-low border border-glass-stroke space-y-4">
      <div>
        <p className="text-white font-bold text-sm">OAuth redirect URLs</p>
        <p className="text-[11px] text-on-surface-variant mt-1">
          Add these exact callback URLs in your HubSpot app and Salesforce Connected App.
        </p>
      </div>

      <div className="space-y-2 text-[11px]">
        <p className="text-on-surface-variant font-semibold">HubSpot redirect URL</p>
        <button
          type="button"
          onClick={() => copy(setup.hubspotRedirectUri)}
          className="w-full text-left font-mono text-primary bg-black/30 rounded-lg p-2 hover:bg-black/40 break-all"
        >
          {setup.hubspotRedirectUri}
          <span className="block text-[9px] text-on-surface-variant mt-1">Click to copy</span>
        </button>
        <p className="text-on-surface-variant">Scopes: crm.objects.contacts.read, crm.objects.contacts.write</p>
      </div>

      <div className="space-y-2 text-[11px]">
        <p className="text-on-surface-variant font-semibold">Salesforce callback URL</p>
        <button
          type="button"
          onClick={() => copy(setup.salesforceRedirectUri)}
          className="w-full text-left font-mono text-primary bg-black/30 rounded-lg p-2 hover:bg-black/40 break-all"
        >
          {setup.salesforceRedirectUri}
          <span className="block text-[9px] text-on-surface-variant mt-1">Click to copy</span>
        </button>
        <p className="text-on-surface-variant">OAuth scopes: api, refresh_token</p>
      </div>

      {!setup.ready && setup.missingEnv?.length > 0 && (
        <p className="text-[10px] text-amber-300/90">
          Missing credentials: {setup.missingEnv.join(', ')}
        </p>
      )}
    </div>
  );
}
