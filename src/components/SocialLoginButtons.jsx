import React, { useState } from "react";
import { signInWithGoogle } from "../lib/socialAuth.js";
import { API_BASE } from "../config.js";

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default function SocialLoginButtons({
  onSuccess,
  onError,
  disabled = false,
}) {
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const envReady = Boolean(
        import.meta.env.VITE_FIREBASE_API_KEY &&
          import.meta.env.VITE_FIREBASE_PROJECT_ID &&
          import.meta.env.VITE_FIREBASE_APP_ID,
      );
      if (envReady) {
        if (!cancelled) setAvailable(true);
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/api/auth/firebase-config`, { cache: "no-store" });
        const data = await res.json();
        if (!cancelled) setAvailable(Boolean(res.ok && data.configured));
      } catch {
        if (!cancelled) setAvailable(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleGoogle = async () => {
    setBusy(true);
    try {
      const data = await signInWithGoogle();
      onSuccess?.(data);
    } catch (err) {
      const message =
        err?.code === "auth/popup-closed-by-user"
          ? "Sign-in popup was closed."
          : err?.message || "Google sign-in failed";
      onError?.(message);
    } finally {
      setBusy(false);
    }
  };

  const locked = disabled || busy || available !== true;

  return (
    <div className="space-y-3">
      {available === false && (
        <p className="text-[11px] text-amber-300/90 leading-relaxed">
          Social login is not configured. Add VITE_FIREBASE_* values to .env and restart Vite, or
          configure Firebase Admin in server/.env.
        </p>
      )}
      <div className="relative flex items-center gap-3 py-1">
        <div className="flex-1 h-px bg-glass-stroke" />
        <span className="text-[10px] uppercase tracking-wider text-on-surface-variant/70">
          or continue with
        </span>
        <div className="flex-1 h-px bg-glass-stroke" />
      </div>

      <button
        type="button"
        disabled={locked}
        onClick={handleGoogle}
        className="flex items-center justify-center gap-2 w-full border border-glass-stroke bg-surface-container-low/60 hover:bg-white/5 text-on-surface font-semibold py-2.5 rounded-lg text-xs transition-colors disabled:opacity-60"
      >
        <GoogleIcon />
        {busy ? "Connecting…" : "Continue with Google"}
      </button>
    </div>
  );
}
