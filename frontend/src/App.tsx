import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import LoginPage from "./features/auth/LoginPage";
import OverviewPage from "./features/overview/OverviewPage";
import StrategiesPage from "./features/strategies/StrategiesPage";
import RequestsPage from "./features/requests/RequestsPage";
import BacktestsListPage from "./features/backtests/BacktestsListPage";
import BacktestDetailPage from "./features/backtests/BacktestDetailPage";
import TermsAcceptPage from "./features/terms/TermsAcceptPage";
import AdminLayout from "./components/AdminLayout";
import AdminPulsePage from "./features/admin/AdminPulsePage";
import AdminClientsPage from "./features/admin/AdminClientsPage";
import AdminBacktestUploadPage from "./features/admin/AdminBacktestUploadPage";
import AdminNotificationsPage from "./features/admin/AdminNotificationsPage";
import AdminAuditPage from "./features/admin/AdminAuditPage";
import AdminTermsPage from "./features/admin/AdminTermsPage";
import { auth } from "./lib/firebase";
import { fetchMe } from "./lib/api";
import { useAuth } from "./store/auth";

function Protected({
  children,
  requireTncDone,
  requireAdmin,
  requireClient,
}: {
  children: React.ReactNode;
  requireTncDone?: boolean;
  requireAdmin?: boolean;
  requireClient?: boolean;
}) {
  const me = useAuth((s) => s.me);
  const loading = useAuth((s) => s.loading);
  if (loading) return <div className="p-6 text-sm text-ink-500">Loading…</div>;
  if (!me) return <Navigate to="/login" replace />;

  const isAdmin = me.role === "main_admin" || me.role === "sub_admin";
  if (requireAdmin && !isAdmin) return <Navigate to="/" replace />;
  if (requireClient && isAdmin) return <Navigate to="/admin" replace />;
  if (requireTncDone && me.role === "client" && me.needs_tnc_acceptance)
    return <Navigate to="/terms" replace />;
  return <>{children}</>;
}

export default function App() {
  const setMe = useAuth((s) => s.setMe);
  const setLoading = useAuth((s) => s.setLoading);

  useEffect(() => {
    let cancelled = false;

    const resolve = async (user: typeof auth.currentUser) => {
      if (cancelled) return;
      if (!user) {
        setMe(null);
      } else {
        try {
          const me = await fetchMe();
          if (!cancelled) setMe(me);
        } catch {
          if (!cancelled) setMe(null);
        }
      }
      if (!cancelled) setLoading(false);
    };

    // Subscribe for ongoing auth changes
    const unsub = onAuthStateChanged(auth, (user) => resolve(user));
    // Hard-resolve on initial load via authStateReady (handles persisted sessions)
    auth.authStateReady().then(() => resolve(auth.currentUser));

    // Safety net: if neither fires within 4s, stop spinning
    const failsafe = window.setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 4000);

    return () => {
      cancelled = true;
      window.clearTimeout(failsafe);
      unsub();
    };
  }, [setMe, setLoading]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/terms" element={<Protected><TermsAcceptPage /></Protected>} />

        {/* Client portal */}
        <Route element={<Protected requireClient requireTncDone><Layout /></Protected>}>
          <Route index element={<OverviewPage />} />
          <Route path="strategies" element={<StrategiesPage />} />
          <Route path="requests" element={<RequestsPage />} />
          <Route path="backtests" element={<BacktestsListPage />} />
          <Route path="backtests/:id" element={<BacktestDetailPage />} />
        </Route>

        {/* Admin console */}
        <Route path="admin" element={<Protected requireAdmin><AdminLayout /></Protected>}>
          <Route index element={<AdminPulsePage />} />
          <Route path="clients" element={<AdminClientsPage />} />
          <Route path="backtests/upload" element={<AdminBacktestUploadPage />} />
          <Route path="terms" element={<AdminTermsPage />} />
          <Route path="notifications" element={<AdminNotificationsPage />} />
          <Route path="audit" element={<AdminAuditPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
