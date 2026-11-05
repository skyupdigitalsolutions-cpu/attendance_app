// Mark / edit one day for one person: work from home, status, login/logout, remark.
// Only changed fields are sent, so adding a remark alone doesn't lock the day.
import { useEffect, useState } from "react";
import { Home, Info } from "lucide-react";
import { api, fmtDay, hhmmOf, todayLocal } from "../lib/core";
import { Button, Checkbox, Dialog, Field, Input, Select, Textarea, useToast } from "./ui";

const STATUSES = [
  ["auto", "Automatic (from login time and policy)"],
  ["present", "Present"], ["late", "Late"], ["half-day", "Half-day"],
  ["absent", "Absent"], ["on-leave", "On leave"],
];

export function DayEditor({ open, onClose, person, date, day = {}, onSaved }) {
  const toast = useToast();
  const initial = {
    wfh: Boolean(day.work_from_home),
    status: day.admin_locked ? day.status : "auto",
    in: hhmmOf(day.clock_in), out: hhmmOf(day.clock_out),
    remark: day.remark || "",
  };
  const [f, setF] = useState(initial);
  const [pickDate, setPickDate] = useState(todayLocal());
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setF(initial); setErr(""); setPickDate(todayLocal()); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!person) return null;
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    const d = date || pickDate;
    if (!d) return setErr("Pick a date.");
    if (f.in && f.out && f.out <= f.in) return setErr("Logout must be after login.");
    const body = { user_id: person._id, date: d };
    if (f.wfh !== initial.wfh) body.work_from_home = f.wfh;
    if (f.status !== initial.status) body.status = f.status;
    if (f.in !== initial.in) body.clock_in = f.in;
    if (f.out !== initial.out) body.clock_out = f.out;
    if (f.remark.trim() !== initial.remark) body.remark = f.remark.trim();
    const timesOrWfh = ["clock_in", "clock_out", "work_from_home"].some((k) => body[k] !== undefined);
    if (timesOrWfh && body.status === undefined && f.status === "auto") body.status = "auto";
    if (Object.keys(body).length === 2) return onClose();
    setSaving(true);
    try {
      const j = await api("/attendance-app/record", { method: "PUT", body });
      toast(body.remark !== undefined && Object.keys(body).length === 3 ? "Remark saved." : "Day updated.");
      onClose();
      onSaved?.(j.data);
    } catch (ex) { setErr(ex.message); } finally { setSaving(false); }
  };

  const fromMachine = day.clock_in && !day.admin_locked && day.source === "fingerprint";
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={date ? "Edit day" : "Mark a day"}
      subtitle={`${person.name}${date ? `, ${fmtDay(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}` : ""}`}
    >
      <form onSubmit={save} className="flex flex-col gap-4" noValidate>
        {!date && (
          <Field label="Date"><Input type="date" value={pickDate} max={todayLocal()} onChange={(e) => setPickDate(e.target.value)} required /></Field>
        )}
        {(fromMachine || day.admin_locked) && (
          <p className="flex gap-2 rounded-xl bg-zinc-50 p-3 text-sm text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            {day.admin_locked
              ? `Marked by ${day.marked_by || "an admin"}. Fingerprint punches don't change this day.`
              : "Times came from the fingerprint machine. Changing them overrides the machine for this day."}
          </p>
        )}
        <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
          <Checkbox checked={f.wfh} onChange={set("wfh")} label={<span className="inline-flex items-center gap-2"><Home className="size-4" aria-hidden /> Work from home</span>} />
        </div>
        <Field label="Status">
          <Select value={f.status} onChange={set("status")}>
            {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Login"><Input type="time" value={f.in} onChange={set("in")} /></Field>
          <Field label="Logout"><Input type="time" value={f.out} onChange={set("out")} /></Field>
        </div>
        <Field label="Remark" hint="(optional, shown with the day)">
          <Textarea rows={3} maxLength={500} value={f.remark} onChange={set("remark")} placeholder="e.g. Approved WFH, client visit, late due to traffic" />
        </Field>
        {err && <p role="alert" className="text-sm font-semibold text-rose-600 dark:text-rose-400">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" loading={saving}>Save</Button>
        </div>
      </form>
    </Dialog>
  );
}
