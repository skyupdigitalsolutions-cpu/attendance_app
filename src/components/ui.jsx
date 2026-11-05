// Design system: every visual style in the app lives in these components as Tailwind classes.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { STATUS_LABEL, initials } from "../lib/core";

export const cx = (...a) => a.filter(Boolean).join(" ");

// ── surfaces ────────────────────────────────────────────────────────────────
export const Card = ({ className, as: Tag = "section", ...p }) => (
  <Tag
    className={cx(
      "rounded-2xl border border-zinc-200/80 bg-white/80 shadow-sm shadow-zinc-900/[0.03] backdrop-blur-xl",
      "dark:border-zinc-800 dark:bg-zinc-900/70 dark:shadow-none",
      className,
    )}
    {...p}
  />
);

export const CardTitle = ({ className, ...p }) => (
  <h2 className={cx("text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50", className)} {...p} />
);

export const Muted = ({ className, as: Tag = "p", ...p }) => (
  <Tag className={cx("text-sm text-zinc-500 dark:text-zinc-400", className)} {...p} />
);

// ── buttons ─────────────────────────────────────────────────────────────────
const BTN = {
  base: "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors select-none " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:pointer-events-none disabled:opacity-50",
  size: { sm: "h-9 px-3 text-sm", md: "h-11 px-4 text-[15px]", lg: "h-12 px-5 text-base" },
  variant: {
    primary: "bg-brand-600 text-white hover:bg-brand-700 dark:bg-brand-400 dark:text-zinc-950 dark:hover:bg-brand-300",
    default: "border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800",
    ghost: "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800",
    danger: "text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10",
  },
};
export function Button({ variant = "default", size = "md", icon: Icon, loading, className, children, ...p }) {
  return (
    <button type="button" className={cx(BTN.base, BTN.size[size], BTN.variant[variant], className)} disabled={loading || p.disabled} {...p}>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : Icon && <Icon className="size-4" aria-hidden />}
      {children}
    </button>
  );
}

export function IconButton({ icon: Icon, label, className, children, ...p }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cx(
        "relative inline-flex size-11 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 transition-colors",
        "hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
        className,
      )}
      {...p}
    >
      <Icon className="size-5" aria-hidden />
      {children}
    </button>
  );
}

// ── badges & chips ──────────────────────────────────────────────────────────
export const TONE = {
  present: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  late: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  "half-day": "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  absent: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  "on-leave": "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  "not-marked": "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  holiday: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  wfh: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  info: "bg-brand-50 text-brand-700 dark:bg-brand-400/15 dark:text-brand-300",
  neutral: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};
export const BAR = {
  present: "bg-emerald-500", late: "bg-amber-400", "half-day": "bg-orange-400",
  absent: "bg-rose-400", "on-leave": "bg-violet-400", holiday: "bg-sky-400",
};
export const Badge = ({ tone = "neutral", className, ...p }) => (
  <span className={cx("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold", TONE[tone] || TONE.neutral, className)} {...p} />
);
export const StatusBadge = ({ status }) => <Badge tone={status}>{STATUS_LABEL[status] || status}</Badge>;

const COUNT_TONE = {
  present: "text-emerald-600 dark:text-emerald-400", late: "text-amber-600 dark:text-amber-400",
  "half-day": "text-orange-600 dark:text-orange-400", absent: "text-rose-600 dark:text-rose-400",
  "on-leave": "text-violet-600 dark:text-violet-400", "not-marked": "text-rose-600 dark:text-rose-400",
  holiday: "text-sky-600 dark:text-sky-400", wfh: "text-sky-600 dark:text-sky-400",
};
export function Chip({ active, count, tone, className, children, ...p }) {
  return (
    <button
      type="button"
      aria-pressed={Boolean(active)}
      className={cx(
        "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap transition-colors",
        active
          ? "border-brand-500/40 bg-brand-50 text-brand-700 dark:border-brand-400/40 dark:bg-brand-400/15 dark:text-brand-300"
          : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800",
        className,
      )}
      {...p}
    >
      {children}
      {count !== undefined && <span className={cx("tabular-nums font-bold", active ? "" : COUNT_TONE[tone] || "text-zinc-400")}>{count}</span>}
    </button>
  );
}

// Segmented control (tabs inside a card)
export function Segmented({ options, value, onChange, className, size = "md" }) {
  return (
    <div role="group" className={cx("flex gap-1 overflow-x-auto rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800/70", className)}>
      {options.map(([v, label, extra]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={cx(
            "flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-semibold transition-colors",
            size === "sm" ? "h-8 px-3 text-sm" : "h-9 px-3.5 text-sm",
            value === v
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
              : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100",
          )}
        >
          {label}
          {extra}
        </button>
      ))}
    </div>
  );
}

// ── form controls ───────────────────────────────────────────────────────────
const CONTROL =
  "w-full rounded-xl border border-zinc-200 bg-white px-3 text-[15px] text-zinc-900 placeholder:text-zinc-400 " +
  "focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15 disabled:opacity-60 " +
  "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-brand-400 dark:[color-scheme:dark]";
export const inputClass = (invalid) => cx(CONTROL, "h-11", invalid && "border-rose-400 ring-4 ring-rose-500/15 dark:border-rose-500");
export const Input = ({ className, invalid, ...p }) => <input className={cx(inputClass(invalid), className)} {...p} />;
export const Select = ({ className, ...p }) => <select className={cx(CONTROL, "h-11 pr-8", className)} {...p} />;
export const Textarea = ({ className, ...p }) => <textarea className={cx(CONTROL, "min-h-20 py-2.5", className)} {...p} />;

export function Field({ label, hint, className, children }) {
  return (
    <label className={cx("flex flex-col gap-1.5", className)}>
      <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
        {label}
        {hint && <span className="font-normal text-zinc-400"> {hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function Checkbox({ label, className, ...p }) {
  return (
    <label className={cx("flex cursor-pointer items-center gap-3 text-[15px] font-semibold text-zinc-800 dark:text-zinc-100", className)}>
      <input type="checkbox" className="size-5 accent-brand-600 dark:accent-brand-400" {...p} />
      {label}
    </label>
  );
}

// ── people ──────────────────────────────────────────────────────────────────
export const Avatar = ({ name, size = "md" }) => (
  <span
    aria-hidden
    className={cx(
      "inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-violet-500 font-bold text-white",
      size === "sm" ? "size-8 text-xs" : size === "lg" ? "size-14 text-lg" : "size-10 text-sm",
    )}
  >
    {initials(name)}
  </span>
);

// ── feedback ────────────────────────────────────────────────────────────────
export const Empty = ({ children, className }) => (
  <div className={cx("px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400", className)}>{children}</div>
);
export const Spinner = ({ label = "Loading…" }) => (
  <div className="flex items-center justify-center gap-2 py-10 text-sm text-zinc-500 dark:text-zinc-400">
    <Loader2 className="size-4 animate-spin" aria-hidden /> {label}
  </div>
);

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [msg, setMsg] = useState("");
  const timer = useRef();
  const show = useCallback((m) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(""), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4">
        {msg && (
          <div className="pointer-events-auto max-w-md rounded-xl bg-zinc-900/95 px-4 py-3 text-sm font-semibold text-white shadow-lg dark:bg-zinc-100/95 dark:text-zinc-900">
            {msg}
          </div>
        )}
      </div>
    </ToastCtx.Provider>
  );
}

// ── dialog (native <dialog>: focus trap, Esc to close) ─────────────────────
export function Dialog({ open, onClose, title, subtitle, children, className }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className={cx(
        "m-auto w-[min(460px,calc(100vw-1.5rem))] max-h-[calc(100dvh-1.5rem)] overflow-auto rounded-2xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-2xl",
        "backdrop:bg-zinc-950/30 backdrop:backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:backdrop:bg-black/60",
        className,
      )}
    >
      {open && (
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">{title}</h2>
              {subtitle && <Muted>{subtitle}</Muted>}
            </div>
            <IconButton icon={X} label="Close" onClick={onClose} className="size-9 border-0" />
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
