import { CalendarDays, FileBarChart2, Fingerprint, LogOut, Plane, Settings, Users } from "lucide-react";
import { useApp } from "../lib/app";
import { Avatar, Button, cx } from "./ui";
import LeaveBell from "./LeaveBell";

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
          <LeaveBell />
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
