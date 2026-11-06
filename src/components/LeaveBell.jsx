// Bell for LEAVE REQUESTS only (backend notification type "leave_requested").
// Shows who asked for what, with Approve / Reject right in the list, plays a
// chime when a new request arrives, and can show a pop-up when the app is in
// the background. Other notification types are not shown for now.
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellRing, Check, CheckCheck, ExternalLink, Volume2, VolumeX, X } from "lucide-react";
import { api, fmtDay, leaveLabel, timeAgo, ymdOfStored } from "../lib/core";
import { go, useApp } from "../lib/app";
import { enablePopups, playChime, prefs, showPopup, unlockSoundOnFirstTouch } from "../lib/alerts";
import { Avatar, Badge, Button, Card, Empty, IconButton, Spinner, cx, useToast } from "./ui";

const TYPE = "leave_requested";
const POLL_MS = 20000;
const LSTAT = { pending: ["Pending", "late"], approved: ["Approved", "present"], rejected: ["Not approved", "absent"] };
const span = (l) => {
  const a = ymdOfStored(l.from_date), b = ymdOfStored(l.to_date);
  const s = { day: "numeric", month: "short" };
  return a === b ? fmtDay(a, { weekday: "short", ...s }) : `${fmtDay(a, s)} to ${fmtDay(b, s)}`;
};

unlockSoundOnFirstTouch();

export default function LeaveBell() {
  const { leaveTypes } = useApp();
  const toast = useToast();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const [sound, setSound] = useState(prefs.sound);
  const [popup, setPopup] = useState(prefs.popup);
  const [busy, setBusy] = useState("");
  const seen = useRef(null); // ids already known, so only truly new requests alert
  const wrap = useRef(null);

  const applyCount = useCallback((n) => {
    const v = Math.max(0, Number(n) || 0);
    setUnread(v);
    document.title = v ? `(${v}) Attendance Admin` : "Attendance Admin";
    try { if (v && navigator.setAppBadge) navigator.setAppBadge(v); else navigator.clearAppBadge?.(); } catch { /* unsupported */ }
  }, []);

  // Unread leave requests: count + newest ones. New ids → chime, toast, pop-up.
  const check = useCallback(async () => {
    try {
      const j = await api("/notifications", { params: { type: TYPE, is_read: "false", limit: 20 } });
      applyCount(j.total);
      const fresh = (j.data || []).filter((n) => seen.current && !seen.current.has(n._id));
      if (!seen.current) seen.current = new Set();
      (j.data || []).forEach((n) => seen.current.add(n._id));
      if (fresh.length) {
        const first = fresh[0];
        const who = first.sender_id?.name || "An employee";
        const msg = fresh.length === 1 ? `New leave request from ${who}` : `${fresh.length} new leave requests`;
        if (prefs.sound && !playChime()) { /* sound not allowed until the page is tapped once */ }
        toast(msg);
        showPopup(msg, fresh.length === 1 ? first.message : "Open the app to review them.", () => go("#leave"));
        if (open) load();
      }
    } catch { /* keep last value */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyCount, toast, open]);

  useEffect(() => {
    check();
    const t = setInterval(check, POLL_MS);
    const vis = () => !document.hidden && check();
    document.addEventListener("visibilitychange", vis);
    addEventListener("focus", vis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vis); removeEventListener("focus", vis); };
  }, [check]);

  // Panel: latest leave notifications, joined with the leave request they point to
  const load = useCallback(async () => {
    try {
      const [n, l] = await Promise.all([
        api("/notifications", { params: { type: TYPE, limit: 30 } }),
        api("/leaves", { params: { limit: 200 } }),
      ]);
      const byId = new Map((l.data || []).map((x) => [String(x._id), x]));
      setItems((n.data || []).map((x) => ({ note: x, leave: byId.get(String(x.ref_id)) || null })));
    } catch (e) { setItems([]); toast(e.message); }
  }, [toast]);

  useEffect(() => {
    if (!open) return;
    setItems(null);
    load();
    const onDoc = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open, load]);

  const markRead = async (ids) => {
    if (!ids.length) return;
    await api("/notifications/mark-read", { method: "PATCH", body: { ids } }).catch(() => {});
    await check();
  };
  const markAllRead = async () => {
    const j = await api("/notifications", { params: { type: TYPE, is_read: "false", limit: 100 } }).catch(() => ({ data: [] }));
    await markRead((j.data || []).map((n) => n._id));
    load();
  };
  const review = async (item, status) => {
    setBusy(item.note._id + status);
    try {
      await api(`/leaves/${item.leave._id}`, { method: "PATCH", body: { status } });
      toast(status === "approved" ? `Approved ${item.leave.user_id?.name || ""}'s leave.` : `Rejected ${item.leave.user_id?.name || ""}'s leave.`);
      await markRead([item.note._id]);
      load();
    } catch (e) { toast(e.message); } finally { setBusy(""); }
  };
  const openItem = (item) => {
    if (!item.note.is_read) markRead([item.note._id]);
    setOpen(false);
    go("#leave");
  };

  const toggleSound = () => {
    const v = !sound;
    prefs.sound = v; setSound(v);
    if (v) playChime();
    toast(v ? "Sound on for new leave requests." : "Sound off.");
  };
  const togglePopup = async () => {
    if (popup) { prefs.popup = false; setPopup(false); return toast("Pop-ups off."); }
    const r = await enablePopups();
    setPopup(prefs.popup);
    toast(r === "granted" ? "Pop-ups on: you'll see new leave requests even when the app is in the background."
      : r === "unsupported" ? "This browser can't show pop-ups." : "Pop-ups are blocked for this site in your browser settings.");
  };

  const fresh = items?.filter((i) => !i.note.is_read) || [];
  const earlier = items?.filter((i) => i.note.is_read) || [];

  const Item = (item) => {
    const { note, leave } = item;
    const who = leave?.user_id?.name || note.sender_id?.name || "Employee";
    const [label, tone] = LSTAT[leave?.status] || ["", "neutral"];
    return (
      <li key={note._id} className={cx("rounded-xl p-3", !note.is_read && "bg-brand-50/80 ring-1 ring-brand-500/20 dark:bg-brand-400/10 dark:ring-brand-400/25")}>
        <button type="button" onClick={() => openItem(item)} className="flex w-full items-start gap-3 text-left">
          <Avatar name={who} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <b className="text-[15px]">{who}</b>
              {!note.is_read && <Badge tone="info">New</Badge>}
              {label && <Badge tone={tone} className="ml-auto">{label}</Badge>}
            </span>
            {leave ? (
              <>
                <span className="mt-0.5 block text-sm font-semibold">
                  {leaveLabel(leaveTypes, leave.leave_type)}, {span(leave)} <span className="font-normal text-zinc-500">({leave.days} {leave.days === 1 ? "day" : "days"})</span>
                </span>
                {leave.reason && <span className="mt-0.5 line-clamp-2 block text-sm text-zinc-600 dark:text-zinc-300">{leave.reason}</span>}
              </>
            ) : (
              <span className="mt-0.5 block text-sm">{note.message}</span>
            )}
            <span className="mt-1 block text-xs text-zinc-400">{timeAgo(note.createdAt)}</span>
          </span>
        </button>
        {leave?.status === "pending" && (
          <div className="mt-2 flex gap-2 pl-11">
            <Button size="sm" icon={X} className="flex-1" loading={busy === note._id + "rejected"} onClick={() => review(item, "rejected")}>Reject</Button>
            <Button size="sm" variant="primary" icon={Check} className="flex-1" loading={busy === note._id + "approved"} onClick={() => review(item, "approved")}>Approve</Button>
          </div>
        )}
      </li>
    );
  };

  return (
    <div ref={wrap} className="relative">
      <IconButton
        icon={unread ? BellRing : Bell}
        label={unread ? `Leave requests, ${unread} new` : "Leave requests"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={unread ? "text-brand-600 dark:text-brand-400" : ""}
      >
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[11px] font-extrabold text-white ring-2 ring-white dark:ring-zinc-950">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </IconButton>
      {open && (
        <Card role="dialog" aria-label="Leave requests"
          className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+4.25rem)] z-40 flex max-h-[75vh] flex-col overflow-hidden bg-white! shadow-2xl sm:absolute sm:inset-x-auto sm:top-12 sm:right-0 sm:w-[26rem] dark:bg-zinc-900!">
          <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <div>
              <h2 className="font-bold">Leave requests</h2>
              <p className="text-xs text-zinc-500">{unread ? `${unread} new` : "You're up to date"}</p>
            </div>
            <div className="flex items-center gap-1">
              <IconButton icon={sound ? Volume2 : VolumeX} label={sound ? "Sound on (tap to turn off)" : "Sound off (tap to turn on)"} onClick={toggleSound} className="size-9" />
              <Button size="sm" variant="ghost" icon={CheckCheck} onClick={markAllRead} disabled={!unread}>Mark all read</Button>
            </div>
          </div>
          <div className="overflow-y-auto p-2">
            {!items ? <Spinner /> : !items.length ? (
              <Empty>No leave requests yet. New ones appear here with a sound.</Empty>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {fresh.length > 0 && <li className="px-2 pt-1 text-xs font-bold text-zinc-500">New</li>}
                {fresh.map(Item)}
                {earlier.length > 0 && <li className="px-2 pt-2 text-xs font-bold text-zinc-500">Earlier</li>}
                {earlier.map(Item)}
              </ul>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-zinc-100 px-3 py-2 dark:border-zinc-800">
            <Button size="sm" variant="ghost" onClick={togglePopup}>{popup ? "Pop-ups on" : "Turn on pop-ups"}</Button>
            <Button size="sm" variant="ghost" icon={ExternalLink} onClick={() => { setOpen(false); go("#leave"); }}>Open Leave</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
