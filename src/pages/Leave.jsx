import { useCallback, useEffect, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { BulkLeaveDialog } from "../components/Bulk";
import { api, fmtDay, leaveLabel, ymdOfStored } from "../lib/core";
import { useApp } from "../lib/app";
import { Avatar, Badge, Button, Card, Empty, Input, Muted, Segmented, Spinner, useToast } from "../components/ui";

const LSTAT = { pending: ["Pending", "late"], approved: ["Approved", "present"], rejected: ["Not approved", "absent"] };
const TYPE_DOT = { sick: "bg-emerald-500", casual: "bg-brand-500", earned: "bg-violet-500", maternity: "bg-rose-500", emergency: "bg-amber-400", unpaid: "bg-zinc-400" };
const days = (n) => `${n} ${n === 1 ? "day" : "days"}`;
const span = (r) => {
  const a = ymdOfStored(r.from_date), b = ymdOfStored(r.to_date);
  const s = { day: "numeric", month: "short" };
  return a === b ? fmtDay(a, { weekday: "short", ...s, year: "numeric" }) : `${fmtDay(a, s)} to ${fmtDay(b, { ...s, year: "numeric" })}`;
};

export default function Leave() {
  const { leaveTypes } = useApp();
  const toast = useToast();
  const [tab, setTab] = useState("pending");
  const [items, setItems] = useState(null);
  const [pending, setPending] = useState(0);
  const [q, setQ] = useState("");
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setItems(null);
    try {
      const j = await api("/leaves", { params: { limit: 200, status: tab || undefined } });
      setItems(j.data || []);
      setPending(tab === "pending" ? j.total : (await api("/leaves", { params: { status: "pending", limit: 1 } })).total);
    } catch (e) { setItems([]); toast(e.message); }
  }, [tab, toast]);
  useEffect(() => { load(); }, [load]);

  const review = async (r, status) => {
    setBusy(r._id + status);
    try {
      await api(`/leaves/${r._id}`, { method: "PATCH", body: { status, admin_note: notes[r._id]?.trim() || undefined } });
      toast(status === "approved" ? "Leave approved." : "Leave rejected.");
      load();
    } catch (e) { toast(e.message); } finally { setBusy(""); }
  };

  const term = q.trim().toLowerCase();
  const list = (items || []).filter((r) => !term || (r.user_id?.name || "").toLowerCase().includes(term));

  return (
    <Card className="mx-auto w-full max-w-3xl p-3">
      <BulkLeaveDialog open={adding} onClose={() => setAdding(false)} onSaved={() => { setTab("approved"); load(); }} />
      <div className="flex flex-wrap items-center gap-2 pb-2">
        <Segmented
          className="flex-1"
          value={tab}
          onChange={setTab}
          options={[
            ["pending", "To review", pending ? <span className="rounded-full bg-rose-500 px-1.5 text-xs font-bold text-white">{pending}</span> : null],
            ["approved", "Approved"], ["rejected", "Rejected"], ["", "All"],
          ]}
        />
        <Button variant="primary" icon={Plus} onClick={() => setAdding(true)} className="max-sm:w-full">Add leave</Button>
        <label className="relative w-full sm:w-56">
          <span className="sr-only">Search by name</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
          <Input type="search" placeholder="Search name" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </label>
      </div>
      {!items ? <Spinner /> : !list.length ? (
        <Empty>{term ? "No one matches that name." : tab === "pending" ? "No requests waiting. New ones will appear here and in your notifications." : "No leave requests here."}</Empty>
      ) : (
        <ul>
          {list.map((r) => {
            const who = r.user_id || {};
            const [label, tone] = LSTAT[r.status] || [r.status, "neutral"];
            return (
              <li key={r._id} className="flex flex-col gap-2 border-t border-zinc-100 px-1 py-4 first:border-0 dark:border-zinc-800">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <a href={`#employee/${who._id}`} className="flex items-center gap-2.5">
                    <Avatar name={who.name} size="sm" />
                    <span className="leading-tight"><b className="block">{who.name}</b>{who.department && <span className="text-xs text-zinc-500">{who.department}</span>}</span>
                  </a>
                  <span className="inline-flex items-center gap-1.5 font-bold">
                    <span className={`size-2.5 rounded-full ${TYPE_DOT[r.leave_type] || "bg-violet-500"}`} aria-hidden />
                    {leaveLabel(leaveTypes, r.leave_type)}
                  </span>
                  {r.is_urgent && <Badge tone="late">Urgent</Badge>}
                  <Badge tone={tone} className="ml-auto">{label}</Badge>
                </div>
                <p><b>{span(r)}</b> <span className="text-zinc-500">{days(r.days)}</span></p>
                {r.reason && <p className="text-[15px] text-zinc-600 dark:text-zinc-300">{r.reason}</p>}
                {r.handover_notes && <Muted>Handover: {r.handover_notes}</Muted>}
                {r.contact_during_leave && <Muted>Contact: {r.contact_during_leave}</Muted>}
                {r.status !== "pending" && (r.reviewed_by || r.admin_note) && (
                  <Muted>{r.reviewed_by?.name ? `Reviewed by ${r.reviewed_by.name}` : "Reviewed"}{r.admin_note ? `: ${r.admin_note}` : ""}</Muted>
                )}
                {r.status === "pending" && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Input
                      className="h-10 flex-1 basis-full sm:basis-60"
                      placeholder="Note to the employee (optional)"
                      aria-label="Note"
                      maxLength={500}
                      value={notes[r._id] || ""}
                      onChange={(e) => setNotes((n) => ({ ...n, [r._id]: e.target.value }))}
                    />
                    <Button size="sm" icon={X} className="max-sm:flex-1" loading={busy === r._id + "rejected"} onClick={() => review(r, "rejected")}>Reject</Button>
                    <Button size="sm" variant="primary" icon={Check} className="max-sm:flex-1" loading={busy === r._id + "approved"} onClick={() => review(r, "approved")}>Approve</Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
