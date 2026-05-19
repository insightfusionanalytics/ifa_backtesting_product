import { signInWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../../lib/firebase";
import { fetchMe } from "../../lib/api";
import { useAuth } from "../../store/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const setMe = useAuth((s) => s.setMe);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      const me = await fetchMe();
      setMe(me);
      if (me.role === "client" && me.needs_tnc_acceptance) navigate("/terms");
      else if (me.role === "client") navigate("/");
      else navigate("/admin");
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? err?.message ?? "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white dark:bg-ink-900 rounded-2xl shadow-pop border border-ink-200 dark:border-ink-800 p-8">
        <div className="flex items-center gap-3 mb-6">
          <span className="size-9 rounded-xl bg-ink-900 dark:bg-ink-50 text-white dark:text-ink-900 flex items-center justify-center font-semibold text-sm">
            IFA
          </span>
          <div>
            <div className="text-base font-semibold tracking-tight">Backtest Engine</div>
            <div className="text-[11px] text-ink-500 uppercase tracking-wider">Client Portal</div>
          </div>
        </div>

        <h1 className="text-xl font-semibold tracking-tight mb-1">Sign in</h1>
        <p className="text-sm text-ink-500 dark:text-ink-400 mb-6">
          Use the credentials shared by your account manager.
        </p>

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-ink-600 dark:text-ink-300">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full h-10 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-950 focus:outline-none focus:ring-2 focus:ring-accent-500/40"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600 dark:text-ink-300">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full h-10 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-950 focus:outline-none focus:ring-2 focus:ring-accent-500/40"
            />
          </div>
          {error && (
            <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full h-10 bg-accent-600 hover:bg-accent-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-[11px] text-ink-400 text-center">
          No account? Contact your IFA account manager.
        </p>
      </div>
    </div>
  );
}
