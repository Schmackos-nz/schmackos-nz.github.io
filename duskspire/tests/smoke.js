// Node smoke test: loads the data modules (no DOM needed at load
// time) and validates sprite grids, card defs, enemy AI, relics,
// and map generation. Run: node tests/smoke.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console, Math, Object, Array, JSON, Error };
ctx.globalThis = ctx;
vm.createContext(ctx);
['sprites.js', 'cards.js', 'enemies.js', 'relics.js', 'map.js'].forEach(f => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
  vm.runInContext(src, ctx, { filename: f });
});
// top-level consts live in the context's lexical scope, not on the
// context object — pull them out with an in-context expression
const { Sprites, Cards, Enemies, Relics, GameMap } =
  vm.runInContext('({ Sprites, Cards, Enemies, Relics, GameMap })', ctx);
Object.assign(ctx, { Sprites, Cards, Enemies, Relics, GameMap });

let fails = 0;
const check = (ok, msg) => { if (!ok) { console.error('FAIL:', msg); fails++; } };

// ---- sprites: every grid char must be in the palette ----
const allDefs = { ...ctx.Sprites.DEFS, ...ctx.Sprites.ICONS };
Object.entries(allDefs).forEach(([name, def]) => {
  def.g.forEach((row, y) => {
    for (const ch of row) {
      if (ch === '.' || ch === ' ') continue;
      check(def.p[ch], `sprite '${name}' row ${y}: char '${ch}' (U+${ch.codePointAt(0).toString(16)}) not in palette`);
    }
  });
});

// ---- cards: descs render, icons exist, classes valid ----
const CLASSES = ['knight', 'huntress', 'arcanist', 'any'];
Object.values(ctx.Cards.DEFS).forEach(d => {
  check(CLASSES.includes(d.cls), `card ${d.id}: bad cls ${d.cls}`);
  check(ctx.Sprites.ICONS[d.icon], `card ${d.id}: missing icon ${d.icon}`);
  check(typeof d.cost === 'number', `card ${d.id}: no cost`);
  const inst = ctx.Cards.make(d.id);
  check(typeof ctx.Cards.descFor(inst) === 'string', `card ${d.id}: desc failed`);
  inst.up = true;
  check(typeof ctx.Cards.descFor(inst) === 'string', `card ${d.id}: upgraded desc failed`);
  check(typeof d.play === 'function', `card ${d.id}: no play()`);
});

// ---- starter decks and reward pools per class ----
['knight', 'huntress', 'arcanist'].forEach(cls => {
  check(ctx.Cards.starterDeck(cls).length === 10, `starter deck ${cls} != 10`);
  for (let i = 0; i < 20; i++) {
    const r = ctx.Cards.rollReward(cls, 3);
    check(r.length === 3, `reward roll ${cls} gave ${r.length}`);
    r.forEach(inst => {
      const d = ctx.Cards.DEFS[inst.id];
      check(d.cls === cls || d.cls === 'any', `reward for ${cls} leaked ${d.id} (${d.cls})`);
      check(d.rarity !== 'basic', `reward gave basic ${d.id}`);
    });
  }
  check(ctx.Relics.starterFor(cls), `no starter relic for ${cls}`);
});

// ---- enemies: sprites exist, ai returns sane intents ----
Object.values(ctx.Enemies.DEFS).forEach(d => {
  check(ctx.Sprites.DEFS[d.sprite], `enemy ${d.id}: missing sprite ${d.sprite}`);
  const e = ctx.Enemies.spawn(d.id);
  check(e.hp >= d.hp[0] && e.hp <= d.hp[1], `enemy ${d.id}: hp out of range`);
  for (let t = 1; t <= 8; t++) {
    const it = d.ai(e, t);
    check(it && ['attack', 'block', 'buff', 'debuff'].includes(it.type), `enemy ${d.id} turn ${t}: bad intent`);
    if (it.type === 'attack') check(typeof it.dmg === 'number', `enemy ${d.id}: attack without dmg`);
  }
});

// ---- encounters reference real enemies ----
['easy', 'hard', 'elite', 'boss'].forEach(kind => {
  for (let i = 0; i < 10; i++) {
    ctx.Enemies.rollEncounter(kind).forEach(id =>
      check(ctx.Enemies.DEFS[id], `encounter ${kind}: unknown enemy ${id}`));
  }
});

// ---- relics: icons exist, roll excludes owned ----
Object.values(ctx.Relics.DEFS).forEach(r =>
  check(ctx.Sprites.ICONS[r.icon], `relic ${r.id}: missing icon ${r.icon}`));
const owned = Object.keys(ctx.Relics.DEFS);
check(ctx.Relics.rollRelic(owned) === null, 'rollRelic should be null when all owned');

// ---- map: structure + full connectivity to boss ----
for (let i = 0; i < 30; i++) {
  const rows = ctx.GameMap.generate();
  check(rows.length === 15, 'map rows != 15');
  check(rows[14].length === 1 && rows[14][0].type === 'boss', 'no boss node');
  rows[13].forEach(n => check(n.type === 'rest', 'pre-boss row not all rest'));
  // every node in rows 1..14 has an incoming edge; every node's edges resolve
  for (let r = 0; r < 14; r++) {
    rows[r].forEach(n => {
      check(n.next.length >= 1, `node ${n.id} has no exits`);
      n.next.forEach(id => check(ctx.GameMap.byId(rows, id).row === r + 1, `edge ${n.id}->${id} skips a row`));
    });
    rows[r + 1].forEach(m =>
      check(rows[r].some(n => n.next.includes(m.id)), `node ${m.id} unreachable`));
  }
}

if (fails) { console.error(`\n${fails} check(s) failed`); process.exit(1); }
console.log('All smoke checks passed.');
