import { useEffect } from "react";
import { signOut } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "./features/auth/LoginPage";
import TermsAcceptPage from "./features/terms/TermsAcceptPage";
import { auth } from "./lib/firebase";
import { fetchMe } from "./lib/api";
import { useAuth } from "./store/auth";

function Protected({ children, requireTncDone }: { children: React.ReactNode; requireTncDone?: boolean }) {
  const me = useAuth((s) => s.me);
  const loading = useAuth((s) => s.loading);
  if (loading) return <div className="p-6 text-sm text-ink-500">Loading…</div>;
  if (!me) return <Navigate to="/login" replace />;
  if (requireTncDone && me.role === "client" && me.needs_tnc_acceptance)
    return <Navigate to="/terms" replace />;
  return <>{children}</>;
}

function Home() {
  const me = useAuth((s) => s.me);
  const setMe = useAuth((s) => s.setMe);
  const logout = async () => {
    await signOut(auth);
    setMe(null);
  };
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Signed in</h1>
        <button onClick={logout} className="text-xs text-ink-500 hover:text-ink-900 dark:hover:text-ink-100 underline">
          Log out
        </button>
      </div>
      <pre className="mt-4 text-xs bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-xl p-4 overflow-auto">
        {JSON.stringify(me, null, 2)}
      </pre>
      <p className="mt-4 text-sm text-ink-500">
        Day 2 placeholder — full dashboard lands in Phase E.
      </p>
    </div>
  );
}

export default function App() {
  const setMe = useAuth((s) => s.setMe);
  const setLoading = useAuth((s) => s.setLoading);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setMe(null);
        setLoading(false);
        return;
      }
      try {
        const me = await fetchMe();
        setMe(me);
      } catch {
        setMe(null);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [setMe, setLoading]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/terms" element={<Protected><TermsAcceptPage /></Protected>} />
        <Route path="/" element={<Protected requireTncDone><Home /></Protected>} />
        <Route path="/admin" element={<Protected><Home /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
