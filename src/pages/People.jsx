import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { deviceIdOf, empIdOf } from "../lib/core";
import { useApp } from "../lib/app";
import { Avatar, Card, Empty, Input, Muted, Spinner, cx } from "../components/ui";

export default function People() {
  const { loadUsers } = useApp();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => { loadUsers().then(setUsers).catch((e) => setError(e.message)); }, [loadUsers]);

  const term = q.trim().toLowerCase();
  const list = useMemo(() => (users || [])
    .filter((u) => !term || (u.name || "").toLowerCase().includes(term) || (u.email || "").toLowerCase().includes(term) ||
      empIdOf(u).toLowerCase().startsWith(term) || deviceIdOf(u).toLowerCase() === term)
    .sort((a, b) => (a.status === "inactive") - (b.status === "inactive") || (a.name || "").localeCompare(b.name || "")), [users, term]);

  return (
    <div className="flex flex-col gap-3">
      <Card className="flex items-center gap-3 p-3">
        <label className="relative flex-1">
          <span className="sr-only">Find a person</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
          <Input type="search" placeholder="Find by name, email, employee ID or device ID" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </label>
        {users && <Muted as="span" className="shrink-0">{list.length} {list.length === 1 ? "person" : "people"}</Muted>}
      </Card>
      <Card className="p-1.5">
        {error ? <Empty>{error}</Empty> : !users ? <Spinner /> : !list.length ? <Empty>No one matches “{q}”.</Empty> : (
          <ul>
            {list.map((u) => (
              <li key={u._id} className="border-t border-zinc-100 first:border-0 dark:border-zinc-800">
                <a href={`#employee/${u._id}`} className={cx("flex items-center gap-3 rounded-xl p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50", u.status === "inactive" && "opacity-50")}>
                  <Avatar name={u.name} />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate font-bold">{u.name}</span>
                    <span className="block truncate text-sm text-zinc-500 dark:text-zinc-400">{u.email}</span>
                  </span>
                  <span className="hidden text-right text-sm leading-tight sm:block">
                    <span className={cx("block font-semibold tabular-nums", !empIdOf(u) && "text-zinc-400")}>{empIdOf(u) ? `ID ${empIdOf(u)}` : "No employee ID"}</span>
                    <span className="block text-zinc-500 dark:text-zinc-400">{deviceIdOf(u) ? `Device ${deviceIdOf(u)}` : "No device ID"}{u.department ? `, ${u.department}` : ""}</span>
                  </span>
                  <ChevronRight className="size-4 text-zinc-400" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
