import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { Button, Card, SectionTitle } from "../../components/ui";
import { broadcastNotification, fetchAdminClients, personalNotification, type AdminClient } from "../../lib/api";

export default function AdminNotificationsPage() {
  const [mode, setMode] = useState<"broadcast" | "personal">("broadcast");
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAdminClients().then((cs) => {
      setClients(cs);
      if (cs[0]) setClientId(cs[0].id);
    });
  }, []);

  const send = async () => {
    setSubmitting(true);
    setMsg(null);
    try {
      if (mode === "broadcast") {
        await broadcastNotification({ title, body });
        setMsg("Broadcast sent to all clients");
      } else {
        await personalNotification({ client_id: clientId, title, body });
        setMsg("Personal notification sent");
      }
      setTitle("");
      setBody("");
    } catch (e: any) {
      setMsg(e?.response?.data?.detail ?? "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle sub="Reach all clients or one specific client. In-app inbox delivery only (no email/SMS in V1).">
          Compose notification
        </SectionTitle>

        <div className="flex gap-1 p-1 bg-ink-100 dark:bg-ink-800 rounded-lg w-fit mb-4">
          {(["broadcast", "personal"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 h-8 text-xs font-medium rounded-md transition-colors ${
                mode === m ? "bg-white dark:bg-ink-900 text-ink-900 dark:text-ink-50 shadow-sm" : "text-ink-500"
              }`}
            >
              {m === "broadcast" ? "Broadcast to all" : "Personal"}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {mode === "personal" && (
            <div>
              <label className="text-xs font-medium text-ink-600 dark:text-ink-300">Target client</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="mt-1 w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-950"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-ink-600 dark:text-ink-300">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-950" placeholder="e.g. T&C v1.2 published" />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600 dark:text-ink-300">Body</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} className="mt-1 w-full min-h-[120px] px-3 py-2 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-950" placeholder="Full message body" />
          </div>
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-emerald-600 dark:text-emerald-400">{msg}</span>
            <Button variant="accent" icon={<Send size={15}/>} onClick={send} disabled={!title || !body || submitting || (mode === "personal" && !clientId)}>
              {submitting ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
