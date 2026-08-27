import {
  GoogleAuthProvider,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { API_BASE } from "../config.js";
import { ensureFirebaseAuth } from "./firebase.js";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

/** One shared promise — Strict Mode remount must not call getRedirectResult twice. */
let redirectCompletionPromise = null;

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

function shouldFallbackToRedirect(err) {
  const code = String(err?.code || "");
  return (
    code === "auth/popup-blocked" ||
    code === "auth/cancelled-popup-request" ||
    /cross-origin-opener|window\.closed|opener/i.test(String(err?.message || ""))
  );
}

/**
 * Complete Google redirect sign-in after returning to the app (or null if none).
 * Note: redirect often fails when authDomain is *.firebaseapp.com and the app is
 * on another site (Chrome/Safari third-party storage). Prefer popup in that case.
 */
export async function completeGoogleRedirectIfPresent() {
  if (!redirectCompletionPromise) {
    redirectCompletionPromise = (async () => {
      const authInstance = await ensureFirebaseAuth();
      const result = await getRedirectResult(authInstance);
      if (!result?.user) return null;
      const idToken = await result.user.getIdToken();
      return exchangeFirebaseToken(idToken);
    })().catch((err) => {
      // Allow a later retry after a hard failure (e.g. network), but not after null.
      redirectCompletionPromise = null;
      throw err;
    });
  }
  return redirectCompletionPromise;
}

/**
 * Prefer popup: live COOP is same-origin-allow-popups, and redirect through
 * solar-*.firebaseapp.com loses the session on modern browsers (getRedirectResult → null).
 * Fall back to full-page redirect only when the popup cannot complete.
 */
export async function signInWithGoogle() {
  const authInstance = await ensureFirebaseAuth();
  try {
    const result = await signInWithPopup(authInstance, googleProvider);
    const idToken = await result.user.getIdToken();
    return exchangeFirebaseToken(idToken);
  } catch (err) {
    if (!shouldFallbackToRedirect(err)) throw err;
    await signInWithRedirect(authInstance, googleProvider);
    return new Promise(() => {});
  }
}
