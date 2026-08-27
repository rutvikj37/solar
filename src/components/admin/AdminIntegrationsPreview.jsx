import React from 'react';
import { CRM_PROVIDER_META } from '../../lib/crmIntegrations.js';
import { EMAIL_PROVIDER_META } from '../../lib/emailIntegrations.js';

const CRM_STYLES = {
  hubspot: { logo: 'H', badge: 'bg-[#ff7a59]/15 text-[#ffb199] border-[#ff7a59]/30' },
  salesforce: { logo: 'SF', badge: 'bg-sky-500/15 text-sky-200 border-sky-500/30' },
};

function StatusPill({ live }) {
  return (
    <span
      className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full border ${
        live
          ? 'bg-green-500/15 text-green-300 border-green-500/30'
          : 'bg-amber-500/15 text-amber-200 border-amber-500/30'
      }`}
    >
      {live ? 'Live for users' : 'Locked for users'}
    </span>
  );
}

function CrmPreviewCard({ provider, configured }) {
  const meta = CRM_PROVIDER_META[provider];
  const style = CRM_STYLES[provider];
  return (
    <div className="rounded-2xl border border-glass-stroke bg-white/[0.03] p-5 flex flex-col min-h-[160px]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black border ${style.badge}`}>
            {style.logo}
          </div>
          <div>
            <p className="text-white font-bold">{meta.label}</p>
            <p className="text-[11px] text-on-surface-variant">{meta.description}</p>
          </div>
        </div>
        <StatusPill live={configured} />
      </div>
      <p className="text-[11px] text-on-surface-variant mt-auto pt-4 leading-relaxed">
        {configured
          ? 'Users see Connect and can push leads after OAuth login.'
          : 'Users see a locked card until Client ID + Secret are saved below.'}
      </p>
    </div>
  );
}

function EmailPreviewCard({ provider, configured, alwaysOn = false }) {
  const meta = EMAIL_PROVIDER_META[provider];
  const live = alwaysOn || configured;
  return (
    <div className="rounded-2xl border border-glass-stroke bg-white/[0.03] p-5 flex flex-col min-h-[160px]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-2xl text-primary">{meta.icon}</span>
          <div>
            <p className="text-white font-bold">{meta.label}</p>
            <p className="text-[11px] text-on-surface-variant">{meta.description}</p>
          </div>
        </div>
        <StatusPill live={live} />
      </div>
      <p className="text-[11px] text-on-surface-variant mt-auto pt-4 leading-relaxed">
        {alwaysOn
          ? 'No platform OAuth needed — users enter SMTP credentials themselves.'
          : configured
            ? 'Users see Connect and send lead emails from their inbox.'
            : 'Users see a locked card until OAuth credentials are saved below.'}
      </p>
    </div>
  );
}

export default function AdminIntegrationsPreview({ crmSetup, emailSetup }) {
  if (!crmSetup && !emailSetup) return null;

  const crmReady = crmSetup?.hubspotConfigured || crmSetup?.salesforceConfigured;
  const emailReady = !!emailSetup?.gmailConfigured;

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-xl p-4 border border-primary/20 bg-primary/5">
        <p className="text-sm text-white font-semibold">What users see on Integrations</p>
        <p className="text-xs text-on-surface-variant mt-1">
          Preview below matches the user-facing page. Save credentials in the forms below to unlock each provider.
        </p>
      </div>

      <div className="space-y-3">
        <h4 className="text-white font-bold text-sm">CRM</h4>
        {!crmReady && (
          <p className="text-xs text-amber-200/90 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2">
            CRM not set up yet — users see locked HubSpot and Salesforce cards until you add OAuth credentials below.
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CrmPreviewCard provider="hubspot" configured={!!crmSetup?.hubspotConfigured} />
          <CrmPreviewCard provider="salesforce" configured={!!crmSetup?.salesforceConfigured} />
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-white font-bold text-sm">Email</h4>
        {!emailReady && (
          <p className="text-xs text-amber-200/90 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2">
            Gmail is locked for users until Google OAuth is configured below. Custom SMTP is always
            available.
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <EmailPreviewCard provider="gmail" configured={!!emailSetup?.gmailConfigured} />
          <EmailPreviewCard provider="smtp" configured alwaysOn />
        </div>
      </div>
    </div>
  );
}
