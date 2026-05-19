import { useEffect, useState } from "react";
import { Activity, BarChart3, CheckCircle2, Inbox, Users } from "lucide-react";
import { Badge, Card, SectionTitle, StatTile } from "../../components/ui";
import { fetchAdminClients, fetchPlatformStats, type AdminClient, type PlatformStats } from "../../lib/api";

export default function AdminPulsePage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [clients, setClients] = useState<AdminClient[]>([]);

  useEffect(() => {
    fetchPlatformStats().then(setStats).catch(() => setStats(null));
    fetchAdminClients().then(setClients).catch(() => setClients([]));
  }, []);

  if (!stats) return <div className="text-sm text-ink-500">Loading platform stats…</div>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-ink-500">Platform pulse</p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">Operations dashboard</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <StatTile label="Clients" value={String(stats.n_clients)} icon={<Users size={14}/>} delta={`${stats.n_clients_active} active`} />
        <StatTile label="Backtests" value={String(stats.n_backtests)} icon={<BarChart3 size={14}/>} delta="all-time" />
        <StatTile label="Completed" value={String(stats.n_backtests_completed)} icon={<CheckCircle2 size={14}/>} tone="pos" />
        <StatTile label="Open requests" value={String(stats.n_requests_open)} icon={<Inbox size={14}/>} delta="awaiting reply" />
        <StatTile label="Tiers" value={Object.entries(stats.tier_distribution).map(([k, v]) => `${k.replace("tier", "T")}:${v}`).join(" ") || "—"} icon={<Activity size={14}/>} />
      </div>

      <Card>
        <SectionTitle sub="Most recent first">All clients</SectionTitle>
        <ul className="divide-y divide-ink-100 dark:divide-ink-800">
          {clients.map((c) => (
            <li key={c.id} className="py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{c.name}</div>
                <div className="text-xs text-ink-500 tabular">
                  {c.primary_contact ?? "—"} · joined {new Date(c.created_at).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge status={c.status} dot>{c.status}</Badge>
                <span className="text-xs uppercase tracking-wider text-ink-500">{c.tier}</span>
              </div>
            </li>
          ))}
          {clients.length === 0 && (
            <li className="py-8 text-center text-sm text-ink-500">No clients yet.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
