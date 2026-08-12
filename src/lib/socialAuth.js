import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { API_BASE } from "../config.js";
import { auth, isFirebaseConfigured } from "./firebase.js";

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
  if (!isFirebaseConfigured() || !auth) {
    throw new Error(
      "Social login is not configured. Add Firebase env vars and restart the app.",
    );
  }

  const result = await signInWithPopup(auth, googleProvider);
  const idToken = await result.user.getIdToken();
  return exchangeFirebaseToken(idToken);
}
