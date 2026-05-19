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
