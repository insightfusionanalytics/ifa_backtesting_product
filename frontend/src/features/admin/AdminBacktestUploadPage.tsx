import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Download, FileText, Upload } from "lucide-react";
import { Button, Card, SectionTitle } from "../../components/ui";
import {
  type AdminClient,
  type AdminStrategy,
  fetchAdminClients,
  fetchBacktestExampleTemplate,
  fetchClientStrategies,
  uploadBacktestResult,
} from "../../lib/api";

export default function AdminBacktestUploadPage() {
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [clientId, setClientId] = useState("");
  const [strategies, setStrategies] = useState<AdminStrategy[]>([]);
  const [strategyId, setStrategyId] = useState<string>(""); // empty = not associated
  const [json, setJson] = useState("");
  const [violations, setViolations] = useState<{ path: string; message: string }[] | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  // Load clients on mount
  useEffect(() => {
    fetchAdminClients()
      .then((cs) => setClients(cs.filter((c) => c.status === "active")))
      .catch(() => setClients([]));
  }, []);

  // When client changes → fetch their strategies; reset strategy_id
  useEffect(() => {
    if (!clientId) {
      setStrategies([]);
      setStrategyId("");
      return;
    }
    fetchClientStrategies(clientId)
      .then((s) => setStrategies(s.filter((x) => x.status === "active")))
      .catch(() => setStrategies([]));
    setStrategyId("");
  }, [clientId]);

  // Clear violations / success whenever JSON changes — stale feedback is worse than no feedback
  const onJsonChange = (next: string) => {
    setJson(next);
    if (violations) setViolations(null);
    if (success) setSuccess(null);
  };

  // When admin links to a specific strategy, rewrite the JSON's strategy.name so the
  // backtest row in the list shows the actual strategy name, not the example template's
  // default ("EMA 20/50 Crossover with RSI Confirmation"). Only touches strategy.name —
  // leaves version/type/params alone since those are inputs the admin still has to set
  // to match the actual backtest run.
  useEffect(() => {
    if (!json.trim() || !strategyId) return;
    const linked = strategies.find((s) => s.id === strategyId);
    if (!linked) return;
    try {
      const parsed = JSON.parse(json);
      if (parsed?.strategy?.name === linked.name) return; // already in sync, no-op
      parsed.strategy = { ...(parsed.strategy ?? {}), name: linked.name };
      setJson(JSON.stringify(parsed, null, 2));
    } catch {
      // JSON not parseable yet — skip silently, preview already shows the syntax error
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategyId]);

  // Live preview of key fields (only if JSON parses)
  const preview = useMemo(() => {
    if (!json.trim()) return null;
    try {
      const p = JSON.parse(json) as {
        backtest_id?: string;
        result_type?: string;
        strategy?: { name?: string; version?: string; type?: string; instrument_type?: string };
        assumptions?: {
          date_range?: { from?: string; to?: string };
          initial_capital?: { amount?: number; currency?: string };
          timeframe?: string;
        };
        metrics?: {
          summary?: {
            total_return_pct?: number;
            cagr_pct?: number;
            sharpe?: number;
            max_drawdown_pct?: number;
            win_rate_pct?: number;
            n_trades?: number;
          };
        };
        trades?: unknown[];
      };
      return {
        ok: true as const,
        backtest_id: p.backtest_id ?? "",
        result_type: p.result_type ?? "",
        strategy_name: p.strategy?.name ?? "",
        strategy_version: p.strategy?.version ?? "",
        strategy_type: p.strategy?.type ?? "",
        instrument_type: p.strategy?.instrument_type ?? "",
        from: p.assumptions?.date_range?.from ?? "",
        to: p.assumptions?.date_range?.to ?? "",
        capital: p.assumptions?.initial_capital,
        timeframe: p.assumptions?.timeframe ?? "",
        summary: p.metrics?.summary ?? {},
        n_trades_actual: p.trades?.length ?? 0,
      };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [json]);

  const submit = async () => {
    setSubmitting(true);
    setViolations(null);
    setSuccess(null);
    try {
      const parsed = JSON.parse(json);
      const res = await uploadBacktestResult(clientId, parsed, strategyId || null);
      const linkedHint = strategyId
        ? ` (linked to strategy ${strategies.find((s) => s.id === strategyId)?.name ?? "?"})`
        : "";
      setSuccess(`Uploaded ${res.code} (${res.name})${linkedHint}`);
      setJson("");
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      if (typeof detail === "object" && detail?.violations) {
        setViolations(detail.violations);
      } else if (e?.name === "SyntaxError") {
        setViolations([{ path: "(root)", message: "Invalid JSON: " + e.message }]);
      } else {
        setViolations([
          { path: "(server)", message: typeof detail === "string" ? detail : detail?.error ?? e?.message ?? "Upload failed" },
        ]);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    onJsonChange(await f.text());
  };

  const loadTemplate = async () => {
    setLoadingTemplate(true);
    try {
      const tpl = (await fetchBacktestExampleTemplate()) as Record<string, unknown> & {
        backtest_id?: string;
        strategy?: Record<string, unknown> & { name?: string };
      };
      // Stamp a unique backtest_id so admin doesn't accidentally re-upload with the
      // canonical example's code ("BT-2026-0001") and silently duplicate the demo seed.
      // NOTE: split into three .replace calls (instead of one regex char class) because
      // Tailwind JIT's content scanner mistakes a square-bracket-colon pattern in source
      // code for an arbitrary-property class and emits broken CSS that lightningcss rejects.
      const stamp = new Date()
        .toISOString()
        .replace(/-/g, "")
        .replace(/:/g, "")
        .replace(/T/g, "")
        .slice(0, 14); // YYYYMMDDHHmmss
      const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
      tpl.backtest_id = `BT-${stamp}-${rand}`;

      // If a strategy is already linked, pre-stamp its name so the resulting row in
      // the backtests list doesn't read as the example default
      // ("EMA 20/50 Crossover with RSI Confirmation").
      const linked = strategies.find((s) => s.id === strategyId);
      if (linked) {
        tpl.strategy = { ...(tpl.strategy ?? {}), name: linked.name };
      }

      onJsonChange(JSON.stringify(tpl, null, 2));
    } catch (e) {
      alert("Could not load example template");
    } finally {
      setLoadingTemplate(false);
    }
  };

  const selectedClient = clients.find((c) => c.id === clientId);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-ink-500">Backtest delivery</p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">Upload backtest result</h1>
        <p className="mt-1 text-sm text-ink-500">
          Paste JSON or upload a file. The payload is validated against the locked v1.0 schema before persisting.
        </p>
      </div>

      <Card>
        <SectionTitle sub="Workflow: pick the client → review their submitted strategy → paste your backtest result JSON → upload.">
          New backtest
        </SectionTitle>

        <div className="space-y-5">
          {/* 1. Target client */}
          <div>
            <label className="text-xs font-medium text-ink-600 dark:text-ink-300">
              1. Target client
            </label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="mt-1 w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-950"
            >
              <option value="">— pick a client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.tier}
                </option>
              ))}
            </select>
            {selectedClient && (
              <p className="mt-1 text-[11px] text-ink-500">
                {selectedClient.name} · {selectedClient.tier} · client id <span className="font-mono">{selectedClient.id.slice(0, 8)}…</span>
              </p>
            )}
          </div>

          {/* 2. Strategies submitted by this client — admin reads these to know what to backtest */}
          {clientId && (
            <div>
              <label className="text-xs font-medium text-ink-600 dark:text-ink-300">
                2. Strategy this backtest is for {strategies.length > 0 && <span className="text-ink-400">(optional but recommended — links the backtest back to the doc the client submitted)</span>}
              </label>
              {strategies.length === 0 ? (
                <div className="mt-1 text-xs text-ink-500 italic p-3 rounded-lg bg-ink-50 dark:bg-ink-950/40 border border-ink-100 dark:border-ink-800">
                  This client hasn't uploaded any strategy documents yet.
                  You can still upload a backtest, but provenance won't link to a strategy doc.
                </div>
              ) : (
                <div className="mt-1 space-y-2">
                  <select
                    value={strategyId}
                    onChange={(e) => setStrategyId(e.target.value)}
                    className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-950"
                  >
                    <option value="">— don't link to a specific strategy —</option>
                    {strategies.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (v{s.version}) {s.is_source_of_truth ? "· SoT" : ""}
                      </option>
                    ))}
                  </select>

                  <ul className="space-y-1.5">
                    {strategies.slice(0, 5).map((s) => (
                      <li
                        key={s.id}
                        className={`flex items-center gap-2 p-2 rounded border text-xs ${
                          strategyId === s.id
                            ? "border-accent-400 bg-accent-50/40 dark:bg-accent-900/10"
                            : "border-ink-200 dark:border-ink-700"
                        }`}
                      >
                        <FileText size={12} className="text-ink-400 shrink-0" />
                        <span className="font-medium truncate flex-1">{s.name}</span>
                        <span className="text-ink-500 tabular shrink-0">
                          v{s.version} · {s.size_bytes ? `${(s.size_bytes / 1024).toFixed(0)} KB` : "—"}
                        </span>
                        <a
                          href={`/admin/clients`}
                          className="text-accent-700 dark:text-accent-300 hover:underline shrink-0"
                          title="Open client drawer to download this PDF"
                        >
                          view in client →
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* 3. JSON payload */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-ink-600 dark:text-ink-300">
                3. Result JSON (v1.0 schema)
              </label>
              <div className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={loadTemplate}
                  disabled={loadingTemplate}
                  className="text-accent-700 dark:text-accent-300 hover:underline inline-flex items-center gap-1 disabled:opacity-50"
                >
                  <Download size={12}/> {loadingTemplate ? "Loading…" : "Load example template"}
                </button>
                <label className="text-accent-700 dark:text-accent-300 hover:underline cursor-pointer">
                  <input type="file" accept=".json,application/json" className="hidden" onChange={onFile} />
                  Load from file
                </label>
              </div>
            </div>
            <textarea
              value={json}
              onChange={(e) => onJsonChange(e.target.value)}
              spellCheck={false}
              className="w-full min-h-[300px] px-3 py-2 text-xs font-mono rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-950"
              placeholder='{ "schema_version": "1.0", "result_type": "backtest", "backtest_id": "BT-...", "strategy": { ... }, "assumptions": { ... }, "metrics": { ... }, "time_series": { ... }, "trades": [...] }'
            />
            <div className="mt-1 flex items-center justify-between">
              <div className="text-xs text-ink-500">{json.length.toLocaleString()} chars</div>
              {preview && !preview.ok && (
                <div className="text-xs text-amber-700 dark:text-amber-400">
                  Not valid JSON yet — {preview.error.slice(0, 80)}
                </div>
              )}
            </div>
          </div>

          {/* 4. Live preview — surfaces key fields so admin can sanity-check before upload */}
          {preview && preview.ok && (
            <Card padding="p-4" className="bg-ink-50/60 dark:bg-ink-950/40 !border-dashed">
              <div className="text-[11px] uppercase tracking-wider text-ink-500 mb-2">Preview</div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                <KVrow k="Backtest ID" v={preview.backtest_id} mono />
                <KVrow k="Result type" v={preview.result_type} />
                <KVrow k="Strategy" v={`${preview.strategy_name}${preview.strategy_version ? " " + preview.strategy_version : ""}`} />
                <KVrow k="Type / instrument" v={`${preview.strategy_type} · ${preview.instrument_type}`} />
                <KVrow k="Date range" v={`${preview.from} → ${preview.to}`} />
                <KVrow k="Initial capital" v={preview.capital ? `${preview.capital.currency ?? ""} ${preview.capital.amount?.toLocaleString() ?? "?"}` : "—"} />
                <KVrow k="Timeframe" v={preview.timeframe} mono />
                <KVrow k="Trades (array length)" v={String(preview.n_trades_actual)} />
                <KVrow k="summary.n_trades" v={String(preview.summary?.n_trades ?? "—")} warn={preview.summary?.n_trades !== undefined && preview.summary.n_trades !== preview.n_trades_actual} />
                <KVrow k="Total return" v={pct(preview.summary?.total_return_pct)} />
                <KVrow k="CAGR" v={pct(preview.summary?.cagr_pct)} />
                <KVrow k="Sharpe" v={preview.summary?.sharpe?.toFixed(2) ?? "—"} />
                <KVrow k="Max drawdown" v={pct(preview.summary?.max_drawdown_pct)} />
                <KVrow k="Win rate" v={preview.summary?.win_rate_pct !== undefined ? `${preview.summary.win_rate_pct.toFixed(1)}%` : "—"} />
              </div>
              {preview.summary?.n_trades !== undefined && preview.summary.n_trades !== preview.n_trades_actual && (
                <div className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">
                  ⚠ summary.n_trades ({preview.summary.n_trades}) doesn't match trades array length ({preview.n_trades_actual}) — server will reject this.
                </div>
              )}
            </Card>
          )}

          {/* 5. Submit */}
          <div className="flex items-center justify-between pt-2 border-t border-ink-100 dark:border-ink-800">
            <div className="text-xs text-ink-500">
              {!clientId
                ? "Select a client to continue."
                : !json
                ? "Paste JSON or load the example template."
                : preview && !preview.ok
                ? "Fix JSON syntax before uploading."
                : "Ready."}
            </div>
            <Button
              variant="accent"
              icon={<Upload size={15}/>}
              onClick={submit}
              disabled={!json || !clientId || submitting || (preview ? !preview.ok : false)}
            >
              {submitting ? "Validating + uploading…" : "Validate & upload"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Success card */}
      {success && (
        <Card>
          <div className="flex items-center gap-3 text-sm">
            <Check className="text-emerald-600 dark:text-emerald-400" size={18}/>
            <div>
              <div className="font-medium">Upload complete</div>
              <div className="text-xs text-ink-500">{success}</div>
            </div>
          </div>
        </Card>
      )}

      {/* Violations card */}
      {violations && (
        <Card>
          <SectionTitle sub={`${violations.length} schema violation(s) — payload was rejected before storage`}>
            <span className="inline-flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle size={18}/> Validation failed
            </span>
          </SectionTitle>
          <ul className="space-y-2">
            {violations.map((v, i) => (
              <li key={i} className="text-xs">
                <span className="font-mono text-accent-700 dark:text-accent-300">{v.path || "(root)"}</span>
                <span className="text-ink-600 dark:text-ink-300">: {v.message}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function KVrow({ k, v, mono = false, warn = false }: { k: string; v: string; mono?: boolean; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-ink-500 dark:text-ink-400 truncate">{k}</span>
      <span
        className={`text-ink-900 dark:text-ink-100 truncate text-right ${
          mono ? "font-mono" : ""
        } ${warn ? "text-amber-700 dark:text-amber-400" : ""}`}
      >
        {v || "—"}
      </span>
    </div>
  );
}

function pct(v?: number): string {
  if (v === undefined || v === null || Number.isNaN(v)) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}
