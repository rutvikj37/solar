import {
  GoogleAuthProvider,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { API_BASE } from "../config.js";
import { ensureFirebaseAuth, getFirebaseConfigMeta } from "./firebase.js";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

/** One shared promise — Strict Mode remount must not call getRedirectResult twice. */
let redirectCompletionPromise = null;
let coopHeaderCache = null;

async function exchangeFirebaseToken(idToken) {
  const response = await fetch(`${API_BASE}/api/auth/firebase`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    throw new Error(
      data?.error || `Social sign-in failed (${response.status})`,
    );
  }
  return data;
}

/**
 * Read the live COOP header nginx/CDN serves on HTML (HEAD /).
 * Cached for the page session.
 */
export async function detectCoopHeader() {
  if (coopHeaderCache !== null) return coopHeaderCache;
  try {
    const res = await fetch(`${window.location.origin}/`, {
      method: "HEAD",
      cache: "no-store",
    });
    coopHeaderCache = String(
      res.headers.get("Cross-Origin-Opener-Policy") || "",
    ).toLowerCase();
  } catch {
    coopHeaderCache = "";
  }
  return coopHeaderCache;
}

function coopBlockedMessage() {
  return (
    "Google sign-in is blocked by server headers (Cross-Origin-Opener-Policy: same-origin). " +
    "Set Cross-Origin-Opener-Policy: same-origin-allow-popups on HTML responses in nginx. " +
    "See DEPLOY.md."
  );
}

function enrichGoogleAuthError(err, coop) {
  if (coop === "same-origin") {
    return new Error(coopBlockedMessage());
  }
  const msg = String(err?.message || "Google sign-in failed");
  if (/cross-origin-opener|window\.closed|opener/i.test(msg)) {
    return new Error(
      `${msg} Ensure Cross-Origin-Opener-Policy is same-origin-allow-popups (not same-origin). See DEPLOY.md.`,
    );
  }
  return err instanceof Error ? err : new Error(msg);
}

function shouldFallbackToRedirect(err) {
  const code = String(err?.code || "");
  return (
    code === "auth/popup-blocked" ||
    code === "auth/cancelled-popup-request" ||
    /cross-origin-opener|window\.closed|opener/i.test(String(err?.message || ""))
  );
}

function isIndexedDbClosingError(err) {
  return /database is closing\/hidden|database connection is closing/i.test(
    String(err?.message || ""),
  );
}

async function withIndexedDbRetry(operation, { retries = 2, delayMs = 400 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation();
    } catch (err) {
      lastErr = err;
      if (!isIndexedDbClosingError(err) || attempt >= retries) throw err;
      await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
    }
  }
  throw lastErr;
}

/**
 * Complete Google redirect sign-in after returning to the app (or null if none).
 */
export async function completeGoogleRedirectIfPresent() {
  if (!redirectCompletionPromise) {
    redirectCompletionPromise = (async () => {
      const authInstance = await ensureFirebaseAuth();
      const result = await withIndexedDbRetry(() =>
        getRedirectResult(authInstance),
      );
      if (!result?.user) return null;
      const idToken = await result.user.getIdToken();
      return exchangeFirebaseToken(idToken);
    })().catch((err) => {
      redirectCompletionPromise = null;
      throw enrichGoogleAuthError(err, "");
    });
  }
  return redirectCompletionPromise;
}

/**
 * Popup when authDomain is *.firebaseapp.com (cross-site redirect loses session).
 * Redirect when authDomain matches this host (requires /__/auth proxy + FIREBASE_AUTH_DOMAIN).
 */
export async function signInWithGoogle() {
  const authInstance = await ensureFirebaseAuth();
  const meta = getFirebaseConfigMeta();
  const coop = await detectCoopHeader();

  if (coop === "same-origin") {
    throw new Error(coopBlockedMessage());
  }

  if (meta.signInMethod === "redirect") {
    await signInWithRedirect(authInstance, googleProvider);
    return new Promise(() => {});
  }

  try {
    const result = await withIndexedDbRetry(() =>
      signInWithPopup(authInstance, googleProvider),
    );
    const idToken = await result.user.getIdToken();
    return exchangeFirebaseToken(idToken);
  } catch (err) {
    if (isIndexedDbClosingError(err)) {
      throw new Error(
        "Google sign-in was interrupted while saving your session. Please try again.",
      );
    }
    if (!shouldFallbackToRedirect(err)) {
      throw enrichGoogleAuthError(err, coop);
    }
    await signInWithRedirect(authInstance, googleProvider);
    return new Promise(() => {});
  }
}
