import { useEffect, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Badge, Button, Card, Modal, SectionTitle } from "../../components/ui";
import {
  type AdminClient,
  createAdminClient,
  deleteAdminClient,
  fetchAdminClients,
  updateAdminClient,
} from "../../lib/api";

export default function AdminClientsPage() {
  const [rows, setRows] = useState<AdminClient[]>([]);
  const [selected, setSelected] = useState<AdminClient | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const refresh = () => fetchAdminClients().then(setRows).catch(() => setRows([]));
  useEffect(() => { refresh(); }, []);

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle
          sub="Provision new clients, change tiers, suspend or soft-delete."
          action={<Button variant="accent" icon={<Plus size={15}/>} onClick={() => setCreateOpen(true)}>New client</Button>}
        >
          Clients
        </SectionTitle>

        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-ink-500 dark:text-ink-400">
                <th className="text-left font-medium px-5 py-2.5">Name</th>
                <th className="text-left font-medium px-5 py-2.5">Primary contact</th>
                <th className="text-left font-medium px-5 py-2.5">Tier</th>
                <th className="text-left font-medium px-5 py-2.5">Status</th>
                <th className="text-left font-medium px-5 py-2.5">Joined</th>
                <th className="text-right font-medium px-5 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-ink-50/70 dark:hover:bg-ink-800/30 cursor-pointer" onClick={() => setSelected(c)}>
                  <td className="px-5 py-3 font-medium">{c.name}</td>
                  <td className="px-5 py-3 text-ink-600">{c.primary_contact ?? "—"}</td>
                  <td className="px-5 py-3 uppercase tracking-wider text-xs text-ink-500">{c.tier}</td>
                  <td className="px-5 py-3"><Badge status={c.status} dot>{c.status}</Badge></td>
                  <td className="px-5 py-3 text-ink-500 tabular">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelected(c); }}>Edit</Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-ink-500">No clients yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {selected && <ClientDrawer client={selected} onClose={() => { setSelected(null); refresh(); }} />}
      {createOpen && <CreateClientModal onClose={() => { setCreateOpen(false); refresh(); }} />}
    </div>
  );
}

function ClientDrawer({ client, onClose }: { client: AdminClient; onClose: () => void }) {
  const [tier, setTier] = useState<AdminClient["tier"]>(client.tier);
  const [status, setStatus] = useState<AdminClient["status"]>(client.status);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    try {
      await updateAdminClient(client.id, { tier, status });
      setMsg("Saved");
      setTimeout(onClose, 600);
    } catch (e: any) {
      setMsg(e?.response?.data?.detail ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Soft-delete ${client.name}? Data retained 30 days.`)) return;
    await deleteAdminClient(client.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-white dark:bg-ink-900 border-l border-ink-200 dark:border-ink-800 shadow-pop h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-ink-100 dark:border-ink-800 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">{client.name}</div>
            <div className="text-xs text-ink-500 font-mono">{client.id.slice(0, 8)}…</div>
          </div>
          <button onClick={onClose} className="size-8 rounded-md text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800 flex items-center justify-center">
            <X size={15}/>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-ink-600 dark:text-ink-300">Tier</label>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as AdminClient["tier"])}
              className="mt-1 w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-950"
            >
              <option value="tier1">Tier 1 — Starter</option>
              <option value="tier2">Tier 2 — Growth</option>
              <option value="tier3">Tier 3 — Enterprise</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-ink-600 dark:text-ink-300">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as AdminClient["status"])}
              className="mt-1 w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-950"
            >
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <div className="pt-4 border-t border-ink-100 dark:border-ink-800 flex items-center justify-between">
            <Button variant="danger" icon={<Trash2 size={14}/>} onClick={remove}>Soft delete</Button>
            <div className="flex items-center gap-3">
              {msg && <span className="text-xs text-emerald-600">{msg}</span>}
              <Button variant="accent" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateClientModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [tier, setTier] = useState<AdminClient["tier"]>("tier1");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await createAdminClient({
        name,
        primary_contact: contact,
        tier,
        user_email: email,
        user_password: password,
      });
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to create");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="New client"
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          {error && <span className="text-xs text-red-600 mr-auto">{error}</span>}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="accent" onClick={submit} disabled={!name || !email || !password || submitting}>
            {submitting ? "Creating…" : "Create client"}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Client name" full>
          <input value={name} onChange={(e) => setName(e.target.value)} className="h-9 w-full px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-950" placeholder="e.g. Northbridge Asset Mgmt." />
        </Field>
        <Field label="Primary contact">
          <input value={contact} onChange={(e) => setContact(e.target.value)} className="h-9 w-full px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-950" placeholder="Person of contact" />
        </Field>
        <Field label="Tier">
          <select value={tier} onChange={(e) => setTier(e.target.value as AdminClient["tier"])} className="h-9 w-full px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-950">
            <option value="tier1">Tier 1 — Starter</option>
            <option value="tier2">Tier 2 — Growth</option>
            <option value="tier3">Tier 3 — Enterprise</option>
          </select>
        </Field>
        <Field label="User email" full>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="h-9 w-full px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-950" placeholder="login@client.com" />
        </Field>
        <Field label="Initial password" full>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="text" className="h-9 w-full px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-950" placeholder="Share with client out-of-band" />
        </Field>
      </div>
    </Modal>
  );
}

function Field({ label, children, full = false }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="text-xs font-medium text-ink-600 dark:text-ink-300">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
