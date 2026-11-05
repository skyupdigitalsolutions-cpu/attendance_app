import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Info, PencilLine, RefreshCw, Search } from "lucide-react";
import { api, addDays, downloadCsv, deviceIdOf, empIdOf, fmtDay, fmtHours, fmtTime, idsLabel, STATUS_LABEL, todayLocal } from "../lib/core";
import { go } from "../lib/app";
import { Avatar, Badge, Button, Card, Chip, Empty, IconButton, Input, Muted, Spinner, StatusBadge } from "../components/ui";
import { DayEditor } from "../components/DayEditor";

const ORDER = ["present", "late", "half-day", "on-leave", "absent", "not-marked"];
const GRID = "md:grid md:grid-cols-[6.5rem_5rem_minmax(0,1fr)_5.5rem_5.5rem_5.5rem_8.5rem_5rem] md:items-center md:gap-3";

export default function Today() {
  const [date, setDate] = useState(todayLocal());
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [edit, setEdit] = useState(null);
  const ticket = useRef(0);

  const load = useCallback(async () => {
    const t = ++ticket.current;
    setData(null); setError("");
    try {
      const j = await api("/attendance-app/day", { params: { date } });
      if (t !== ticket.current) return; // a newer request is on its way
      const rows = j.data.map((r) => ({
        ...r, uid: String(r.user._id), empId: empIdOf(r.user), devId: deviceIdOf(r.user),
        name: r.user.name || "Unknown", dept: r.user.department || "",
      }));
      rows.sort((a, b) => (!a.empId - !b.empId) || a.empId.localeCompare(b.empId, undefined, { numeric: true }) || a.name.localeCompare(b.name));
      setData({ rows, holiday: j.holiday, weeklyOff: j.weekly_off });
    } catch (e) { if (t === ticket.current) setError(e.message); }
  }, [date]);
  useEffect(() => { load(); }, [load]);

  const term = q.trim().toLowerCase();
  const searched = useMemo(() => (data?.rows || []).filter((r) =>
    !term || r.name.toLowerCase().includes(term) || r.empId.toLowerCase().includes(term) || r.devId.toLowerCase() === term), [data, term]);
  const shown = searched.filter((r) => !status || r.status === status);

  const exportCsv = () => {
    if (!shown.length) return;
    downloadCsv(`attendance-${date}.csv`,
      ["Employee ID", "Device ID", "Name", "Department", "Date", "Login", "Logout", "Hours", "Status", "Work from home", "Remark"],
      shown.map((r) => [r.empId, r.devId, r.name, r.dept, date, fmtTime(r.clock_in), fmtTime(r.clock_out), r.hours_worked ?? "", STATUS_LABEL[r.status] || r.status, r.work_from_home ? "Yes" : "", r.remark || ""]));
  };

  return (
    <div className="flex flex-col gap-3">
      <Card className="flex flex-wrap items-center gap-2 p-3">
        <div className="flex items-center gap-1.5 max-sm:w-full">
          <IconButton icon={ChevronLeft} label="Previous day" onClick={() => setDate(addDays(date, -1))} />
          <Input type="date" aria-label="Date" value={date} max={todayLocal()} onChange={(e) => e.target.value && setDate(e.target.value)} className="tabular-nums sm:w-44" />
          <IconButton icon={ChevronRight} label="Next day" disabled={date >= todayLocal()} onClick={() => setDate(addDays(date, 1))} />
        </div>
        <label className="relative min-w-48 flex-1">
          <span className="sr-only">Search by name or ID</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
          <Input type="search" placeholder="Search name or ID" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </label>
        <div className="flex gap-2 max-sm:w-full [&>*]:max-sm:flex-1">
          <Button icon={RefreshCw} onClick={load}>Refresh</Button>
          <Button icon={Download} onClick={exportCsv} disabled={!shown.length}>Export CSV</Button>
        </div>
      </Card>

      {data && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          <Chip active={!status} count={searched.length} onClick={() => setStatus("")}>Everyone</Chip>
          {ORDER.map((s) => {
            const n = searched.filter((r) => r.status === s).length;
            return n || status === s ? <Chip key={s} tone={s} active={status === s} count={n} onClick={() => setStatus(s)}>{STATUS_LABEL[s]}</Chip> : null;
          })}
        </div>
      )}
      {(data?.holiday || data?.weeklyOff) && (
        <p className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <Info className="size-4" aria-hidden />
          {data.holiday ? `${data.holiday} is a holiday` : `${fmtDay(date, { weekday: "long" })} is a weekly off`}, so only people who came in are listed.
        </p>
      )}

      <Card className="overflow-hidden p-1.5">
        {error ? <Empty>{error}</Empty> : !data ? <Spinner /> : !shown.length ? (
          <Empty>{data.rows.length ? "No one matches. Clear the search or pick another status." : "No attendance recorded for this day."}</Empty>
        ) : (
          <div role="table" aria-label="Attendance">
            <div role="row" className={`hidden px-3 py-2 text-xs font-bold text-zinc-500 dark:text-zinc-400 ${GRID}`}>
              <span role="columnheader">Employee ID</span><span role="columnheader">Device ID</span><span role="columnheader">Employee</span>
              <span role="columnheader">Login</span><span role="columnheader">Logout</span><span role="columnheader">Hours</span>
              <span role="columnheader">Status</span><span role="columnheader" className="sr-only">Mark</span>
            </div>
            {shown.map((r) => (
              <div
                role="row"
                key={r.uid}
                onClick={(e) => { if (!e.target.closest("button,a")) go(`#employee/${r.uid}`); }}
                className={`grid cursor-pointer grid-cols-3 gap-x-2 gap-y-2 rounded-xl border-t border-zinc-100 px-3 py-3 first-of-type:border-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50 ${GRID}`}
              >
                <span role="cell" className="hidden font-semibold tabular-nums md:block">{r.empId || "—"}</span>
                <span role="cell" className="hidden tabular-nums text-zinc-500 md:block">{r.devId || "—"}</span>
                <a role="cell" href={`#employee/${r.uid}`} className="col-span-2 flex min-w-0 items-center gap-3 md:col-span-1">
                  <Avatar name={r.name} size="sm" />
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate font-bold">{r.name}</span>
                    <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="md:hidden">{idsLabel(r.user)}{idsLabel(r.user) && r.dept ? ", " : ""}</span>{r.dept}
                    </span>
                    {r.remark && <span className="mt-0.5 block truncate text-xs italic text-zinc-500">“{r.remark}”</span>}
                  </span>
                </a>
                <span role="cell" className="col-start-3 row-start-1 flex flex-wrap justify-end gap-1 md:col-start-auto md:row-start-auto md:order-7 md:justify-start">
                  <StatusBadge status={r.status} />{r.work_from_home && <Badge tone="wfh">WFH</Badge>}
                </span>
                <span role="cell" className="text-sm font-semibold tabular-nums md:order-4 md:text-[15px]"><span className="font-normal text-zinc-400 md:hidden">In </span>{r.clock_in ? fmtTime(r.clock_in) : "—"}</span>
                <span role="cell" className="text-sm font-semibold tabular-nums md:order-5 md:text-[15px]"><span className="font-normal text-zinc-400 md:hidden">Out </span>{r.clock_out ? fmtTime(r.clock_out) : "—"}</span>
                <span role="cell" className="text-sm font-semibold tabular-nums md:order-6 md:text-[15px]"><span className="font-normal text-zinc-400 md:hidden">Hours </span>{fmtHours(r.hours_worked) || "—"}</span>
                <span role="cell" className="col-span-3 flex justify-end md:order-8 md:col-span-1">
                  <Button size="sm" variant="ghost" icon={PencilLine} onClick={() => setEdit(r)} aria-label={`Mark ${r.name}`}>
                    {r.admin_locked || r.remark ? "Edit" : "Mark"}
                  </Button>
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Muted className="text-center">Tap anyone to see their full attendance.</Muted>

      <DayEditor
        open={Boolean(edit)}
        onClose={() => setEdit(null)}
        person={edit?.user}
        date={date}
        day={edit?.synthetic ? {} : edit || {}}
        onSaved={load}
      />
    </div>
  );
}
