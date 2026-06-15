// Core simulation + render orchestrator (ported from legacy game.js).
// Owns all match state (formerly the global `G`), input, and the RAF loop.
// HUD is no longer drawn to the DOM here — React reads the exposed state.
import {
  WORLD, SQUADS, SQUAD_SIZE, MAX_SLOTS, VISION, BOSS_TRIGGER, SPEED_SCALE,
  TAU, rand, randi, clamp, dist, dist2, lerp, angTo, angDiff, shade,
} from "./constants";
import {
  HUNTERS, HUNTER_IDS, BOT_NAMES, GEAR, GEAR_IDS, CREEP_IDS, CREEP_TYPES,
  PALETTE, palIdx, hidIdx, gIdx, abilityOf, effColor,
} from "./data";
import { Hunter, Creep, resetUID } from "./entities";
import { Terrain, Sprites, buildSprite, drawWeapon } from "./Terrain";
import { Sfx } from "./Sfx";
import { Net } from "./Net";

export type Role = "solo" | "host" | "client";
export type GameConfig = { hunter: string; difficulty: "easy" | "normal" | "hard"; squadSize: number; role?: Role; roster?: any[]; myName?: string };

function setHunterHid(h: any, hid: string) { const d = HUNTERS[hid]; h.hid = hid; h.def = d; h.maxHp = d.maxHp; h.hp = d.maxHp; h.radius = d.radius; h.speed = d.speed * SPEED_SCALE; h.form = d.forms ? d.defaultForm : null; }

export class Game {
  canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D;
  mm: HTMLCanvasElement; mmx: CanvasRenderingContext2D;
  cfg: GameConfig;
  // state (was global G)
  hunters: any[] = []; creeps: any[] = []; projectiles: any[] = []; aoes: any[] = [];
  items: any[] = []; pings: any[] = []; particles: any[] = []; motes: any[] = []; swings: any[] = [];
  cam = { x: 0, y: 0 }; t = 0; over = false; placeWhenDead = 0; flash = 0; bolt: any = null; lightT = rand(5, 12);
  diff: string; phase = "choose"; deployT = 20; landX: number | null = null; landY: number | null = null; overtime = false;
  zone = { cx: WORLD / 2, cy: WORLD / 2, r: WORLD * 0.82, target: WORLD * 0.82, nextShrink: 40, stage: 0 };
  player: any = null; camFollow: any = null; bossSpawned = false; replacePrompt: any = null;
  // client/render-from-snapshot
  hmap = new Map<number, any>(); names: any = {}; myHunterId: number | null = null; clientSwingCd = 0;
  // net
  netrole: Role = "solo"; netRoster: any[] = []; netAccum = 0;
  clientInAccum = 0; clientPing: any = null; clientAct = false; clientVHeld = false; clientFHeld = false; clientEdge: any = {};
  ovScale: number | null = null; ovX = 0; ovY = 0;
  // input
  input = { keys: new Set<string>(), mx: 0, my: 0, mdown: false };
  mobile = { on: false, move: { id: null as any, ox: 0, oy: 0, nx: 0, ny: 0, active: false, cx: 0, cy: 0 }, aim: { id: null as any, ox: 0, oy: 0, ang: 0, active: false, firing: false, cx: 0, cy: 0 }, lastAim: 0 };
  // react-facing
  feed: { id: number; txt: string }[] = []; chat: { id: number; name: string; text: string; mine: boolean }[] = [];
  endInfo: any = null; private feedId = 1; handle: string;
  private raf = 0; private lastT = 0; private fogCanvas: HTMLCanvasElement | null = null; private fogCtx: CanvasRenderingContext2D | null = null;
  private listeners: Array<[any, string, any]> = [];

  constructor(canvas: HTMLCanvasElement, minimap: HTMLCanvasElement, cfg: GameConfig) {
    this.canvas = canvas; this.ctx = canvas.getContext("2d")!;
    this.mm = minimap; this.mmx = minimap.getContext("2d")!;
    this.cfg = cfg; this.diff = cfg.difficulty;
    this.netrole = cfg.role || "solo";
    this.netRoster = cfg.roster || [];
    this.handle = cfg.myName || (BOT_NAMES[randi(0, BOT_NAMES.length - 1)] + randi(10, 99));
  }

  // ---------- lifecycle ----------
  start() {
    this.resize();
    this.attachInput();
    this.detectMobile();
    Sfx.ambientStart();
    Terrain.generate();
    resetUID();
    HUNTER_IDS.forEach((id) => (Sprites[id] = buildSprite(HUNTERS[id])));
    if (this.netrole === "client") { this.clientStartMatch(); }
    else { this.startMatch(); }
    this.lastT = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }
  destroy() {
    cancelAnimationFrame(this.raf);
    Sfx.ambientStop();
    for (const [el, ev, fn] of this.listeners) el.removeEventListener(ev, fn);
    this.listeners = [];
    document.body.classList.remove("mobile");
    if (this.netrole !== "solo") Net.cleanup();
  }
  private on(el: any, ev: string, fn: any, opts?: any) { el.addEventListener(ev, fn, opts); this.listeners.push([el, ev, fn]); }
  resize() { this.canvas.width = innerWidth; this.canvas.height = innerHeight; }

  private typingInField(e: any) { const t = (e.target.tagName || "").toLowerCase(); return t === "input" || t === "textarea"; }
  attachInput() {
    const c = this.canvas;
    this.on(window, "keydown", (e: KeyboardEvent) => { if (this.typingInField(e)) return; this.input.keys.add(e.key.toLowerCase()); if ([" ", "q", "e", "r", "f", "v"].includes(e.key.toLowerCase())) e.preventDefault(); });
    this.on(window, "keyup", (e: KeyboardEvent) => this.input.keys.delete(e.key.toLowerCase()));
    this.on(c, "mousemove", (e: MouseEvent) => { const r = c.getBoundingClientRect(); this.input.mx = e.clientX - r.left; this.input.my = e.clientY - r.top; });
    this.on(c, "mousedown", (e: MouseEvent) => { if (e.button === 0) this.input.mdown = true; });
    this.on(window, "mouseup", (e: MouseEvent) => { if (e.button === 0) this.input.mdown = false; });
    this.on(c, "contextmenu", (e: Event) => e.preventDefault());
    this.on(window, "resize", () => this.resize());
    // deploy map click + minimap click
    this.on(c, "mousedown", (e: any) => this.deployClick(e));
    this.on(c, "touchstart", (e: any) => this.deployClick(e), { passive: false });
    this.on(this.mm, "mousedown", (e: any) => this.chooseLanding(e));
    this.on(this.mm, "touchstart", (e: any) => this.chooseLanding(e), { passive: false });
  }
  detectMobile() {
    const coarse = window.matchMedia && matchMedia("(pointer: coarse)").matches;
    const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    this.mobile.on = coarse || (touch && Math.min(innerWidth, innerHeight) < 820);
    if (!this.mobile.on) return;
    document.body.classList.add("mobile");
    const c = this.canvas;
    this.on(c, "touchstart", (e: any) => this.mobileTouch(e), { passive: false });
    this.on(c, "touchmove", (e: any) => this.mobileTouch(e), { passive: false });
    this.on(c, "touchend", (e: any) => this.mobileTouchEnd(e), { passive: false });
    this.on(c, "touchcancel", (e: any) => this.mobileTouchEnd(e), { passive: false });
  }
  // React mobile ability buttons
  pressKey(k: string) { this.input.keys.add(k); }
  releaseKey(k: string) { this.input.keys.delete(k); }

  worldMouse() { return { x: this.input.mx + this.cam.x, y: this.input.my + this.cam.y }; }
  volAt(x: number, y: number) { const c = this.camFollow || this.player; return clamp(1 - dist(x, y, c.x, c.y) / 1500, 0, 1); }
  inVision(x: number, y: number) { const t = this.player ? this.player.team : 0; for (const h of this.hunters) { if (h.alive && h.team === t && dist2(h.x, h.y, x, y) < VISION * VISION) return true; } return false; }

  // ---------- match setup ----------
  startMatch() {
    this.hunters = []; this.projectiles = []; this.aoes = []; this.items = []; this.pings = []; this.particles = []; this.motes = []; this.swings = []; this.creeps = [];
    this.cam = { x: 0, y: 0 }; this.t = 0; this.over = false; this.placeWhenDead = 0; this.flash = 0; this.bolt = null; this.lightT = rand(5, 12);
    this.phase = "choose"; this.deployT = 20; this.landX = null; this.landY = null; this.overtime = false; this.bossSpawned = false;
    this.zone = { cx: WORLD / 2, cy: WORLD / 2, r: WORLD * 0.82, target: WORLD * 0.82, nextShrink: 40, stage: 0 };
    this.feed = []; this.chat = [];

    const cols = Math.ceil(Math.sqrt(SQUADS)), cellW = WORLD / cols, cells: any[] = [];
    for (let gy = 0; gy < cols; gy++) for (let gx = 0; gx < cols; gx++) cells.push([gx, gy]);
    for (let i = cells.length - 1; i > 0; i--) { const j = randi(0, i); const t = cells[i]; cells[i] = cells[j]; cells[j] = t; }
    for (let s = 0; s < SQUADS; s++) {
      const [gx, gy] = cells[s];
      const sx = clamp(gx * cellW + rand(cellW * 0.2, cellW * 0.8), 200, WORLD - 200);
      const sy = clamp(gy * cellW + rand(cellW * 0.2, cellW * 0.8), 200, WORLD - 200);
      for (let m = 0; m < SQUAD_SIZE; m++) {
        const isPlayer = s === 0 && m === 0;
        const hid = isPlayer ? this.cfg.hunter : HUNTER_IDS[randi(0, HUNTER_IDS.length - 1)];
        const name = isPlayer ? "You" : BOT_NAMES[randi(0, BOT_NAMES.length - 1)];
        const e = new Hunter(this, hid, s, isPlayer, name);
        e.x = sx + rand(-80, 80); e.y = sy + rand(-80, 80);
        if (isPlayer && localStorage.getItem("stormfall_crown") === "1") e.hasCrown = true;
        this.hunters.push(e);
      }
    }
    this.player = this.hunters.find((h) => h.isPlayer); this.camFollow = this.player;
    this.landX = this.player.x; this.landY = this.player.y;
    this.cam.x = this.player.x - this.canvas.width / 2; this.cam.y = this.player.y - this.canvas.height / 2;
    this.netHostAssign();
    this.spawnCreeps();
    for (let i = 0; i < 60; i++) this.motes.push({ x: rand(0, this.canvas.width), y: rand(0, this.canvas.height), vx: rand(-8, 8), vy: rand(-14, -3), r: rand(0.6, 2), a: rand(0.1, 0.4) });
  }

  dropItem(id: string, lvl: number, x: number, y: number, t4?: boolean) { id = id || GEAR_IDS[randi(0, GEAR_IDS.length - 1)]; this.items.push({ id, lvl, t4: !!t4, x: clamp(x, 20, WORLD - 20), y: clamp(y, 20, WORLD - 20), bob: rand(0, TAU) }); }
  private randGear() { return GEAR_IDS[randi(0, GEAR_IDS.length - 1)]; }
  private addCreep(type: string, x: number, y: number, drops: any[]) { const c = new Creep(this, type, clamp(x, 80, WORLD - 80), clamp(y, 80, WORLD - 80)); c.drops = drops || []; this.creeps.push(c); return c; }
  spawnCreeps() {
    const A = WORLD * WORLD;
    const littles = Math.floor(A / 3000000);
    for (let i = 0; i < littles; i++) { const a = rand(0, TAU), r = rand(0, WORLD * 0.46); this.addCreep("little", WORLD / 2 + Math.cos(a) * r, WORLD / 2 + Math.sin(a) * r, [{ id: this.randGear(), lvl: 1 }]); }
    const packs = Math.floor(A / 14000000);
    for (let i = 0; i < packs; i++) {
      const a = rand(0, TAU), r = rand(WORLD * 0.1, WORLD * 0.44), cx = WORLD / 2 + Math.cos(a) * r, cy = WORLD / 2 + Math.sin(a) * r;
      for (let k = 0; k < randi(4, 6); k++) this.addCreep("little", cx + rand(-120, 120), cy + rand(-120, 120), [{ id: this.randGear(), lvl: 1 }]);
      this.addCreep("leader", cx + rand(-40, 40), cy + rand(-40, 40), [{ id: this.randGear(), lvl: 1 }, { id: this.randGear(), lvl: 2 }]);
    }
    const minis = Math.max(2, Math.floor(A / 40000000));
    for (let i = 0; i < minis; i++) { const a = rand(0, TAU), r = rand(WORLD * 0.15, WORLD * 0.42); const drops = []; for (let k = 0; k < randi(1, 2); k++) drops.push({ id: this.randGear(), lvl: 3 }); this.addCreep("miniboss", WORLD / 2 + Math.cos(a) * r, WORLD / 2 + Math.sin(a) * r, drops); }
  }
  spawnBoss() { const drops = []; for (let k = 0; k < randi(1, 2); k++) drops.push({ id: this.randGear(), lvl: 3, t4: true }); this.addCreep("boss", this.zone.cx + rand(-60, 60), this.zone.cy + rand(-60, 60), drops); this.bossSpawned = true; this.addFeed("☠ THE STORM TITAN HAS AWOKEN at the centre!"); Sfx.zone(); }

  // ---------- deploy ----------
  dropSquads() { this.hunters.filter((h) => h.team === this.player.team).forEach((h) => { h.x = clamp(this.landX! + rand(-90, 90), 60, WORLD - 60); h.y = clamp(this.landY! + rand(-90, 90), 60, WORLD - 60); }); this.spawnBurst(this.landX!, this.landY!, "#34e3ff", 30); }
  updateDeployCamera(dt: number) { const tx = (this.landX != null ? this.landX : this.player.x) - this.canvas.width / 2; const ty = (this.landY != null ? this.landY : this.player.y) - this.canvas.height / 2; this.cam.x = lerp(this.cam.x, tx, 0.15); this.cam.y = lerp(this.cam.y, ty, 0.15); }
  chooseLanding(ev: any) { if (this.phase !== "choose") return; ev.preventDefault(); const r = this.mm.getBoundingClientRect(); const px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left; const py = (ev.touches ? ev.touches[0].clientY : ev.clientY) - r.top; this.landX = clamp((px / r.width) * WORLD, 0, WORLD); this.landY = clamp((py / r.height) * WORLD, 0, WORLD); if (this.netrole === "client") Net.toHost({ t: "land", x: this.landX, y: this.landY }); Sfx.ping(0.6); }
  deployClick(ev: any) { if (this.phase !== "choose" || this.ovScale == null) return; ev.preventDefault(); const r = this.canvas.getBoundingClientRect(); const px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left; const py = (ev.touches ? ev.touches[0].clientY : ev.clientY) - r.top; this.landX = clamp((px - this.ovX) / this.ovScale, 0, WORLD); this.landY = clamp((py - this.ovY) / this.ovScale, 0, WORLD); if (this.netrole === "client") Net.toHost({ t: "land", x: this.landX, y: this.landY }); Sfx.ping(0.6); }

  // ---------- abilities ----------
  cast(ent: any, slot: string) {
    if (!ent.alive || ent.downed || ent.stunT > 0) return false;
    const def = abilityOf(ent, slot);
    if (ent.cd[slot] > 0) return false;
    ent.cd[slot] = def.cd * (slot === "basic" ? ent.atkSpeedMul : 1);
    const isAb = slot !== "basic";
    const dmg = (def.dmg || 0) * ent.dmgMul * (isAb ? ent.abilityMul : 1);
    const ax = Math.cos(ent.aim), ay = Math.sin(ent.aim), v = this.volAt(ent.x, ent.y);
    switch (def.kind) {
      case "swap": ent.form = ent.form === "shadow" ? "holy" : "shadow"; this.spawnRing(ent.x, ent.y, 70, effColor(ent)); this.spawnBurst(ent.x, ent.y, effColor(ent), 16); Sfx.cast(v); break;
      case "proj": this.fireProj(ent, def, ent.aim, dmg); Sfx.shoot(v); break;
      case "burst": { const start = ent.aim - def.spread / 2; for (let i = 0; i < def.count; i++) this.fireProj(ent, def, start + def.spread * (i / (def.count - 1 || 1)), dmg); Sfx.shoot(v); break; }
      case "cone": this.coneHit(ent, def, dmg); this.spawnSwing(ent, def); Sfx.dash(v); break;
      case "dash": { ent.dashVx = ax * (def.range * 4); ent.dashVy = ay * (def.range * 4); ent.dashT = 0.25; if (def.hitRange > 0) setTimeout(() => { if (ent.alive) this.coneHit(ent, { ...def, range: def.hitRange }, dmg); }, 120); this.spawnBurst(ent.x, ent.y, effColor(ent), 8); Sfx.dash(v); break; }
      case "blink": ent.x = clamp(ent.x + ax * def.range, 40, WORLD - 40); ent.y = clamp(ent.y + ay * def.range, 40, WORLD - 40); this.spawnBurst(ent.x, ent.y, effColor(ent), 14); Sfx.cast(v); break;
      case "shield": ent.shield = Math.max(ent.shield, def.amount); Sfx.cast(v); break;
      case "aoe": case "dotaoe": { let tx = ent.x, ty = ent.y; if (def.atCursor) { if (ent.isPlayer) { const w = this.worldMouse(); tx = w.x; ty = w.y; } else if (ent.aiTarget) { tx = ent.aiTarget.x; ty = ent.aiTarget.y; } else { tx = ent.x + ax * 220; ty = ent.y + ay * 220; } } this.addAoe(ent, tx, ty, def.radius, dmg, def.delay, def.dot || null); Sfx.cast(v); break; }
      case "storm": { let tx = ent.x + ax * 260, ty = ent.y + ay * 260; if (ent.isPlayer) { const w = this.worldMouse(); tx = w.x; ty = w.y; } else if (ent.aiTarget) { tx = ent.aiTarget.x; ty = ent.aiTarget.y; } for (let i = 0; i < def.count; i++) { const dx = rand(-def.spread, def.spread), dy = rand(-def.spread, def.spread); setTimeout(() => { if (!this.over) this.addAoe(ent, tx + dx, ty + dy, def.radius, dmg, 0.5, null); }, i * 180); } Sfx.cast(v); break; }
      case "heal": this.hunters.forEach((o) => { if (o.team === ent.team && o.alive && dist(o.x, o.y, ent.x, ent.y) < def.radius) { if (o.downed) o.bleed = Math.min(12, o.bleed + 5); else o.hp = Math.min(o.maxHp, o.hp + def.amount * ent.abilityMul); } }); this.spawnRing(ent.x, ent.y, def.radius, "#46e08a"); Sfx.cast(v); break;
      case "speed": this.hunters.forEach((o) => { if (o.team === ent.team && o.alive && dist(o.x, o.y, ent.x, ent.y) < def.radius) { o.speedBuffT = def.dur; o.speedBuffMul = def.mult; } }); this.spawnRing(ent.x, ent.y, def.radius, "#ffd24a"); Sfx.cast(v); break;
      case "shieldAura": this.hunters.forEach((o) => { if (o.team === ent.team && o.alive && !o.downed && dist(o.x, o.y, ent.x, ent.y) < def.radius) o.shield = Math.max(o.shield, def.amount); }); this.spawnRing(ent.x, ent.y, def.radius, "#34e3ff"); Sfx.cast(v); break;
    }
    return true;
  }
  fireProj(ent: any, def: any, ang: number, dmg: number) { this.projectiles.push({ x: ent.x + Math.cos(ang) * ent.radius, y: ent.y + Math.sin(ang) * ent.radius, vx: Math.cos(ang) * def.speed, vy: Math.sin(ang) * def.speed, dmg, team: ent.team, owner: ent, radius: def.radius * 1.45, life: def.range / def.speed, pierce: !!def.pierce, color: effColor(ent), hits: new Set(), dot: def.dot || null }); }
  coneHit(ent: any, def: any, dmg: number) {
    const inArc = (o: any) => dist(o.x, o.y, ent.x, ent.y) <= def.range + o.radius && Math.abs(angDiff(angTo(ent.x, ent.y, o.x, o.y), ent.aim)) <= def.arc / 2;
    this.hunters.forEach((o) => { if (o.team === ent.team || !o.alive) return; if (inArc(o)) { o.takeDamage(dmg, ent); if (def.snare) o.addSnare(); if (def.stun) o.stunT = Math.max(o.stunT || 0, def.stun); this.spawnBurst(o.x, o.y, "#fff", 6); Sfx.hit(this.volAt(o.x, o.y)); } });
    if (ent.team >= 0) for (const c of this.creeps) { if (c.alive && inArc(c)) { c.takeDamage(dmg, ent); this.spawnBurst(c.x, c.y, "#fff", 6); } }
  }
  addAoe(ent: any, x: number, y: number, r: number, dmg: number, delay: number, dot: any) { this.aoes.push({ x, y, r, dmg, team: ent.team, owner: ent, t: delay, max: delay, color: effColor(ent), dot: dot || null }); }

  // ---------- control ----------
  readMoveAim(p: any) {
    if (this.mobile.on) {
      if (this.mobile.aim.active) this.mobile.lastAim = this.mobile.aim.ang;
      const aim = this.mobile.lastAim;
      this.input.mx = p.x + Math.cos(aim) * 420 - this.cam.x; this.input.my = p.y + Math.sin(aim) * 420 - this.cam.y;
      return { mx: this.mobile.move.nx, my: this.mobile.move.ny, aim, fire: this.mobile.aim.firing };
    }
    let mx = 0, my = 0; const k = this.input.keys;
    if (k.has("w")) my--; if (k.has("s")) my++; if (k.has("a")) mx--; if (k.has("d")) mx++;
    const ml = Math.hypot(mx, my) || 1; const w = this.worldMouse();
    return { mx: mx / ml, my: my / ml, aim: angTo(p.x, p.y, w.x, w.y), fire: this.input.mdown };
  }
  controlPlayer(p: any, dt: number) {
    const k = this.input.keys, r = this.readMoveAim(p);
    p.moveX = r.mx; p.moveY = r.my; p.aim = r.aim; const w = this.worldMouse();
    p.reviving = null; if (p.downed) return;
    if (r.fire) this.cast(p, "basic");
    if (k.has("q")) this.cast(p, "q"); if (k.has("e")) this.cast(p, "e"); if (k.has("r")) this.cast(p, "r");
    if (k.has(" ") && p.cd.dash <= 0) { const a = p.aim; p.dashVx = Math.cos(a) * 900; p.dashVy = Math.sin(a) * 900; p.dashT = 0.2; p.cd.dash = 3; this.spawnBurst(p.x, p.y, p.def.color, 6); Sfx.dash(1); }
    if (k.has("v") && p.pingCd <= 0) { this.addPing(w.x, w.y, p.team, p); p.pingCd = 1; k.delete("v"); }
    const downAlly = this.hunters.find((o) => o.team === p.team && o !== p && o.downed && dist(o.x, o.y, p.x, p.y) < 110);
    if (downAlly) { downAlly.reviveProg += dt; p.reviving = downAlly; if (downAlly.reviveProg >= 2.5) downAlly.reviveTo(); this.replacePrompt = null; }
    else {
      this.tickReplacePrompt(p);
      if (!this.replacePrompt && k.has("f")) {
        const item = this.nearestGroundItem(p, 90);
        if (item) { k.delete("f"); const owned = p.slots.find((x: any) => x.id === item.id); if (!owned && p.slots.length >= MAX_SLOTS) this.replacePrompt = { x: item.x, y: item.y, id: item.id, lvl: item.lvl, t4: item.t4 }; else this.equipItem(p, item); }
      }
    }
  }
  private isEnemyAI(e: any) { return e.team !== this.player.team; }
  private aimErr(e: any) { if (!this.isEnemyAI(e)) return 0.05; return this.diff === "easy" ? 0.24 : this.diff === "hard" ? 0.015 : 0.05; }
  private lootRange(e: any) { if (!this.isEnemyAI(e)) return 1100; return this.diff === "easy" ? 500 : this.diff === "hard" ? 2000 : 1100; }
  private gearCap(e: any) { return this.isEnemyAI(e) && this.diff === "easy" ? 1 : 3; }
  private engageRange(e: any) { if (this.isEnemyAI(e) && this.diff === "easy" && this.zone.stage < 2 && e.threatT <= 0) return 300; return this.diff === "hard" ? 900 : 820; }
  controlAI(e: any, dt: number) {
    e.moveX = 0; e.moveY = 0; e.reviving = null; e.aiTimer -= dt;
    const inStorm = dist(e.x, e.y, this.zone.cx, this.zone.cy) > this.zone.r;
    let foe: any = null, fd = 1e18; const los = VISION * VISION;
    for (const o of this.hunters) { if (o.team === e.team || !o.alive) continue; const d = dist2(e.x, e.y, o.x, o.y); if (d < fd && d < los) { fd = d; foe = o; } }
    fd = Math.sqrt(fd);
    let downAlly: any = null, dad = 1e9;
    for (const o of this.hunters) { if (o.team === e.team && o !== e && o.downed) { const d = dist(e.x, e.y, o.x, o.y); if (d < dad) { dad = d; downAlly = o; } } }
    let gx: number | null = null, gy: number | null = null, fight = false;
    if (e.downed) { let ally: any = null, ad = 1e9; for (const o of this.hunters) if (o.team === e.team && o.alive && !o.downed) { const d = dist(e.x, e.y, o.x, o.y); if (d < ad) { ad = d; ally = o; } } if (ally) { gx = ally.x; gy = ally.y; } }
    else if (inStorm) { gx = this.zone.cx; gy = this.zone.cy; }
    else if (e.hp < e.maxHp * 0.3 && foe && fd < 460) { gx = e.x + (e.x - foe.x); gy = e.y + (e.y - foe.y); }
    else if (downAlly && dad < 560 && (!foe || fd > 360)) { gx = downAlly.x; gy = downAlly.y; if (dad < 80) { downAlly.reviveProg += dt; e.reviving = downAlly; if (downAlly.reviveProg >= 2.8) downAlly.reviveTo(); } }
    else if (foe && fd < this.engageRange(e)) {
      fight = true; e.aiTarget = foe;
      const ranged = abilityOf(e, "basic").kind === "proj"; const ideal = ranged ? 340 : 64;
      const a = angTo(e.x, e.y, foe.x, foe.y); const err = this.aimErr(e); e.aim = a + rand(-err, err);
      if (fd > ideal + 40) { gx = foe.x; gy = foe.y; } else if (fd < ideal - 40) { gx = e.x - (foe.x - e.x); gy = e.y - (foe.y - e.y); } else { e.moveX = Math.cos(a + Math.PI / 2) * (e.id % 2 ? 1 : -1); e.moveY = Math.sin(a + Math.PI / 2) * (e.id % 2 ? 1 : -1); }
      this.cast(e, "basic"); if (fd < 560) this.cast(e, "q"); if (e.hp < e.maxHp * 0.6) this.cast(e, "e"); if (fd < 480) this.cast(e, "r");
      if (abilityOf(e, "q").kind === "heal" || abilityOf(e, "e").kind === "speed") { this.cast(e, "q"); this.cast(e, "e"); }
    } else {
      const item = this.nearestNeededItem(e);
      const cr = !item || dist2(e.x, e.y, item.x, item.y) > 360 * 360 ? this.nearestCreep(e, this.lootRange(e)) : null;
      if (item && dist(e.x, e.y, item.x, item.y) < 280) { gx = item.x; gy = item.y; if (dist(e.x, e.y, item.x, item.y) < 32 && e.lootCd <= 0) { this.equipItem(e, item); e.lootCd = 0.5; } }
      else if (cr && (cr.type !== "boss" || e.team === this.player.team)) { fight = true; const a = angTo(e.x, e.y, cr.x, cr.y); const err = this.aimErr(e); e.aim = a + rand(-err, err); const reach = e.radius + cr.radius + (abilityOf(e, "basic").kind === "proj" ? 260 : 30); if (dist(e.x, e.y, cr.x, cr.y) > reach) { gx = cr.x; gy = cr.y; } this.cast(e, "basic"); this.cast(e, "q"); }
      else if (item) { gx = item.x; gy = item.y; if (dist(e.x, e.y, item.x, item.y) < 32 && e.lootCd <= 0) { this.equipItem(e, item); e.lootCd = 0.5; } }
      else { if (e.aiTimer <= 0) { e.wander = rand(0, TAU); e.aiTimer = rand(2, 4); } gx = clamp(e.x + Math.cos(e.wander) * 260, 150, WORLD - 150); gy = clamp(e.y + Math.sin(e.wander) * 260, 150, WORLD - 150); gx = lerp(gx, this.zone.cx, 0.25); gy = lerp(gy, this.zone.cy, 0.25); }
    }
    if (gx !== null) { const a = angTo(e.x, e.y, gx, gy!); if (dist(e.x, e.y, gx, gy!) > 22) { e.moveX = Math.cos(a); e.moveY = Math.sin(a); } if (!fight) e.aim = a; }
    if (e.team === this.player.team && e.pingCd <= 0) { for (const it of this.items) { if (dist(e.x, e.y, it.x, it.y) < 90 && !this.aiNeedsItem(e, it)) { this.addPing(it.x, it.y, e.team, e); e.pingCd = rand(5, 9); break; } } }
  }
  nearestGroundItem(e: any, range: number) { let best: any = null, bd = range * range; for (const it of this.items) { const d = dist2(e.x, e.y, it.x, it.y); if (d < bd) { bd = d; best = it; } } return best; }
  private nearestNeededItem(e: any) { let best: any = null, bd = 1e18; for (const it of this.items) { if (!this.aiNeedsItem(e, it)) continue; const d = dist2(e.x, e.y, it.x, it.y); if (d < bd) { bd = d; best = it; } } return Math.sqrt(bd) < this.lootRange(e) ? best : null; }
  private aiNeedsItem(e: any, it: any) { const s = e.slots.find((x: any) => x.id === it.id); const cap = this.gearCap(e); if (it.t4 && cap >= 3) return !s || !s.t4; if (!s) return cap >= 1; return s.lvl < cap || (it.lvl > s.lvl && s.lvl < cap); }
  nearestCreep(e: any, range: number) { let best: any = null, bd = range * range; for (const c of this.creeps) { if (!c.alive) continue; const d = dist2(e.x, e.y, c.x, c.y); if (d < bd) { bd = d; best = c; } } return best; }
  equipItem(ent: any, it: any) {
    const res = ent.equip(it.id, it.lvl, it.t4);
    const i = this.items.indexOf(it); if (i >= 0) this.items.splice(i, 1);
    if (res === "max") return;
    Sfx.pickup(this.volAt(ent.x, ent.y)); this.spawnBurst(ent.x, ent.y, it.t4 ? "#ffd24a" : GEAR[it.id].color, 8);
    if (ent.isPlayer) { const g = GEAR[it.id]; const s = ent.slots.find((x: any) => x.id === it.id); this.addFeed(`${res === "up" ? "Upgraded" : "Equipped"} ${g.name} ${s && s.t4 ? "T4 (true damage!)" : s ? "Lv" + s.lvl : ""} — ${g.blurb[(s ? s.lvl : 1) - 1]}`); }
  }
  private itemNear(x: number, y: number, r: number) { let best: any = null, bd = r * r; for (const it of this.items) { const d = dist2(x, y, it.x, it.y); if (d < bd) { bd = d; best = it; } } return best; }
  doReplace(slotIndex: number) {
    const rp = this.replacePrompt; if (!rp || slotIndex < 0 || slotIndex >= MAX_SLOTS) return;
    if (this.netrole === "client") { Net.toHost({ t: "replace", slot: slotIndex }); this.replacePrompt = null; return; }
    const p = this.player, it = this.itemNear(rp.x, rp.y, 70);
    if (it) { p.slots[slotIndex] = { id: it.id, lvl: Math.min(3, it.lvl), t4: !!it.t4 }; p.recomputeGear(); const i = this.items.indexOf(it); if (i >= 0) this.items.splice(i, 1); Sfx.pickup(this.volAt(p.x, p.y)); this.spawnBurst(p.x, p.y, it.t4 ? "#ffd24a" : GEAR[it.id].color, 8); this.addFeed(`Replaced slot ${slotIndex + 1} with ${GEAR[it.id].name}`); }
    this.replacePrompt = null;
  }
  private tickReplacePrompt(p: any) {
    if (!this.replacePrompt) return; const rp = this.replacePrompt;
    if (!p || !p.alive || p.downed || dist(p.x, p.y, rp.x, rp.y) > 110 || !this.itemNear(rp.x, rp.y, 45)) { this.replacePrompt = null; return; }
    for (let i = 1; i <= MAX_SLOTS; i++) if (this.input.keys.has("" + i)) { this.doReplace(i - 1); this.input.keys.delete("" + i); break; }
  }

  // ---------- effects / feed / chat ----------
  addPing(x: number, y: number, team: number, by: any) { this.pings.push({ x, y, team, t: 4, by }); Sfx.ping(this.volAt(x, y) * (by === this.player ? 1.4 : 1)); }
  addFeed(txt: string) { this.feed.push({ id: this.feedId++, txt }); if (this.feed.length > 6) this.feed.shift(); if (this.netrole === "host") Net.broadcast({ t: "feed", x: txt }); }
  spawnBurst(x: number, y: number, color: string, n: number) { for (let i = 0; i < n; i++) { const a = rand(0, TAU), s = rand(40, 220); this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.6), color, r: rand(2, 4) }); } }
  spawnRing(x: number, y: number, r: number, color: string) { this.particles.push({ ring: true, x, y, maxR: r, life: 0.5, color }); }
  spawnSwing(ent: any, def: any) { this.swings.push({ x: ent.x, y: ent.y, aim: ent.aim, arc: def.arc, range: def.range, t: 0.2, max: 0.2 }); }
  addChatMsg(name: string, text: string, mine?: boolean) { this.chat.push({ id: this.feedId++, name: String(name).slice(0, 12), text: String(text).slice(0, 120), mine: !!mine }); if (this.chat.length > 6) this.chat.shift(); }
  sendChat(text: string) { const name = this.netrole === "solo" ? "You" : this.handle; this.addChatMsg("You", text, true); if (this.netrole === "host") Net.broadcast({ t: "chat", name, text }); else if (this.netrole === "client") Net.toHost({ t: "chat", name, text }); }

  // ---------- update ----------
  update(dt: number) {
    const z = this.zone; this.t += dt;
    if (this.phase !== "live") {
      this.deployT -= dt;
      if (this.phase === "choose" && this.deployT <= 5) { this.phase = "grace"; this.dropSquads(); Sfx.zone(); this.addFeed("Hunters deployed — grace period"); }
      if (this.deployT <= 0) { this.phase = "live"; this.addFeed("⚔ The hunt begins!"); }
    }
    if (this.phase === "choose") { this.updateDeployCamera(dt); this.hostStream(dt); return; }
    const live = this.phase === "live";
    if (live) {
      if (z.target > WORLD * 0.05) { z.nextShrink -= dt; if (z.nextShrink <= 0) { z.stage++; z.target = Math.max(WORLD * 0.05, z.target * 0.7); z.nextShrink = Math.max(20, 40 - z.stage * 2.5); this.addFeed("⚠ The storm is closing in"); Sfx.zone(); } }
      else { if (!this.overtime) { this.overtime = true; this.addFeed("⏱ OVERTIME — the storm collapses to nothing!"); Sfx.zone(); } z.target = Math.max(0, z.target - WORLD * 0.0025 * dt); }
    }
    z.r = lerp(z.r, z.target, dt * 0.4); Sfx.ambientIntensity(clamp(1 - z.r / (WORLD * 0.82), 0, 1));
    this.lightT -= dt; if (this.flash > 0) this.flash -= dt;
    if (this.lightT <= 0) { this.lightT = rand(5, 13) - z.stage * 0.4; this.flash = 0.16; const a = rand(0, TAU); const ex = z.cx + Math.cos(a) * z.r, ey = z.cy + Math.sin(a) * z.r; this.bolt = []; let bx = ex, by = ey - rand(200, 500); for (let i = 0; i < 6; i++) { this.bolt.push({ x: bx, y: by }); bx += rand(-40, 40); by += Math.abs(rand(40, 110)); } this.bolt.push({ x: ex, y: ey }); }

    for (const e of this.hunters) {
      if (!e.alive) continue;
      if (e.dots.length) { for (let i = e.dots.length - 1; i >= 0; i--) { const d = e.dots[i]; d.t -= dt; e.takeDamage(d.dps * dt, d.src); if (!e.alive) break; if (d.t <= 0) e.dots.splice(i, 1); } if (!e.alive) continue; }
      for (const kk in e.cd) if (e.cd[kk] > 0) e.cd[kk] -= dt;
      if (e.speedBuffT > 0) e.speedBuffT -= dt;
      if (e.snareT > 0) { e.snareT -= dt; if (e.snareT <= 0) e.snareStacks = 0; }
      if (e.threatT > 0) e.threatT -= dt; if (e.pingCd > 0) e.pingCd -= dt; if (e.lootCd > 0) e.lootCd -= dt;
      if (e.reviveProg > 0 && !e.beingRevived) e.reviveProg = Math.max(0, e.reviveProg - dt * 0.5); e.beingRevived = false;
      if (e.shieldRegen > 0 && e.shield < e.maxShield && !e.downed) e.shield = Math.min(e.maxShield, e.shield + e.shieldRegen * dt);
      if (e.regenLockT > 0) e.regenLockT -= dt; else if (!e.downed && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.06 * dt);
      if (e.stunT > 0) { e.stunT -= dt; e.moveX = 0; e.moveY = 0; e.reviving = null; }
      else if (e.isPlayer) this.controlPlayer(e, dt);
      else if (e.human) this.applyRemoteControl(e, dt);
      else this.controlAI(e, dt);
      if (e.downed) { e.bleed -= dt; if (e.bleed <= 0) e.die(null); }
      const moving = e.moveX || e.moveY, spd = e.downed ? e.effSpeed * 0.35 : e.effSpeed;
      if (e.dashT > 0) { e.x += e.dashVx * dt; e.y += e.dashVy * dt; e.dashT -= dt; } else { e.x += (e.moveX || 0) * spd * dt; e.y += (e.moveY || 0) * spd * dt; }
      if (moving) e.walkT += dt * 10;
      e.x = clamp(e.x, e.radius, WORLD - e.radius); e.y = clamp(e.y, e.radius, WORLD - e.radius);
      if (dist(e.x, e.y, z.cx, z.cy) > z.r) e.takeDamage((7 + z.stage * 3 + (this.overtime ? 40 : 0)) * dt, null);
    }
    for (const e of this.hunters) if (e.reviving) e.reviving.beingRevived = true;

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      let dead = p.life <= 0 || p.x < 0 || p.y < 0 || p.x > WORLD || p.y > WORLD;
      if (!dead) for (const o of this.hunters) { if (o.team === p.team || !o.alive || p.hits.has(o.id)) continue; if (dist(p.x, p.y, o.x, o.y) < o.radius + p.radius) { o.takeDamage(p.dmg, p.owner); if (p.dot) o.addDot(p.dot.dps, p.dot.dur, p.owner); this.spawnBurst(p.x, p.y, p.color, 5); Sfx.hit(this.volAt(p.x, p.y)); p.hits.add(o.id); if (!p.pierce) { dead = true; break; } } }
      if (!dead && p.owner && p.owner.team >= 0) for (const c of this.creeps) { if (!c.alive || p.hits.has(c.id)) continue; if (dist(p.x, p.y, c.x, c.y) < c.radius + p.radius) { c.takeDamage(p.dmg, p.owner); this.spawnBurst(p.x, p.y, p.color, 5); Sfx.hit(this.volAt(p.x, p.y)); p.hits.add(c.id); if (!p.pierce) { dead = true; break; } } }
      if (dead) this.projectiles.splice(i, 1);
    }
    for (let i = this.aoes.length - 1; i >= 0; i--) {
      const a = this.aoes[i]; a.t -= dt;
      if (a.t <= 0) { for (const o of this.hunters) { if (o.team === a.team || !o.alive) continue; if (dist(a.x, a.y, o.x, o.y) < a.r + o.radius) { o.takeDamage(a.dmg, a.owner); if (a.dot) o.addDot(a.dot.dps, a.dot.dur, a.owner); } } if (a.owner && a.owner.team >= 0) for (const c of this.creeps) { if (c.alive && dist(a.x, a.y, c.x, c.y) < a.r + c.radius) c.takeDamage(a.dmg, a.owner); } this.spawnBurst(a.x, a.y, a.color, 18); this.spawnRing(a.x, a.y, a.r, a.color); Sfx.explode(this.volAt(a.x, a.y)); this.aoes.splice(i, 1); }
    }
    for (let i = this.pings.length - 1; i >= 0; i--) { this.pings[i].t -= dt; if (this.pings[i].t <= 0) this.pings.splice(i, 1); }
    for (let i = this.particles.length - 1; i >= 0; i--) { const p = this.particles[i]; p.life -= dt; if (!p.ring) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9; } if (p.life <= 0) this.particles.splice(i, 1); }
    for (let i = this.swings.length - 1; i >= 0; i--) { this.swings[i].t -= dt; if (this.swings[i].t <= 0) this.swings.splice(i, 1); }
    for (const m of this.motes) { m.x += m.vx * dt; m.y += m.vy * dt; if (m.y < -5) { m.y = this.canvas.height + 5; m.x = rand(0, this.canvas.width); } if (m.x < -5) m.x = this.canvas.width + 5; if (m.x > this.canvas.width + 5) m.x = -5; }
    this.updateCreeps(dt);
    if (live && !this.bossSpawned && this.hunters.filter((h) => h.alive).length <= BOSS_TRIGGER) this.spawnBoss();
    this.camFollow = this.player.alive ? this.player : this.hunters.find((o) => o.team === this.player.team && o.alive) || this.player;
    this.cam.x = lerp(this.cam.x, this.camFollow.x - this.canvas.width / 2, 0.1); this.cam.y = lerp(this.cam.y, this.camFollow.y - this.canvas.height / 2, 0.1);
    this.hostStream(dt);
    this.checkEnd();
  }
  private updateCreeps(dt: number) {
    for (let i = this.creeps.length - 1; i >= 0; i--) {
      const c = this.creeps[i]; if (!c.alive) { this.creeps.splice(i, 1); continue; }
      if (c.flash > 0) c.flash -= dt; if (c.atkCd > 0) c.atkCd -= dt;
      let tgt: any = null, td = c.cfg.aggro * c.cfg.aggro;
      for (const h of this.hunters) { if (!h.alive || h.downed) continue; const d = dist2(c.x, c.y, h.x, h.y); if (d < td) { td = d; tgt = h; } }
      if (tgt) { const a = angTo(c.x, c.y, tgt.x, tgt.y), reach = c.radius + tgt.radius + 6, d = dist(c.x, c.y, tgt.x, tgt.y); if (d > reach) { c.x += Math.cos(a) * c.cfg.speed * dt; c.y += Math.sin(a) * c.cfg.speed * dt; } else if (c.atkCd <= 0) { tgt.takeDamage(c.cfg.dmg, c); c.atkCd = 1; this.spawnBurst(tgt.x, tgt.y, c.color, 5); } }
      else { c.wt -= dt; if (c.wt <= 0) { c.wander = rand(0, TAU); c.wt = rand(1.5, 4); } const home = c.type === "boss" ? dist(c.x, c.y, this.zone.cx, this.zone.cy) > 120 : dist(c.x, c.y, c.spawnX, c.spawnY) > 180; const ang = home ? angTo(c.x, c.y, c.type === "boss" ? this.zone.cx : c.spawnX, c.type === "boss" ? this.zone.cy : c.spawnY) : c.wander; c.x += Math.cos(ang) * c.cfg.speed * 0.5 * dt; c.y += Math.sin(ang) * c.cfg.speed * 0.5 * dt; }
      c.x = clamp(c.x, 40, WORLD - 40); c.y = clamp(c.y, 40, WORLD - 40);
      if (dist(c.x, c.y, this.zone.cx, this.zone.cy) > this.zone.r) c.takeDamage((6 + this.zone.stage * 3) * dt, null);
    }
  }
  private checkEnd() {
    if (this.over) return;
    const teams = new Set(); for (const e of this.hunters) if (e.alive) teams.add(e.team);
    if (teams.size <= 1) { this.over = true; const won = teams.has(this.player.team); setTimeout(() => this.showEnd(won), 800); }
    else if (!this.hunters.some((e) => e.team === this.player.team && e.alive)) { this.over = true; this.placeWhenDead = teams.size + 1; setTimeout(() => this.showEnd(false), 800); }
  }
  private endScreenShow(won: boolean, place: any, yourKills: number, squadKills: number, sub?: string) {
    Sfx.ambientStop(); won ? Sfx.victory() : Sfx.defeat();
    this.endInfo = { won, place, yourKills, squadKills, sub };
    if (won) { localStorage.setItem("stormfall_crown", "1"); localStorage.setItem("stormfall_wins", "" + (+(localStorage.getItem("stormfall_wins") || 0) + 1)); }
    else localStorage.setItem("stormfall_crown", "0");
  }
  private showEnd(won: boolean) {
    const place = won ? 1 : this.placeWhenDead || 2;
    const sk = this.hunters.filter((e) => e.team === this.player.team).reduce((a, e) => a + e.kills, 0);
    this.endScreenShow(won, place, this.player.kills, sk);
    if (this.netrole === "host") for (const id in Net.conns) { const me = this.hunters.find((h) => h.controlledBy === id); Net.send(id, { t: "end", won, place, yourKills: me ? me.kills : 0, squadKills: sk }); }
  }

  // ---------- HUD-facing getters ----------
  get aliveCount() { return this.hunters.filter((e) => e.alive).length; }
  get squadCount() { return new Set(this.hunters.filter((e) => e.alive).map((e) => e.team)).size; }
  get zoneTimerText() { return this.zone.target <= WORLD * 0.051 ? "⏱ OVERTIME — storm collapsing!" : this.zone.target <= WORLD * 0.07 ? "Final zone!" : `Storm closes in ${Math.ceil(this.zone.nextShrink)}s`; }

  // ---------- loop ----------
  private loop = (now: number) => {
    const dt = Math.min(0.05, (now - this.lastT) / 1000); this.lastT = now;
    try { if (!this.over) { if (this.netrole === "client") this.clientTick(dt); else this.update(dt); } } catch (err) { console.error("Stormfall update error:", err); }
    try { this.draw(); } catch (err) { console.error("Stormfall draw error:", err); }
    this.raf = requestAnimationFrame(this.loop);
  };

  // ---------- render ----------
  private drawFog(cam: any) {
    const w = this.canvas.width, h = this.canvas.height;
    if (!this.fogCanvas) { this.fogCanvas = document.createElement("canvas"); this.fogCtx = this.fogCanvas.getContext("2d"); }
    if (this.fogCanvas.width !== w || this.fogCanvas.height !== h) { this.fogCanvas.width = w; this.fogCanvas.height = h; }
    const fc = this.fogCtx!; fc.clearRect(0, 0, w, h); fc.fillStyle = "rgba(4,7,14,0.88)"; fc.fillRect(0, 0, w, h);
    fc.globalCompositeOperation = "destination-out"; const t = this.player ? this.player.team : 0;
    for (const o of this.hunters) { if (!o.alive || o.team !== t) continue; const sx = o.x - cam.x, sy = o.y - cam.y; const g = fc.createRadialGradient(sx, sy, VISION * 0.55, sx, sy, VISION); g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)"); fc.fillStyle = g; fc.beginPath(); fc.arc(sx, sy, VISION, 0, TAU); fc.fill(); }
    fc.globalCompositeOperation = "source-over"; this.ctx.drawImage(this.fogCanvas, 0, 0);
  }
  draw() {
    const ctx = this.ctx;
    if (this.phase === "choose") { this.drawDeployOverview(); return; }
    const w = this.canvas.width, h = this.canvas.height, cam = this.cam;
    ctx.imageSmoothingEnabled = false; ctx.fillStyle = "#0a1018"; ctx.fillRect(0, 0, w, h);
    Terrain.draw(ctx, cam, w, h, this.t);
    ctx.strokeStyle = "rgba(255,255,255,.08)"; ctx.lineWidth = 4; ctx.strokeRect(-cam.x, -cam.y, WORLD, WORLD);
    Terrain.drawProps(ctx, cam, w, h);
    const z = this.zone;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.arc(z.cx - cam.x, z.cy - cam.y, z.r, 0, TAU, true); ctx.fillStyle = "rgba(150,40,200,.18)"; ctx.fill("evenodd"); ctx.restore();
    ctx.beginPath(); ctx.arc(z.cx - cam.x, z.cy - cam.y, z.r, 0, TAU); ctx.strokeStyle = "rgba(190,100,255,.75)"; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.arc(z.cx - cam.x, z.cy - cam.y, z.target, 0, TAU); ctx.setLineDash([10, 10]); ctx.strokeStyle = "rgba(255,255,255,.25)"; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
    for (const it of this.items) {
      const sx = it.x - cam.x, sy = it.y - cam.y; if (sx < -40 || sy < -40 || sx > w + 40 || sy > h + 40) continue;
      const g = GEAR[it.id], bob = Math.sin(this.t * 3 + it.bob) * 3, col = it.t4 ? "#ffd24a" : g.color;
      if (it.t4) { ctx.beginPath(); ctx.arc(sx, sy + bob, 15, 0, TAU); ctx.strokeStyle = "rgba(255,210,74,.5)"; ctx.lineWidth = 1; ctx.stroke(); }
      ctx.beginPath(); ctx.arc(sx, sy + bob, 12, 0, TAU); ctx.fillStyle = col + "33"; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
      ctx.font = "14px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#fff"; ctx.fillText(g.emoji, sx, sy + bob + 1);
      ctx.font = "11px sans-serif"; ctx.fillStyle = col; ctx.fillText(g.name + (it.t4 ? " T4✦" : it.lvl > 1 ? " Lv" + it.lvl : ""), sx, sy + bob - 20);
      const ps = this.player && this.player.slots;
      if (ps) { const own = ps.find((s: any) => s.id === it.id); if (own) { if (own.lvl < 3 || (it.t4 && !own.t4)) { ctx.fillStyle = "#46e08a"; ctx.font = "bold 15px sans-serif"; ctx.fillText("▲", sx + 16, sy + bob); } } else if (ps.length >= MAX_SLOTS) { ctx.fillStyle = "#ffd24a"; ctx.font = "bold 14px sans-serif"; ctx.fillText("⇄", sx + 16, sy + bob); } }
    }
    for (const a of this.aoes) { const sx = a.x - cam.x, sy = a.y - cam.y, f = 1 - a.t / a.max; ctx.beginPath(); ctx.arc(sx, sy, a.r, 0, TAU); ctx.fillStyle = a.color + "22"; ctx.fill(); ctx.beginPath(); ctx.arc(sx, sy, a.r * f, 0, TAU); ctx.strokeStyle = a.color; ctx.lineWidth = 3; ctx.stroke(); }
    for (const s of this.swings) { const sx = s.x - cam.x, sy = s.y - cam.y, k = s.t / s.max, p = clamp((1 - k) * 1.25, 0, 1), a0 = s.aim - s.arc / 2, a1 = a0 + s.arc * p; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.arc(sx, sy, s.range, a0, a1); ctx.closePath(); ctx.fillStyle = `rgba(255,205,130,${0.3 * k})`; ctx.fill(); ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(a1) * s.range, sy + Math.sin(a1) * s.range); ctx.strokeStyle = `rgba(255,245,210,${0.85 * k})`; ctx.lineWidth = 3.5; ctx.stroke(); }
    for (const pg of this.pings) { const sx = pg.x - cam.x, sy = pg.y - cam.y, pulse = 1 + Math.sin(this.t * 8) * 0.15; ctx.beginPath(); ctx.arc(sx, sy, 16 * pulse, 0, TAU); ctx.strokeStyle = "#ffd24a"; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = "#ffd24a"; ctx.font = "16px sans-serif"; ctx.textAlign = "center"; ctx.fillText("⚑", sx, sy - 22); }
    for (const p of this.projectiles) { const sx = p.x - cam.x, sy = p.y - cam.y; ctx.beginPath(); ctx.arc(sx, sy, p.radius, 0, TAU); ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 10; ctx.fill(); ctx.shadowBlur = 0; }
    for (const c of this.creeps) {
      if (!c.alive || !this.inVision(c.x, c.y)) continue; const sx = c.x - cam.x, sy = c.y - cam.y; if (sx < -90 || sy < -90 || sx > w + 90 || sy > h + 90) continue;
      const big = c.type === "boss" || c.type === "miniboss";
      ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(sx, sy + c.radius * 0.6, c.radius * 0.9, c.radius * 0.4, 0, 0, TAU); ctx.fill();
      const bob = Math.sin(this.t * 4 + c.bob) * c.radius * 0.06; ctx.beginPath(); ctx.arc(sx, sy + bob, c.radius, 0, TAU); ctx.fillStyle = c.flash > 0 ? "#fff" : c.color; ctx.fill(); ctx.strokeStyle = shade(c.color, -0.4); ctx.lineWidth = big ? 4 : 2; ctx.stroke();
      ctx.fillStyle = "#1a1a1a"; ctx.beginPath(); ctx.arc(sx - c.radius * 0.32, sy + bob - c.radius * 0.1, c.radius * 0.16, 0, TAU); ctx.arc(sx + c.radius * 0.32, sy + bob - c.radius * 0.1, c.radius * 0.16, 0, TAU); ctx.fill();
      const bw = c.radius * 2.2, by = sy - c.radius - (big ? 16 : 9); ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(sx - bw / 2, by, bw, big ? 6 : 4); ctx.fillStyle = c.color; ctx.fillRect(sx - bw / 2, by, bw * clamp(c.hp / c.maxHp, 0, 1), big ? 6 : 4);
      if (big) { ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = c.type === "boss" ? "#ff7a7a" : "#d9a0c0"; ctx.fillText(c.type === "boss" ? "⚠ STORM TITAN" : "MINI-BOSS", sx, by - 6); }
    }
    for (const e of this.hunters) {
      if (!e.alive) continue; const ally = e.team === this.player.team; if (!ally && !this.inVision(e.x, e.y)) continue;
      const sx = e.x - cam.x, sy = e.y - cam.y; if (sx < -80 || sy < -100 || sx > w + 80 || sy > h + 100) continue;
      const ring = e.isPlayer ? "#ffd24a" : ally ? "#46e08a" : "#ff5a5a";
      if (e.reviving) { ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(e.reviving.x - cam.x, e.reviving.y - cam.y); ctx.strokeStyle = "rgba(70,224,138,.6)"; ctx.lineWidth = 3; ctx.stroke(); }
      ctx.beginPath(); ctx.ellipse(sx, sy + e.radius * 0.55, e.radius * 0.95, e.radius * 0.42, 0, 0, TAU); ctx.fillStyle = ring + "33"; ctx.fill(); ctx.strokeStyle = ring; ctx.lineWidth = 2; ctx.stroke();
      const sprite = Sprites[e.hid], H = e.radius * 2.7, sc = H / 18, W = 16 * sc, handY = sy - e.radius * 0.35, aimingUp = Math.sin(e.aim) < 0;
      if (aimingUp) drawWeapon(ctx, sx, handY, e.aim, e.def, e.radius);
      if (e.def.forms) { const fc = e.form === "shadow" ? "#b15cff" : "#ffe08a"; ctx.globalAlpha = 0.45 + 0.2 * Math.sin(this.t * 4); ctx.beginPath(); ctx.arc(sx, sy, e.radius + 5, 0, TAU); ctx.strokeStyle = fc; ctx.lineWidth = 3; ctx.stroke(); ctx.globalAlpha = 1; }
      if (e.dots.length) { ctx.beginPath(); ctx.arc(sx, sy, e.radius + 4, 0, TAU); ctx.strokeStyle = "rgba(155,93,229,.8)"; ctx.lineWidth = 2; ctx.setLineDash([3, 4]); ctx.stroke(); ctx.setLineDash([]); if (Math.random() < 0.25) this.particles.push({ x: e.x + rand(-e.radius, e.radius), y: e.y + rand(-e.radius, e.radius), vx: 0, vy: rand(-20, -50), life: 0.5, color: "#9b5de5", r: 2 }); }
      if (e.snareStacks > 0) { ctx.beginPath(); ctx.arc(sx, sy + e.radius * 0.55, e.radius * 0.8, 0.2, Math.PI - 0.2); ctx.strokeStyle = `rgba(255,138,61,${0.4 + e.snareStacks * 0.12})`; ctx.lineWidth = 2.5; ctx.stroke(); }
      if (e.stunT > 0) { for (let k = 0; k < 3; k++) { const a = this.t * 7 + (k * TAU) / 3; ctx.fillStyle = "#ffe04a"; ctx.font = "12px sans-serif"; ctx.textAlign = "center"; ctx.fillText("✦", sx + Math.cos(a) * e.radius, sy - e.radius - 8 + Math.sin(a) * 4); } }
      if (e.shield > 0) { ctx.beginPath(); ctx.arc(sx, sy, e.radius + 6, 0, TAU); ctx.strokeStyle = "rgba(52,227,255,.8)"; ctx.lineWidth = 3; ctx.stroke(); }
      const bob = (e.moveX || e.moveY) && !e.downed ? Math.abs(Math.sin(e.walkT)) * -2.5 : 0, flip = Math.cos(e.aim) < 0;
      ctx.save(); if (e.downed) ctx.globalAlpha = 0.7; ctx.translate(sx - W / 2, sy + e.radius * 0.55 - H + bob); if (flip) { ctx.translate(W, 0); ctx.scale(-1, 1); } if (sprite) ctx.drawImage(sprite, 0, 0, W, H); ctx.restore();
      if (!aimingUp) drawWeapon(ctx, sx, handY, e.aim, e.def, e.radius);
      if (e.hasCrown) { ctx.font = "18px sans-serif"; ctx.textAlign = "center"; ctx.fillText("👑", sx, sy - H + e.radius * 0.55 - 8); }
      const bw = 44, bh = 5, by = sy - H + e.radius * 0.55 - (e.hasCrown ? 22 : 6); ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(sx - bw / 2, by, bw, bh); ctx.fillStyle = e.downed ? "#ff5a5a" : ally ? "#46e08a" : "#ff7a7a"; ctx.fillRect(sx - bw / 2, by, bw * clamp(e.downed ? e.bleed / 12 : e.hp / e.maxHp, 0, 1), bh);
      if (e.shield > 0 && !e.downed) { ctx.fillStyle = "#34e3ff"; ctx.fillRect(sx - bw / 2, by - 3, bw * clamp(e.shield / 300, 0, 1), 2); }
      ctx.font = "11px sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = e.isPlayer ? "#ffd24a" : ring; ctx.fillText(e.isPlayer ? "You" : e.name, sx, by - 7);
      if (e.downed) { ctx.fillStyle = "#ff5a5a"; ctx.font = "bold 12px sans-serif"; ctx.fillText("DOWN", sx, sy + e.radius + 14); if (ally && !e.isPlayer && this.player.alive && !this.player.downed && dist(e.x, e.y, this.player.x, this.player.y) < 110) { const pct = clamp(e.reviveProg / 2.5, 0, 1); ctx.fillStyle = "#46e08a"; ctx.font = "bold 11px sans-serif"; ctx.fillText("REVIVING…", sx, sy + e.radius + 28); if (pct > 0) { ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(sx - 24, sy + e.radius + 34, 48, 4); ctx.fillStyle = "#46e08a"; ctx.fillRect(sx - 24, sy + e.radius + 34, 48 * pct, 4); } } }
      if (ally && !e.isPlayer) { const cyy = by - 16 + Math.sin(this.t * 4 + e.id) * 2; ctx.fillStyle = "#46e08a"; ctx.strokeStyle = "#0a1018"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx - 8, cyy); ctx.lineTo(sx + 8, cyy); ctx.lineTo(sx, cyy + 9); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    }
    for (const p of this.particles) { const sx = p.x - cam.x, sy = p.y - cam.y; if (p.ring) { const f = p.life / 0.5; ctx.beginPath(); ctx.arc(sx, sy, p.maxR * (1 - f), 0, TAU); ctx.strokeStyle = p.color; ctx.globalAlpha = f; ctx.lineWidth = 3; ctx.stroke(); ctx.globalAlpha = 1; } else { ctx.globalAlpha = clamp(p.life * 2, 0, 1); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(sx, sy, p.r, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; } }
    if (this.flash > 0 && this.bolt) { ctx.strokeStyle = "rgba(220,230,255,.9)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(this.bolt[0].x - cam.x, this.bolt[0].y - cam.y); for (const b of this.bolt) ctx.lineTo(b.x - cam.x, b.y - cam.y); ctx.stroke(); ctx.fillStyle = `rgba(180,160,255,${this.flash * 0.6})`; ctx.fillRect(0, 0, w, h); }
    this.drawFog(cam);
    for (const m of this.motes) { ctx.globalAlpha = m.a; ctx.fillStyle = "#cfe2ff"; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1;
    const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.45)"); ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
    this.drawTeammateArrows(cam);
    if (this.mobile.on) { const drawStick = (s: any, col: string) => { if (s.id === null) return; ctx.globalAlpha = 0.5; ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(s.ox, s.oy, 64, 0, TAU); ctx.stroke(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(s.cx, s.cy, 26, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }; drawStick(this.mobile.move, "#34e3ff"); drawStick(this.mobile.aim, "#ff5da2"); }
    this.drawMinimap();
  }
  private drawTeammateArrows(cam: any) {
    const ctx = this.ctx, ref = this.camFollow || this.player; if (!ref) return;
    const w = this.canvas.width, h = this.canvas.height, cx = w / 2, cy = h / 2, t = this.player ? this.player.team : 0, mg = 58;
    for (const o of this.hunters) { if (!o.alive || o.team !== t || o === ref) continue; const sx = o.x - cam.x, sy = o.y - cam.y; if (sx >= 0 && sy >= 0 && sx <= w && sy <= h) continue; const ang = Math.atan2(sy - cy, sx - cx); const hw = cx - mg, hh = cy - mg; const d = Math.min(Math.abs(hw / Math.cos(ang)) || 1e9, Math.abs(hh / Math.sin(ang)) || 1e9); const ex = cx + Math.cos(ang) * d, ey = cy + Math.sin(ang) * d; const dm = Math.round(dist(o.x, o.y, ref.x, ref.y) / 10); ctx.save(); ctx.translate(ex, ey); ctx.fillStyle = o.downed ? "#ff5a5a" : "#46e08a"; ctx.strokeStyle = "#0a1018"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.fill(); ctx.stroke(); ctx.save(); ctx.rotate(ang); ctx.fillStyle = "#0a1018"; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(4, -6); ctx.lineTo(4, 6); ctx.closePath(); ctx.fill(); ctx.restore(); ctx.fillStyle = "#0a1018"; ctx.font = "bold 9px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText((o.name || "").slice(0, 4), 0, -1); ctx.fillStyle = o.downed ? "#ff5a5a" : "#46e08a"; ctx.font = "10px sans-serif"; ctx.fillText(`${o.downed ? "DOWN " : ""}${dm}m`, 0, 24); ctx.restore(); }
  }
  private drawMinimap() {
    const mmx = this.mmx, s = 160 / WORLD, z = this.zone;
    mmx.fillStyle = "#0a0e1a"; mmx.fillRect(0, 0, 160, 160);
    mmx.beginPath(); mmx.arc(z.cx * s, z.cy * s, z.r * s, 0, TAU); mmx.strokeStyle = "rgba(190,100,255,.8)"; mmx.lineWidth = 1.5; mmx.stroke();
    for (const pg of this.pings) { mmx.fillStyle = "#ffd24a"; mmx.fillRect(pg.x * s - 1.5, pg.y * s - 1.5, 3, 3); }
    for (const c of this.creeps) { if (!c.alive || !this.inVision(c.x, c.y)) continue; mmx.fillStyle = c.type === "boss" ? "#ff5a5a" : c.type === "miniboss" ? "#d36b9b" : "#9bd36b"; mmx.beginPath(); mmx.arc(c.x * s, c.y * s, c.type === "boss" ? 3.5 : c.type === "miniboss" ? 2.5 : 1.5, 0, TAU); mmx.fill(); }
    for (const e of this.hunters) { if (!e.alive) continue; const ally = e.team === this.player.team; if (!ally && !this.inVision(e.x, e.y)) continue; if (ally && !e.isPlayer) { mmx.fillStyle = "#46e08a"; mmx.beginPath(); mmx.arc(e.x * s, e.y * s, 3.5, 0, TAU); mmx.fill(); mmx.strokeStyle = "#0a1018"; mmx.lineWidth = 1; mmx.stroke(); continue; } mmx.fillStyle = e.isPlayer ? "#ffd24a" : "#ff5a5a"; mmx.beginPath(); mmx.arc(e.x * s, e.y * s, e.isPlayer ? 3 : 2, 0, TAU); mmx.fill(); }
    if (this.phase === "choose" && this.landX != null) { mmx.strokeStyle = "#34e3ff"; mmx.lineWidth = 2; mmx.beginPath(); mmx.arc(this.landX * s, this.landY! * s, 6 + Math.sin(this.t * 5) * 2, 0, TAU); mmx.stroke(); }
  }
  private drawDeployOverview() {
    const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
    ctx.imageSmoothingEnabled = true; ctx.fillStyle = "#060a12"; ctx.fillRect(0, 0, w, h);
    const pad = 70, scale = Math.min((w - pad * 2) / WORLD, (h - pad * 2) / WORLD), ox = (w - WORLD * scale) / 2, oy = (h - WORLD * scale) / 2;
    this.ovScale = scale; this.ovX = ox; this.ovY = oy;
    const X = (x: number) => ox + x * scale, Y = (y: number) => oy + y * scale;
    ctx.fillStyle = "#0c1626"; ctx.fillRect(ox, oy, WORLD * scale, WORLD * scale); ctx.strokeStyle = "rgba(255,255,255,.14)"; ctx.lineWidth = 2; ctx.strokeRect(ox, oy, WORLD * scale, WORLD * scale);
    ctx.strokeStyle = "rgba(52,227,255,.07)"; ctx.lineWidth = 1;
    for (let g = 0; g <= WORLD; g += 1000) { ctx.beginPath(); ctx.moveTo(X(g), oy); ctx.lineTo(X(g), oy + WORLD * scale); ctx.stroke(); ctx.beginPath(); ctx.moveTo(ox, Y(g)); ctx.lineTo(ox + WORLD * scale, Y(g)); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(X(this.zone.cx), Y(this.zone.cy), this.zone.r * scale, 0, TAU); ctx.strokeStyle = "rgba(190,100,255,.7)"; ctx.lineWidth = 2; ctx.stroke();
    for (const c of this.creeps) { if (!c.alive) continue; const col = c.type === "boss" ? "#ff5a5a" : c.type === "miniboss" ? "#d36b9b" : c.type === "leader" ? "#6bd3a0" : "#9bd36b", rad = c.type === "boss" ? 10 : c.type === "miniboss" ? 7 : c.type === "leader" ? 5 : 3; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(c.x), Y(c.y), rad, 0, TAU); ctx.fill(); if (c.type === "miniboss" || c.type === "boss") { ctx.fillStyle = col; ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center"; ctx.fillText(c.type === "boss" ? "BOSS" : "mini-boss", X(c.x), Y(c.y) - rad - 4); } }
    if (this.landX != null) { const sx = X(this.landX), sy = Y(this.landY!); ctx.strokeStyle = "#34e3ff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx, sy, 14 + Math.sin(this.t * 5) * 3, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(sx - 22, sy); ctx.lineTo(sx + 22, sy); ctx.moveTo(sx, sy - 22); ctx.lineTo(sx, sy + 22); ctx.globalAlpha = 0.5; ctx.stroke(); ctx.globalAlpha = 1; ctx.fillStyle = "#34e3ff"; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "center"; ctx.fillText("YOUR DROP", sx, sy - 22); }
    ctx.textAlign = "left"; ctx.font = "11px sans-serif";
    const lg = [["#9bd36b", "Creeps — basic gear"], ["#6bd3a0", "Packs — +1 upgraded piece"], ["#d36b9b", "Mini-boss — maxed gear"], ["#ff5a5a", "Boss (centre, late game) — Tier-4"]];
    lg.forEach((l, i) => { const ly = oy + 14 + i * 16; ctx.fillStyle = l[0]; ctx.beginPath(); ctx.arc(ox + 10, ly, 4, 0, TAU); ctx.fill(); ctx.fillStyle = "#c8d6f0"; ctx.fillText(l[1], ox + 20, ly + 4); });
  }

  // ---------- mobile ----------
  private updStick(s: any, x: number, y: number) { const dx = x - s.ox, dy = y - s.oy, mag = Math.hypot(dx, dy), R = 64, dead = 10; if (mag > dead) { const m = Math.min(mag, R); s.nx = (dx / mag) * (m / R); s.ny = (dy / mag) * (m / R); s.ang = Math.atan2(dy, dx); s.active = true; } else { s.nx = 0; s.ny = 0; s.active = false; } s.cx = x; s.cy = y; }
  private mobileTouch(e: any) {
    if (!this.mobile.on || this.phase === "choose") return; e.preventDefault();
    for (const t of e.changedTouches) { if (e.type !== "touchstart") continue; const left = t.clientX < innerWidth * 0.5; if (left && this.mobile.move.id === null) { this.mobile.move.id = t.identifier; this.mobile.move.ox = t.clientX; this.mobile.move.oy = t.clientY; this.updStick(this.mobile.move, t.clientX, t.clientY); } else if (!left && this.mobile.aim.id === null) { this.mobile.aim.id = t.identifier; this.mobile.aim.ox = t.clientX; this.mobile.aim.oy = t.clientY; this.updStick(this.mobile.aim, t.clientX, t.clientY); this.mobile.aim.firing = this.mobile.aim.active; } }
    for (const t of e.touches) { if (t.identifier === this.mobile.move.id) this.updStick(this.mobile.move, t.clientX, t.clientY); if (t.identifier === this.mobile.aim.id) { this.updStick(this.mobile.aim, t.clientX, t.clientY); this.mobile.aim.firing = this.mobile.aim.active; } }
  }
  private mobileTouchEnd(e: any) { for (const t of e.changedTouches) { if (t.identifier === this.mobile.move.id) { this.mobile.move.id = null; this.mobile.move.nx = 0; this.mobile.move.ny = 0; this.mobile.move.active = false; } if (t.identifier === this.mobile.aim.id) { this.mobile.aim.id = null; this.mobile.aim.active = false; this.mobile.aim.firing = false; } } }

  // ---------- networking ----------
  private hostStream(dt: number) { if (this.netrole === "host" && Net.count() > 0) { this.netAccum += dt; if (this.netAccum >= 1 / 12) { this.netAccum = 0; for (const id in Net.conns) Net.send(id, this.encodeSnapshot(id)); } } }
  // routed by Session (which owns Net.onData while the lobby is up)
  handleNet(fromId: string, msg: any) { try { if (Net.isHost) this.netHostData(fromId, msg); else this.netClientData(msg); } catch (e) { console.error("net data", e); } }
  handleClose(id: string) { try { if (Net.isHost) this.netHostClose(id); else this.netClientClose(); } catch (e) {} }
  private netHostData(fromId: string, msg: any) {
    if (msg.t === "in") { const h = this.hunters.find((x) => x.controlledBy === fromId); if (h) h._in = msg; }
    else if (msg.t === "land") { if (this.phase === "choose") { this.landX = msg.x; this.landY = msg.y; } }
    else if (msg.t === "chat") { this.addChatMsg(msg.name, msg.text); for (const id in Net.conns) if (id !== fromId) Net.send(id, { t: "chat", name: msg.name, text: msg.text }); }
    else if (msg.t === "replace") { const h = this.hunters.find((x) => x.controlledBy === fromId); if (h) { const it = this.nearestGroundItem(h, 110); if (it && !h.slots.find((s: any) => s.id === it.id) && h.slots.length >= MAX_SLOTS && msg.slot >= 0 && msg.slot < MAX_SLOTS) { h.slots[msg.slot] = { id: it.id, lvl: Math.min(3, it.lvl), t4: !!it.t4 }; h.recomputeGear(); const i = this.items.indexOf(it); if (i >= 0) this.items.splice(i, 1); } } }
  }
  private netHostClose(id: string) { this.netRoster = this.netRoster.filter((x) => x.id !== id); if (this.player) { const h = this.hunters.find((x) => x.controlledBy === id); if (h) { h.human = false; h.controlledBy = null; h._in = null; } } }
  private netHostAssign() {
    if (this.netrole !== "host") return;
    const team0 = this.hunters.filter((h) => h.team === 0);
    this.netRoster.forEach((mem, i) => { const h = team0[i]; if (!h) return; setHunterHid(h, mem.hunter); h.name = mem.name; if (mem.id !== "host") { h.isPlayer = false; h.human = true; h.controlledBy = mem.id; h._in = null; } });
    const names: any = {}; for (const h of this.hunters) names[h.id] = h.name;
    for (const id in Net.conns) { const me = this.hunters.find((h) => h.controlledBy === id); Net.send(id, { t: "init", youId: me ? me.id : null, names }); }
    this.netAccum = 0;
  }
  private applyRemoteControl(h: any, dt: number) {
    const inp = h._in; h.reviving = null; if (!inp) { h.moveX = 0; h.moveY = 0; return; }
    h.moveX = inp.mv ? inp.mv[0] : 0; h.moveY = inp.mv ? inp.mv[1] : 0; if (inp.aim != null) h.aim = inp.aim; if (h.downed) return;
    if (inp.fire) this.cast(h, "basic"); if (inp.q) this.cast(h, "q"); if (inp.e) this.cast(h, "e"); if (inp.r) this.cast(h, "r");
    if (inp.dash && h.cd.dash <= 0) { const a = h.aim; h.dashVx = Math.cos(a) * 900; h.dashVy = Math.sin(a) * 900; h.dashT = 0.2; h.cd.dash = 3; this.spawnBurst(h.x, h.y, h.def.color, 6); }
    if (inp.ping) { if (h.pingCd <= 0) { this.addPing(inp.ping[0], inp.ping[1], h.team, h); h.pingCd = 1; } inp.ping = null; }
    const ally = this.hunters.find((o) => o.team === h.team && o !== h && o.downed && dist(o.x, o.y, h.x, h.y) < 110);
    if (ally) { ally.reviveProg += dt; h.reviving = ally; if (ally.reviveProg >= 2.5) ally.reviveTo(); }
    else if (inp.act) { inp.act = false; const item = this.nearestGroundItem(h, 90); if (item) { const owned = h.slots.find((s: any) => s.id === item.id); if (owned || h.slots.length < MAX_SLOTS) this.equipItem(h, item); } }
  }
  private encodeSnapshot(forId: string) {
    const z = this.zone, H: any[] = [], P: any[] = [], A: any[] = [], I: any[] = [], PG: any[] = [];
    for (const e of this.hunters) { if (!e.alive) continue; let fl = 0; if (e.downed) fl |= 1; if (e.hasCrown) fl |= 2; if (e.snareStacks > 0) fl |= 4; if (e.dots.length) fl |= 8; if (e.shield > 0) fl |= 16; if (e.form === "shadow") fl |= 32; if (e.stunT > 0) fl |= 64; H.push([e.id, hidIdx(e.hid), e.team, e.x | 0, e.y | 0, Math.round(e.aim * 100), e.hp | 0, e.maxHp | 0, e.shield | 0, Math.round((e.downed ? e.bleed / 12 : 1) * 100), fl]); }
    for (const p of this.projectiles) P.push([p.x | 0, p.y | 0, p.radius, palIdx(p.color)]);
    for (const a of this.aoes) A.push([a.x | 0, a.y | 0, a.r | 0, Math.round((1 - a.t / a.max) * 100), palIdx(a.color)]);
    for (const it of this.items) I.push([gIdx(it.id), it.lvl, it.x | 0, it.y | 0, it.t4 ? 1 : 0]);
    for (const pg of this.pings) PG.push([pg.x | 0, pg.y | 0]);
    const Cr: any[] = []; for (const c of this.creeps) { if (!c.alive) continue; Cr.push([CREEP_IDS.indexOf(c.type), c.x | 0, c.y | 0, Math.round((c.hp / c.maxHp) * 100)]); }
    const me = this.hunters.find((h) => h.controlledBy === forId); const you = me ? { cd: me.cd, slots: me.slots, kills: me.kills } : null;
    return { t: "state", z: [z.cx | 0, z.cy | 0, z.r | 0, z.target | 0, z.stage, Math.ceil(z.nextShrink)], H, P, A, I, PG, Cr, you, ph: this.phase, dT: Math.max(0, Math.round(this.deployT * 10) / 10) };
  }
  private netClientData(msg: any) {
    switch (msg.t) {
      case "init": this.myHunterId = msg.youId; this.names = msg.names || {}; break;
      case "state": this.clientApplySnapshot(msg); break;
      case "feed": this.addFeed(msg.x); break;
      case "chat": this.addChatMsg(msg.name, msg.text); break;
      case "end": this.over = true; this.endScreenShow(msg.won, msg.place, msg.yourKills, msg.squadKills); break;
    }
  }
  private netClientClose() { if (!this.over) { this.over = true; this.endScreenShow(false, "—", this.player ? this.player.kills : 0, 0, "Host disconnected — match ended."); } }
  clientStartMatch() {
    Terrain.generate(); HUNTER_IDS.forEach((id) => (Sprites[id] = buildSprite(HUNTERS[id])));
    this.hunters = []; this.hmap = new Map(); this.projectiles = []; this.aoes = []; this.items = []; this.pings = []; this.particles = []; this.motes = []; this.swings = []; this.creeps = [];
    this.cam = { x: WORLD / 2 - this.canvas.width / 2, y: WORLD / 2 - this.canvas.height / 2 }; this.t = 0; this.over = false; this.names = {}; this.myHunterId = null; this.clientSwingCd = 0;
    this.phase = "choose"; this.deployT = 20; this.landX = null; this.landY = null; this.feed = []; this.chat = [];
    this.zone = { cx: WORLD / 2, cy: WORLD / 2, r: WORLD * 0.82, target: WORLD * 0.82, stage: 0, nextShrink: 40 };
    for (let i = 0; i < 60; i++) this.motes.push({ x: rand(0, this.canvas.width), y: rand(0, this.canvas.height), vx: rand(-8, 8), vy: rand(-14, -3), r: rand(0.6, 2), a: rand(0.1, 0.4) });
  }
  private clientApplySnapshot(snap: any) {
    const z = snap.z; this.zone = { cx: z[0], cy: z[1], r: z[2], target: z[3], stage: z[4], nextShrink: z[5] };
    if (snap.ph) this.phase = snap.ph; if (snap.dT != null) this.deployT = snap.dT;
    const seen = new Set<number>();
    for (const a of snap.H) {
      const id = a[0]; let h = this.hmap.get(id);
      if (!h) { h = { id, x: a[3], y: a[4], tx: a[3], ty: a[4], walkT: rand(0, 6), cd: {}, slots: [], kills: 0 }; this.hmap.set(id, h); }
      h.tx = a[3]; h.ty = a[4]; h.hid = HUNTER_IDS[a[1]] || "sable"; h.def = HUNTERS[h.hid]; h.radius = h.def.radius; h.team = a[2];
      h.aim = a[5] / 100; h.hp = a[6]; h.maxHp = a[7]; h.shield = a[8]; h.bleed = (a[9] / 100) * 12; const fl = a[10];
      h.downed = !!(fl & 1); h.hasCrown = !!(fl & 2); h.snareStacks = fl & 4 ? 3 : 0; h.dots = fl & 8 ? [1] : []; h.form = fl & 32 ? "shadow" : "holy"; h.stunT = fl & 64 ? 0.4 : 0;
      h.alive = true; h.reviving = null; h.isPlayer = id === this.myHunterId; h.name = h.isPlayer ? "You" : (this.names && this.names[id]) || "Hunter"; seen.add(id);
    }
    for (const id of [...this.hmap.keys()]) if (!seen.has(id)) this.hmap.delete(id);
    this.hunters = [...this.hmap.values()];
    if (this.myHunterId != null) this.player = this.hmap.get(this.myHunterId) || this.player;
    if (snap.you && this.player) { this.player.cd = snap.you.cd || {}; this.player.slots = snap.you.slots || []; this.player.kills = snap.you.kills || 0; }
    this.items = snap.I.map((a: any, i: number) => ({ id: GEAR_IDS[a[0]] || GEAR_IDS[0], lvl: a[1], x: a[2], y: a[3], t4: !!a[4], bob: i * 0.6 }));
    this.creeps = (snap.Cr || []).map((a: any, i: number) => { const type = CREEP_IDS[a[0]] || "little", cfg = CREEP_TYPES[type]; return { type, cfg, x: a[1], y: a[2], maxHp: cfg.hp, hp: (cfg.hp * a[3]) / 100, radius: cfg.r, color: cfg.color, alive: true, flash: 0, bob: i * 0.7 }; });
    this.projectiles = snap.P.map((a: any) => ({ x: a[0], y: a[1], radius: a[2], color: PALETTE[a[3]] || "#fff" }));
    this.aoes = snap.A.map((a: any) => ({ x: a[0], y: a[1], r: a[2], t: 1 - a[3] / 100, max: 1, color: PALETTE[a[4]] || "#fff" }));
    this.pings = snap.PG.map((a: any) => ({ x: a[0], y: a[1], t: 2, team: 0, by: null }));
  }
  private clientSendInput(dt: number) {
    const k = this.input.keys, r = this.player ? this.readMoveAim(this.player) : { mx: 0, my: 0, aim: 0, fire: false };
    const w = this.player ? this.worldMouse() : { x: 0, y: 0 };
    const able = this.player && this.player.alive && !this.player.downed;
    if (k.has("v")) { if (!this.clientVHeld) { this.clientVHeld = true; this.clientPing = [w.x | 0, w.y | 0]; Sfx.ping(1); } } else this.clientVHeld = false;
    if (k.has("f")) { if (!this.clientFHeld) { this.clientFHeld = true; const item = this.player && !this.replacePrompt && this.nearestGroundItem(this.player, 90); if (item && this.player.slots) { const owned = this.player.slots.find((x: any) => x.id === item.id); if (!owned && this.player.slots.length >= MAX_SLOTS) this.replacePrompt = { x: item.x, y: item.y, id: item.id, lvl: item.lvl, t4: item.t4 }; else this.clientAct = true; } else this.clientAct = true; } } else this.clientFHeld = false;
    ["q", "e", "r", " "].forEach((key) => { const down = k.has(key); if (able && down && !this.clientEdge[key]) { this.clientEdge[key] = true; (key === " " ? Sfx.dash : Sfx.cast)(0.7); } else if (!down) this.clientEdge[key] = false; });
    this.clientInAccum += dt; if (this.clientInAccum < 1 / 30) return; this.clientInAccum = 0;
    if (!Net.ready || !this.player) return;
    const msg: any = { t: "in", mv: [r.mx, r.my], aim: r.aim, fire: able && r.fire ? 1 : 0, q: able && k.has("q") ? 1 : 0, e: able && k.has("e") ? 1 : 0, r: able && k.has("r") ? 1 : 0, dash: able && k.has(" ") ? 1 : 0, fhold: k.has("f") ? 1 : 0 };
    if (this.clientPing) { msg.ping = this.clientPing; this.clientPing = null; }
    if (this.clientAct) { msg.act = 1; this.clientAct = false; }
    Net.toHost(msg);
  }
  private clientTick(dt: number) {
    this.t += dt; this.clientSendInput(dt); this.tickReplacePrompt(this.player);
    for (const h of this.hunters) { const moving = h.tx !== undefined && dist(h.x, h.y, h.tx, h.ty) > 0.5; if (h.tx !== undefined) { h.x = lerp(h.x, h.tx, clamp(dt * 16, 0, 1)); h.y = lerp(h.y, h.ty, clamp(dt * 16, 0, 1)); } h.moveX = moving ? 1 : 0; h.moveY = 0; if (moving) h.walkT += dt * 10; }
    if (this.player && this.phase !== "choose") { const w = this.worldMouse(); this.player.aim = angTo(this.player.x, this.player.y, w.x, w.y); }
    if (this.phase === "choose") this.updateDeployCamera(dt);
    else { const cf = this.player || this.camFollow; if (cf) { this.camFollow = cf; this.cam.x = lerp(this.cam.x, cf.x - this.canvas.width / 2, 0.12); this.cam.y = lerp(this.cam.y, cf.y - this.canvas.height / 2, 0.12); } }
    for (const m of this.motes) { m.x += m.vx * dt; m.y += m.vy * dt; if (m.y < -5) { m.y = this.canvas.height + 5; m.x = rand(0, this.canvas.width); } if (m.x < -5) m.x = this.canvas.width + 5; if (m.x > this.canvas.width + 5) m.x = -5; }
    for (let i = this.particles.length - 1; i >= 0; i--) { const p = this.particles[i]; p.life -= dt; if (!p.ring) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9; } if (p.life <= 0) this.particles.splice(i, 1); }
    for (let i = this.swings.length - 1; i >= 0; i--) { this.swings[i].t -= dt; if (this.swings[i].t <= 0) this.swings.splice(i, 1); }
    if (this.clientSwingCd > 0) this.clientSwingCd -= dt;
    if (this.player && this.player.alive && !this.player.downed && this.player.hid === "vanguard" && this.input.mdown && this.clientSwingCd <= 0) { this.spawnSwing(this.player, HUNTERS.vanguard.basic); this.clientSwingCd = HUNTERS.vanguard.basic.cd; }
  }
}
