// Unique ID generator
export const uid = () => Math.random().toString(36).slice(2, 10);

// Date helpers
export const today = () => new Date().toISOString().split("T")[0];
export const ago = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
};
export const fmtShort = (d) =>
  new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
export const fmtFull = (d) =>
  new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

// Weight unit helper
export const wUnit = (units) => (units === "kg" ? "kg" : "lbs");

// 1RM estimation (Epley)
export const calc1RM = (w, r) => (r <= 0 || w <= 0 ? 0 : r === 1 ? w : Math.round(w * (1 + r / 30)));

// localStorage wrapper with JSON parse/stringify
export const LS = {
  get: (k) => {
    try {
      return JSON.parse(localStorage.getItem(k));
    } catch {
      return localStorage.getItem(k);
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {
      console.warn("LS full:", e);
    }
  },
};

// App version
export const APP_VERSION = "4.2";
export const SYNC_URL = "https://ironlog-api.vercel.app";

// Format seconds to MM:SS
export const fmtTimer = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;

// ─── Undo System ───
let _undoItem = null;
let _undoTimer = null;
export const Undo = {
  set: (label, item, type) => {
    _undoItem = { label, item, type, ts: Date.now() };
    if (_undoTimer) clearTimeout(_undoTimer);
    _undoTimer = setTimeout(() => { _undoItem = null; }, 6000);
  },
  get: () => _undoItem,
  clear: () => { _undoItem = null; if (_undoTimer) clearTimeout(_undoTimer); },
};
