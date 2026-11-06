import { useEffect, useMemo, useState } from "react";
import { BulkHolidaysDialog } from "../components/Bulk";
import { CalendarPlus, CheckCircle2, ListPlus, Clock3, RotateCcw, Save, ShieldCheck, Trash2, TriangleAlert, Wrench } from "lucide-react";
import { api, fmtDay, fmtMinutes, hhmmToMin, todayLocal, ymdOfStored } from "../lib/core";
import { useApp } from "../lib/app";
import { Button, Card, CardTitle, Checkbox, Chip, Empty, Field, Input, Muted, Segmented, Spinner, useToast } from "../components/ui";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function Settings() {
  const { policy, reloadPolicy } = useApp();
  if (!policy) return <Card><Spinner /></Card>;
  return (
    <div className="grid items-start gap-3 lg:grid-cols-2">
      <DataCard policy={policy} />
      <RulesCard policy={policy} reload={reloadPolicy} />
      <HolidaysCard policy={policy} reload={reloadPolicy} />
      <LeaveRulesCard policy={policy} reload={reloadPolicy} />
    </div>
  );
}

function RulesCard({ policy: p, reload }) {
  const toast = useToast();
  const [f, setF] = useState({
    work_start_time: p.work_start_time || "09:00", work_end_time: p.work_end_time || "18:00",
    late_threshold_minutes: p.late_threshold_minutes ?? 15, early_logout_grace_minutes: p.early_logout_grace_minutes ?? 0,
    half_day_hours: p.half_day_hours ?? 4, full_day_hours: p.full_day_hours ?? 8,
    device_clock_offset_minutes: p.device_clock_offset_minutes ?? 0, weekly_offs: p.weekly_offs || [0, 6],
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const start = hhmmToMin(f.work_start_time), end = hhmmToMin(f.work_end_time);
  const clk = Number(f.device_clock_offset_minutes) || 0;
  const preview = end <= start ? "Work end must be after work start."
    : `Late after ${fmtMinutes(start + Number(f.late_threshold_minutes || 0))}. Early logout before ${fmtMinutes(end - Number(f.early_logout_grace_minutes || 0))}. ` +
      `Half-day under ${f.half_day_hours} h, overtime over ${f.full_day_hours} h. Weekly off: ${f.weekly_offs.length ? f.weekly_offs.map((i) => DAYS[i]).join(" and ") : "no days"}.` +
      (clk ? ` Machine punches ${clk > 0 ? "+" : "−"}${Math.abs(clk)} min (machine shows 9:00 → saved as ${fmtMinutes(9 * 60 + clk)}).` : "");

  const save = async (e) => {
    e.preventDefault();
    if (end <= start) return toast("Work end must be after work start.");
    setBusy(true);
    try {
      const n = (k) => Number(f[k]);
      await api(`/policy/${p._id}`, { method: "PATCH", body: {
        work_start_time: f.work_start_time, work_end_time: f.work_end_time,
        late_threshold_minutes: n("late_threshold_minutes"), early_logout_grace_minutes: n("early_logout_grace_minutes"),
        half_day_hours: n("half_day_hours"), full_day_hours: n("full_day_hours"),
        device_clock_offset_minutes: n("device_clock_offset_minutes"), weekly_offs: f.weekly_offs,
      } });
      await reload(); toast("Settings saved.");
    } catch (ex) { toast(ex.message); } finally { setBusy(false); }
  };

  return (
    <Card as="form" onSubmit={save} noValidate className="flex flex-col gap-4 p-5">
      <div>
        <CardTitle>Working hours and rules</CardTitle>
        <Muted>Your company policy. The app applies it to every day it shows, including past ones.</Muted>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Work starts"><Input type="time" value={f.work_start_time} onChange={set("work_start_time")} /></Field>
        <Field label="Work ends"><Input type="time" value={f.work_end_time} onChange={set("work_end_time")} /></Field>
        <Field label="Late after (grace, min)"><Input type="number" min={0} max={240} value={f.late_threshold_minutes} onChange={set("late_threshold_minutes")} /></Field>
        <Field label="Early logout grace (min)"><Input type="number" min={0} max={240} value={f.early_logout_grace_minutes} onChange={set("early_logout_grace_minutes")} /></Field>
        <Field label="Half-day below (hours)"><Input type="number" min={0} max={24} step={0.25} value={f.half_day_hours} onChange={set("half_day_hours")} /></Field>
        <Field label="Overtime after (hours)"><Input type="number" min={1} max={24} step={0.25} value={f.full_day_hours} onChange={set("full_day_hours")} /></Field>
      </div>
      <fieldset className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
        <legend className="flex items-center gap-1.5 px-1 text-sm font-bold text-zinc-600 dark:text-zinc-300"><Clock3 className="size-4" aria-hidden /> Fingerprint machine clock</legend>
        <Field label="Machine is behind real time by (minutes)">
          <Input type="number" min={-720} max={720} value={f.device_clock_offset_minutes} onChange={set("device_clock_offset_minutes")} />
        </Field>
        <Muted>
          If the machine shows 9:00 when it's really 9:30, enter 30. If it runs ahead, use a negative number. Every new punch is corrected by this amount.
          {p.device_clock_offset_since && p.device_clock_offset_minutes ? ` Set on ${new Date(p.device_clock_offset_since).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}.` : ""}
        </Muted>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300">Weekly off days</legend>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d, i) => (
            <Chip key={d} active={f.weekly_offs.includes(i)} onClick={() => setF((s) => ({
              ...s, weekly_offs: s.weekly_offs.includes(i) ? s.weekly_offs.filter((x) => x !== i) : [...s.weekly_offs, i].sort(),
            }))}>{d.slice(0, 3)}</Chip>
          ))}
        </div>
      </fieldset>
      <p className="rounded-xl bg-zinc-50 p-3 text-sm text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300">{preview}</p>
      <Button variant="primary" type="submit" icon={Save} loading={busy}>Save settings</Button>
    </Card>
  );
}

function HolidaysCard({ policy, reload }) {
  const toast = useToast();
  const thisYear = Number(todayLocal().slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [bulk, setBulk] = useState(false);
  const items = useMemo(() => (policy.holidays || []).map((h) => ({ ...h, ymd: ymdOfStored(h.date) }))
    .filter((h) => h.ymd.startsWith(String(year))).sort((a, b) => (a.ymd < b.ymd ? -1 : 1)), [policy, year]);

  const add = async (e) => {
    e.preventDefault();
    if (!date || !name.trim()) return toast("Enter a date and a name.");
    try {
      await api("/policy/holidays", { method: "POST", body: { date, name: name.trim() } });
      await reload(); setYear(Number(date.slice(0, 4))); setName(""); toast("Holiday added.");
    } catch (ex) { toast(ex.message); }
  };
  const remove = async (h) => {
    if (!confirm(`Remove ${h.name}?`)) return;
    try { await api(`/policy/holidays/${h.ymd}`, { method: "DELETE" }); await reload(); toast("Holiday removed."); }
    catch (ex) { toast(ex.message); }
  };

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <CardTitle>Holidays</CardTitle>
        <Segmented size="sm" className="w-40" value={year} onChange={setYear} options={[[thisYear, String(thisYear)], [thisYear + 1, String(thisYear + 1)]]} />
      </div>
      <form onSubmit={add} className="flex flex-wrap items-end gap-2" noValidate>
        <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Name" className="min-w-40 flex-1"><Input value={name} maxLength={120} placeholder="e.g. Diwali" onChange={(e) => setName(e.target.value)} /></Field>
        <Button variant="primary" type="submit" icon={CalendarPlus}>Add holiday</Button>
        <Button icon={ListPlus} onClick={() => setBulk(true)}>Add many</Button>
      </form>
      <BulkHolidaysDialog open={bulk} onClose={() => setBulk(false)} onSaved={reload} />
      {!items.length ? <Empty>No holidays for {year} yet. Add your company holidays so nobody is marked absent on them.</Empty> : (
        <ul>
          {items.map((h) => (
            <li key={h.ymd} className="flex items-center gap-3 border-t border-zinc-100 py-2.5 first:border-0 dark:border-zinc-800">
              <span className="flex w-11 flex-col items-center leading-none">
                <b className="text-xl font-extrabold">{fmtDay(h.ymd, { day: "numeric" })}</b>
                <span className="mt-1 text-xs font-semibold text-zinc-500">{fmtDay(h.ymd, { month: "short" })}</span>
              </span>
              <span className="flex-1 leading-tight"><b className="block">{h.name}</b>
                <span className="text-sm text-zinc-500">{fmtDay(h.ymd, { weekday: "long" })}{h.ymd < todayLocal() ? ", passed" : ""}</span></span>
              <Button size="sm" variant="danger" icon={Trash2} onClick={() => remove(h)} aria-label={`Remove ${h.name}`}><span className="max-sm:sr-only">Remove</span></Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function LeaveRulesCard({ policy, reload }) {
  const toast = useToast();
  const [rows, setRows] = useState(policy.leave_types || []);
  const [busy, setBusy] = useState(false);
  useEffect(() => setRows(policy.leave_types || []), [policy]);
  const set = (i, k, v) => setRows((r) => r.map((t, j) => (j === i ? { ...t, [k]: v } : t)));
  const save = async () => {
    setBusy(true);
    try { await api(`/policy/${policy._id}`, { method: "PATCH", body: { leave_types: rows } }); await reload(); toast("Leave rules saved."); }
    catch (ex) { toast(ex.message); } finally { setBusy(false); }
  };
  const num = "h-10 w-24 tabular-nums";
  return (
    <Card className="flex flex-col gap-3 p-5 lg:col-span-2">
      <div>
        <CardTitle>Leave rules</CardTitle>
        <Muted>Days a year is the allowance shown in each person's balance. Set an unpaid type to 0 for no limit.</Muted>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[15px]">
          <thead><tr className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
            <th className="px-2 py-2">Leave type</th><th className="px-2">Days a year</th><th className="px-2">Per month</th>
            <th className="px-2">Paid</th><th className="px-2">Carry forward</th><th className="px-2">Carry max</th>
          </tr></thead>
          <tbody>
            {rows.map((t, i) => (
              <tr key={t.type} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="px-2 py-2 font-bold">{t.label}</td>
                <td className="px-2"><Input type="number" min={0} max={366} className={num} value={t.allowed_per_year ?? 0} onChange={(e) => set(i, "allowed_per_year", Number(e.target.value))} aria-label={`${t.label} days a year`} /></td>
                <td className="px-2"><Input type="number" min={0} max={31} className={num} value={t.allowed_per_month ?? 0} onChange={(e) => set(i, "allowed_per_month", Number(e.target.value))} aria-label={`${t.label} per month`} /></td>
                <td className="px-2"><Checkbox checked={Boolean(t.is_paid)} onChange={(e) => set(i, "is_paid", e.target.checked)} aria-label={`${t.label} paid`} /></td>
                <td className="px-2"><Checkbox checked={Boolean(t.carry_forward)} onChange={(e) => set(i, "carry_forward", e.target.checked)} aria-label={`${t.label} carry forward`} /></td>
                <td className="px-2"><Input type="number" min={0} max={366} className={num} value={t.carry_forward_max ?? 0} onChange={(e) => set(i, "carry_forward_max", Number(e.target.value))} aria-label={`${t.label} carry forward maximum`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div><Button variant="primary" icon={Save} onClick={save} loading={busy}>Save leave rules</Button></div>
    </Card>
  );
}

// ── Check & fix data ─────────────────────────────────────────────────────────
function DataCard({ policy }) {
  const toast = useToast();
  const [health, setHealth] = useState(null);
  const [preview, setPreview] = useState(null);
  const [correctClock, setCorrectClock] = useState(true);
  const [busy, setBusy] = useState("");
  const [lastBackup, setLastBackup] = useState(() => localStorage.getItem("att_last_repair_backup") || "");
  const offset = Number(policy.device_clock_offset_minutes) || 0;

  const check = async () => {
    setHealth(null);
    try { setHealth((await api("/attendance-app/data-health")).data); } catch (e) { setHealth({ error: e.message }); }
  };
  useEffect(() => { check(); }, []);

  const run = async (apply) => {
    setBusy(apply ? "apply" : "preview");
    try {
      const r = (await api("/attendance-app/repair", { method: "POST", body: { apply, correct_clock: correctClock && offset !== 0 }, timeout: 120000 })).data;
      if (apply) {
        setPreview(null);
        if (r.backupFile) { localStorage.setItem("att_last_repair_backup", r.backupFile); setLastBackup(r.backupFile); }
        toast(r.applied ? `Fixed: ${r.changes} change${r.changes === 1 ? "" : "s"} saved.` : "Nothing needed fixing.");
        check();
      } else setPreview(r);
    } catch (e) { toast(e.message); } finally { setBusy(""); }
  };
  const undo = async () => {
    if (!confirm("Put back the attendance records exactly as they were before the last fix?")) return;
    setBusy("undo");
    try {
      const r = (await api("/attendance-app/repair/undo", { method: "POST", body: { backup: lastBackup, apply: true }, timeout: 120000 })).data;
      toast(`Restored ${r.restored} records.`);
      localStorage.removeItem("att_last_repair_backup"); setLastBackup(""); check();
    } catch (e) { toast(e.message); } finally { setBusy(""); }
  };

  const h = health;
  const issues = h && !h.error ? [
    h.split_days && `${h.split_days} day${h.split_days === 1 ? "" : "s"} split into two records (this is what shows "Out Missing")`,
    h.wrong_day_records && `${h.wrong_day_records} record${h.wrong_day_records === 1 ? "" : "s"} saved with the old date format`,
    h.uncorrected_punches && `${h.uncorrected_punches} machine punch${h.uncorrected_punches === 1 ? "" : "es"} not yet corrected by ${offset > 0 ? "+" : ""}${offset} min`,
  ].filter(Boolean) : [];
  const s = preview?.stats;

  return (
    <Card className="flex flex-col gap-4 p-5 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-brand-600 dark:text-brand-400" aria-hidden /> Check & fix data</CardTitle>
          <Muted>Checks the last 90 days for split days, old date formats and uncorrected machine times.</Muted>
        </div>
        <Button size="sm" onClick={check}>Check again</Button>
      </div>

      {!h ? <Spinner label="Checking…" /> : h.error ? <Empty>{h.error}</Empty> : !h.needs_repair ? (
        <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          <CheckCircle2 className="size-4" aria-hidden /> Everything looks right. Nothing needs fixing.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col gap-1.5 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
            {issues.map((t) => <li key={t} className="flex gap-2"><TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />{t}</li>)}
          </ul>
          {offset !== 0 && h.uncorrected_punches > 0 && (
            <Checkbox checked={correctClock} onChange={(e) => setCorrectClock(e.target.checked)}
              label={`Also correct old machine punches by ${offset > 0 ? "+" : ""}${offset} min (each punch only once)`} />
          )}
          <div className="flex flex-wrap gap-2">
            <Button icon={Wrench} loading={busy === "preview"} onClick={() => run(false)}>Preview the fix</Button>
          </div>
        </div>
      )}

      {preview && (
        <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
          <b>What the fix will change ({s.days} person-days checked)</b>
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            <li>Split days joined: <b>{s.merged}</b></li>
            <li>Moved to the correct day: <b>{s.dateMoved}</b></li>
            <li>Login / logout / hours recalculated: <b>{s.timesChanged}</b></li>
            <li>Status recalculated: <b>{s.statusChanged}</b></li>
            {preview.clockOffsetMin !== 0 && <li>Machine punches corrected: <b>{s.punchesShifted}</b></li>}
            <li>Already correct: <b>{s.untouched}</b></li>
          </ul>
          {Object.keys(preview.transitions).length > 0 && (
            <Muted>Status changes: {Object.entries(preview.transitions).map(([t, n]) => `${t} (${n})`).join(", ")}</Muted>
          )}
          <Muted>Days an admin marked by hand aren't changed. A backup is saved first, so you can undo.</Muted>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon={Wrench} loading={busy === "apply"} disabled={!preview.changes} onClick={() => run(true)}>
              {preview.changes ? `Apply ${preview.changes} change${preview.changes === 1 ? "" : "s"}` : "Nothing to change"}
            </Button>
            <Button variant="ghost" onClick={() => setPreview(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {lastBackup && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-500">
          <span>Last fix can be undone (backup {lastBackup}).</span>
          <Button size="sm" variant="ghost" icon={RotateCcw} loading={busy === "undo"} onClick={undo}>Undo last fix</Button>
        </div>
      )}
    </Card>
  );
}
