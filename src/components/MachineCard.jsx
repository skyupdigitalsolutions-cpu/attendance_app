// Fingerprint machine: status, its enrolled users (linked or not), and two actions:
// "Get users from machine" and "Re-send punches" for dates that are missing.
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, Download, Eraser, Fingerprint, Power, RefreshCw, TriangleAlert, Upload, Users, Wifi, WifiOff, X, XCircle } from "lucide-react";
import { addDays, api, timeAgo, todayLocal } from "../lib/core";
import { Badge, Button, Card, CardTitle, Empty, Field, Input, Muted, Select, Spinner, cx, useToast } from "./ui";
import { UserPlus } from "lucide-react";
import CreateFromMachine from "./CreateFromMachine";

const CMD_TONE = { queued: ["Waiting for the machine", "late"], sent: ["Sent, waiting for the machine", "info"], done: ["Done", "present"], failed: ["Not answered", "absent"] };

export default function MachineCard({ people, onLink, linkedNow, onDiscard, refreshKey, onCreated }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [from, setFrom] = useState(addDays(todayLocal(), -6));
  const [to, setTo] = useState(todayLocal());
  const [busy, setBusy] = useState("");
  const [picked, setPicked] = useState(new Set());
  const [creating, setCreating] = useState(null); // machine users to create

  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const prevUsers = useRef(null);
  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const d = (await api("/attendance-app/machine")).data;
      // Tell the admin when new data from the machine has arrived since the last look
      const total = d.devices.reduce((a, x) => a + (x.users_count || 0), 0);
      if (prevUsers.current != null && total > prevUsers.current) toast(`The machine sent its user list: ${total} users.`);
      prevUsers.current = total;
      setData(d); setError(""); setUpdatedAt(new Date());
      if (manual) toast("Machine status updated.");
    } catch (e) { setError(e.message); if (manual) toast(e.message); }
    finally { if (manual) setRefreshing(false); }
  }, [toast]);
  useEffect(() => { load(); }, [load, refreshKey]);
  // Keep the status fresh while the screen is open (every 30 s)
  useEffect(() => { const t = setInterval(() => load(), 30000); return () => clearInterval(t); }, [load]);
  // While a command is waiting, refresh every 8 s so its status updates by itself
  const waiting = data?.devices.some((d) => d.commands.some((c) => c.status === "queued" || c.status === "sent"));
  useEffect(() => { if (!waiting) return; const t = setInterval(() => load(), 8000); return () => clearInterval(t); }, [waiting, load]);

  const clearRequests = async (serial, id) => {
    try {
      await api("/attendance-app/machine/clear-requests", { method: "POST", body: { serial, ...(id != null ? { id } : {}) } });
      // Remove from the screen right away, then reload
      setData((x) => x && { ...x, devices: x.devices.map((dv) => dv.serial !== serial ? dv : {
        ...dv, commands: dv.commands.filter((c) => (id != null ? c.id !== id : !(c.status === "done" || c.status === "failed"))) }) });
      toast(id != null ? "Request cleared." : "Finished requests cleared.");
      load();
    } catch (e) { toast(e.message); }
  };

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
        <span className="flex items-center gap-2">
          {updatedAt && <span className="text-xs text-zinc-400">Updated {updatedAt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit" })}</span>}
          <Button size="sm" icon={RefreshCw} loading={refreshing} onClick={() => load(true)}>Refresh</Button>
        </span>
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
            {d.last_handshake_at && <span className="text-zinc-500">Last reconnect {timeAgo(d.last_handshake_at)}</span>}
          </div>
          <NoReplyHelp d={d} busy={busy} send={send} />
          {d.commands.length > 0 && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-zinc-500">Requests to the machine</span>
                {d.commands.some((c) => c.status === "done" || c.status === "failed") && (
                  <Button size="sm" variant="ghost" icon={Eraser} className="h-7 px-2 text-xs"
                    onClick={() => clearRequests(d.serial)}>Clear finished</Button>
                )}
              </div>
              <ul className="flex flex-col gap-1 text-sm">
                {d.commands.slice(0, 5).map((c) => {
                  const [label, tone] = CMD_TONE[c.status] || [c.status, "neutral"];
                  const finished = c.status === "done" || c.status === "failed";
                  return (
                    <li key={c.id} className="flex flex-wrap items-center gap-2">
                      {c.status === "done" ? <CheckCircle2 className="size-4 text-emerald-600" aria-hidden /> : c.status === "failed" ? <XCircle className="size-4 text-rose-500" aria-hidden /> : <Clock className="size-4 text-amber-500" aria-hidden />}
                      <span>{c.label}</span><Badge tone={tone}>{label}</Badge>
                      {c.result && c.result.startsWith("Machine sent") && <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{c.result}</span>}
                      {c.status === "failed" && <span className="text-xs text-zinc-500">{c.result}</span>}
                      <span className="text-xs text-zinc-400">{timeAgo(c.created_at)}{c.created_by ? `, ${c.created_by}` : ""}</span>
                      {finished && (
                        <button type="button" onClick={() => clearRequests(d.serial, c.id)} aria-label={`Clear "${c.label}"`}
                          className="ml-auto rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
                          <X className="size-3.5" aria-hidden />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
              {d.commands.some((c) => c.status === "done" || c.status === "failed") && (
                <span className="text-xs text-zinc-400">Finished requests disappear by themselves 10 minutes after they finish.</span>
              )}
            </div>
          )}
        </div>
      ))}

      {data.devices.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="flex flex-col gap-2 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
            <b className="flex items-center gap-2"><Users className="size-4" aria-hidden /> Users on the machine</b>
            <Muted>Asks the machine for everyone enrolled on it, with the names saved on the machine.</Muted>
            <div><Button icon={Download} loading={busy === "/attendance-app/machine/fetch-users"} disabled={data.devices.some((x) => x.users_pending)}
              onClick={() => send("/attendance-app/machine/fetch-users", {}, "Asked the machine for its user list. It usually answers within a few minutes.")}>
              {data.devices.some((x) => x.users_pending) ? "Waiting for the machine…" : "Get users from machine"}</Button></div>
          </div>
          <div className="flex flex-col gap-2 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
            <b className="flex items-center gap-2"><RefreshCw className="size-4" aria-hidden /> Re-send missing punches</b>
            <Muted>Asks the machine to send its punches for these dates again. Punches already saved are ignored.</Muted>
            <div className="flex flex-wrap items-end gap-2">
              <Field label="From"><Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-10" /></Field>
              <Field label="To"><Input type="date" value={to} min={from} max={todayLocal()} onChange={(e) => setTo(e.target.value)} className="h-10" /></Field>
              <Button icon={RefreshCw} loading={busy === "/attendance-app/machine/resync"} disabled={data.devices.some((x) => x.punches_pending)}
                onClick={() => send("/attendance-app/machine/resync", { from, to }, "Asked the machine to re-send punches. They arrive within a few minutes.")}>
                {data.devices.some((x) => x.punches_pending) ? "Waiting…" : "Re-send"}</Button>
            </div>
          </div>
        </div>
      )}

      {data.users.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              <span className="text-emerald-700 dark:text-emerald-300">{linked} linked to an employee</span>
              {notLinked.length > 0 && <span className="text-rose-600 dark:text-rose-400">, {notLinked.length} not linked (their punches don't reach anyone's attendance)</span>}
            </p>
            {notLinked.length > 0 && (
              <span className="flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" onClick={() => setPicked(picked.size === notLinked.length ? new Set() : new Set(notLinked.map((u) => u.pin)))}>
                  {picked.size === notLinked.length ? "Clear selection" : "Select all"}
                </Button>
                <Button size="sm" variant="primary" icon={UserPlus} disabled={!picked.size}
                  onClick={() => setCreating(notLinked.filter((u) => picked.has(u.pin)))}>
                  Create employee{picked.size === 1 ? "" : "s"}{picked.size ? ` (${picked.size})` : ""}
                </Button>
              </span>
            )}
          </div>
          {notLinked.length > 0 && <Muted>Not in your employee list yet? Tick them and press Create employees. Already an employee? Use Link to employee.</Muted>}
          {notLinked.length > 0 && (
            <ul className="rounded-xl border border-zinc-200 dark:border-zinc-700">
              {notLinked.map((u) => {
                const staged = linkedNow(u.pin);
                return (
                  <li key={u.pin} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 border-t border-zinc-100 px-3 py-2.5 first:border-0 sm:grid-cols-[8rem_1fr_auto] dark:border-zinc-800">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input type="checkbox" className="size-5 accent-brand-600" checked={picked.has(u.pin)} aria-label={`Select Device ID ${u.pin}`}
                        onChange={() => setPicked((s) => { const n = new Set(s); n.has(u.pin) ? n.delete(u.pin) : n.add(u.pin); return n; })} />
                      <span>Device ID <b className="tabular-nums">{u.pin}</b></span>
                    </label>
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
                        <Button size="sm" icon={UserPlus} onClick={() => setCreating([u])} aria-label={`Create employee for Device ID ${u.pin}`}><span className="max-sm:sr-only">Create</span></Button>
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
      <CreateFromMachine
        open={Boolean(creating)}
        onClose={() => setCreating(null)}
        machineUsers={creating || []}
        people={people}
        onCreated={() => { setPicked(new Set()); load(); onCreated?.(); }}
      />
    </Card>
  );
}

// Shown when the machine received a request but didn't answer for 3+ minutes
// (older eSSL firmware ignores the newer requests), or while a full upload is pending.
function NoReplyHelp({ d, busy, send }) {
  const stuck = d.commands.some((c) => c.status === "sent" && !c.result && c.sent_at && Date.now() - new Date(c.sent_at) > 3 * 60 * 1000 && c.cmd !== "REBOOT");
  const pendingFull = d.resend_all;
  const fullWaitLong = pendingFull && d.resend_all_requested_at && Date.now() - new Date(d.resend_all_requested_at) > 10 * 60 * 1000;
  if (!stuck && !pendingFull) return null;
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
      {pendingFull ? (
        <p className="flex gap-2"><Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>Waiting for the machine to reconnect and upload all its punches and users again
            {d.resend_all_requested_at ? ` (asked ${timeAgo(d.resend_all_requested_at)})` : ""}.
            {fullWaitLong ? " It hasn't reconnected yet: restart it to make it reconnect now." : " This usually happens within a few minutes."}</span></p>
      ) : (
        <p className="flex gap-2"><TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>The machine received the request but didn't answer. Older eSSL firmware doesn't support it.
            Use <b>Upload everything again</b> instead: at its next connection the machine re-sends all punches and users (punches already saved are ignored).</span></p>
      )}
      <div className="flex flex-wrap gap-2">
        {!pendingFull && <Button size="sm" variant="primary" icon={Upload} loading={busy === "/attendance-app/machine/full-upload"}
          onClick={() => send("/attendance-app/machine/full-upload", { serial: d.serial }, "Asked the machine to upload everything again at its next connection.")}>Upload everything again</Button>}
        {(fullWaitLong || stuck) && <Button size="sm" icon={Power} loading={busy === "/attendance-app/machine/restart"}
          onClick={() => { if (confirm("Restart the fingerprint machine? It's unavailable for about a minute; punches made during the restart are saved on it and sent afterwards.")) send("/attendance-app/machine/restart", { serial: d.serial }, "Restart sent. The machine reconnects in about a minute."); }}>Restart machine</Button>}
      </div>
      {d.unknown_calls?.length > 0 && (
        <details className="text-xs text-amber-800 dark:text-amber-200/80">
          <summary className="cursor-pointer font-semibold">Other calls from the machine (for support)</summary>
          <ul className="mt-1 flex flex-col gap-0.5 font-mono">{d.unknown_calls.map((u, i) => <li key={i} className="break-all">{u}</li>)}</ul>
        </details>
      )}
    </div>
  );
}
