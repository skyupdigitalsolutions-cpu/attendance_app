// Fingerprint machine: status, its enrolled users (linked or not), and two actions:
// "Get users from machine" and "Re-send punches" for dates that are missing.
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock, Download, Fingerprint, RefreshCw, Users, Wifi, WifiOff, XCircle } from "lucide-react";
import { addDays, api, timeAgo, todayLocal } from "../lib/core";
import { Badge, Button, Card, CardTitle, Empty, Field, Input, Muted, Select, Spinner, cx, useToast } from "./ui";

const CMD_TONE = { queued: ["Waiting for the machine", "late"], sent: ["Sent, waiting for reply", "info"], done: ["Done", "present"], failed: ["Machine refused", "absent"] };

export default function MachineCard({ people, onLink, linkedNow, onDiscard, refreshKey }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [from, setFrom] = useState(addDays(todayLocal(), -6));
  const [to, setTo] = useState(todayLocal());
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try { setData((await api("/attendance-app/machine")).data); setError(""); } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);
  // While a command is waiting, refresh every 8 s so its status updates by itself
  const waiting = data?.devices.some((d) => d.commands.some((c) => c.status === "queued" || c.status === "sent"));
  useEffect(() => { if (!waiting) return; const t = setInterval(load, 8000); return () => clearInterval(t); }, [waiting, load]);

  const send = async (path, body, done) => {
    setBusy(path);
    try { await api(path, { method: "POST", body }); toast(done); load(); } catch (e) { toast(e.message); } finally { setBusy(""); }
  };

  if (error) return <Card className="p-4"><Empty>{error}</Empty></Card>;
  if (!data) return <Card><Spinner label="Checking the fingerprint machine…" /></Card>;

  const notLinked = data.users.filter((u) => !u.employee);
  const linked = data.users.length - notLinked.length;
  const options = [...people].filter((p) => p.status !== "inactive").sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2"><Fingerprint className="size-5 text-brand-600 dark:text-brand-400" aria-hidden /> Fingerprint machine</CardTitle>
          <Muted>Get the machine's user list to see who isn't linked yet, and ask it to re-send punches for days that are missing.</Muted>
        </div>
        <Button size="sm" icon={RefreshCw} onClick={load}>Refresh</Button>
      </div>

      {!data.devices.length ? (
        <Empty>No fingerprint machine has contacted the server yet. Check the machine's server address (ADMS / Cloud server settings).</Empty>
      ) : data.devices.map((d) => (
        <div key={d.serial} className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <b className="flex items-center gap-1.5">
              {d.online ? <Wifi className="size-4 text-emerald-600" aria-hidden /> : <WifiOff className="size-4 text-rose-500" aria-hidden />}
              {d.serial}
            </b>
            <Badge tone={d.online ? "present" : "absent"}>{d.online ? "Connected" : "Not connected"}</Badge>
            <span className="text-zinc-500">Last contact {d.last_seen ? timeAgo(d.last_seen) : "never"}</span>
            <span className="text-zinc-500">Last punches {d.last_punches_at ? `${timeAgo(d.last_punches_at)} (${d.last_punches_count})` : "—"}</span>
            <span className="text-zinc-500">{d.users_count ? `${d.users_count} users on the machine` : "User list not fetched yet"}</span>
          </div>
          {d.commands.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm">
              {d.commands.slice(0, 4).map((c) => {
                const [label, tone] = CMD_TONE[c.status] || [c.status, "neutral"];
                return (
                  <li key={c.id} className="flex flex-wrap items-center gap-2">
                    {c.status === "done" ? <CheckCircle2 className="size-4 text-emerald-600" aria-hidden /> : c.status === "failed" ? <XCircle className="size-4 text-rose-500" aria-hidden /> : <Clock className="size-4 text-amber-500" aria-hidden />}
                    <span>{c.label}</span><Badge tone={tone}>{label}</Badge>
                    <span className="text-xs text-zinc-400">{timeAgo(c.created_at)}{c.created_by ? `, ${c.created_by}` : ""}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}

      {data.devices.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="flex flex-col gap-2 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
            <b className="flex items-center gap-2"><Users className="size-4" aria-hidden /> Users on the machine</b>
            <Muted>Asks the machine for everyone enrolled on it, with the names saved on the machine.</Muted>
            <div><Button icon={Download} loading={busy === "/attendance-app/machine/fetch-users"}
              onClick={() => send("/attendance-app/machine/fetch-users", {}, "Asked the machine for its user list. It answers within a minute.")}>Get users from machine</Button></div>
          </div>
          <div className="flex flex-col gap-2 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
            <b className="flex items-center gap-2"><RefreshCw className="size-4" aria-hidden /> Re-send missing punches</b>
            <Muted>Asks the machine to send its punches for these dates again. Punches already saved are ignored.</Muted>
            <div className="flex flex-wrap items-end gap-2">
              <Field label="From"><Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-10" /></Field>
              <Field label="To"><Input type="date" value={to} min={from} max={todayLocal()} onChange={(e) => setTo(e.target.value)} className="h-10" /></Field>
              <Button icon={RefreshCw} loading={busy === "/attendance-app/machine/resync"}
                onClick={() => send("/attendance-app/machine/resync", { from, to }, "Asked the machine to re-send punches. They arrive within a few minutes.")}>Re-send</Button>
            </div>
          </div>
        </div>
      )}

      {data.users.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">
            <span className="text-emerald-700 dark:text-emerald-300">{linked} linked to an employee</span>
            {notLinked.length > 0 && <span className="text-rose-600 dark:text-rose-400">, {notLinked.length} not linked (their punches don't reach anyone's attendance)</span>}
          </p>
          {notLinked.length > 0 && (
            <ul className="rounded-xl border border-zinc-200 dark:border-zinc-700">
              {notLinked.map((u) => {
                const staged = linkedNow(u.pin);
                return (
                  <li key={u.pin} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 border-t border-zinc-100 px-3 py-2.5 first:border-0 sm:grid-cols-[6rem_1fr_auto] dark:border-zinc-800">
                    <span>Device ID <b className="tabular-nums">{u.pin}</b></span>
                    <span className="min-w-0 text-sm">
                      <b>{u.name || "No name on the machine"}</b>
                      {u.unassigned_punches > 0 && <span className="text-zinc-500">, {u.unassigned_punches} punch{u.unassigned_punches === 1 ? "" : "es"} kept</span>}
                    </span>
                    {staged ? <span className="col-span-2 text-sm text-emerald-700 sm:col-span-1 dark:text-emerald-300">Links to <b>{staged}</b> when you save</span> : (
                      <span className="col-span-2 flex gap-2 sm:col-span-1">
                        <Select aria-label={`Link Device ID ${u.pin} to`} value="" onChange={(e) => e.target.value && onLink(u.pin, e.target.value)} className="h-10 flex-1 sm:w-64">
                          <option value="">Link to employee…</option>
                          {options.map((p) => <option key={p._id} value={p._id}>{p.name}{p.fingerprint_id ? ` (has Device ID ${p.fingerprint_id})` : ""}</option>)}
                        </Select>
                        {u.unassigned_punches > 0 && !u.machines.length && <Button size="sm" variant="danger" onClick={() => onDiscard(u.pin)}>Discard</Button>}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
