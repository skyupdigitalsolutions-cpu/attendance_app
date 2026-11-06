// Bulk entry dialogs: many holidays at once, and leave for many people at once.
// Both: enter / paste / import → Check (server validates, saves nothing) → Save.
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, FileUp, ListChecks, Save, Search, XCircle } from "lucide-react";
import { api, empIdOf, fmtDay, todayLocal } from "../lib/core";
import { useApp } from "../lib/app";
import { downloadText, normalizeDate, parseTable, readFile, withoutHeader } from "../lib/bulk";
import { Avatar, Button, Checkbox, Dialog, Empty, Field, Input, Muted, Segmented, Select, Spinner, Textarea, cx, useToast } from "./ui";

const WIDE = "w-[min(780px,calc(100vw-1.5rem))]!";

function FileButton({ onText }) {
  const toast = useToast();
  return (
    <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800">
      <FileUp className="size-4" aria-hidden /> Choose CSV file
      <input type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only"
        onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { try { onText(await readFile(f)); } catch (ex) { toast(ex.message); } } }} />
    </label>
  );
}

function Results({ results, render }) {
  const good = results.filter((r) => r.ok).length;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold">
        <span className="text-emerald-700 dark:text-emerald-300">{good} ready</span>
        {results.length - good > 0 && <span className="text-rose-600 dark:text-rose-400">, {results.length - good} with problems (they won't be saved)</span>}
      </p>
      <ul className="max-h-72 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
        {results.map((r) => (
          <li key={r.index} className="flex items-start gap-2 border-t border-zinc-100 px-3 py-2 text-sm first:border-0 dark:border-zinc-800">
            {r.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="Ready" />
              : <XCircle className={cx("mt-0.5 size-4 shrink-0", r.skipped ? "text-zinc-400" : "text-rose-500")} aria-label="Problem" />}
            <span className="min-w-0 flex-1">{render(r)}{!r.ok && <span className={cx("block", r.skipped ? "text-zinc-500" : "text-rose-600 dark:text-rose-400")}>{r.error}</span>}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Holidays ────────────────────────────────────────────────────────────────
export function BulkHolidaysDialog({ open, onClose, onSaved }) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [check, setCheck] = useState(null);
  const [busy, setBusy] = useState("");
  useEffect(() => { if (open) { setText(""); setCheck(null); } }, [open]);

  const items = () => withoutHeader(parseTable(text), ["date", "holiday", "name"])
    .map(([date, ...rest]) => ({ date: normalizeDate(date) || date, name: rest.join(" ").trim() }));
  const send = async (dry) => {
    const list = items();
    if (!list.length) return toast("Add at least one line: date, name.");
    setBusy(dry ? "check" : "save");
    try {
      const j = (await api("/attendance-app/holidays/bulk", { method: "POST", body: { items: list, dry_run: dry } })).data;
      if (dry) setCheck(j);
      else { toast(`${j.saved} holiday${j.saved === 1 ? "" : "s"} saved.`); onSaved?.(); onClose(); }
    } catch (e) { toast(e.message); } finally { setBusy(""); }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Add many holidays" subtitle="One holiday per line: date, name. Paste from Excel or Google Sheets, or choose a CSV file." className={WIDE}>
      <Textarea rows={7} value={text} onChange={(e) => { setText(e.target.value); setCheck(null); }} className="font-mono text-sm"
        placeholder={"26-01-2027, Republic Day\n22-03-2027, Ugadi\n01-05-2027, May Day\n15-08-2027, Independence Day"} />
      <div className="flex flex-wrap gap-2">
        <FileButton onText={(t) => { setText(t); setCheck(null); }} />
        <Button size="sm" variant="ghost" icon={Download} onClick={() => downloadText("holidays-template.csv", "Date,Holiday\n26-01-2027,Republic Day\n15-08-2027,Independence Day\n")}>Template</Button>
      </div>
      <Muted>Dates like 26-01-2027, 26/01/2027, 2027-01-26 or 26 Jan 2027 all work. A date that's already a holiday is renamed if the name is different.</Muted>
      {check && <Results results={check.results} render={(r) => <><b className="tabular-nums">{/^\d{4}-\d{2}-\d{2}$/.test(r.date) ? fmtDay(r.date, { day: "numeric", month: "short", year: "numeric" }) : r.date || "?"}</b> {r.name}{r.ok && r.action !== "add" && <span className="text-zinc-500"> ({r.action})</span>}</>} />}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        {!check ? <Button icon={ListChecks} loading={busy === "check"} onClick={() => send(true)}>Check list</Button>
          : <Button variant="primary" icon={Save} loading={busy === "save"} disabled={!check.ready} onClick={() => send(false)}>Save {check.ready} holiday{check.ready === 1 ? "" : "s"}</Button>}
      </div>
    </Dialog>
  );
}

// ── Leave ───────────────────────────────────────────────────────────────────
export function BulkLeaveDialog({ open, onClose, onSaved }) {
  const { leaveTypes, loadUsers } = useApp();
  const toast = useToast();
  const [mode, setMode] = useState("people");
  const [people, setPeople] = useState(null);
  const [picked, setPicked] = useState(new Set());
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState(todayLocal());
  const [to, setTo] = useState(todayLocal());
  const [reason, setReason] = useState("");
  const [text, setText] = useState("");
  const [check, setCheck] = useState(null);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (!open) return;
    setPicked(new Set()); setQ(""); setReason(""); setText(""); setCheck(null); setFrom(todayLocal()); setTo(todayLocal());
    setType(leaveTypes[0]?.type || "casual");
    loadUsers().then((u) => setPeople(u.filter((x) => x.status !== "inactive" && x.role !== "admin"))).catch(() => setPeople([]));
  }, [open, leaveTypes, loadUsers]);

  const term = q.trim().toLowerCase();
  const shown = useMemo(() => (people || []).filter((u) => !term || u.name.toLowerCase().includes(term) ||
    empIdOf(u).toLowerCase().includes(term) || (u.department || "").toLowerCase().includes(term)), [people, term]);
  const toggle = (id) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const items = () => {
    if (mode === "people") return [...picked].map((user_id) => ({ user_id, leave_type: type, from, to: to || from, reason }));
    return withoutHeader(parseTable(text), ["employee", "leave", "type", "from", "date"])
      .map(([who, leave_type, f, t, ...r]) => ({ who, leave_type, from: normalizeDate(f) || f, to: normalizeDate(t) || t || normalizeDate(f) || f, reason: r.join(" ").trim() }));
  };
  const send = async (dry) => {
    const list = items();
    if (!list.length) return toast(mode === "people" ? "Pick at least one person." : "Add at least one line.");
    setBusy(dry ? "check" : "save");
    try {
      const j = (await api("/attendance-app/leaves/bulk", { method: "POST", body: { items: list, dry_run: dry }, timeout: 60000 })).data;
      if (dry) setCheck(j);
      else { toast(`Leave recorded for ${j.saved} ${j.saved === 1 ? "entry" : "entries"}. Each person was notified.`); onSaved?.(); onClose(); }
    } catch (e) { toast(e.message); } finally { setBusy(""); }
  };
  const reset = () => setCheck(null);

  return (
    <Dialog open={open} onClose={onClose} title="Add leave" subtitle="Recorded as approved leave. Weekly offs and holidays aren't counted." className={WIDE}>
      <Segmented value={mode} onChange={(v) => { setMode(v); reset(); }} options={[["people", "Several people"], ["import", "Import a list"]]} />

      {mode === "people" ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Leave type" className="col-span-2 sm:col-span-1">
              <Select value={type} onChange={(e) => { setType(e.target.value); reset(); }}>
                {leaveTypes.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
              </Select>
            </Field>
            <Field label="From"><Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); if (!to || to < e.target.value) setTo(e.target.value); reset(); }} /></Field>
            <Field label="To"><Input type="date" value={to} min={from} onChange={(e) => { setTo(e.target.value); reset(); }} /></Field>
          </div>
          <Field label="Reason" hint="(optional)"><Input value={reason} maxLength={300} placeholder="e.g. Office closed for maintenance" onChange={(e) => { setReason(e.target.value); reset(); }} /></Field>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative flex-1">
              <span className="sr-only">Search people</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
              <Input type="search" placeholder="Search name, ID or department" value={q} onChange={(e) => setQ(e.target.value)} className="h-10 pl-9" />
            </label>
            <Button size="sm" onClick={() => { setPicked(new Set([...picked, ...shown.map((u) => u._id)])); reset(); }}>Select all shown</Button>
            {picked.size > 0 && <Button size="sm" variant="ghost" onClick={() => { setPicked(new Set()); reset(); }}>Clear ({picked.size})</Button>}
          </div>
          <ul className="max-h-56 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
            {!people ? <li><Spinner /></li> : !shown.length ? <li><Empty>No one matches.</Empty></li> : shown.map((u) => (
              <li key={u._id} className="border-t border-zinc-100 first:border-0 dark:border-zinc-800">
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <input type="checkbox" className="size-5 accent-brand-600" checked={picked.has(u._id)} onChange={() => { toggle(u._id); reset(); }} />
                  <Avatar name={u.name} size="sm" />
                  <span className="min-w-0 flex-1 leading-tight"><b className="block truncate">{u.name}</b>
                    <span className="text-xs text-zinc-500">{[empIdOf(u) && `ID ${empIdOf(u)}`, u.department].filter(Boolean).join(", ")}</span></span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Muted>One leave per line: <b>Employee ID (or Device ID or email), leave type, from, to, reason</b>. Paste from Excel or Google Sheets, or choose a CSV file. "To" and reason are optional.</Muted>
          <Textarea rows={7} value={text} onChange={(e) => { setText(e.target.value); reset(); }} className="font-mono text-sm"
            placeholder={"SDS-02, casual, 23-11-2026, 24-11-2026, Family function\nSDS-08, sick, 25-11-2026\n13, earned, 24-12-2026, 28-12-2026, Year-end vacation"} />
          <div className="flex flex-wrap gap-2">
            <FileButton onText={(t) => { setText(t); reset(); }} />
            <Button size="sm" variant="ghost" icon={Download} onClick={() => downloadText("leave-template.csv",
              `Employee ID,Leave type,From,To,Reason\nSDS-02,casual,23-11-2026,24-11-2026,Family function\nSDS-08,sick,25-11-2026,,\n`)}>Template</Button>
          </div>
          <Muted>Leave types: {leaveTypes.map((t) => `${t.type} (${t.label})`).join(", ")}.</Muted>
        </div>
      )}

      {check && <Results results={check.results} render={(r) => (
        <><b>{r.user?.name || r.who || "?"}</b> {r.leave_label || r.leave_type || ""} <span className="tabular-nums text-zinc-600 dark:text-zinc-300">
          {/^\d{4}-\d{2}-\d{2}$/.test(r.from) ? fmtDay(r.from, { day: "numeric", month: "short" }) : r.from}
          {r.to && r.to !== r.from ? ` to ${/^\d{4}-\d{2}-\d{2}$/.test(r.to) ? fmtDay(r.to, { day: "numeric", month: "short", year: "numeric" }) : r.to}` : ""}
          {r.days != null && r.ok ? `, ${r.days} day${r.days === 1 ? "" : "s"}` : ""}</span></>
      )} />}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        {!check ? <Button icon={ListChecks} loading={busy === "check"} onClick={() => send(true)}>Check{mode === "people" && picked.size ? ` ${picked.size} ${picked.size === 1 ? "person" : "people"}` : " list"}</Button>
          : <Button variant="primary" icon={Save} loading={busy === "save"} disabled={!check.ready} onClick={() => send(false)}>Save {check.ready} leave{check.ready === 1 ? "" : "s"}</Button>}
      </div>
    </Dialog>
  );
}
