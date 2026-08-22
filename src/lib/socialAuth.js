import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
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

export async function signInWithGoogle() {
  const authInstance = await ensureFirebaseAuth();
  const result = await signInWithPopup(authInstance, googleProvider);
  const idToken = await result.user.getIdToken();
  return exchangeFirebaseToken(idToken);
}
