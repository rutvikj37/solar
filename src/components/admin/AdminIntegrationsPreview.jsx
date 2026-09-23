import React from 'react';
import { CRM_PROVIDER_META } from '../../lib/crmIntegrations.js';
import { EMAIL_PROVIDER_META } from '../../lib/emailIntegrations.js';

const CRM_STYLES = {
  hubspot: { logo: 'H', badge: 'bg-[#ff7a59]/15 text-[#ff7a59] dark:text-[#ffb199] border-[#ff7a59]/30' },
  salesforce: { logo: 'SF', badge: 'bg-sky-500/15 text-sky-700 dark:text-sky-200 border-sky-500/30' },
};

function StatusPill({ live }) {
  return (
    <span
      className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
        live
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30'
          : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-500/30'
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
    <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#121826] p-5 flex flex-col min-h-[160px] shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black border ${style.badge}`}>
            {style.logo}
          </div>
          <div>
            <p className="text-slate-900 dark:text-white font-bold text-sm">{meta?.label || provider}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{meta?.description}</p>
          </div>
        </div>
        <StatusPill live={configured} />
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-300 mt-auto pt-4 leading-relaxed border-t border-slate-100 dark:border-white/5">
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
    <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#121826] p-5 flex flex-col min-h-[160px] shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-xl">{meta?.icon || 'mail'}</span>
          </div>
          <div>
            <p className="text-slate-900 dark:text-white font-bold text-sm">{meta?.label || 'Custom SMTP'}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{meta?.description || 'Use your company mail server.'}</p>
          </div>
        </div>
        <StatusPill live={live} />
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-300 mt-auto pt-4 leading-relaxed border-t border-slate-100 dark:border-white/5">
        {alwaysOn
          ? 'No platform OAuth needed — users enter their custom SMTP credentials directly in their portal.'
          : configured
            ? 'Users see Connect and send lead emails from their verified mailbox.'
            : 'Users see a locked card until OAuth credentials are saved below.'}
      </p>
    </div>
  );
}

export default function AdminIntegrationsPreview({ crmSetup, emailSetup, smtpOnly = false }) {
  if (!crmSetup && !emailSetup && !smtpOnly) return null;

  if (smtpOnly) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#121826] shadow-xs">
          <p className="text-sm text-slate-900 dark:text-white font-bold">What users see in their workspace</p>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            SMTP connect form is active by default. Native CRM and platform OAuth cards remain hidden or locked until configured below.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          <EmailPreviewCard provider="smtp" configured alwaysOn />
        </div>
      </div>
    );
  }

  const crmReady = crmSetup?.hubspotConfigured || crmSetup?.salesforceConfigured;
  const emailReady = !!emailSetup?.gmailConfigured;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-5 border border-blue-200 dark:border-blue-500/20 bg-blue-50/70 dark:bg-blue-500/5 shadow-xs">
        <p className="text-sm text-slate-900 dark:text-white font-bold">What users see on their Integrations screen</p>
        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
          {crmReady || emailReady
            ? 'Active connectors display an enabled status. Users can link their personal or company accounts.'
            : 'Providers without credentials are locked in the user interface.'}
        </p>
      </div>

      <div>
        <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
          CRM Integrations
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CrmPreviewCard provider="hubspot" configured={!!crmSetup?.hubspotConfigured} />
          <CrmPreviewCard provider="salesforce" configured={!!crmSetup?.salesforceConfigured} />
        </div>
      </div>

      <div>
        <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
          Email Integrations
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <EmailPreviewCard provider="smtp" configured alwaysOn />
          <EmailPreviewCard provider="gmail" configured={!!emailSetup?.gmailConfigured} />
        </div>
      </div>
    </div>
  );
}
