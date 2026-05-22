import axios from "axios";
import { auth } from "./firebase";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1",
});

api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export type Me = {
  id: string;
  email: string;
  role: "client" | "sub_admin" | "main_admin";
  status: "active" | "suspended";
  client: { id: string; name: string; tier: string; status: string } | null;
  needs_tnc_acceptance: boolean;
  latest_tnc_version_id: string | null;
};

export async function fetchMe(): Promise<Me> {
  const res = await api.get<Me>("/me");
  return res.data;
}

export type TermsClause = { id: string; title: string; body: string; required: boolean };
export type Terms = {
  id: string;
  version: string;
  body: string;
  clauses: TermsClause[];
  effective_from: string;
};

export async function fetchTerms(): Promise<Terms> {
  const res = await api.get<Terms>("/terms/current");
  return res.data;
}

export async function acceptTerms(version_id: string, accepted_clauses: string[]) {
  const res = await api.post<{ ok: boolean; acceptance_id: string }>("/terms/accept", {
    version_id,
    accepted_clauses,
  });
  return res.data;
}

// ── Strategies ──────────────────────────────────────────────────
export type Strategy = {
  id: string;
  name: string;
  version: number;
  storage_key: string;
  size_bytes: number | null;
  mime_type: string | null;
  is_source_of_truth: boolean;
  status: string;
  uploaded_at: string;
};

export async function fetchStrategies(): Promise<Strategy[]> {
  const res = await api.get<Strategy[]>("/strategies");
  return res.data;
}

export type StrategyUploadInit = {
  upload_id: string;
  storage_key: string;
  signed_url: string;
  token: string | null;
  expires_in: number;
};

export async function initStrategyUpload(args: {
  name: string;
  filename: string;
  size_bytes: number;
  mime_type: string;
}): Promise<StrategyUploadInit> {
  const res = await api.post<StrategyUploadInit>("/strategies/upload", args);
  return res.data;
}

export async function finalizeStrategyUpload(upload_id: string, checksum: string): Promise<Strategy> {
  const res = await api.post<{ ok: boolean; strategy: Strategy }>(
    `/strategies/${upload_id}/finalize`,
    { checksum }
  );
  return res.data.strategy;
}

// ── Requests ────────────────────────────────────────────────────
export type RequestType = "new_strategy" | "change" | "quote" | "clarification";
export type ClientRequest = {
  id: string;
  type: RequestType;
  status: string;
  payload: Record<string, unknown>;
  strategy_id: string | null;
  submitted_at: string;
};

export async function fetchRequests(): Promise<ClientRequest[]> {
  const res = await api.get<ClientRequest[]>("/requests");
  return res.data;
}

export async function submitRequest(args: {
  type: RequestType;
  payload: Record<string, unknown>;
  strategy_id?: string | null;
}): Promise<ClientRequest> {
  const res = await api.post<ClientRequest>("/requests", args);
  return res.data;
}

// ── Backtests ───────────────────────────────────────────────────
export type BacktestListItem = {
  id: string;
  code: string;
  name: string;
  status: string;
  completed_at: string | null;
  created_at: string;
};

export type BacktestDetail = {
  id: string;
  code: string;
  name: string;
  status: string;
  assumptions: Record<string, unknown> | null;
  metrics: Record<string, unknown> | null;
  result: BacktestResult | null;
  completed_at: string | null;
  created_at: string;
};

/** The locked v1.0 backtest result schema (loaded server-side from the bucket). */
export type BacktestResult = {
  schema_version: string;
  result_type: "scanner" | "backtest" | "live";
  backtest_id: string;
  strategy: { name: string; version: string; description?: string; type: string };
  universe?: { name?: string; symbols?: string[]; market_data_provider?: { name: string }; brokerage?: { name: string } };
  assumptions: {
    date_range: { from: string; to: string };
    initial_capital: { amount: number; currency: string };
    timeframe: string;
    [k: string]: unknown;
  };
  metrics: {
    summary: Record<string, number>;
    risk?: Record<string, number>;
    [k: string]: unknown;
  };
  time_series: {
    equity_curve: { date: string; nav: number }[];
    drawdown_curve: { date: string; drawdown_pct: number }[];
    benchmark_curves?: { name: string; series: { date: string; value: number }[] }[];
  };
  trades: Array<{
    id: string;
    symbol: string;
    side: "long" | "short";
    entry: { timestamp: string; price: number; quantity: number };
    exit: { timestamp: string; price: number };
    pnl: { net: number; pct: number };
    holding?: { calendar_days?: number };
  }>;
  disclaimer?: string;
};

export async function fetchBacktests(status?: string): Promise<BacktestListItem[]> {
  const res = await api.get<BacktestListItem[]>("/backtests", { params: status ? { status } : {} });
  return res.data;
}

export async function fetchBacktest(id: string): Promise<BacktestDetail> {
  const res = await api.get<BacktestDetail>(`/backtests/${id}`);
  return res.data;
}

// ── Admin ───────────────────────────────────────────────────────
export type PlatformStats = {
  n_clients: number;
  n_clients_active: number;
  n_backtests: number;
  n_backtests_completed: number;
  n_requests_open: number;
  tier_distribution: Record<string, number>;
};

export async function fetchPlatformStats(): Promise<PlatformStats> {
  return (await api.get<PlatformStats>("/admin/stats")).data;
}

export type AdminClient = {
  id: string;
  name: string;
  primary_contact: string | null;
  tier: "tier1" | "tier2" | "tier3";
  status: "active" | "suspended";
  deleted_at: string | null;
  created_at: string;
};

export async function fetchAdminClients(): Promise<AdminClient[]> {
  return (await api.get<AdminClient[]>("/admin/clients")).data;
}

export async function createAdminClient(args: {
  name: string;
  primary_contact?: string;
  tier?: "tier1" | "tier2" | "tier3";
  user_email: string;
  user_password: string;
}) {
  return (await api.post("/admin/clients", args)).data;
}

export async function updateAdminClient(id: string, patch: Partial<AdminClient>) {
  return (await api.patch<AdminClient>(`/admin/clients/${id}`, patch)).data;
}

export async function deleteAdminClient(id: string) {
  await api.delete(`/admin/clients/${id}`);
}

export async function uploadBacktestResult(
  client_id: string,
  result: object,
  strategy_id?: string | null,
) {
  return (
    await api.post("/admin/backtests/upload-result", {
      client_id,
      result,
      ...(strategy_id ? { strategy_id } : {}),
    })
  ).data;
}

export async function fetchBacktestExampleTemplate(): Promise<object> {
  return (await api.get<object>("/admin/backtests/example-template")).data;
}

// ── Admin inbox: "what needs my attention right now" ───────────
export type AdminInboxItem = {
  type: "strategy_uploaded" | "request_open";
  id: string;
  client_id: string;
  client_name: string;
  title: string;
  subtitle: string;
  occurred_at: string;
  href: string;
};

export type AdminInbox = {
  items: AdminInboxItem[];
  total: number;
  unread_strategies: number;
  unread_requests: number;
};

export async function fetchAdminInbox(): Promise<AdminInbox> {
  return (await api.get<AdminInbox>("/admin/inbox")).data;
}

// Admin: list a specific client's requests (uses the same /admin/inbox under the hood
// would be nice but inbox only shows OPEN. We need full list per client.)
// We'll route via a new admin endpoint added below.
export async function fetchClientRequests(clientId: string): Promise<ClientRequest[]> {
  const r = await api.get<ClientRequest[]>(`/admin/clients/${clientId}/requests`);
  return r.data;
}

export async function publishTerms(args: {
  version: string;
  body: string;
  clauses: Array<{ id: string; title: string; body: string; required: boolean }>;
}) {
  return (await api.post("/admin/terms", args)).data;
}

export async function fetchAdminTerms() {
  return (await api.get("/admin/terms")).data;
}

export async function broadcastNotification(args: { title: string; body: string }) {
  return (await api.post("/admin/notifications/broadcast", args)).data;
}

export async function personalNotification(args: {
  client_id: string;
  title: string;
  body: string;
}) {
  return (await api.post("/admin/notifications/personal", args)).data;
}

export type AuditEntry = {
  id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  payload: Record<string, unknown> | null;
  ip: string | null;
  occurred_at: string;
};

export async function fetchAuditLog(action_prefix?: string): Promise<AuditEntry[]> {
  return (await api.get<AuditEntry[]>("/admin/audit", {
    params: action_prefix ? { action_prefix } : {},
  })).data;
}

// ── Admin: client-strategies (read uploads to know what the client wants tested) ──
export type AdminStrategy = {
  id: string;
  client_id: string;
  name: string;
  version: number;
  storage_key: string;
  size_bytes: number | null;
  mime_type: string | null;
  checksum: string | null;
  is_source_of_truth: boolean;
  status: string;
  uploaded_by: string | null;
  uploaded_at: string;
};

export async function fetchClientStrategies(clientId: string): Promise<AdminStrategy[]> {
  const r = await api.get<AdminStrategy[]>(`/admin/clients/${clientId}/strategies`);
  return r.data;
}

export async function getStrategyDownloadUrl(strategyId: string): Promise<string> {
  const r = await api.get<{ signed_url: string; expires_in: number }>(
    `/admin/strategies/${strategyId}/download-url`
  );
  return r.data.signed_url;
}
