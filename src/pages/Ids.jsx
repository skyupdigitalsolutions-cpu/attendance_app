import { useCallback, useEffect, useMemo, useState } from "react";
import { Fingerprint, Save, Search, Trash2, Undo2 } from "lucide-react";
import { api, fmtDay, fmtTime, ymdOfStored } from "../lib/core";
import { useApp } from "../lib/app";
import MachineCard from "../components/MachineCard";
import { Avatar, Badge, Button, Card, CardTitle, Chip, Empty, Input, Muted, Select, Spinner, cx, useToast } from "../components/ui";

export default function Ids() {
  const { invalidateUsers } = useApp();
  const toast = useToast();
  const [people, setPeople] = useState(null);
  const [unassigned, setUnassigned] = useState([]);
  const [edits, setEdits] = useState({}); // { userId: { employee_id?, fingerprint_id? } }
  const [q, setQ] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError(""); // keep the current list on screen while refreshing (so open dialogs stay open)
    try {
      const j = await api("/attendance-app/ids");
      setPeople(j.data || []); setUnassigned(j.unassigned || []); setEdits({});
    } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const val = (p, f) => (edits[p._id]?.[f] ?? p[f] ?? "") || "";
  const setVal = (p, f, v) => setEdits((all) => {
    const cur = { ...(all[p._id] || {}), [f]: v.trim() };
    const same = ["employee_id", "fingerprint_id"].every((k) => (cur[k] ?? (p[k] || "")) === (p[k] || ""));
    const next = { ...all };
    if (same) delete next[p._id]; else next[p._id] = cur;
    return next;
  });

  // Duplicate values after the pending edits
  const dup = useMemo(() => {
    const d = { employee_id: new Set(), fingerprint_id: new Set() };
    for (const f of ["employee_id", "fingerprint_id"]) {
      const seen = new Set();
      for (const p of people || []) { const v = val(p, f).trim(); if (!v) continue; if (seen.has(v)) d[f].add(v); seen.add(v); }
    }
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, edits]);

  const missing = (p) => !val(p, "employee_id") || !val(p, "fingerprint_id");
  const term = q.trim().toLowerCase();
  const list = (people || []).filter((p) =>
    (!term || p.name.toLowerCase().includes(term) || (p.email || "").toLowerCase().includes(term) ||
      val(p, "employee_id").toLowerCase().includes(term) || val(p, "fingerprint_id").toLowerCase() === term) &&
    (!onlyMissing || missing(p)));
  const nChanged = Object.keys(edits).length;
  const hasDup = dup.employee_id.size + dup.fingerprint_id.size > 0;
  const nMissing = (people || []).filter((p) => p.status !== "inactive" && missing(p)).length;

  const state = (p) => {
    if (dup.employee_id.has(val(p, "employee_id")) || dup.fingerprint_id.has(val(p, "fingerprint_id"))) return <Badge tone="absent">Duplicate</Badge>;
    if (edits[p._id]) return <Badge tone="late">Not saved</Badge>;
    if (!val(p, "fingerprint_id")) return <Badge tone="not-marked">No device ID</Badge>;
    if (!val(p, "employee_id")) return <Badge tone="not-marked">No employee ID</Badge>;
    return <Badge tone="present">Ready</Badge>;
  };

  const assign = (deviceId, userId) => {
    const p = people.find((x) => x._id === userId);
    if (!p) return;
    if (val(p, "fingerprint_id") && !confirm(`${p.name} already has Device ID ${val(p, "fingerprint_id")}. Replace it with ${deviceId}?`)) return;
    setVal(p, "fingerprint_id", deviceId);
    toast(`Device ID ${deviceId} set for ${p.name}. Save to import their earlier punches.`);
  };
  const discard = async (deviceId) => {
    if (!confirm(`Discard the kept punches for Device ID ${deviceId}? Use this only for test or wrong enrolments.`)) return;
    try { await api(`/attendance-app/ids/unassigned/${encodeURIComponent(deviceId)}`, { method: "DELETE" }); toast("Discarded."); load(); setRefreshKey((k) => k + 1); }
    catch (e) { toast(e.message); }
  };
  const save = async () => {
    setSaving(true);
    try {
      const changes = Object.entries(edits).map(([user_id, c]) => ({ user_id, ...c }));
      const j = await api("/attendance-app/ids", { method: "PUT", body: { changes } });
      const imp = j.imported || [];
      toast(`Saved ${j.updated} ${j.updated === 1 ? "person" : "people"}.` +
        (imp.length ? ` Imported ${imp.map((i) => `${i.punches} earlier punches for Device ID ${i.device_id} into ${i.user}`).join("; ")}.` : ""));
      invalidateUsers(); load(); setRefreshKey((k) => k + 1);
    } catch (e) { toast(e.message); } finally { setSaving(false); }
  };

  if (error) return <Card className="p-2"><Empty>{error}</Empty></Card>;
  if (!people) return <Card><Spinner /></Card>;
  const options = [...people].filter((p) => p.status !== "inactive")
    .sort((a, b) => (!!val(a, "fingerprint_id") - !!val(b, "fingerprint_id")) || a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-3 pb-24">
      <MachineCard
        people={people}
        refreshKey={refreshKey}
        onLink={assign}
        onDiscard={discard}
        onCreated={() => { invalidateUsers(); load(); }}
        linkedNow={(pin) => people.find((p) => edits[p._id] && val(p, "fingerprint_id") === pin)?.name}
      />

      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Employee and Device IDs</CardTitle>
            <Muted>{people.length} people, {nMissing} missing an ID</Muted>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <label className="relative flex-1 sm:w-60 sm:flex-none">
              <span className="sr-only">Search</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
              <Input type="search" placeholder="Search name or ID" value={q} onChange={(e) => setQ(e.target.value)} className="h-10 pl-9" />
            </label>
            <Chip active={onlyMissing} onClick={() => setOnlyMissing((v) => !v)} className="h-10">Missing IDs only</Chip>
          </div>
        </div>
        <Muted className="mt-2">Device ID is the user number on the fingerprint machine. Each punch goes to the person with that Device ID; if nobody has it, to the person whose Employee ID matches it.</Muted>

        <div className="mt-3 hidden grid-cols-[minmax(0,1.3fr)_1fr_1fr_8.5rem] gap-3 px-2 pb-1 text-xs font-bold text-zinc-500 md:grid dark:text-zinc-400">
          <span>Employee</span><span>Employee ID</span><span>Device ID</span><span />
        </div>
        {!list.length ? <Empty>{onlyMissing ? "Everyone has both IDs." : "No one matches."}</Empty> : (
          <ul>
            {list.map((p) => {
              const e = val(p, "employee_id"), d = val(p, "fingerprint_id");
              return (
                <li key={p._id} className={cx(
                  "grid grid-cols-2 items-center gap-x-3 gap-y-2 rounded-xl border-t border-zinc-100 px-2 py-3 first:border-0 md:grid-cols-[minmax(0,1.3fr)_1fr_1fr_8.5rem] dark:border-zinc-800",
                  edits[p._id] && "bg-amber-50/60 dark:bg-amber-500/5", p.status === "inactive" && "opacity-55",
                )}>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={p.name} size="sm" />
                    <span className="min-w-0 leading-tight"><b className="block truncate">{p.name}</b>
                      <span className="block truncate text-xs text-zinc-500">{[p.department, p.status === "inactive" && "inactive"].filter(Boolean).join(", ") || p.email}</span></span>
                  </span>
                  <span className="flex justify-end md:order-4">{state(p)}</span>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-zinc-500 md:sr-only">Employee ID</span>
                    <Input value={e} maxLength={40} placeholder="e.g. SKY012" aria-label={`Employee ID for ${p.name}`} invalid={dup.employee_id.has(e)} onChange={(ev) => setVal(p, "employee_id", ev.target.value)} className="h-10 tabular-nums" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-zinc-500 md:sr-only">Device ID</span>
                    <Input value={d} maxLength={40} placeholder="e.g. 7" inputMode="numeric" aria-label={`Device ID for ${p.name}`} invalid={dup.fingerprint_id.has(d)} onChange={(ev) => setVal(p, "fingerprint_id", ev.target.value)} className="h-10 tabular-nums" />
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {nChanged > 0 && (
        <div className="sticky bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-20">
          <Card className="flex flex-wrap items-center justify-between gap-3 bg-white! px-4 py-3 shadow-lg dark:bg-zinc-900!">
            <span className="font-bold">
              {hasDup
                ? `Fix the duplicate ${[...dup.employee_id].map((v) => `Employee ID ${v}`).concat([...dup.fingerprint_id].map((v) => `Device ID ${v}`)).join(", ")} before saving.`
                : `${nChanged} ${nChanged === 1 ? "person" : "people"} changed`}
            </span>
            <span className="flex gap-2 max-sm:w-full [&>*]:max-sm:flex-1">
              <Button variant="ghost" icon={Undo2} onClick={() => setEdits({})}>Discard changes</Button>
              <Button variant="primary" icon={Save} onClick={save} loading={saving} disabled={hasDup}>Save changes</Button>
            </span>
          </Card>
        </div>
      )}
    </div>
  );
}