import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowRight, BarChart3, CheckCircle2, FileText, Inbox, LineChart } from "lucide-react";
import { Badge, Button, Card, SectionTitle, StatTile } from "../../components/ui";
import { fetchBacktests, fetchRequests, type BacktestListItem } from "../../lib/api";
import { useAuth } from "../../store/auth";

export default function OverviewPage() {
  const me = useAuth((s) => s.me);
  const [backtests, setBacktests] = useState<BacktestListItem[]>([]);
  const [requestCount, setRequestCount] = useState(0);

  useEffect(() => {
    fetchBacktests().then(setBacktests).catch(() => setBacktests([]));
    fetchRequests().then((r) => setRequestCount(r.length)).catch(() => setRequestCount(0));
  }, []);

  const active = backtests.filter((b) => ["in_progress", "approved"].includes(b.status)).length;
  const completed = backtests.filter((b) => b.status === "completed").length;
  const pendingQuote = backtests.filter((b) => ["quote_requested", "quote_sent"].includes(b.status)).length;
  const demo = backtests.find((b) => b.code === "BT-2026-0001");

  return (
    <div className="space-y-6">
      <Card padding="p-0">
        <div className="px-7 py-6 flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400">
              Welcome back
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-ink-900 dark:text-ink-50">
              {me?.client?.name}
            </h1>
            <div className="mt-2 flex items-center gap-2 text-sm text-ink-500 dark:text-ink-400">
              <Badge status="active" dot>
                Tier {me?.client?.tier?.replace("tier", "")}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/strategies"><Button variant="secondary" icon={<FileText size={15}/>}>Upload strategy</Button></Link>
            <Link to="/requests"><Button variant="accent" icon={<MessageIcon/>}>New request</Button></Link>
          </div>
        </div>

        {demo && (
          <div className="border-t border-ink-100 dark:border-ink-800 bg-ink-50/60 dark:bg-ink-950/40 px-7 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="size-9 rounded-lg bg-accent-600/10 text-accent-700 dark:text-accent-300 flex items-center justify-center shrink-0">
                <LineChart size={18}/>
              </span>
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink-900 dark:text-ink-50 truncate">
                  Demo: {demo.name}
                </div>
                <div className="text-xs text-ink-500 dark:text-ink-400">
                  {demo.code} · completed · use to preview the full backtest view
                </div>
              </div>
            </div>
            <Link to={`/backtests/${demo.id}`}>
              <Button variant="secondary" icon={<ArrowRight size={15}/>}>Open results</Button>
            </Link>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatTile label="Active Backtests" value={String(active)} icon={<Activity size={14}/>} delta="in progress / approved" tone="neutral" />
        <StatTile label="Completed" value={String(completed)} icon={<CheckCircle2 size={14}/>} delta="lifetime" tone="pos" />
        <StatTile label="Pending Quotes" value={String(pendingQuote)} icon={<FileText size={14}/>} delta="awaiting decision" tone="neutral" />
        <StatTile label="Open Requests" value={String(requestCount)} icon={<Inbox size={14}/>} delta="from your side" tone="neutral" />
      </div>

      <Card>
        <SectionTitle sub="Most recent first">Latest backtests</SectionTitle>
        <ul className="divide-y divide-ink-100 dark:divide-ink-800">
          {backtests.slice(0, 5).map((b) => (
            <li key={b.id} className="py-3 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{b.name}</div>
                <div className="text-xs text-ink-500 tabular">{b.code}</div>
              </div>
              <div className="flex items-center gap-3">
                <Badge status={b.status} dot>{b.status.replace("_", " ")}</Badge>
                <Link to={`/backtests/${b.id}`} className="text-xs font-medium text-accent-700 dark:text-accent-300 hover:underline">
                  View →
                </Link>
              </div>
            </li>
          ))}
          {backtests.length === 0 && (
            <li className="py-8 text-center text-sm text-ink-500">No backtests yet.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}

function MessageIcon() {
  return <BarChart3 size={15} />;
}
