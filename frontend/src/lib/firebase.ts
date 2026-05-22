import { initializeApp } from "firebase/app";
import { browserSessionPersistence, getAuth, setPersistence } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);

// ────────────────────────────────────────────────────────────────
// Per-tab session isolation.
//
// Firebase Auth defaults to `browserLocalPersistence` (IndexedDB) which is
// SHARED across all tabs of the same browser/origin. With that default,
// signing in as a client in one tab fires onAuthStateChanged in EVERY other
// tab — so an admin tab silently flips to the client identity.
//
// `browserSessionPersistence` uses sessionStorage, which is scoped per-tab.
// Each tab keeps its own session: log in as admin in tab A and client in
// tab B, switch back to A — still admin.
//
// Trade-off: opening a fresh blank tab and pasting a URL requires logging in
// again (sessionStorage starts empty). Acceptable for a B2B portal.
// Refreshing within a tab keeps the session (sessionStorage survives reload).
// ────────────────────────────────────────────────────────────────
setPersistence(auth, browserSessionPersistence).catch((err) => {
  // Non-fatal — falls back to LOCAL persistence if SESSION is unavailable
  // (e.g. some incognito modes). Log so we know.
  console.error("Firebase persistence set to SESSION failed:", err);
});
