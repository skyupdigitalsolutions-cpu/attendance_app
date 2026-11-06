// Shared non-UI logic: config, session, API client, IST dates, labels, CSV.

export const API_BASE = String(import.meta.env.VITE_API_BASE || "https://skyup-pm.duckdns.org").replace(/\/+$/, "");
export const TZ = import.meta.env.VITE_TIME_ZONE || "Asia/Kolkata";
export const DAY_START = 7 * 60; // timeline starts 07:00
export const DAY_END = 22 * 60; //  ...and ends 22:00

// ── session ─────────────────────────────────────────────────────────────────
export const session = {
  get token() { return localStorage.getItem("att_token"); },
  get user() { try { return JSON.parse(localStorage.getItem("att_user")); } catch { return null; } },
  set(token, user) {
    if (token) localStorage.setItem("att_token", token);
    localStorage.setItem("att_user", JSON.stringify(user));
  },
  clear() { localStorage.removeItem("att_token"); localStorage.removeItem("att_user"); },
};

// ── API ─────────────────────────────────────────────────────────────────────
let onExpired = () => {};
export const setOnSessionExpired = (fn) => { onExpired = fn; };

export async function api(path, { method = "GET", params, body, timeout = 20000 } = {}) {
  if (!API_BASE) throw new Error("Set VITE_API_BASE to your server address and rebuild.");
  const url = new URL(`${API_BASE}/api${path}`);
  if (params) for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (session.token) headers.Authorization = `Bearer ${session.token}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal });
  } catch (e) {
    throw new Error(e.name === "AbortError" ? "The server took too long to answer. Try again." : "Can't reach the server. Check your connection.");
  } finally {
    clearTimeout(timer);
  }
  const json = await res.json().catch(() => ({}));
  if (res.status === 401 && session.token) {
    onExpired();
    throw new Error("Your session ended. Sign in again.");
  }
  if (res.status === 404 && path.startsWith("/attendance-app")) {
    throw new Error("The server doesn't have the Attendance Admin update yet. Deploy the backend files (attendance-app routes) and restart the server.");
  }
  if (!res.ok) throw new Error(json.message || `Request failed (${res.status})`);
  return json;
}

// ── dates (office time zone; calendar days are "YYYY-MM-DD") ────────────────
export const todayLocal = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
export const ymdOfStored = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: TZ });
export const addDays = (ymd, n) => { const d = new Date(`${ymd}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const weekdayOf = (ymd) => new Date(`${ymd}T00:00:00Z`).getUTCDay();
export const monthStart = (ymd) => `${ymd.slice(0, 7)}-01`;
export const monthEnd = (ymd) => { const [y, m] = ymd.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
export const addMonths = (ymd, n) => { const [y, m] = ymd.split("-").map(Number); return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10); };
export const hhmmToMin = (s) => { const [h, m] = String(s || "0:0").split(":").map(Number); return h * 60 + (m || 0); };

const timeFmt = new Intl.DateTimeFormat("en-IN", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true });
const partsFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
export const fmtTime = (d) => (d ? timeFmt.format(new Date(d)).replace(/\s?([ap])\.?m\.?/i, " $1m").toLowerCase() : "");
export const localMinutes = (d) => {
  const p = Object.fromEntries(partsFmt.formatToParts(new Date(d)).map((x) => [x.type, x.value]));
  return Number(p.hour) * 60 + Number(p.minute);
};
export const hhmmOf = (d) => (d ? partsFmt.format(new Date(d)) : ""); // "09:05" for <input type="time">
export const fmtMinutes = (m) => { const h = Math.floor(m / 60), mm = Math.round(m % 60); return `${h % 12 || 12}:${String(mm).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`; };
export const fmtDay = (ymd, opts = { weekday: "short", day: "numeric", month: "short" }) =>
  new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", ...opts });
export const fmtHours = (h) => {
  if (h == null || !Number.isFinite(Number(h))) return "";
  const mins = Math.round(Number(h) * 60);
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
};
export const timeAgo = (d) => {
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`;
  return fmtDay(ymdOfStored(d), { day: "numeric", month: "short" });
};

// ── people & labels ─────────────────────────────────────────────────────────
const idOf = (u, k) => (u && u[k] != null && u[k] !== "" ? String(u[k]) : "");
export const empIdOf = (u) => idOf(u, "employee_id");
export const deviceIdOf = (u) => idOf(u, "fingerprint_id");
export const idsLabel = (u) => [empIdOf(u) && `ID ${empIdOf(u)}`, deviceIdOf(u) && `Device ${deviceIdOf(u)}`].filter(Boolean).join(", ");
export const initials = (name) => String(name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

export const STATUS_LABEL = {
  present: "Present", late: "Late", "half-day": "Half-day", absent: "Absent",
  "on-leave": "On leave", "not-marked": "Not marked", holiday: "Holiday",
};
export const leaveLabel = (types, type) =>
  types.find((t) => t.type === type)?.label || (type ? `${type[0].toUpperCase()}${type.slice(1)} leave` : "Leave");

// ── CSV ─────────────────────────────────────────────────────────────────────
export function downloadCsv(filename, headers, rows) {
  const cell = (v) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // stop spreadsheets running it as a formula
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = "\uFEFF" + [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = filename.replace(/[^\w.-]+/g, "_");
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
