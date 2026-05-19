import { useEffect, useState } from "react";
import { Upload, Check, AlertCircle } from "lucide-react";
import { Badge, Button, Card, SectionTitle } from "../../components/ui";
import { fetchAdminClients, uploadBacktestResult, type AdminClient } from "../../lib/api";

export default function AdminBacktestUploadPage() {
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [clientId, setClientId] = useState("");
  const [json, setJson] = useState("");
  const [violations, setViolations] = useState<{ path: string; message: string }[] | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAdminClients().then((cs) => {
      setClients(cs);
      if (cs[0]) setClientId(cs[0].id);
    });
  }, []);

  const submit = async () => {
    setSubmitting(true);
    setViolations(null);
    setSuccess(null);
    try {
      const parsed = JSON.parse(json);
      const res = await uploadBacktestResult(clientId, parsed);
      setSuccess(`Uploaded ${res.code} (${res.name})`);
      setJson("");
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      if (typeof detail === "object" && detail?.violations) {
        setViolations(detail.violations);
      } else if (e?.name === "SyntaxError") {
        setViolations([{ path: "(root)", message: "Invalid JSON: " + e.message }]);
      } else {
        setViolations([{ path: "(server)", message: detail ?? e?.message ?? "Upload failed" }]);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setJson(await f.text());
  };

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
        <SectionTitle sub="The completed backtest will appear in the selected client's Backtests list with status = completed.">
          New backtest
        </SectionTitle>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-ink-600 dark:text-ink-300">Target client</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="mt-1 w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-950"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.tier}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-ink-600 dark:text-ink-300">
                Result JSON (v1.0 schema)
              </label>
              <label className="text-xs text-accent-700 dark:text-accent-300 hover:underline cursor-pointer">
                <input type="file" accept=".json,application/json" className="hidden" onChange={onFile} />
                Load from file
              </label>
            </div>
            <textarea
              value={json}
              onChange={(e) => setJson(e.target.value)}
              spellCheck={false}
              className="w-full min-h-[300px] px-3 py-2 text-xs font-mono rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-950"
              placeholder='{ "schema_version": "1.0", "result_type": "backtest", "backtest_id": "BT-...", "strategy": { ... }, "assumptions": { ... }, "metrics": { ... }, "time_series": { ... }, "trades": [...] }'
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="text-xs text-ink-500">{json.length} chars</div>
            <Button variant="accent" icon={<Upload size={15}/>} onClick={submit} disabled={!json || !clientId || submitting}>
              {submitting ? "Validating + uploading…" : "Validate & upload"}
            </Button>
          </div>
        </div>
      </Card>

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
