// Create employees for people enrolled on the fingerprint machine who have no employee record.
// Name and Device ID come from the machine; the admin adds email (and optional Employee ID),
// one department and designation for the group. Temporary passwords are shown once.
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Copy, ListChecks, UserPlus, XCircle } from "lucide-react";
import { api } from "../lib/core";
import { Button, Checkbox, Dialog, Field, Input, Muted, cx, useToast } from "./ui";

const WIDE = "w-[min(860px,calc(100vw-1.5rem))]!";

export default function CreateFromMachine({ open, onClose, machineUsers, people, onCreated }) {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [department, setDepartment] = useState("");
  const [designation, setDesignation] = useState("");
  const [noEmailOk, setNoEmailOk] = useState(false);
  const [check, setCheck] = useState(null);
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (!open) return;
    setRows(machineUsers.map((u) => ({ pin: u.pin, name: u.name || "", email: "", employee_id: "" })));
    setCheck(null); setDone(null); setNoEmailOk(false);
  }, [open, machineUsers]);

  const departments = useMemo(() => [...new Set(people.map((p) => p.department).filter(Boolean))].sort(), [people]);
  const set = (i, k, v) => { setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x))); setCheck(null); };
  const byPin = new Map((check?.results || []).map((r) => [r.pin, r]));

  const send = async (dry) => {
    if (!department.trim() || !designation.trim()) return toast("Choose a department and enter a designation.");
    setBusy(dry ? "check" : "save");
    try {
      const j = (await api("/attendance-app/machine/create-employees", {
        method: "POST", body: { items: rows, department: department.trim(), designation: designation.trim(), no_email_ok: noEmailOk, dry_run: dry }, timeout: 60000,
      })).data;
      if (dry) setCheck(j);
      else { setDone(j); onCreated?.(); }
    } catch (e) { toast(e.message); } finally { setBusy(""); }
  };

  const created = done?.results.filter((r) => r.user_id) || [];
  const copyAll = async () => {
    const text = created.filter((r) => r.temporary_password).map((r) => `${r.name}\t${r.email}\t${r.temporary_password}`).join("\n");
    try { await navigator.clipboard.writeText(`Name\tEmail\tTemporary password\n${text}`); toast("Copied. Paste it into a message or a sheet."); }
    catch { toast("Couldn't copy. Select the table and copy it instead."); }
  };

  return (
    <Dialog open={open} onClose={onClose} className={WIDE}
      title={done ? "Employees created" : `Create ${rows.length} employee${rows.length === 1 ? "" : "s"} from the machine`}
      subtitle={done ? "Share each temporary password privately. People can also use Forgot password to set their own."
        : "Name and Device ID come from the machine. Add an email for each person, then choose their department and designation."}>
      {done ? (
        <div className="flex flex-col gap-3">
          <ul className="max-h-80 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
            {done.results.map((r) => (
              <li key={r.pin} className="grid grid-cols-[auto_1fr] items-start gap-2 border-t border-zinc-100 px-3 py-2.5 text-sm first:border-0 sm:grid-cols-[auto_1fr_auto] dark:border-zinc-800">
                {r.user_id ? <CheckCircle2 className="mt-0.5 size-4 text-emerald-600" aria-label="Created" /> : <XCircle className="mt-0.5 size-4 text-rose-500" aria-label="Not created" />}
                <span><b>{r.name}</b> <span className="text-zinc-500">Device ID {r.pin}{r.employee_id ? `, ${r.employee_id}` : ""}</span>
                  <span className="block text-zinc-500">{r.no_email ? "No email: attendance only, can't sign in" : r.email}{r.imported_punches ? `, ${r.imported_punches} earlier punches added` : ""}</span>
                  {!r.user_id && <span className="block text-rose-600 dark:text-rose-400">{r.error}</span>}</span>
                {r.temporary_password && (
                  <code className="col-span-2 rounded-lg bg-zinc-100 px-2 py-1 font-mono text-sm tracking-wide sm:col-span-1 dark:bg-zinc-800">{r.temporary_password}</code>
                )}
              </li>
            ))}
          </ul>
          <Muted>The passwords are shown only now. Copy them before closing.</Muted>
          <div className="flex justify-end gap-2">
            {created.some((r) => r.temporary_password) && <Button icon={Copy} onClick={copyAll}>Copy all</Button>}
            <Button variant="primary" onClick={onClose}>Close</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Department">
              <Input list="departments" value={department} onChange={(e) => { setDepartment(e.target.value); setCheck(null); }} placeholder="e.g. IT" />
              <datalist id="departments">{departments.map((d) => <option key={d} value={d} />)}</datalist>
            </Field>
            <Field label="Designation"><Input value={designation} onChange={(e) => { setDesignation(e.target.value); setCheck(null); }} placeholder="e.g. Executive" /></Field>
          </div>
          <div className="hidden grid-cols-[4.5rem_1fr_1.3fr_8rem] gap-2 px-1 text-xs font-bold text-zinc-500 sm:grid">
            <span>Device ID</span><span>Name</span><span>Email</span><span>Employee ID</span>
          </div>
          <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto">
            {rows.map((r, i) => {
              const res = byPin.get(r.pin);
              return (
                <li key={r.pin} className={cx("grid grid-cols-2 gap-2 rounded-xl p-1 sm:grid-cols-[4.5rem_1fr_1.3fr_8rem] sm:items-center", res && !res.ok && "bg-rose-50 dark:bg-rose-500/10")}>
                  <span className="font-bold tabular-nums sm:pl-1">#{r.pin}</span>
                  <Input aria-label={`Name for ${r.pin}`} value={r.name} onChange={(e) => set(i, "name", e.target.value)} className="h-10" placeholder="Name" />
                  <Input aria-label={`Email for ${r.pin}`} type="email" value={r.email} onChange={(e) => set(i, "email", e.target.value)} className="col-span-2 h-10 sm:col-span-1" placeholder="name@company.com (required)" />
                  <Input aria-label={`Employee ID for ${r.pin}`} value={r.employee_id} onChange={(e) => set(i, "employee_id", e.target.value)} className="col-span-2 h-10 sm:col-span-1" placeholder="Optional" />
                  {res && !res.ok && <span className="col-span-2 px-1 text-sm text-rose-600 sm:col-span-4 dark:text-rose-400">{res.error}</span>}
                </li>
              );
            })}
          </ul>
          {check && (
            <p className="text-sm font-semibold">
              <span className="text-emerald-700 dark:text-emerald-300">{check.ready} ready</span>
              {check.results.length - check.ready > 0 && <span className="text-rose-600 dark:text-rose-400">, {check.results.length - check.ready} to fix (shown in red)</span>}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            {!check ? <Button icon={ListChecks} loading={busy === "check"} onClick={() => send(true)}>Check</Button>
              : <Button variant="primary" icon={UserPlus} loading={busy === "save"} disabled={!check.ready} onClick={() => send(false)}>Create {check.ready} employee{check.ready === 1 ? "" : "s"}</Button>}
          </div>
        </>
      )}
    </Dialog>
  );
}