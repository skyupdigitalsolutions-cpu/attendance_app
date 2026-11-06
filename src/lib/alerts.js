// Sound and pop-up alerts for new leave requests (while the app is open).

const PREF = { sound: "att_alert_sound", popup: "att_alert_popup" };
export const prefs = {
  get sound() { return localStorage.getItem(PREF.sound) !== "off"; }, // on by default
  set sound(v) { localStorage.setItem(PREF.sound, v ? "on" : "off"); },
  get popup() { return localStorage.getItem(PREF.popup) === "on" && "Notification" in window && Notification.permission === "granted"; },
  set popup(v) { localStorage.setItem(PREF.popup, v ? "on" : "off"); },
};

// Browsers only allow sound after the user has interacted with the page once.
// The first tap or key press anywhere unlocks it.
let ctx = null;
const getCtx = () => {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
};
export function unlockSoundOnFirstTouch() {
  const unlock = () => { getCtx()?.resume?.(); };
  addEventListener("pointerdown", unlock, { once: true, capture: true });
  addEventListener("keydown", unlock, { once: true, capture: true });
}

/** Two-note chime. Returns false if the browser hasn't allowed sound yet. */
export function playChime() {
  const c = getCtx();
  if (!c) return false;
  if (c.state === "suspended") { c.resume(); if (c.state === "suspended") return false; }
  const t0 = c.currentTime + 0.01;
  [[784, 0], [1175, 0.16], [1568, 0.32]].forEach(([freq, delay]) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0 + delay);
    gain.gain.exponentialRampToValueAtTime(0.22, t0 + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + 0.6);
    osc.connect(gain).connect(c.destination);
    osc.start(t0 + delay);
    osc.stop(t0 + delay + 0.65);
  });
  window.__chimes = (window.__chimes || 0) + 1; // lets tests confirm a chime played
  return true;
}

/** Ask the browser for permission to show pop-up notifications. */
export async function enablePopups() {
  if (!("Notification" in window)) return "unsupported";
  const p = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  prefs.popup = p === "granted";
  return p;
}

/** System pop-up (only when the app is in the background and pop-ups are on). */
export async function showPopup(title, body, onClick) {
  if (!prefs.popup || !document.hidden) return;
  try {
    const n = new Notification(title, { body, icon: "./icon-192.png", tag: `leave-${Date.now()}` });
    n.onclick = () => { window.focus(); onClick?.(); n.close(); };
  } catch {
    // Android Chrome only allows notifications through the service worker
    const reg = await navigator.serviceWorker?.ready;
    reg?.showNotification(title, { body, icon: "./icon-192.png", badge: "./badge-96.png" });
  }
}
