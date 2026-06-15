// Procedural terrain + pixel-sprite characters (ported from legacy game.js)
import { WORLD, TAU, rand, shade } from "./constants";

export const Terrain = {
  size: 220, cols: 0, rows: 0, tiles: [] as { c: string; w: boolean }[], props: [] as any[],
  _f(a: number, b: number) { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); },
  noise(i: number, j: number) {
    let v = 0, amp = 0.6, sc = 0.15;
    for (let o = 0; o < 3; o++) {
      const x = i * sc, y = j * sc, xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const tl = this._f(xi, yi), tr = this._f(xi + 1, yi), bl = this._f(xi, yi + 1), br = this._f(xi + 1, yi + 1);
      const u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
      const top = tl + (tr - tl) * u, bot = bl + (br - bl) * u;
      v += (top + (bot - top) * w) * amp; amp *= 0.5; sc *= 2;
    }
    return v;
  },
  sample(x: number, y: number) { return this.noise(x / this.size, y / this.size); },
  colorFor(hv: number, i: number, j: number) {
    const jit = (this._f(i * 3.1, j * 1.7) - 0.5) * 0.06;
    if (hv < 0.3) return { c: "#16324f", w: true };
    if (hv < 0.37) return { c: "#1e4d70", w: true };
    if (hv < 0.43) return { c: "#c3b079", w: false };
    if (hv < 0.52) return { c: shade("#2f6b3a", jit), w: false };
    if (hv < 0.74) return { c: shade("#3c8a4a", jit), w: false };
    if (hv < 0.88) return { c: shade("#4fa85c", jit), w: false };
    return { c: shade("#6a6f7c", jit), w: false };
  },
  generate() {
    this.cols = Math.ceil(WORLD / this.size); this.rows = this.cols; this.tiles = []; this.props = [];
    for (let j = 0; j < this.rows; j++) for (let i = 0; i < this.cols; i++) this.tiles.push(this.colorFor(this.noise(i, j), i, j));
    const count = Math.floor((WORLD * WORLD) / 55000);
    for (let k = 0; k < count; k++) {
      const x = rand(0, WORLD), y = rand(0, WORLD), hv = this.sample(x, y);
      if (hv < 0.46) continue;
      const r = Math.random();
      const type = r < 0.42 ? "tree" : r < 0.66 ? "rock" : r < 0.86 ? "bush" : "flower";
      this.props.push({ x, y, type, s: rand(0.8, 1.35), h: Math.random() });
    }
    this.props.sort((a, b) => a.y - b.y);
  },
  draw(g: CanvasRenderingContext2D, cam: { x: number; y: number }, w: number, hgt: number, t: number) {
    const s = this.size;
    const i0 = Math.max(0, Math.floor(cam.x / s)), i1 = Math.min(this.cols - 1, Math.ceil((cam.x + w) / s));
    const j0 = Math.max(0, Math.floor(cam.y / s)), j1 = Math.min(this.rows - 1, Math.ceil((cam.y + hgt) / s));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const tl = this.tiles[j * this.cols + i]; if (!tl) continue;
      const x = i * s - cam.x, y = j * s - cam.y;
      g.fillStyle = tl.c; g.fillRect(x, y, s + 1, s + 1);
      if (tl.w) { g.globalAlpha = 0.1 + 0.06 * Math.sin(t * 1.5 + i * 0.7 + j * 0.5); g.fillStyle = "#bfe6ff"; g.fillRect(x, y, s + 1, s + 1); g.globalAlpha = 1; }
    }
  },
  drawProps(g: CanvasRenderingContext2D, cam: { x: number; y: number }, w: number, hgt: number) {
    for (const p of this.props) {
      const sx = p.x - cam.x, sy = p.y - cam.y;
      if (sx < -60 || sy < -80 || sx > w + 60 || sy > hgt + 60) continue;
      g.fillStyle = "rgba(0,0,0,.22)";
      g.beginPath(); g.ellipse(sx, sy + 4, 9 * p.s, 4 * p.s, 0, 0, TAU); g.fill();
      if (p.type === "tree") {
        g.fillStyle = "#6b4a2b"; g.fillRect(sx - 2 * p.s, sy - 6 * p.s, 4 * p.s, 12 * p.s);
        const gc = p.h < 0.5 ? "#2f7d3e" : "#367f46";
        g.fillStyle = shade(gc, -0.1); g.beginPath(); g.arc(sx, sy - 16 * p.s, 12 * p.s, 0, TAU); g.fill();
        g.fillStyle = gc; g.beginPath(); g.arc(sx - 6 * p.s, sy - 12 * p.s, 8 * p.s, 0, TAU); g.fill();
        g.beginPath(); g.arc(sx + 6 * p.s, sy - 12 * p.s, 8 * p.s, 0, TAU); g.fill();
        g.fillStyle = shade(gc, 0.2); g.beginPath(); g.arc(sx - 3 * p.s, sy - 19 * p.s, 6 * p.s, 0, TAU); g.fill();
      } else if (p.type === "rock") {
        g.fillStyle = "#7c818c"; g.beginPath(); g.ellipse(sx, sy - 4 * p.s, 10 * p.s, 8 * p.s, 0, 0, TAU); g.fill();
        g.fillStyle = "#9aa0ab"; g.beginPath(); g.ellipse(sx - 3 * p.s, sy - 7 * p.s, 5 * p.s, 4 * p.s, 0, 0, TAU); g.fill();
      } else if (p.type === "bush") {
        const gc = "#357a44"; g.fillStyle = gc;
        g.beginPath(); g.arc(sx, sy - 4 * p.s, 7 * p.s, 0, TAU); g.arc(sx - 5 * p.s, sy - 2 * p.s, 5 * p.s, 0, TAU);
        g.arc(sx + 5 * p.s, sy - 2 * p.s, 5 * p.s, 0, TAU); g.fill();
        g.fillStyle = shade(gc, 0.2); g.beginPath(); g.arc(sx - 1 * p.s, sy - 6 * p.s, 4 * p.s, 0, TAU); g.fill();
      } else {
        g.strokeStyle = "#3a7d44"; g.lineWidth = 1.5 * p.s;
        g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx, sy - 7 * p.s); g.stroke();
        g.fillStyle = ["#ff6f91", "#ffd24a", "#b07dff", "#ff8a3d"][Math.floor(p.h * 4) % 4];
        g.beginPath(); g.arc(sx, sy - 8 * p.s, 2.4 * p.s, 0, TAU); g.fill();
      }
    }
  },
};

export const Sprites: Record<string, HTMLCanvasElement> = {};
export function buildSprite(h: any): HTMLCanvasElement {
  const c = document.createElement("canvas"); c.width = 16; c.height = 18;
  const x = c.getContext("2d")!;
  const col = h.color, dark = shade(col, -0.4), light = shade(col, 0.35), skin = "#f1c9a0";
  x.fillStyle = dark; x.fillRect(5, 14, 2, 3); x.fillRect(9, 14, 2, 3);
  x.fillStyle = col; x.fillRect(4, 8, 8, 7);
  x.fillStyle = light; x.fillRect(4, 8, 8, 2);
  x.fillStyle = dark; x.fillRect(4, 12, 8, 1);
  x.fillStyle = col; x.fillRect(3, 9, 1, 4); x.fillRect(12, 9, 1, 4);
  x.fillStyle = skin; x.fillRect(5, 3, 6, 6);
  x.fillStyle = dark; x.fillRect(5, 3, 6, 2); x.fillRect(4, 4, 1, 3); x.fillRect(11, 4, 1, 3);
  x.fillStyle = "#222"; x.fillRect(6, 6, 1, 1); x.fillRect(9, 6, 1, 1);
  return c;
}
export function drawWeapon(g: CanvasRenderingContext2D, ox: number, oy: number, aim: number, h: any, r: number) {
  g.save(); g.translate(ox, oy); g.rotate(aim);
  const col = h.color, lite = shade(col, 0.5), dark = shade(col, -0.3);
  if (h.weapon === "sword") {
    g.fillStyle = lite; g.fillRect(r * 0.5, -r * 0.11, r * 1.35, r * 0.22);
    g.fillStyle = dark; g.fillRect(r * 0.32, -r * 0.24, r * 0.2, r * 0.48);
  } else if (h.weapon === "bow") {
    g.strokeStyle = lite; g.lineWidth = r * 0.16;
    g.beginPath(); g.arc(r * 0.55, 0, r * 0.7, -1.15, 1.15); g.stroke();
    g.strokeStyle = "#eee"; g.lineWidth = r * 0.05;
    g.beginPath(); g.moveTo(r * 0.55 + Math.cos(-1.15) * r * 0.7, Math.sin(-1.15) * r * 0.7);
    g.lineTo(r * 0.55 + Math.cos(1.15) * r * 0.7, Math.sin(1.15) * r * 0.7); g.stroke();
  } else {
    g.strokeStyle = shade("#7a5230", 0.15); g.lineWidth = r * 0.15;
    g.beginPath(); g.moveTo(r * 0.2, 0); g.lineTo(r * 1.2, 0); g.stroke();
    g.fillStyle = lite; g.beginPath(); g.arc(r * 1.3, 0, r * 0.24, 0, TAU); g.fill();
  }
  g.restore();
}
