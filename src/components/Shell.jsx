import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CalendarDays, CheckCheck, FileBarChart2, Fingerprint, LogOut, Plane, Settings, Users } from "lucide-react";
import { api, timeAgo } from "../lib/core";
import { go, useApp } from "../lib/app";
import { Avatar, Button, Card, Empty, IconButton, Spinner, cx, useToast } from "./ui";

export const TABS = [
  ["today", "Today", CalendarDays],
  ["people", "People", Users],
  ["leave", "Leave", Plane],
  ["reports", "Reports", FileBarChart2],
  ["ids", "IDs", Fingerprint],
  ["settings", "Settings", Settings],
];

export function Header() {
  const { me, signOut } = useApp();
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200/70 bg-white/75 pt-[env(safe-area-inset-top)] backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-950/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={me.name || me.email} />
          <div className="min-w-0 leading-tight">
            <p className="truncate font-bold">{me.name || me.email}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Admin</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <Button variant="ghost" icon={LogOut} onClick={() => signOut()} className="max-sm:px-3">
            <span className="max-sm:sr-only">Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}

export function Tabs({ page }) {
  const current = page === "employee" ? "people" : page;
  return (
    <nav aria-label="Sections" className="mx-auto mt-3 max-w-6xl px-3">
      <div className="flex flex-wrap justify-center gap-1 rounded-2xl border border-zinc-200/80 bg-white/80 p-1 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/70 sm:mx-auto sm:w-fit">
        {TABS.map(([k, label, Icon]) => (
          <a
            key={k}
            href={`#${k}`}
            aria-current={current === k ? "page" : undefined}
            className={cx(
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors sm:flex-none sm:px-4",
              current === k
                ? "bg-brand-600 text-white dark:bg-brand-400 dark:text-zinc-950"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}

// ── bell ────────────────────────────────────────────────────────────────────
const isLeaveNote = (n) => n.type === "leave_requested" || /\bleave\b/i.test(n.message || "");

function NotificationBell() {
  const toast = useToast();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const wrap = useRef(null);

  const applyCount = useCallback((n) => {
    const v = Math.max(0, Number(n) || 0);
    setUnread(v);
    document.title = v ? `(${v}) Attendance Admin` : "Attendance Admin";
    try { if (v && navigator.setAppBadge) navigator.setAppBadge(v); else navigator.clearAppBadge?.(); } catch { /* unsupported */ }
  }, []);

  const refreshCount = useCallback(async () => {
    if (document.hidden) return;
    try { applyCount((await api("/notifications/unread-count")).unread_count); } catch { /* keep last */ }
  }, [applyCount]);

  useEffect(() => {
    refreshCount();
    const t = setInterval(refreshCount, 60000);
    const vis = () => !document.hidden && refreshCount();
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [refreshCount]);

  const load = async () => {
    setItems(null);
    try {
      const j = await api("/notifications", { params: { limit: 30 } });
      setItems(j.data || []);
      applyCount(j.unread_count);
    } catch (e) { setItems([]); toast(e.message); }
  };

  useEffect(() => {
    if (!open) return;
    load();
    const onDoc = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const markAll = async () => {
    try { await api("/notifications/mark-all-read", { method: "PATCH" }); await load(); } catch (e) { toast(e.message); }
  };
  const openItem = async (n) => {
    if (!n.is_read) api("/notifications/mark-read", { method: "PATCH", body: { ids: [n._id] } }).then(refreshCount).catch(() => {});
    setOpen(false);
    if (isLeaveNote(n)) go("#leave");
  };

  const fresh = items?.filter((n) => !n.is_read) || [];
  const old = items?.filter((n) => n.is_read) || [];
  const Item = (n) => (
    <li key={n._id}>
      <button
        type="button"
        onClick={() => openItem(n)}
        className={cx(
          "flex w-full gap-3 rounded-xl p-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800",
          !n.is_read && "bg-brand-50/70 dark:bg-brand-400/10",
        )}
      >
        <span className={cx("mt-1.5 size-2.5 shrink-0 rounded-full", isLeaveNote(n) ? "bg-violet-500" : "bg-amber-400", !n.is_read && "ring-4 ring-brand-500/15")} aria-hidden />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className={cx("text-[15px]", n.is_read ? "font-semibold" : "font-extrabold")}>{n.message}</span>
          {n.sender_id?.name && <span className="text-sm text-zinc-500 dark:text-zinc-400">From {n.sender_id.name}</span>}
          <span className="text-xs text-zinc-400">{timeAgo(n.createdAt)}</span>
        </span>
      </button>
    </li>
  );

  return (
    <div ref={wrap} className="relative">
      <IconButton icon={Bell} label={unread ? `Notifications, ${unread} unread` : "Notifications"} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[11px] font-extrabold text-white ring-2 ring-white dark:ring-zinc-950">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </IconButton>
      {open && (
        <Card className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+4.25rem)] z-40 flex max-h-[70vh] flex-col overflow-hidden bg-white/95 sm:absolute sm:inset-x-auto sm:top-12 sm:right-0 sm:w-96 dark:bg-zinc-900/95" role="dialog" aria-label="Notifications">
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <h2 className="font-bold">Notifications</h2>
            <Button size="sm" variant="ghost" icon={CheckCheck} onClick={markAll} disabled={!unread}>Mark all as read</Button>
          </div>
          <div className="overflow-y-auto px-2 pb-2">
            {!items ? <Spinner /> : !items.length ? (
              <Empty>Nothing yet. Leave requests, approvals and other updates will show up here.</Empty>
            ) : (
              <ul>
                {fresh.length > 0 && <li className="px-3 pt-2 pb-1 text-xs font-bold text-zinc-500">New</li>}
                {fresh.map(Item)}
                {old.length > 0 && <li className="px-3 pt-2 pb-1 text-xs font-bold text-zinc-500">Earlier</li>}
                {old.map(Item)}
              </ul>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
