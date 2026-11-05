import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Download } from "lucide-react";
import { api, deviceIdOf, downloadCsv, empIdOf, fmtDay, fmtHours, fmtMinutes, idsLabel, todayLocal } from "../lib/core";
import { go } from "../lib/app";
import { Avatar, Button, Card, Empty, Field, Input, Muted, Spinner, cx } from "../components/ui";

const COLS = [
  ["working_days", "Working days"], ["present", "Present"], ["late", "Late"], ["half_day", "Half-days"],
  ["leave", "Leave"], ["wfh_days", "WFH"], ["absent", "Absent"], ["attendance_pct", "Attendance"],
  ["total_hours", "Hours"], ["overtime_hours", "Overtime"], ["early_logouts", "Left early"],
  ["missing_logouts", "No logout"], ["avg_login", "Avg login"],
];
const cell = (r, k) => {
  const v = r[k];
  if (k === "attendance_pct") return v == null ? "—" : `${v}%`;
  if (k === "total_hours" || k === "overtime_hours") return v ? fmtHours(v) : "—";
  if (k === "avg_login") return v == null ? "—" : fmtMinutes(v);
  return v;
};
const TONE = { late: "text-amber-600 dark:text-amber-300", absent: "text-rose-600 dark:text-rose-300", missing_logouts: "text-rose-600 dark:text-rose-300", leave: "text-violet-600 dark:text-violet-300", wfh_days: "text-sky-600 dark:text-sky-300" };

export default function Reports() {
  const [month, setMonth] = useState(todayLocal().slice(0, 7));
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [sort, setSort] = useState(["name", 1]);
  const ticket = useRef(0);

  useEffect(() => {
    const t = ++ticket.current;
    setData(null); setError("");
    api("/attendance-app/register", { params: { month } })
      .then((j) => t === ticket.current && setData(j))
      .catch((e) => t === ticket.current && setError(e.message));
  }, [month]);

  const rows = useMemo(() => {
    const [k, dir] = sort;
    return [...(data?.data || [])].sort((a, b) => {
      const x = k === "name" ? a.user.name : a[k] ?? -1, y = k === "name" ? b.user.name : b[k] ?? -1;
      return (typeof x === "string" ? x.localeCompare(y) : x - y) * dir;
    });
  }, [data, sort]);

  const sortBy = (k) => setSort(([sk, d]) => [k, sk === k ? -d : k === "name" ? 1 : -1]);
  const Th = ({ k, children, className }) => (
    <th scope="col" className={cx("px-3 py-2 text-xs font-bold whitespace-nowrap text-zinc-500 dark:text-zinc-400", className)} aria-sort={sort[0] === k ? (sort[1] > 0 ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => sortBy(k)} className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100">
        {children}
        {sort[0] === k && (sort[1] > 0 ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />)}
      </button>
    </th>
  );
  const holidays = (data?.holidays || []).map((h) => `${h.name} (${fmtDay(h.date, { day: "numeric", month: "short" })})`);

  return (
    <div className="flex flex-col gap-3">
      <Card className="flex flex-wrap items-end gap-3 p-3">
        <Field label="Month"><Input type="month" value={month} max={todayLocal().slice(0, 7)} onChange={(e) => e.target.value && setMonth(e.target.value)} className="w-44" /></Field>
        <Muted className="flex-1 pb-2.5">
          {data && `${data.working_days_in_month} working days in ${fmtDay(`${month}-01`, { month: "long", year: "numeric" })}${holidays.length ? `. Holidays: ${holidays.join(", ")}` : ""}.`}
        </Muted>
        <Button icon={Download} disabled={!rows.length} onClick={() => downloadCsv(`attendance-register-${data.month}.csv`,
          ["Employee ID", "Device ID", "Name", "Department", ...COLS.map(([, l]) => l)],
          data.data.map((r) => [empIdOf(r.user), deviceIdOf(r.user), r.user.name, r.user.department || "", ...COLS.map(([k]) => cell(r, k))]))}>Export CSV</Button>
      </Card>
      <Card className="overflow-x-auto p-1.5">
        {error ? <Empty>{error}</Empty> : !data ? <Spinner /> : !rows.length ? <Empty>No employees to report on.</Empty> : (
          <table className="w-full min-w-[1100px] border-collapse text-[15px]">
            <thead><tr className="text-right"><Th k="name" className="text-left">Employee</Th>{COLS.map(([k, l]) => <Th key={k} k={k}>{l}</Th>)}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user._id} onClick={() => go(`#employee/${r.user._id}`)} className="cursor-pointer border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50">
                  <td className="px-3 py-2.5">
                    <a href={`#employee/${r.user._id}`} className="flex items-center gap-2.5" onClick={(e) => e.stopPropagation()}>
                      <Avatar name={r.user.name} size="sm" />
                      <span className="leading-tight"><b className="block whitespace-nowrap">{r.user.name}</b>
                        <span className="text-xs whitespace-nowrap text-zinc-500">{idsLabel(r.user)}{idsLabel(r.user) && r.user.department ? ", " : ""}{r.user.department}</span></span>
                    </a>
                  </td>
                  {COLS.map(([k]) => <td key={k} className={cx("px-3 py-2.5 text-right tabular-nums", r[k] ? TONE[k] && `font-bold ${TONE[k]}` : "")}>{cell(r, k)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <Muted className="text-center">Working days that have passed with no punch and no leave count as absent. Tap a name for details.</Muted>
    </div>
  );
}
