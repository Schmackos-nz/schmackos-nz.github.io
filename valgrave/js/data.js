// ---------- Item & recipe definitions ----------
const ITEMS = {
  wood:        { name:'Wood',            w:1.0 },
  stone:       { name:'Stone',           w:2.0 },
  iron:        { name:'Iron',            w:2.0 },
  hide:        { name:'Hide',            w:1.0 },
  troll_hide:  { name:'Troll Hide',      w:3.0 },
  raw_meat:    { name:'Raw Meat',        w:0.5 },
  cooked_meat: { name:'Cooked Meat',     w:0.5, food:{ heal:30 } },
  berries:     { name:'Berries',         w:0.2, food:{ heal:8 } },
  mead:        { name:'Healing Mead',    w:1.0, food:{ heal:55 } },
  coin:        { name:'Coin',            w:0.02 },
  relic:       { name:'Ancient Relic',   w:4.0, sell:40 },
  arrow:       { name:'Arrow',           w:0.1 },

  club:        { name:'Club',            w:4, weapon:{ dmg:7,  range:2.6, cd:0.6 } },
  flint_axe:   { name:'Flint Axe',       w:5, weapon:{ dmg:13, range:2.6, cd:0.55 }, tool:true },
  iron_sword:  { name:'Iron Sword',      w:6, weapon:{ dmg:26, range:2.9, cd:0.45 } },
  crude_bow:   { name:'Crude Bow',       w:4, bow:{ dmg:12 } },
  hunts_bow:   { name:'Huntsman Bow',    w:5, bow:{ dmg:22 } },
  leather_armor:{ name:'Leather Armor',  w:8,  armor:0.25 },
  iron_armor:  { name:'Iron Armor',      w:14, armor:0.45 },
  troll_armor: { name:'Troll Hide Armor',w:10, armor:0.60 },
};

// station: null = campfire (always), 'workbench', 'forge'
const RECIPES = [
  { id:'club',         qty:1,  req:{ wood:6 },                station:null },
  { id:'crude_bow',    qty:1,  req:{ wood:10 },               station:null },
  { id:'arrow',        qty:8,  req:{ wood:3 },                station:null },
  { id:'cooked_meat',  qty:1,  req:{ raw_meat:1 },            station:null },
  { id:'flint_axe',    qty:1,  req:{ wood:4, stone:6 },       station:'workbench' },
  { id:'leather_armor',qty:1,  req:{ hide:6 },                station:'workbench' },
  { id:'mead',         qty:1,  req:{ berries:5 },             station:'workbench' },
  { id:'iron_sword',   qty:1,  req:{ wood:2, iron:6 },        station:'forge' },
  { id:'hunts_bow',    qty:1,  req:{ wood:8, iron:3 },        station:'forge' },
  { id:'iron_armor',   qty:1,  req:{ iron:10, hide:2 },       station:'forge' },
  { id:'troll_armor',  qty:1,  req:{ troll_hide:4, hide:4 },  station:'forge' },
];

const STATIONS = [
  { id:'workbench', name:'Workbench', req:{ wood:10, stone:5 },           needs:null,        desc:'Unlocks flint tools, leather armor, mead.' },
  { id:'forge',     name:'Forge',     req:{ wood:10, stone:20, iron:5 },  needs:'workbench', desc:'Unlocks iron weapons & armor.' },
];

const TRADER = [
  { id:'arrow',       qty:10, cost:15 },
  { id:'cooked_meat', qty:3,  cost:12 },
  { id:'iron',        qty:3,  cost:30 },
  { id:'mead',        qty:1,  cost:25 },
];

const RAID_TIME = 540;        // seconds before the storm
const WEIGHT_CAP = 80;

// ---------- tiny inventory helpers (inventories are {itemId: qty}) ----------
const Inv = {
  add(inv, id, q) { inv[id] = (inv[id] || 0) + q; if (inv[id] <= 0) delete inv[id]; },
  has(inv, req)   { return Object.keys(req).every(k => (inv[k] || 0) >= req[k]); },
  pay(inv, req)   { for (const k in req) Inv.add(inv, k, -req[k]); },
  weight(inv)     { let w = 0; for (const k in inv) w += ITEMS[k].w * inv[k]; return w; },
  merge(into, from) { for (const k in from) Inv.add(into, k, from[k]); },
  count(inv)      { return Object.keys(inv).length; },
};
