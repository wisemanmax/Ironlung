import { LS } from './storage';

export const DARK_THEME = {
  bg: "#08080d", card: "rgba(255,255,255,0.035)", cardBorder: "rgba(255,255,255,0.06)",
  accent: "#00f5a0", accent2: "#00d9f5", warn: "#ff9f43", danger: "#ff6b6b", purple: "#a78bfa",
  text: "#e8e8ec", text2: "#8b8b9e", text3: "#4a4a5c", font: "'Outfit', sans-serif", mono: "'JetBrains Mono', monospace",
  sheetBg: "linear-gradient(180deg,#1a1a28,#08080d)", navBg: "rgba(8,8,13,0.95)", mode: "dark",
};
export const LIGHT_THEME = {
  bg: "#f5f5f7", card: "rgba(0,0,0,0.03)", cardBorder: "rgba(0,0,0,0.08)",
  accent: "#059669", accent2: "#0891b2", warn: "#d97706", danger: "#dc2626", purple: "#7c3aed",
  text: "#1a1a2e", text2: "#4a4a5c", text3: "#8b8b9e", font: "'Outfit', sans-serif", mono: "'JetBrains Mono', monospace",
  sheetBg: "linear-gradient(180deg,#ffffff,#f0f0f5)", navBg: "rgba(245,245,247,0.95)", mode: "light",
};
export const V = {...(LS.get("ft-theme")==="light" ? LIGHT_THEME : DARK_THEME)};
export const setTheme = (mode) => {
  const t = mode === "light" ? LIGHT_THEME : DARK_THEME;
  Object.assign(V, t);
  LS.set("ft-theme", mode);
  document.body.style.background = V.bg;
  document.body.style.color = V.text;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", V.bg);
};

// ─── Haptic Feedback ───
export const Haptic = {
  light: () => { try { navigator.vibrate?.(10); } catch(e) {} },
  medium: () => { try { navigator.vibrate?.(25); } catch(e) {} },
  heavy: () => { try { navigator.vibrate?.([30, 20, 50]); } catch(e) {} },
  success: () => { try { navigator.vibrate?.([10, 30, 10, 30, 50]); } catch(e) {} },
};
