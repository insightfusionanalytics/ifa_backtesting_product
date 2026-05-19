import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "./features/auth/LoginPage";
import { auth } from "./lib/firebase";
import { fetchMe } from "./lib/api";
import { useAuth } from "./store/auth";

function Protected({ children }: { children: React.ReactNode }) {
  const me = useAuth((s) => s.me);
  const loading = useAuth((s) => s.loading);
  if (loading) return <div className="p-6 text-sm text-ink-500">Loading…</div>;
  if (!me) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Home() {
  const me = useAuth((s) => s.me);
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold tracking-tight">Signed in</h1>
      <pre className="mt-4 text-xs bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-xl p-4 overflow-auto">
        {JSON.stringify(me, null, 2)}
      </pre>
      <p className="mt-4 text-sm text-ink-500">
        Day 1 smoke screen — full dashboard ports in Day 2-3.
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
        <Route path="/" element={<Protected><Home /></Protected>} />
        <Route path="/admin" element={<Protected><Home /></Protected>} />
        <Route path="/terms" element={<Protected><Home /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
