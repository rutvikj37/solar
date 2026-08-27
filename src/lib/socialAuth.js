import {
  GoogleAuthProvider,
  getRedirectResult,
  signInWithRedirect,
} from "firebase/auth";
import { API_BASE } from "../config.js";
import { ensureFirebaseAuth } from "./firebase.js";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

async function exchangeFirebaseToken(idToken) {
  const response = await fetch(`${API_BASE}/api/auth/firebase`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Social sign-in failed");
  }
  return data;
}

/** Complete Google redirect sign-in after returning to the app (or null if none). */
export async function completeGoogleRedirectIfPresent() {
  const authInstance = await ensureFirebaseAuth();
  const result = await getRedirectResult(authInstance);
  if (!result?.user) return null;
  const idToken = await result.user.getIdToken();
  return exchangeFirebaseToken(idToken);
}

/** Full-page redirect avoids COOP blocking Firebase popup window.closed polling. */
export async function signInWithGoogle() {
  const authInstance = await ensureFirebaseAuth();
  await signInWithRedirect(authInstance, googleProvider);
  return new Promise(() => {});
}
