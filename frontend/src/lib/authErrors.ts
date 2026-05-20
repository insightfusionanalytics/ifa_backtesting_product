/**
 * Maps Firebase JS SDK auth error codes and our backend's TokenError reasons
 * to friendly UI messages. Catches both the client-side Firebase rejection
 * (during signInWithEmailAndPassword) and the server-side rejection (during
 * fetchMe / auth/login).
 */
import { FirebaseError } from "firebase/app";

const FIREBASE_CLIENT_MAP: Record<string, string> = {
  "auth/invalid-email": "That doesn't look like a valid email address.",
  "auth/missing-email": "Please enter your email.",
  "auth/missing-password": "Please enter your password.",
  "auth/user-not-found": "No account found with this email.",
  "auth/wrong-password": "Incorrect password. Try again.",
  "auth/invalid-credential": "Invalid email or password.",
  "auth/invalid-login-credentials": "Invalid email or password.",
  "auth/user-disabled": "This account has been disabled. Contact your account manager.",
  "auth/too-many-requests": "Too many failed attempts. Wait a few minutes and try again.",
  "auth/network-request-failed": "Connection problem. Check your internet and try again.",
  "auth/internal-error": "Something went wrong. Please try again.",
  "auth/operation-not-allowed": "Email/password sign-in is not enabled.",
  "auth/timeout": "Sign-in timed out. Please try again.",
  "auth/invalid-api-key": "Sign-in is misconfigured. Contact support.",
};

/** Backend-issued reasons (returned in `detail` on 401/403/503). */
const BACKEND_MAP: Record<string, string> = {
  "Missing or empty token": "Please sign in again.",
  "Invalid token": "Session is invalid. Please sign in again.",
  "Token expired, please sign in again": "Your session has expired. Please sign in again.",
  "Token revoked, please sign in again": "Your session was revoked. Please sign in again.",
  "Account is disabled": "This account has been disabled. Contact your account manager.",
  "User not provisioned": "Your account hasn't been set up. Contact your account manager.",
  "User suspended": "This account is suspended. Contact your account manager.",
  "Authentication service temporarily unavailable":
    "Sign-in is briefly unavailable. Please try again in a moment.",
};

/**
 * Best-effort translator. Tries (1) Firebase JS SDK FirebaseError.code,
 * (2) backend HTTP error body, (3) raw message, (4) fallback.
 */
export function friendlyAuthError(err: unknown): string {
  // Firebase client SDK error
  if (err instanceof FirebaseError) {
    const mapped = FIREBASE_CLIENT_MAP[err.code];
    if (mapped) return mapped;
    return `${err.code.replace("auth/", "").replace(/-/g, " ")}.`;
  }

  // Axios-style backend error with response.data.detail
  const e = err as { response?: { data?: { detail?: string } }; message?: string };
  const backendDetail = e?.response?.data?.detail;
  if (typeof backendDetail === "string") {
    return BACKEND_MAP[backendDetail] ?? backendDetail;
  }

  // Fall back to message
  if (e?.message) return e.message;
  return "Sign-in failed. Please try again.";
}
