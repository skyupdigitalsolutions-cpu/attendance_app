import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CalendarPlus, Download, Home, IdCard, Mail, MessageSquareText, PencilLine, TriangleAlert } from "lucide-react";
import SendEmail from "../components/SendEmail";
import {
  api, addMonths, DAY_END, DAY_START, deviceIdOf, downloadCsv, emailMissing, empIdOf, fmtDay, fmtHours, fmtMinutes, fmtTime,
  leaveLabel, localMinutes, monthEnd, monthStart, STATUS_LABEL, todayLocal,
} from "../lib/core";
import { useApp } from "../lib/app";
import { Avatar, BAR, Badge, Button, Card, Chip, Empty, Field, Input, Muted, Segmented, Spinner, StatusBadge, cx, useToast } from "../components/ui";
import { DayEditor } from "../components/DayEditor";

const pct = (m) => Math.min(100, Math.max(0, ((m - DAY_START) / (DAY_END - DAY_START)) * 100));
const RANGES = [["month", "This month"], ["last", "Last month"], ["3m", "3 months"], ["year", "This year"], ["custom", "Custom"]];
function rangeFor(id) {
  const t = todayLocal();
  if (id === "last") { const s = addMonths(t, -1); return { from: s, to: monthEnd(s) }; }
  if (id === "3m") return { from: addMonths(t, -2), to: t };
  if (id === "year") return { from: `${t.slice(0, 4)}-01-01`, to: t };
  return { from: monthStart(t), to: t };
}
const FILTERS = [
  ["all", "All days", () => true],
  ["late", "Late logins", (r) => r.status === "late", "late"],
  ["leave", "Leave", (r) => r.status === "on-leave", "on-leave"],
  ["absent", "Absent", (r) => r.status === "absent", "absent"],
  ["half", "Half-days", (r) => r.status === "half-day", "half-day"],
  ["early", "Left early", (r) => r.early, "late"],
  ["ot", "Overtime", (r) => r.ot > 0, "on-leave"],
  ["wfh", "Work from home", (r) => r.wfh, "wfh"],
  ["noout", "Missing logout", (r) => r.missingOut, "absent"],
  ["holiday", "Holidays", (r) => r.status === "holiday", "holiday"],
];
const SOURCE = { fingerprint: "Fingerprint machine", manual: "App clock-in or admin", wfh: "Work from home" };

export default function Employee({ id }) {
  const { loadUsers, invalidateUsers, leaveTypes, lateAfterMin } = useApp();
  const toast = useToast();
  const [person, setPerson] = useState(null);
  const [personErr, setPersonErr] = useState("");
  const [range, setRange] = useState("month");
  const [custom, setCustom] = useState(rangeFor("month"));
  const [filter, setFilter] = useState("all");
  const [days, setDays] = useState(null);
  const [error, setError] = useState("");
  const [editIds, setEditIds] = useState(false);
  const [edit, setEdit] = useState(null); // { date, day }
  const [mailing, setMailing] = useState(false);
  const ticket = useRef(0);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const cached = (await loadUsers()).find((u) => String(u._id) === String(id));
        const p = cached || (await api(`/attendance-app/user/${id}`, { params: { from: todayLocal(), to: todayLocal() } })).user;
        if (live) setPerson(p);
      } catch (e) { if (live) setPersonErr(e.message); }
    })();
    return () => { live = false; };
  }, [id, loadUsers]);

  const { from, to } = range === "custom" ? custom : rangeFor(range);
  const load = useCallback(async () => {
    if (!from || !to || from > to) return;
    const t = ++ticket.current;
    setDays(null); setError("");
    try {
      const j = await api(`/attendance-app/user/${id}`, { params: { from, to } });
      if (t === ticket.current) setDays(j.data || []);
    } catch (e) { if (t === ticket.current) setError(e.message); }
  }, [id, from, to]);
  useEffect(() => { if (range !== "custom") load(); }, [load, range]);

  const rows = useMemo(() => (days || []).map((d) => ({
    raw: d, ymd: d.date, in: d.clock_in, out: d.clock_out, hours: d.hours_worked, breakMin: d.break_minutes || 0,
    status: d.status, source: d.source || "", synthetic: Boolean(d.synthetic),
    note: d.status === "holiday" ? d.holiday : d.status === "on-leave" ? leaveLabel(leaveTypes, d.leave_type)
      : d.note || (d.off_day && d.clock_in ? (d.holiday ? `Worked on ${d.holiday}` : "Worked on a weekly off") : ""),
    punches: d.punches || [], missingOut: Boolean(d.clock_in && !d.clock_out && d.date < todayLocal()),
    early: Boolean(d.early_logout), ot: Number(d.overtime_hours) || 0, lateBy: d.late_by_minutes || 0,
    wfh: Boolean(d.work_from_home), remark: d.remark || "", remarkBy: d.remark_by || "",
    locked: Boolean(d.admin_locked), markedBy: d.marked_by || "",
    punchDetails: d.punch_details || [], uncorrected: d.uncorrected_punches || 0,
  })), [days, leaveTypes]);

  const stats = useMemo(() => {
    const worked = rows.filter((r) => r.in);
    const withH = rows.filter((r) => r.hours != null);
    const total = withH.reduce((s, r) => s + Number(r.hours), 0);
    const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
    const count = (s) => rows.filter((r) => r.status === s).length;
    return {
      total, days: worked.length, avgHours: withH.length ? total / withH.length : null,
      avgIn: avg(worked.map((r) => localMinutes(r.in))), avgOut: avg(rows.filter((r) => r.out).map((r) => localMinutes(r.out))),
      late: count("late"), leave: count("on-leave"), absent: count("absent"), ot: rows.reduce((a, r) => a + r.ot, 0),
    };
  }, [rows]);

  const test = FILTERS.find(([k]) => k === filter)[2];
  const shown = rows.filter(test);

  const exportCsv = () => {
    if (!shown.length || !person) return;
    downloadCsv(`attendance-${empIdOf(person) || person.name}-${shown.at(-1).ymd}_${shown[0].ymd}.csv`,
      ["Employee ID", "Device ID", "Name", "Date", "Login", "Logout", "Hours", "Break (min)", "Status", "Work from home", "Late by (min)", "Left early", "Overtime (h)", "Source", "All punches", "Remark", "Note"],
      shown.map((r) => [empIdOf(person), deviceIdOf(person), person.name, r.ymd, fmtTime(r.in), fmtTime(r.out), r.hours ?? "", r.breakMin,
        STATUS_LABEL[r.status] || r.status, r.wfh ? "Yes" : "", r.lateBy || "", r.early ? "Yes" : "", r.ot || "", r.source,
        r.punches.map((p) => fmtTime(p)).join(" "), r.remark, r.note]));
  };

  if (personErr) return <Card><Empty>{personErr}</Empty></Card>;
  if (!person) return <Card><Spinner /></Card>;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button size="sm" variant="ghost" icon={ArrowLeft} onClick={() => (history.length > 1 ? history.back() : (location.hash = "#people"))}>Back</Button>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={person.name} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-extrabold tracking-tight">{person.name}</h1>
            <p className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
              <span>Employee ID <b className="text-zinc-900 tabular-nums dark:text-zinc-100">{empIdOf(person) || "not set"}</b></span>
              <span>Device ID <b className="text-zinc-900 tabular-nums dark:text-zinc-100">{deviceIdOf(person) || "not set"}</b></span>
              {person.department && <span>{person.department}</span>}
              {person.designation && <span>{person.designation}</span>}
              {person.status === "inactive" && <Badge tone="absent">Inactive</Badge>}
            </p>
            <p className="mt-0.5 text-sm">
              {emailMissing(person)
                ? <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300"><TriangleAlert className="size-4" aria-hidden /> No email: add one to link attendance and send emails</span>
                : <span className="text-zinc-500 dark:text-zinc-400">{person.email}</span>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="primary" icon={Mail} disabled={emailMissing(person)} onClick={() => setMailing(true)}
              title={emailMissing(person) ? "Add an email first" : `Email ${person.name}`}>Send email</Button>
            <Button size="sm" icon={IdCard} onClick={() => setEditIds((v) => !v)}>Edit details</Button>
          </div>
        </div>
        {editIds && (
          <IdsForm
            person={person}
            onCancel={() => setEditIds(false)}
            onSaved={(p, imported) => {
              setPerson((x) => ({ ...x, name: p.name || x.name, email: p.email || x.email, employee_id: p.employee_id, fingerprint_id: p.fingerprint_id }));
              setEditIds(false); invalidateUsers();
              toast(imported?.length ? `IDs saved. Imported ${imported.reduce((a, i) => a + i.punches, 0)} earlier punches.` : "IDs saved.");
              if (imported?.length) load();
            }}
          />
        )}
      </Card>

      <Card className="flex flex-col gap-2 p-2">
        <Segmented options={RANGES} value={range} onChange={(v) => { setRange(v); if (v !== "custom") setFilter("all"); }} />
        {range === "custom" && (
          <div className="flex flex-wrap items-end gap-2 p-1">
            <Field label="From"><Input type="date" value={custom.from} max={todayLocal()} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} /></Field>
            <Field label="To"><Input type="date" value={custom.to} max={todayLocal()} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} /></Field>
            <Button variant="primary" onClick={load} disabled={!custom.from || !custom.to || custom.from > custom.to}>Show</Button>
          </div>
        )}
      </Card>

      {error ? <Card><Empty>{error}</Empty></Card> : !days ? <Card><Spinner label="Loading attendance…" /></Card> : (
        <>
          <section className="grid grid-cols-3 gap-2.5 md:grid-cols-[1.6fr_1fr_1fr_1fr]" aria-live="polite">
            <Card className="col-span-3 flex flex-col justify-center gap-0.5 p-5 md:col-span-1 md:row-span-2">
              <span className="font-bold">Total working hours</span>
              <b className="text-4xl font-extrabold tracking-tight tabular-nums md:text-5xl">{fmtHours(stats.total) || "0h 00m"}</b>
              <Muted as="span">{stats.avgHours != null ? `${fmtHours(stats.avgHours)} a day on average` : "No completed days yet"}</Muted>
              {stats.ot > 0 && <span className="text-sm font-bold text-violet-600 dark:text-violet-300">{fmtHours(stats.ot)} overtime</span>}
            </Card>
            <Stat value={stats.days} label="Days worked" />
            <Stat value={stats.avgIn != null ? fmtMinutes(stats.avgIn) : "—"} label="Average login" />
            <Stat value={stats.avgOut != null ? fmtMinutes(stats.avgOut) : "—"} label="Average logout" />
            <Stat value={stats.late} label="Late logins" tone={stats.late && "text-amber-600 dark:text-amber-300"} />
            <Stat value={stats.leave} label="Leave days" tone={stats.leave && "text-violet-600 dark:text-violet-300"} />
            <Stat value={stats.absent} label="Absent days" tone={stats.absent && "text-rose-600 dark:text-rose-300"} />
          </section>

          <Card className="p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Show">
                {FILTERS.map(([k, label, fn, tone]) => {
                  const n = rows.filter(fn).length;
                  return k === "all" || n || filter === k
                    ? <Chip key={k} tone={tone} active={filter === k} count={n} onClick={() => setFilter(k)}>{label}</Chip> : null;
                })}
              </div>
              <div className="flex gap-2">
                <Button size="sm" icon={CalendarPlus} onClick={() => setEdit({ date: null, day: {} })}>Mark a day</Button>
                <Button size="sm" icon={Download} onClick={exportCsv} disabled={!shown.length}>Export CSV</Button>
              </div>
            </div>
            <Scale />
            {!shown.length ? <Empty>{rows.length ? "No days match this filter." : "No attendance recorded in these dates."}</Empty> : (
              <ul>
                {shown.map((r, i) => (
                  <Fragment key={r.ymd}>
                    {(i === 0 || shown[i - 1].ymd.slice(0, 7) !== r.ymd.slice(0, 7)) && (
                      <li className="px-1 pt-3 pb-1 text-sm font-extrabold text-zinc-500 dark:text-zinc-400">
                        {fmtDay(`${r.ymd.slice(0, 7)}-01`, { month: "long", year: "numeric" })}
                      </li>
                    )}
                    <DayRow r={r} lateAfterMin={lateAfterMin} onEdit={() => setEdit({ date: r.ymd, day: r.synthetic ? {} : r.raw })} />
                  </Fragment>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      <SendEmail open={mailing} onClose={() => setMailing(false)} person={person} />
      <DayEditor open={Boolean(edit)} onClose={() => setEdit(null)} person={person} date={edit?.date} day={edit?.day} onSaved={load} />
    </div>
  );
}

const Stat = ({ value, label, tone }) => (
  <Card className="flex flex-col gap-0.5 p-3 md:p-4">
    <b className={cx("text-lg font-extrabold tabular-nums md:text-2xl", tone)}>{value}</b>
    <span className="text-xs font-semibold text-zinc-500 md:text-sm dark:text-zinc-400">{label}</span>
  </Card>
);

function Scale() {
  const marks = [];
  for (let h = Math.ceil(DAY_START / 60); h <= DAY_END / 60; h += 3) marks.push(h);
  return (
    <div aria-hidden className="relative mr-[7.5rem] ml-14 hidden h-4 text-[11px] font-semibold text-zinc-400 sm:block">
      {marks.map((h) => <span key={h} className="absolute -translate-x-1/2" style={{ left: `${pct(h * 60)}%` }}>{h % 12 || 12}{h < 12 ? "a" : "p"}</span>)}
    </div>
  );
}

function DayRow({ r, lateAfterMin, onEdit }) {
  const [open, setOpen] = useState(false);
  const live = r.in && !r.out && r.ymd === todayLocal();
  const a = r.in ? pct(localMinutes(r.in)) : 0;
  const b = r.out ? pct(localMinutes(r.out)) : live ? pct(localMinutes(new Date())) : a;
  return (
    <li className="border-t border-zinc-100 first:border-0 dark:border-zinc-800">
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-expanded={open}
          disabled={r.synthetic}
          onClick={() => setOpen((o) => !o)}
          className="grid flex-1 grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl p-2 text-left enabled:hover:bg-zinc-50 disabled:cursor-default dark:enabled:hover:bg-zinc-800/50"
        >
          <span className="flex flex-col items-center leading-none">
            <b className="text-xl font-extrabold">{fmtDay(r.ymd, { day: "numeric" })}</b>
            <span className="mt-1 text-xs font-semibold text-zinc-500">{fmtDay(r.ymd, { weekday: "short" })}</span>
          </span>
          <span className="flex min-w-0 flex-col gap-1.5">
            <span className="relative h-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800" aria-hidden>
              <span className="absolute -top-1 -bottom-1 border-l-[1.5px] border-dashed border-amber-400/80" style={{ left: `${pct(lateAfterMin)}%` }} />
              {r.in && (
                <span
                  className={cx("absolute inset-y-0 rounded-full", BAR[r.status] || BAR.present, live && "animate-pulse")}
                  style={{ left: `${a}%`, width: `${Math.max(b - a, 1.2)}%` }}
                />
              )}
            </span>
            <span className="flex flex-wrap gap-x-3.5 gap-y-0.5 text-sm font-semibold tabular-nums">
              {r.synthetic ? <span className="font-normal text-zinc-500">{r.note}</span> : (
                <>
                  <span><span className="font-normal text-zinc-400">In </span>{r.in ? fmtTime(r.in) : "—"}</span>
                  <span>
                    <span className="font-normal text-zinc-400">Out </span>
                    {r.out ? fmtTime(r.out) : r.missingOut ? <span className="text-rose-600 dark:text-rose-400">Missing</span>
                      : live ? <span className="text-emerald-600 dark:text-emerald-400">At work</span> : "—"}
                  </span>
                  {r.lateBy > 0 && <span className="text-amber-600 dark:text-amber-300">{r.lateBy} min late</span>}
                  {r.early && <span className="text-amber-600 dark:text-amber-300">Left early</span>}
                  {r.ot > 0 && <span className="text-violet-600 dark:text-violet-300">+{fmtHours(r.ot)} overtime</span>}
                  {r.note && <span className="font-normal text-zinc-500">{r.note}</span>}
                </>
              )}
            </span>
          </span>
          <span className="flex min-w-24 flex-col items-end gap-1">
            <b className="tabular-nums">{fmtHours(r.hours) || "—"}</b>
            <span className="flex flex-wrap justify-end gap-1">
              <StatusBadge status={r.status} />
              {r.wfh && <Badge tone="wfh"><Home className="mr-1 size-3" aria-hidden />WFH</Badge>}
            </span>
          </span>
        </button>
        {r.status !== "holiday" && (
          <Button size="sm" variant="ghost" icon={PencilLine} onClick={onEdit} aria-label={`${r.synthetic ? "Mark" : "Edit"} ${r.ymd}`}>
            <span className="max-sm:sr-only">{r.synthetic ? "Mark" : "Edit"}</span>
          </Button>
        )}
      </div>
      {r.remark && (
        <p className="mb-2 ml-16 flex items-start gap-1.5 text-sm italic text-zinc-600 dark:text-zinc-300">
          <MessageSquareText className="mt-0.5 size-3.5 shrink-0 not-italic text-zinc-400" aria-hidden />
          <span>“{r.remark}”{r.remarkBy && <span className="not-italic text-zinc-400"> {r.remarkBy}</span>}</span>
        </p>
      )}
      {open && !r.synthetic && (
        <dl className="mb-3 ml-16 grid gap-1.5 text-sm">
          <Row k="Punches" v={r.punchDetails.length
            ? r.punchDetails.map((p) => `${fmtTime(p.time)}${p.correction_minutes ? ` (machine ${fmtTime(new Date(new Date(p.time) - p.correction_minutes * 60000))})` : ""}`).join(", ")
            : r.punches.length ? r.punches.map((p) => fmtTime(p)).join(", ") : "None recorded"} />
          {r.uncorrected > 0 && <Row k="Machine clock" v={`${r.uncorrected} punch${r.uncorrected === 1 ? "" : "es"} not corrected yet. Use Settings → Check & fix data.`} />}
          <Row k="Break" v={r.breakMin ? `${r.breakMin} min` : "None"} />
          <Row k="Recorded by" v={SOURCE[r.source] || r.source || "—"} />
          {r.locked && <Row k="Marked by" v={`${r.markedBy || "Admin"} (fingerprint punches don't change this day)`} />}
        </dl>
      )}
    </li>
  );
}
const Row = ({ k, v }) => (
  <div className="grid grid-cols-[7rem_1fr] gap-2">
    <dt className="font-semibold text-zinc-500 dark:text-zinc-400">{k}</dt>
    <dd className="tabular-nums">{v}</dd>
  </div>
);

function IdsForm({ person, onCancel, onSaved }) {
  const [name, setName] = useState(person.name || "");
  const [email, setEmail] = useState(emailMissing(person) ? "" : person.email || "");
  const [emp, setEmp] = useState(empIdOf(person));
  const [dev, setDev] = useState(deviceIdOf(person));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const j = await api(`/attendance-app/user/${person._id}/ids`, { method: "PATCH", body: { name: name.trim(), ...(email.trim() && email.trim() !== person.email ? { email: email.trim() } : {}), employee_id: emp.trim(), fingerprint_id: dev.trim() } });
      onSaved(j.data, j.imported);
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={save} className="mt-4 grid gap-3 border-t border-zinc-100 pt-4 sm:grid-cols-2 lg:grid-cols-[1fr_1.3fr_0.8fr_0.8fr_auto] lg:items-end dark:border-zinc-800">
      <Field label="Name"><Input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Email" hint="(required)"><Input type="email" value={email} placeholder="name@company.com" onChange={(e) => setEmail(e.target.value)} /></Field>
      <Field label="Employee ID"><Input value={emp} maxLength={40} placeholder="e.g. SKY012" onChange={(e) => setEmp(e.target.value)} /></Field>
      <Field label="Device ID" hint="(number on the fingerprint machine)"><Input value={dev} maxLength={40} placeholder="e.g. 7" inputMode="numeric" onChange={(e) => setDev(e.target.value)} /></Field>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" type="submit" loading={busy}>Save</Button>
      </div>
      {err && <p role="alert" className="text-sm font-semibold text-rose-600 sm:col-span-2 lg:col-span-5 dark:text-rose-400">{err}</p>}
    </form>
  );
}