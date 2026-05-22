import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, RefreshCw } from "lucide-react";
import { Badge, Button, Card, SectionTitle } from "../../components/ui";
import { fetchBacktests, type BacktestListItem } from "../../lib/api";
import { usePolling } from "../../lib/usePolling";

const FILTERS = ["all", "draft", "in_progress", "completed", "approved", "cancelled"] as const;
type Filter = (typeof FILTERS)[number];

export default function BacktestsListPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const fetcher = useCallback(
    () => fetchBacktests(filter === "all" ? undefined : filter),
    [filter],
  );
  const { data, refresh, lastUpdated } = usePolling<BacktestListItem[]>(fetcher, 15_000);
  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle
          sub={
            lastUpdated
              ? `All runs submitted on behalf of your organisation · auto-refreshes · last ${lastUpdated.toLocaleTimeString()}`
              : "All runs submitted on behalf of your organisation."
          }
          action={
            <button onClick={refresh} className="text-xs text-ink-500 hover:text-ink-900 dark:hover:text-ink-100 inline-flex items-center gap-1">
              <RefreshCw size={12}/> Refresh
            </button>
          }
        >
          Backtests
        </SectionTitle>

        <div className="flex flex-wrap gap-2 mb-4">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 h-8 rounded-full text-xs font-medium border transition-colors ${
                filter === f
                  ? "bg-ink-900 text-white border-ink-900 dark:bg-ink-50 dark:text-ink-900 dark:border-ink-50"
                  : "bg-white text-ink-600 border-ink-200 hover:border-ink-300 dark:bg-ink-900 dark:text-ink-300 dark:border-ink-700"
              }`}
            >
              {f.replace("_", " ")}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-ink-500 dark:text-ink-400">
                <th className="text-left font-medium px-5 py-2.5">Backtest ID</th>
                <th className="text-left font-medium px-5 py-2.5">Strategy</th>
                <th className="text-left font-medium px-5 py-2.5">Date requested</th>
                <th className="text-left font-medium px-5 py-2.5">Status</th>
                <th className="text-right font-medium px-5 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
              {rows.map((b) => (
                <tr key={b.id} className="hover:bg-ink-50/70 dark:hover:bg-ink-800/30">
                  <td className="px-5 py-3 font-mono text-xs text-ink-700 dark:text-ink-200 tabular">
                    {b.code}
                  </td>
                  <td className="px-5 py-3 font-medium text-ink-900 dark:text-ink-50">{b.name}</td>
                  <td className="px-5 py-3 text-ink-500 dark:text-ink-400 tabular">
                    {new Date(b.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3"><Badge status={b.status} dot>{b.status.replace("_", " ")}</Badge></td>
                  <td className="px-5 py-3 text-right">
                    <Link to={`/backtests/${b.id}`}>
                      <Button size="sm" variant="ghost" icon={<Eye size={13}/>}>View</Button>
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-ink-500">No backtests match this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
