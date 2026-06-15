// Math helpers + world constants (ported from legacy game.js)

export const TAU = Math.PI * 2;
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const randi = (a: number, b: number) => Math.floor(rand(a, b + 1));
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const dist2 = (x1: number, y1: number, x2: number, y2: number) => { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; };
export const dist = (x1: number, y1: number, x2: number, y2: number) => Math.sqrt(dist2(x1, y1, x2, y2));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export function angTo(x1: number, y1: number, x2: number, y2: number) { return Math.atan2(y2 - y1, x2 - x1); }
export function angDiff(a: number, b: number) { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
export function shade(hex: string, amt: number) {
  let h = hex.replace("#", ""); if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  let r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  if (amt >= 0) { r = lerp(r, 255, amt); g = lerp(g, 255, amt); b = lerp(b, 255, amt); }
  else { const a = -amt; r = lerp(r, 0, a); g = lerp(g, 0, a); b = lerp(b, 0, a); }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

export const WORLD = 12000;
export const SQUADS = 32;
export const SQUAD_SIZE = 3;
export const SPEED_SCALE = 0.82;
export const MAX_SLOTS = 4;
export const VISION = 1200;
export const BOSS_TRIGGER = 20;
