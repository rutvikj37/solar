import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  analyticsAllowed,
  openCookiePreferences,
  readCookieConsent,
  writeCookieConsent,
  COOKIE_CONSENT_EVENT,
} from '../lib/cookieConsent.js';

/**
 * Site-wide cookie consent banner + preferences panel.
 * Essential cookies always allowed; analytics is opt-in.
 */
export default function CookieConsent() {
  const [consent, setConsent] = useState(() => readCookieConsent());
  const [showBanner, setShowBanner] = useState(() => !readCookieConsent().decided);
  const [showPrefs, setShowPrefs] = useState(false);
  const [analyticsDraft, setAnalyticsDraft] = useState(() => Boolean(readCookieConsent().analytics));

  useEffect(() => {
    const sync = () => {
      const next = readCookieConsent();
      setConsent(next);
      setAnalyticsDraft(Boolean(next.analytics));
      setShowBanner(!next.decided);
    };
    const onOpenPrefs = () => {
      const next = readCookieConsent();
      setConsent(next);
      setAnalyticsDraft(Boolean(next.analytics));
      setShowPrefs(true);
      setShowBanner(false);
    };
    window.addEventListener(COOKIE_CONSENT_EVENT, sync);
    window.addEventListener('str-open-cookie-preferences', onOpenPrefs);
    return () => {
      window.removeEventListener(COOKIE_CONSENT_EVENT, sync);
      window.removeEventListener('str-open-cookie-preferences', onOpenPrefs);
    };
  }, []);

  const acceptAll = useCallback(() => {
    const next = writeCookieConsent({ analytics: true });
    setConsent(next);
    setShowBanner(false);
    setShowPrefs(false);
  }, []);

  const rejectNonEssential = useCallback(() => {
    const next = writeCookieConsent({ analytics: false });
    setConsent(next);
    setShowBanner(false);
    setShowPrefs(false);
  }, []);

  const savePrefs = useCallback(() => {
    const next = writeCookieConsent({ analytics: analyticsDraft });
    setConsent(next);
    setShowBanner(false);
    setShowPrefs(false);
  }, [analyticsDraft]);

  if (!showBanner && !showPrefs) return null;

  return (
    <>
      {showBanner && (
        <div
          role="dialog"
          aria-label="Cookie consent"
          className="fixed inset-x-0 bottom-0 z-[90] p-3 sm:p-4 pointer-events-none"
        >
          <div className="pointer-events-auto mx-auto max-w-3xl rounded-2xl border border-glass-stroke bg-deep/95 backdrop-blur-xl shadow-2xl p-4 sm:p-5 text-on-surface">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="min-w-0 flex-1 space-y-2">
                <h2 className="text-sm font-bold">We use cookies</h2>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Essential cookies keep you signed in and secure the site. Optional analytics cookies help us
                  understand usage — only if you allow them. See our{' '}
                  <Link to="/privacy#cookies" className="text-primary hover:underline font-semibold">
                    Privacy Policy
                  </Link>
                  .
                </p>
              </div>
              <div className="flex flex-col xs:flex-row sm:flex-col gap-2 shrink-0 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={acceptAll}
                  className="rounded-lg bg-primary text-on-primary text-xs font-bold px-4 py-2.5 hover:brightness-110"
                >
                  Accept all
                </button>
                <button
                  type="button"
                  onClick={rejectNonEssential}
                  className="rounded-lg border border-glass-stroke bg-white/5 text-on-surface text-xs font-bold px-4 py-2.5 hover:bg-white/10"
                >
                  Essential only
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPrefs(true);
                    setShowBanner(false);
                  }}
                  className="rounded-lg text-xs font-semibold text-on-surface-variant hover:text-on-surface px-2 py-2"
                >
                  Customize
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPrefs && (
        <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Cookie preferences"
            className="w-full max-w-md rounded-2xl border border-glass-stroke bg-deep shadow-2xl p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-on-surface">Cookie preferences</h2>
                <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                  Choose which cookies we may use. You can change this anytime from the footer.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPrefs(false)}
                className="text-on-surface-variant hover:text-on-surface p-1"
                aria-label="Close"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="rounded-xl border border-glass-stroke bg-surface-container/40 p-3 space-y-1">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-on-surface">Essential</p>
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Always on</span>
              </div>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                Authentication, security, load balancing, and preference storage required for the product to work.
              </p>
            </div>

            <label className="rounded-xl border border-glass-stroke bg-surface-container/40 p-3 flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={analyticsDraft}
                onChange={(e) => setAnalyticsDraft(e.target.checked)}
                className="mt-0.5 rounded border-glass-stroke text-primary focus:ring-primary"
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-on-surface">Analytics</span>
                <span className="block text-[11px] text-on-surface-variant leading-relaxed mt-0.5">
                  Helps us measure page performance and product usage. We do not use analytics cookies until you
                  opt in{consent.decided && analyticsAllowed(consent) ? ' (currently enabled)' : ''}.
                </span>
              </span>
            </label>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="button"
                onClick={savePrefs}
                className="flex-1 rounded-lg bg-primary text-on-primary text-xs font-bold px-4 py-2.5 hover:brightness-110"
              >
                Save preferences
              </button>
              <button
                type="button"
                onClick={acceptAll}
                className="flex-1 rounded-lg border border-glass-stroke bg-white/5 text-on-surface text-xs font-bold px-4 py-2.5 hover:bg-white/10"
              >
                Accept all
              </button>
            </div>

            <p className="text-[10px] text-on-surface-variant text-center">
              Details in our{' '}
              <Link to="/privacy#cookies" onClick={() => setShowPrefs(false)} className="text-primary hover:underline">
                Privacy Policy — Cookies &amp; analytics
              </Link>
            </p>
          </div>
        </div>
      )}
    </>
  );
}

/** Footer / settings trigger */
export function CookieSettingsButton({ className = '' }) {
  return (
    <button
      type="button"
      onClick={() => openCookiePreferences()}
      className={className || 'hover:text-cyan-400 transition-colors'}
    >
      Cookie settings
    </button>
  );
}
