/* ============================================================
   STORMFALL — Arena Royale
   Top-down MOBA battle-royale. Single file engine.
   ============================================================ */
'use strict';

// ---------- math helpers ----------
const TAU = Math.PI * 2;
const rand  = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist2 = (x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; };
const dist  = (x1, y1, x2, y2) => Math.sqrt(dist2(x1, y1, x2, y2));
const lerp  = (a, b, t) => a + (b - a) * t;
function angTo(x1, y1, x2, y2){ return Math.atan2(y2 - y1, x2 - x1); }
function angDiff(a, b){ let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }

// ---------- world config ----------
const WORLD = 4200;
const SQUADS = 4;
const SQUAD_SIZE = 3;

// ---------- hunter roster ----------
const HUNTERS = {
  vanguard: {
    name:'Vanguard', emoji:'🛡️', color:'#ff8a3d', role:'Bruiser',
    maxHp:340, speed:215, radius:20,
    desc:'Front-line bruiser. Dashes into the fray, slams the ground and shrugs off hits with a barrier.',
    basic:{ key:'LMB', name:'Cleave', emoji:'⚔️', cd:0.5, kind:'cone', dmg:26, range:95, arc:1.4 },
    q:{ key:'Q', name:'Skewer', emoji:'➹', cd:6, kind:'dash', dmg:55, range:280, hitRange:90, arc:1.6 },
    e:{ key:'E', name:'Bulwark', emoji:'🛡️', cd:9, kind:'shield', amount:170, dur:5 },
    r:{ key:'R', name:'Seismic Slam', emoji:'💥', cd:22, kind:'aoe', dmg:120, radius:230, delay:0.45, self:true }
  },
  sable: {
    name:'Sable', emoji:'🏹', color:'#46e08a', role:'Marksman',
    maxHp:240, speed:235, radius:17,
    desc:'Precision marksman. Rapid bolts, a spread volley, an evasive roll and a map-wide piercing railshot.',
    basic:{ key:'LMB', name:'Bolt', emoji:'➶', cd:0.36, kind:'proj', dmg:20, speed:760, range:560, radius:7 },
    q:{ key:'Q', name:'Volley', emoji:'🎯', cd:5.5, kind:'burst', dmg:16, speed:680, range:520, radius:6, count:5, spread:0.5 },
    e:{ key:'E', name:'Evade', emoji:'💨', cd:5, kind:'dash', dmg:0, range:300, hitRange:0 },
    r:{ key:'R', name:'Railshot', emoji:'⚡', cd:20, kind:'proj', dmg:170, speed:1500, range:1600, radius:11, pierce:true }
  },
  ember: {
    name:'Ember', emoji:'🔥', color:'#ff5da2', role:'Mage',
    maxHp:230, speed:220, radius:17,
    desc:'Area mage. Lobs heavy embers, blinks out of danger, drops bombs on a point and rains a meteor storm.',
    basic:{ key:'LMB', name:'Ember', emoji:'🔥', cd:0.6, kind:'proj', dmg:30, speed:560, range:520, radius:9 },
    q:{ key:'Q', name:'Firebomb', emoji:'☄️', cd:6, kind:'aoe', dmg:70, radius:140, delay:0.5, atCursor:true },
    e:{ key:'E', name:'Blink', emoji:'🌀', cd:7, kind:'blink', range:340 },
    r:{ key:'R', name:'Meteor Storm', emoji:'🌠', cd:24, kind:'storm', dmg:65, radius:120, count:6, spread:230 }
  },
  lumen: {
    name:'Lumen', emoji:'✨', color:'#34e3ff', role:'Support',
    maxHp:250, speed:225, radius:17,
    desc:'Squad support. Heals allies, hastes the team, shields everyone and zaps from range.',
    basic:{ key:'LMB', name:'Spark', emoji:'✦', cd:0.5, kind:'proj', dmg:18, speed:700, range:520, radius:7 },
    q:{ key:'Q', name:'Mend', emoji:'💚', cd:7, kind:'heal', amount:120, radius:260 },
    e:{ key:'E', name:'Tailwind', emoji:'🌬️', cd:10, kind:'speed', mult:1.6, dur:4, radius:260 },
    r:{ key:'R', name:'Aegis', emoji:'🔆', cd:22, kind:'shieldAura', amount:150, dur:6, radius:320 }
  }
};
const HUNTER_IDS = Object.keys(HUNTERS);
const BOT_NAMES = ['Vex','Rook','Nyx','Kael','Juno','Bizz','Orin','Pax','Wren','Zia','Tov','Cyn','Dax','Echo','Fenn','Goro','Hux','Iri'];

// ============================================================
//  LOBBY
// ============================================================
const Lobby = {
  hunter: 'vanguard',
  squadSize: 1,
  partyCode: null,
  init(){
    // hunter cards
    const list = document.getElementById('hunterList');
    HUNTER_IDS.forEach(id => {
      const h = HUNTERS[id];
      const c = document.createElement('button');
      c.className = 'hunter-card' + (id === this.hunter ? ' active' : '');
      c.innerHTML = `<span class="hunter-emoji" style="background:${h.color}22;color:${h.color}">${h.emoji}</span>
        <span><b>${h.name}</b><small>${h.role}</small></span>`;
      c.onclick = () => { this.hunter = id; this.refresh(); };
      list.appendChild(c);
    });
    // squad size
    document.querySelectorAll('.size-btn').forEach(b => {
      b.onclick = () => { this.squadSize = +b.dataset.size; this.refresh(); };
    });
    document.getElementById('btnCreateParty').onclick = () => {
      this.partyCode = this.makeCode(); this.refresh();
    };
    document.getElementById('btnCopyCode').onclick = () => {
      if (this.partyCode){ navigator.clipboard?.writeText(this.partyCode);
        const b = document.getElementById('btnCopyCode'); b.textContent = 'Copied!'; setTimeout(()=>b.textContent='Copy',1200); }
    };
    document.getElementById('btnJoin').onclick = () => {
      const v = document.getElementById('joinInput').value.trim().toUpperCase();
      if (v.length === 6){ this.partyCode = v; this.refresh(); }
    };
    document.getElementById('btnPlay').onclick = () => startMatch();
    document.getElementById('btnReturn').onclick = () => {
      document.getElementById('game').classList.add('hidden');
      document.getElementById('menu').classList.remove('hidden');
      this.refresh();
    };
    this.refresh();
  },
  makeCode(){ let s=''; const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for(let i=0;i<6;i++) s+=A[randi(0,A.length-1)]; return s; },
  refresh(){
    document.querySelectorAll('.hunter-card').forEach((c,i)=>
      c.classList.toggle('active', HUNTER_IDS[i]===this.hunter));
    document.getElementById('hunterDesc').textContent = HUNTERS[this.hunter].desc;
    document.querySelectorAll('.size-btn').forEach(b=>
      b.classList.toggle('active', +b.dataset.size===this.squadSize));
    document.getElementById('partyCode').textContent = this.partyCode || '——————';
    // party slots
    const slots = document.getElementById('partySlots'); slots.innerHTML='';
    for (let i=0;i<this.squadSize;i++){
      const d=document.createElement('div');
      if(i===0){ d.className='slot you'; d.innerHTML=`<span class="dot"></span> You — ${HUNTERS[this.hunter].name}`; }
      else { d.className='slot bot'; d.innerHTML=`<span class="dot"></span> ${BOT_NAMES[i]} (AI fill)`; }
      slots.appendChild(d);
    }
    // crown banner
    const wins = +(localStorage.getItem('stormfall_wins')||0);
    const banner = document.getElementById('crownBanner');
    if (localStorage.getItem('stormfall_crown')==='1'){
      banner.classList.remove('hidden');
      document.getElementById('crownText').textContent =
        `Reigning Champion — ${wins} crown win${wins!==1?'s':''}. You carry 👑 into this match.`;
    } else banner.classList.add('hidden');
  }
};

// ============================================================
//  GAME STATE
// ============================================================
let G = null;
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const mm = document.getElementById('minimapCanvas');
const mmx = mm.getContext('2d');

const Input = { keys:new Set(), mx:0, my:0, mdown:false };
window.addEventListener('keydown', e => {
  Input.keys.add(e.key.toLowerCase());
  if ([' ','q','e','r','f','v'].includes(e.key.toLowerCase())) e.preventDefault();
});
window.addEventListener('keyup',   e => Input.keys.delete(e.key.toLowerCase()));
canvas.addEventListener('mousemove', e => {
  const r = canvas.getBoundingClientRect();
  Input.mx = e.clientX - r.left; Input.my = e.clientY - r.top;
});
canvas.addEventListener('mousedown', e => { if (e.button===0) Input.mdown = true; });
window.addEventListener('mouseup',   e => { if (e.button===0) Input.mdown = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());

function resize(){ canvas.width = innerWidth; canvas.height = innerHeight; }
window.addEventListener('resize', resize); resize();

// ============================================================
//  ENTITY
// ============================================================
let UID = 1;
class Hunter {
  constructor(hid, team, isPlayer, name){
    const h = HUNTERS[hid];
    this.id = UID++; this.hid = hid; this.def = h;
    this.team = team; this.isPlayer = isPlayer; this.name = name;
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.maxHp = h.maxHp; this.hp = h.maxHp; this.shield = 0;
    this.radius = h.radius; this.speed = h.speed; this.aim = 0;
    this.cd = { basic:0, q:0, e:0, r:0, dash:0 };
    this.alive = true; this.downed = false; this.bleed = 0;
    this.reviveProg = 0;
    this.dmgMul = 1; this.speedBuffT = 0; this.speedBuffMul = 1;
    this.dashVx = 0; this.dashVy = 0; this.dashT = 0;
    this.kills = 0; this.hasCrown = false;
    // AI
    this.aiTimer = 0; this.aiTarget = null; this.aiState='roam'; this.wander = rand(0,TAU);
    this.pingCd = 0;
  }
  get effSpeed(){ return this.speed * (this.speedBuffT>0 ? this.speedBuffMul : 1); }
  takeDamage(amt, src){
    if (!this.alive) return;
    if (this.shield > 0){ const a = Math.min(this.shield, amt); this.shield -= a; amt -= a; }
    if (amt <= 0) return;
    if (this.downed){ this.bleed -= amt*0.04; if (this.bleed<=0) this.die(src); return; }
    this.hp -= amt;
    if (this.hp <= 0){ this.hp = 0; this.goDown(src); }
  }
  goDown(src){
    // if no living teammate, die outright
    const matesUp = G.hunters.some(o => o.team===this.team && o!==this && o.alive && !o.downed);
    if (!matesUp){ this.die(src); return; }
    this.downed = true; this.bleed = 12; this.shield = 0;
    addFeed(`${src?src.name:'Storm'} downed ${this.name}`);
  }
  die(src){
    if (!this.alive) return;
    this.alive = false; this.downed = false;
    if (src && src!==this){ src.kills++; }
    addFeed(`${src&&src!==this?src.name:'The Storm'} eliminated ${this.name}`);
    spawnBurst(this.x, this.y, this.def.color, 22);
    // drop crown
    if (this.hasCrown && src){ this.hasCrown=false; src.hasCrown=true; }
    checkSquadWipe(this.team);
  }
  reviveTo(){ this.downed=false; this.hp = this.maxHp*0.4; this.bleed=0; this.reviveProg=0;
    addFeed(`${this.name} was revived`); }
}

function checkSquadWipe(team){
  const anyUp = G.hunters.some(o => o.team===team && (o.alive));
  // if all members fully dead, downed teammates already handled; nothing extra
}

// ============================================================
//  MATCH SETUP
// ============================================================
function startMatch(){
  document.getElementById('menu').classList.add('hidden');
  document.getElementById('game').classList.remove('hidden');
  document.getElementById('endScreen').classList.add('hidden');
  resize();

  G = {
    hunters:[], projectiles:[], aoes:[], items:[], pings:[], particles:[], feed:[],
    cam:{x:0,y:0}, t:0, over:false, placement:[],
    zone:{ cx:WORLD/2, cy:WORLD/2, r:WORLD*0.75, target:WORLD*0.75, nextShrink:18, stage:0 }
  };

  // spawn squads around the ring
  for (let s=0; s<SQUADS; s++){
    const ang = (s/SQUADS)*TAU + rand(-0.2,0.2);
    const sx = WORLD/2 + Math.cos(ang)*WORLD*0.34;
    const sy = WORLD/2 + Math.sin(ang)*WORLD*0.34;
    for (let m=0; m<SQUAD_SIZE; m++){
      const isPlayer = (s===0 && m===0);
      let hid, name;
      if (isPlayer){ hid = Lobby.hunter; name = 'You'; }
      else { hid = HUNTER_IDS[randi(0,HUNTER_IDS.length-1)];
             name = BOT_NAMES[randi(0,BOT_NAMES.length-1)] + (s===0?'':''); }
      const e = new Hunter(hid, s, isPlayer, name);
      e.x = sx + rand(-70,70); e.y = sy + rand(-70,70);
      if (isPlayer && localStorage.getItem('stormfall_crown')==='1') e.hasCrown = true;
      G.hunters.push(e);
    }
  }
  G.player = G.hunters.find(h=>h.isPlayer);

  // scatter items
  for (let i=0;i<46;i++) spawnItem();

  buildAbilityBar();
  G.feedEl = document.getElementById('killfeed');
  lastT = performance.now();
  requestAnimationFrame(loop);
}

const ITEM_TYPES = [
  { t:'medkit', emoji:'✚', color:'#46e08a', label:'Medkit' },
  { t:'shield', emoji:'🛡️', color:'#34e3ff', label:'Shield Cell' },
  { t:'damage', emoji:'⚔️', color:'#ff5da2', label:'Power Core' },
  { t:'speed',  emoji:'👟', color:'#ffd24a', label:'Swift Boots' },
  { t:'haste',  emoji:'⏱️', color:'#b07dff', label:'Haste Chip' },
];
function spawnItem(x,y,type){
  const it = type || ITEM_TYPES[randi(0,ITEM_TYPES.length-1)];
  const r = rand(0, WORLD*0.42), a = rand(0,TAU);
  G.items.push({
    ...it,
    x: x ?? (WORLD/2 + Math.cos(a)*r),
    y: y ?? (WORLD/2 + Math.sin(a)*r),
    bob: rand(0,TAU)
  });
}

// ============================================================
//  ABILITY CASTING
// ============================================================
function cast(ent, slot){
  const def = ent.def[slot];
  if (ent.cd[slot] > 0) return false;
  const cdMul = ent.hasteT>0 ? 0.6 : 1;
  ent.cd[slot] = def.cd * cdMul;
  const ax = Math.cos(ent.aim), ay = Math.sin(ent.aim);

  switch(def.kind){
    case 'proj':
      fireProj(ent, def, ent.aim); break;
    case 'burst': {
      const start = ent.aim - def.spread/2;
      for (let i=0;i<def.count;i++)
        fireProj(ent, def, start + def.spread*(i/(def.count-1||1)));
      break; }
    case 'cone':
      coneHit(ent, def); spawnArc(ent.x+ax*40, ent.y+ay*40, ent.def.color); break;
    case 'dash': {
      ent.dashVx = ax * (def.range*4); ent.dashVy = ay * (def.range*4);
      ent.dashT = 0.25;
      if (def.hitRange>0){ setTimeout(()=>{ if(ent.alive) coneHit(ent, def); }, 120); }
      spawnBurst(ent.x, ent.y, ent.def.color, 8);
      break; }
    case 'blink': {
      ent.x = clamp(ent.x + ax*def.range, 40, WORLD-40);
      ent.y = clamp(ent.y + ay*def.range, 40, WORLD-40);
      spawnBurst(ent.x, ent.y, ent.def.color, 14);
      break; }
    case 'shield':
      ent.shield = Math.max(ent.shield, def.amount); break;
    case 'aoe': {
      let tx = ent.x, ty = ent.y;
      if (def.atCursor){ tx = ent.x + ax*200; ty = ent.y + ay*200;
        if (ent.isPlayer){ tx = worldMouse().x; ty = worldMouse().y; }
        else if (ent.aiTarget){ tx = ent.aiTarget.x; ty = ent.aiTarget.y; } }
      addAoe(ent, tx, ty, def.radius, def.dmg, def.delay); break; }
    case 'storm': {
      let tx = ent.x + ax*250, ty = ent.y + ay*250;
      if (ent.isPlayer){ tx = worldMouse().x; ty = worldMouse().y; }
      else if (ent.aiTarget){ tx = ent.aiTarget.x; ty = ent.aiTarget.y; }
      for (let i=0;i<def.count;i++){
        const dx = rand(-def.spread,def.spread), dy = rand(-def.spread,def.spread);
        setTimeout(()=>{ if(G&&!G.over) addAoe(ent, tx+dx, ty+dy, def.radius, def.dmg, 0.5); }, i*180);
      }
      break; }
    case 'heal':
      G.hunters.forEach(o=>{ if(o.team===ent.team && o.alive && dist(o.x,o.y,ent.x,ent.y)<def.radius){
        if(o.downed){ o.bleed=Math.min(12,o.bleed+5); } else o.hp=Math.min(o.maxHp,o.hp+def.amount); }});
      spawnRing(ent.x,ent.y,def.radius,'#46e08a'); break;
    case 'speed':
      G.hunters.forEach(o=>{ if(o.team===ent.team && o.alive && dist(o.x,o.y,ent.x,ent.y)<def.radius){
        o.speedBuffT=def.dur; o.speedBuffMul=def.mult; }});
      spawnRing(ent.x,ent.y,def.radius,'#ffd24a'); break;
    case 'shieldAura':
      G.hunters.forEach(o=>{ if(o.team===ent.team && o.alive && !o.downed && dist(o.x,o.y,ent.x,ent.y)<def.radius){
        o.shield=Math.max(o.shield,def.amount); }});
      spawnRing(ent.x,ent.y,def.radius,'#34e3ff'); break;
  }
  return true;
}

function fireProj(ent, def, ang){
  G.projectiles.push({
    x:ent.x+Math.cos(ang)*ent.radius, y:ent.y+Math.sin(ang)*ent.radius,
    vx:Math.cos(ang)*def.speed, vy:Math.sin(ang)*def.speed,
    dmg:def.dmg*ent.dmgMul, team:ent.team, owner:ent,
    radius:def.radius, life:def.range/def.speed, pierce:!!def.pierce,
    color:ent.def.color, hits:new Set()
  });
}
function coneHit(ent, def){
  G.hunters.forEach(o=>{
    if (o.team===ent.team || !o.alive) return;
    if (dist(o.x,o.y,ent.x,ent.y) <= def.range + o.radius){
      if (Math.abs(angDiff(angTo(ent.x,ent.y,o.x,o.y), ent.aim)) <= def.arc/2){
        o.takeDamage(def.dmg*ent.dmgMul, ent); spawnBurst(o.x,o.y,'#fff',6);
      }
    }
  });
}
function addAoe(ent, x, y, r, dmg, delay){
  G.aoes.push({ x, y, r, dmg:dmg*ent.dmgMul, team:ent.team, owner:ent, t:delay, max:delay, color:ent.def.color });
}

// ============================================================
//  CONTROL — player input & AI both feed into this
// ============================================================
function controlPlayer(p, dt){
  // movement
  let mx=0,my=0;
  if (Input.keys.has('w')) my-=1; if (Input.keys.has('s')) my+=1;
  if (Input.keys.has('a')) mx-=1; if (Input.keys.has('d')) mx+=1;
  const ml = Math.hypot(mx,my)||1; p.moveX=mx/ml; p.moveY=my/ml;
  // aim
  const w = worldMouse(); p.aim = angTo(p.x,p.y,w.x,w.y);
  // downed: crawl only, no attacks/abilities
  if (p.downed){ p.reviving=null; return; }
  // attacks
  if (Input.mdown) cast(p,'basic');
  if (Input.keys.has('q')) cast(p,'q');
  if (Input.keys.has('e')) cast(p,'e');
  if (Input.keys.has('r')) cast(p,'r');
  if (Input.keys.has(' ') && p.cd.dash<=0){ doDash(p); }
  if (Input.keys.has('v') && p.pingCd<=0){ addPing(w.x,w.y,p.team,p); p.pingCd=1; Input.keys.delete('v'); }
  // revive
  p.reviving=null;
  if (Input.keys.has('f')){
    const ally=G.hunters.find(o=>o.team===p.team&&o!==p&&o.downed&&dist(o.x,o.y,p.x,p.y)<80);
    if (ally){ ally.reviveProg+=dt; p.reviving=ally; if(ally.reviveProg>=2.5) ally.reviveTo(); }
  }
}
function doDash(p){
  const a=p.aim; p.dashVx=Math.cos(a)*900; p.dashVy=Math.sin(a)*900;
  p.dashT=0.2; p.cd.dash=3; spawnBurst(p.x,p.y,p.def.color,6);
}

// ---------- AI ----------
function controlAI(e, dt){
  e.moveX=0; e.moveY=0; e.reviving=null;
  e.aiTimer -= dt;
  const inStorm = dist(e.x,e.y,G.zone.cx,G.zone.cy) > G.zone.r;

  // find nearest enemy
  let foe=null, fd=1e9;
  for (const o of G.hunters){
    if (o.team===e.team || !o.alive) continue;
    const d=dist2(e.x,e.y,o.x,o.y);
    if (d<fd){ fd=d; foe=o; } }
  fd=Math.sqrt(fd);
  // downed ally
  let downAlly=null, dad=1e9;
  for (const o of G.hunters){
    if (o.team===e.team && o!==e && o.downed){ const d=dist(e.x,e.y,o.x,o.y); if(d<dad){dad=d;downAlly=o;} } }

  let goalX=null, goalY=null, doFight=false;

  if (e.downed){
    // crawl toward nearest standing ally
    let ally=null,ad=1e9;
    for(const o of G.hunters) if(o.team===e.team&&o.alive&&!o.downed){const d=dist(e.x,e.y,o.x,o.y);if(d<ad){ad=d;ally=o;}}
    if(ally){ goalX=ally.x; goalY=ally.y; }
  }
  else if (inStorm){ goalX=G.zone.cx; goalY=G.zone.cy; }
  else if (e.hp < e.maxHp*0.32 && foe && fd<420){
    // retreat from foe, seek medkit
    const med = nearestItem(e, 'medkit');
    if (med){ goalX=med.x; goalY=med.y; }
    else { goalX = e.x + (e.x-foe.x); goalY = e.y + (e.y-foe.y); }
  }
  else if (downAlly && dad<520 && (!foe || fd>320)){
    goalX=downAlly.x; goalY=downAlly.y;
    if (dad<76){ downAlly.reviveProg+=dt; e.reviving=downAlly; if(downAlly.reviveProg>=2.8) downAlly.reviveTo(); }
  }
  else if (foe && fd<760){
    doFight=true; e.aiTarget=foe;
    const ranged = e.def.basic.kind==='proj';
    const ideal = ranged ? 320 : 60;
    const a = angTo(e.x,e.y,foe.x,foe.y);
    e.aim = a + rand(-0.05,0.05);
    if (fd>ideal+40){ goalX=foe.x; goalY=foe.y; }
    else if (fd<ideal-40){ goalX=e.x-(foe.x-e.x); goalY=e.y-(foe.y-e.y); }
    else { // strafe
      e.moveX=Math.cos(a+Math.PI/2)*( (e.id%2)?1:-1 );
      e.moveY=Math.sin(a+Math.PI/2)*( (e.id%2)?1:-1 );
    }
    // abilities
    cast(e,'basic');
    if (fd<540) cast(e,'q');
    if (e.hp<e.maxHp*0.6) cast(e,'e');
    if (fd<460) cast(e,'r');
    if (e.def.q.kind==='heal'||e.def.e.kind==='speed'){ cast(e,'q'); cast(e,'e'); }
  }
  else {
    // loot / roam
    const item = nearestNeededItem(e);
    if (item){ goalX=item.x; goalY=item.y; }
    else {
      if (e.aiTimer<=0){ e.wander=rand(0,TAU); e.aiTimer=rand(1.5,3); }
      goalX = clamp(e.x+Math.cos(e.wander)*200, 100, WORLD-100);
      goalY = clamp(e.y+Math.sin(e.wander)*200, 100, WORLD-100);
      // bias toward zone center
      goalX = lerp(goalX, G.zone.cx, 0.3); goalY = lerp(goalY, G.zone.cy, 0.3);
    }
  }

  if (goalX!==null){
    const a=angTo(e.x,e.y,goalX,goalY);
    if (dist(e.x,e.y,goalX,goalY)>20){ e.moveX=Math.cos(a); e.moveY=Math.sin(a); }
    if (!doFight) e.aim = a;
  }

  // friendly AI ping items it doesn't need (only player's squad, so player sees it)
  if (e.team===G.player.team && e.pingCd<=0){
    for (const it of G.items){
      if (dist(e.x,e.y,it.x,it.y)<70 && !aiNeedsItem(e,it)){
        addPing(it.x,it.y,e.team,e); e.pingCd=rand(4,8); break;
      }
    }
  }
}
function nearestItem(e,type){ let best=null,bd=1e9;
  for(const it of G.items){ if(type&&it.t!==type)continue; const d=dist2(e.x,e.y,it.x,it.y); if(d<bd){bd=d;best=it;} }
  return Math.sqrt(bd)<700?best:null; }
function nearestNeededItem(e){ let best=null,bd=1e9;
  for(const it of G.items){ if(!aiNeedsItem(e,it))continue; const d=dist2(e.x,e.y,it.x,it.y); if(d<bd){bd=d;best=it;} }
  return Math.sqrt(bd)<800?best:null; }
function aiNeedsItem(e,it){
  if (it.t==='medkit') return e.hp < e.maxHp*0.85;
  if (it.t==='shield') return e.shield < 120;
  return true; // power/speed/haste always useful
}

// ============================================================
//  PICKUPS / PINGS / EFFECTS
// ============================================================
function applyItem(e, it){
  switch(it.t){
    case 'medkit': e.hp=Math.min(e.maxHp,e.hp+90); break;
    case 'shield': e.shield=Math.min(e.shield+90,200); break;
    case 'damage': e.dmgMul+=0.12; spawnRing(e.x,e.y,40,'#ff5da2'); break;
    case 'speed':  e.speedBuffT=8; e.speedBuffMul=1.35; break;
    case 'haste':  e.hasteT=10; break;
  }
  spawnBurst(e.x,e.y,it.color,8);
}
function addPing(x,y,team,by){ G.pings.push({x,y,team,t:4,by}); }
function addFeed(txt){
  const el=document.createElement('div'); el.className='kf'; el.textContent=txt;
  G.feedEl.prepend(el);
  while(G.feedEl.children.length>5) G.feedEl.lastChild.remove();
  setTimeout(()=>el.remove(),5000);
}
function spawnBurst(x,y,color,n){ for(let i=0;i<n;i++){ const a=rand(0,TAU),s=rand(40,200);
  G.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rand(.3,.6),color,r:rand(2,4)}); } }
function spawnArc(x,y,color){ spawnBurst(x,y,color,5); }
function spawnRing(x,y,r,color){ G.particles.push({ring:true,x,y,r,maxR:r,life:.5,color}); }

// ============================================================
//  UPDATE
// ============================================================
function update(dt){
  const G_=G; const z=G.zone;
  G.t += dt;

  // zone shrink
  z.nextShrink -= dt;
  if (z.nextShrink<=0 && z.target>WORLD*0.06){
    z.stage++; z.target=Math.max(WORLD*0.06, z.target*0.62);
    z.nextShrink = Math.max(10, 18 - z.stage*1.5);
    addFeed('⚠ The storm is closing in');
  }
  z.r = lerp(z.r, z.target, dt*0.5);

  // entities
  for (const e of G.hunters){
    if (!e.alive) continue;
    // timers
    for (const k in e.cd) if (e.cd[k]>0) e.cd[k]-=dt;
    if (e.speedBuffT>0) e.speedBuffT-=dt;
    if (e.hasteT>0) e.hasteT-=dt;
    if (e.pingCd>0) e.pingCd-=dt;
    if (e.reviveProg>0 && !e.beingRevivedThisFrame) e.reviveProg=Math.max(0,e.reviveProg-dt*0.5);
    e.beingRevivedThisFrame=false;

    // control
    if (e.isPlayer) controlPlayer(e,dt); else controlAI(e,dt);

    // bleed out
    if (e.downed){ e.bleed-=dt; if(e.bleed<=0) e.die(null); }

    // movement
    const spd = e.downed ? e.effSpeed*0.35 : e.effSpeed;
    if (e.dashT>0){ e.x+=e.dashVx*dt; e.y+=e.dashVy*dt; e.dashT-=dt; }
    else { e.x += (e.moveX||0)*spd*dt; e.y += (e.moveY||0)*spd*dt; }
    e.x=clamp(e.x,e.radius,WORLD-e.radius); e.y=clamp(e.y,e.radius,WORLD-e.radius);

    // storm damage
    if (dist(e.x,e.y,z.cx,z.cy) > z.r){ e.takeDamage((8+z.stage*4)*dt, null); }

    // item pickup
    for (let i=G.items.length-1;i>=0;i--){
      const it=G.items[i];
      if (dist(e.x,e.y,it.x,it.y) < e.radius+14){
        if (e.isPlayer || aiNeedsItem(e,it)){ applyItem(e,it); G.items.splice(i,1); }
      }
    }
  }
  // mark revive targets
  for (const e of G.hunters){ if(e.reviving){ e.reviving.beingRevivedThisFrame=true; } }

  // projectiles
  for (let i=G.projectiles.length-1;i>=0;i--){
    const p=G.projectiles[i];
    p.x+=p.vx*dt; p.y+=p.vy*dt; p.life-=dt;
    let dead=p.life<=0 || p.x<0||p.y<0||p.x>WORLD||p.y>WORLD;
    if (!dead) for (const o of G.hunters){
      if (o.team===p.team||!o.alive||p.hits.has(o.id)) continue;
      if (dist(p.x,p.y,o.x,o.y) < o.radius+p.radius){
        o.takeDamage(p.dmg, p.owner); spawnBurst(p.x,p.y,p.color,5);
        p.hits.add(o.id);
        if (!p.pierce){ dead=true; break; }
      }
    }
    if (dead) G.projectiles.splice(i,1);
  }
  // aoes
  for (let i=G.aoes.length-1;i>=0;i--){
    const a=G.aoes[i]; a.t-=dt;
    if (a.t<=0){
      for (const o of G.hunters){ if(o.team===a.team||!o.alive)continue;
        if (dist(a.x,a.y,o.x,o.y)<a.r+o.radius) o.takeDamage(a.dmg,a.owner); }
      spawnBurst(a.x,a.y,a.color,18); spawnRing(a.x,a.y,a.r,a.color);
      G.aoes.splice(i,1);
    }
  }
  // pings
  for (let i=G.pings.length-1;i>=0;i--){ G.pings[i].t-=dt; if(G.pings[i].t<=0) G.pings.splice(i,1); }
  // particles
  for (let i=G.particles.length-1;i>=0;i--){ const p=G.particles[i]; p.life-=dt;
    if(!p.ring){ p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=0.9; p.vy*=0.9; }
    if(p.life<=0) G.particles.splice(i,1); }

  // respawn items over time to keep map stocked
  if (G.items.length<30 && Math.random()<dt*1.5){
    // spawn within current zone
    const a=rand(0,TAU), r=rand(0,z.r*0.8);
    spawnItem(z.cx+Math.cos(a)*r, z.cy+Math.sin(a)*r);
  }

  // camera — follow player, or a living teammate if player is dead (spectate)
  let cf = G.player.alive ? G.player : G.hunters.find(o=>o.team===G.player.team && o.alive) || G.player;
  G.cam.x=lerp(G.cam.x, cf.x-canvas.width/2, 0.12);
  G.cam.y=lerp(G.cam.y, cf.y-canvas.height/2, 0.12);

  // win/lose
  checkEnd();
  updateHUD();
}

function worldMouse(){ return { x:Input.mx+G.cam.x, y:Input.my+G.cam.y }; }

function checkEnd(){
  if (G.over) return;
  const teamsAlive=new Set();
  for (const e of G.hunters) if (e.alive) teamsAlive.add(e.team);
  const playerAlive = G.hunters.some(e=>e.isPlayer&&e.alive) ||
                      G.hunters.some(e=>e.team===G.player.team&&e.alive);
  // track placement: when a team dies record it (handled implicitly)
  if (teamsAlive.size<=1){
    G.over=true;
    const won = teamsAlive.has(G.player.team) && G.player.alive;
    const playerSquadWon = teamsAlive.has(G.player.team);
    setTimeout(()=>showEnd(playerSquadWon), 700);
  } else if (!G.hunters.some(e=>e.team===G.player.team && e.alive)) {
    // player's whole squad eliminated
    G.over=true;
    G.placeWhenDead = teamsAlive.size+1;
    setTimeout(()=>showEnd(false), 700);
  }
}

function showEnd(won){
  const place = won ? 1 : (G.placeWhenDead || (new Set(G.hunters.filter(e=>e.alive).map(e=>e.team)).size+1));
  document.getElementById('endScreen').classList.remove('hidden');
  document.getElementById('endIcon').textContent = won ? '👑' : '💀';
  document.getElementById('endTitle').textContent = won ? 'VICTORY' : 'DEFEATED';
  document.getElementById('endSub').textContent = won
    ? 'Your squad is the last team standing. The crown is yours.'
    : `Your squad placed #${place} of ${SQUADS}.`;
  const kills = G.hunters.filter(e=>e.team===G.player.team).reduce((a,e)=>a+e.kills,0);
  document.getElementById('endStats').innerHTML =
    `<div><b>#${won?1:place}</b><span>Placement</span></div>
     <div><b>${G.player.kills}</b><span>Your Kills</span></div>
     <div><b>${kills}</b><span>Squad Kills</span></div>`;
  // crown persistence
  if (won){
    localStorage.setItem('stormfall_crown','1');
    localStorage.setItem('stormfall_wins', (+(localStorage.getItem('stormfall_wins')||0)+1));
  } else {
    localStorage.setItem('stormfall_crown','0');
  }
}

// ============================================================
//  HUD
// ============================================================
function buildAbilityBar(){
  const bar=document.getElementById('abilityBar'); bar.innerHTML='';
  const p=G.player; ['dash','q','e','r'].forEach(slot=>{
    const def = slot==='dash' ? {key:'SPC',emoji:'💨',name:'Dash'} : p.def[slot];
    const el=document.createElement('div'); el.className='ab'; el.dataset.slot=slot;
    el.innerHTML=`<span class="key">${def.key}</span><span class="emoji">${def.emoji}</span><span class="cool hidden"></span>`;
    bar.appendChild(el);
  });
  // basic too
  const b=document.createElement('div'); b.className='ab'; b.dataset.slot='basic';
  b.innerHTML=`<span class="key">LMB</span><span class="emoji">${p.def.basic.emoji}</span><span class="cool hidden"></span>`;
  bar.prepend(b);
}
function updateHUD(){
  const p=G.player;
  const alive=G.hunters.filter(e=>e.alive).length;
  const squads=new Set(G.hunters.filter(e=>e.alive).map(e=>e.team)).size;
  document.getElementById('aliveCount').textContent=alive;
  document.getElementById('squadCount').textContent=squads;
  document.getElementById('zoneTimer').textContent =
    G.zone.target<=WORLD*0.07 ? 'Final zone!' : `Storm closes in ${Math.ceil(G.zone.nextShrink)}s`;

  // squad panel
  const panel=document.getElementById('squadPanel'); panel.innerHTML='';
  G.hunters.filter(e=>e.team===p.team).forEach(e=>{
    const d=document.createElement('div');
    d.className='mate'+(e.downed?' downed':'')+(!e.alive?' dead':'');
    const hpPct=clamp(e.hp/e.maxHp*100,0,100);
    d.innerHTML=`<div class="mate-name"><span>${e.isPlayer?'You':e.name} ${e.hasCrown?'👑':''}</span>
      <span class="tag">${e.def.name}${e.downed?' · DOWN':''}</span></div>
      <div class="bar"><i style="width:${e.alive?hpPct:0}%"></i></div>`;
    panel.appendChild(d);
  });

  // ability cooldowns
  document.querySelectorAll('.ab').forEach(el=>{
    const slot=el.dataset.slot; const cd=p.cd[slot]||0;
    const cool=el.querySelector('.cool');
    if (cd>0.05){ cool.classList.remove('hidden'); cool.textContent=cd.toFixed(1); el.classList.remove('ready'); }
    else { cool.classList.add('hidden'); el.classList.add('ready'); }
  });

  document.getElementById('downedBanner').classList.toggle('hidden', !p.downed);
}

// ============================================================
//  RENDER
// ============================================================
function draw(){
  const w=canvas.width,h=canvas.height,cam=G.cam;
  ctx.fillStyle='#070b14'; ctx.fillRect(0,0,w,h);

  // grid
  ctx.strokeStyle='rgba(52,227,255,.05)'; ctx.lineWidth=1;
  const gs=80;
  for(let x=-cam.x%gs;x<w;x+=gs){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
  for(let y=-cam.y%gs;y<h;y+=gs){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}

  // world border
  ctx.strokeStyle='rgba(255,255,255,.08)'; ctx.lineWidth=4;
  ctx.strokeRect(-cam.x,-cam.y,WORLD,WORLD);

  // zone (storm) — draw darkened outside
  const z=G.zone;
  ctx.save();
  ctx.beginPath(); ctx.rect(0,0,w,h);
  ctx.arc(z.cx-cam.x, z.cy-cam.y, z.r, 0, TAU, true);
  ctx.fillStyle='rgba(150,40,200,.16)'; ctx.fill('evenodd');
  ctx.restore();
  ctx.beginPath(); ctx.arc(z.cx-cam.x,z.cy-cam.y,z.r,0,TAU);
  ctx.strokeStyle='rgba(180,90,255,.7)'; ctx.lineWidth=3; ctx.stroke();
  // next zone target
  ctx.beginPath(); ctx.arc(z.cx-cam.x,z.cy-cam.y,z.target,0,TAU);
  ctx.strokeStyle='rgba(255,255,255,.25)'; ctx.setLineDash([8,8]); ctx.lineWidth=2; ctx.stroke(); ctx.setLineDash([]);

  // items
  for(const it of G.items){ const sx=it.x-cam.x, sy=it.y-cam.y;
    if(sx<-40||sy<-40||sx>w+40||sy>h+40) continue;
    const bob=Math.sin(G.t*3+it.bob)*3;
    ctx.beginPath(); ctx.arc(sx,sy+bob,11,0,TAU);
    ctx.fillStyle=it.color+'33'; ctx.fill();
    ctx.strokeStyle=it.color; ctx.lineWidth=2; ctx.stroke();
    ctx.font='13px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle='#fff'; ctx.fillText(it.emoji, sx, sy+bob+1);
  }

  // aoe telegraphs
  for(const a of G.aoes){ const sx=a.x-cam.x, sy=a.y-cam.y;
    const f=1-a.t/a.max;
    ctx.beginPath(); ctx.arc(sx,sy,a.r,0,TAU);
    ctx.fillStyle=a.color+'22'; ctx.fill();
    ctx.beginPath(); ctx.arc(sx,sy,a.r*f,0,TAU);
    ctx.strokeStyle=a.color; ctx.lineWidth=3; ctx.stroke();
  }

  // pings
  for(const pg of G.pings){ const sx=pg.x-cam.x, sy=pg.y-cam.y;
    const pulse=1+Math.sin(G.t*8)*0.15;
    ctx.beginPath(); ctx.arc(sx,sy,16*pulse,0,TAU);
    ctx.strokeStyle='#ffd24a'; ctx.lineWidth=3; ctx.stroke();
    ctx.fillStyle='#ffd24a'; ctx.font='16px sans-serif'; ctx.textAlign='center';
    ctx.fillText('⚑', sx, sy-22);
  }

  // projectiles
  for(const p of G.projectiles){ const sx=p.x-cam.x, sy=p.y-cam.y;
    ctx.beginPath(); ctx.arc(sx,sy,p.radius,0,TAU);
    ctx.fillStyle=p.color; ctx.shadowColor=p.color; ctx.shadowBlur=10; ctx.fill(); ctx.shadowBlur=0;
  }

  // entities
  for(const e of G.hunters){
    if(!e.alive) continue;
    const sx=e.x-cam.x, sy=e.y-cam.y;
    if(sx<-60||sy<-60||sx>w+60||sy>h+60) continue;
    const ally = e.team===G.player.team;
    const ring = e.isPlayer ? '#ffd24a' : ally ? '#46e08a' : '#ff5a5a';

    // revive link
    if (e.reviving){ ctx.beginPath(); ctx.moveTo(sx,sy);
      ctx.lineTo(e.reviving.x-cam.x, e.reviving.y-cam.y);
      ctx.strokeStyle='rgba(70,224,138,.6)'; ctx.lineWidth=3; ctx.stroke(); }

    // shield ring
    if (e.shield>0){ ctx.beginPath(); ctx.arc(sx,sy,e.radius+6,0,TAU);
      ctx.strokeStyle='rgba(52,227,255,.8)'; ctx.lineWidth=3; ctx.stroke(); }

    // body
    ctx.beginPath(); ctx.arc(sx,sy,e.radius,0,TAU);
    ctx.fillStyle = e.downed ? '#5a2230' : e.def.color;
    ctx.fill();
    ctx.lineWidth=3; ctx.strokeStyle=ring; ctx.stroke();

    // aim indicator
    if (!e.downed){ ctx.beginPath(); ctx.moveTo(sx,sy);
      ctx.lineTo(sx+Math.cos(e.aim)*(e.radius+12), sy+Math.sin(e.aim)*(e.radius+12));
      ctx.strokeStyle=ring; ctx.lineWidth=3; ctx.stroke(); }

    // emoji
    ctx.font=`${e.radius+2}px sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(e.def.emoji, sx, sy+1);

    // crown
    if (e.hasCrown){ ctx.font='18px sans-serif'; ctx.fillText('👑', sx, sy-e.radius-16); }

    // hp bar
    const bw=42, bh=5, by=sy-e.radius-10;
    ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(sx-bw/2,by,bw,bh);
    ctx.fillStyle = e.downed ? '#ff5a5a' : ally?'#46e08a':'#ff7a7a';
    const hpf = e.downed ? e.bleed/12 : e.hp/e.maxHp;
    ctx.fillRect(sx-bw/2,by,bw*clamp(hpf,0,1),bh);
    if (e.shield>0){ ctx.fillStyle='#34e3ff'; ctx.fillRect(sx-bw/2,by-3,bw*clamp(e.shield/200,0,1),2); }

    // name
    ctx.font='11px sans-serif'; ctx.fillStyle = e.isPlayer?'#ffd24a':ring;
    ctx.fillText(e.isPlayer?'You':e.name, sx, by-8);

    // downed marker
    if (e.downed){ ctx.fillStyle='#ff5a5a'; ctx.font='bold 12px sans-serif';
      ctx.fillText('DOWN', sx, sy+e.radius+12); }
  }

  // particles
  for(const p of G.particles){ const sx=p.x-cam.x, sy=p.y-cam.y;
    if (p.ring){ const f=p.life/0.5; ctx.beginPath();
      ctx.arc(sx,sy,p.maxR*(1-f),0,TAU); ctx.strokeStyle=p.color; ctx.globalAlpha=f; ctx.lineWidth=3; ctx.stroke(); ctx.globalAlpha=1; }
    else { ctx.globalAlpha=clamp(p.life*2,0,1); ctx.fillStyle=p.color;
      ctx.beginPath(); ctx.arc(sx,sy,p.r,0,TAU); ctx.fill(); ctx.globalAlpha=1; }
  }

  drawMinimap();
}

function drawMinimap(){
  const s=160/WORLD;
  mmx.fillStyle='#0a0e1a'; mmx.fillRect(0,0,160,160);
  // zone
  const z=G.zone;
  mmx.beginPath(); mmx.arc(z.cx*s,z.cy*s,z.r*s,0,TAU);
  mmx.strokeStyle='rgba(180,90,255,.8)'; mmx.lineWidth=1.5; mmx.stroke();
  // items (player squad pings only as dots)
  for(const pg of G.pings){ mmx.fillStyle='#ffd24a'; mmx.fillRect(pg.x*s-1.5,pg.y*s-1.5,3,3); }
  // hunters
  for(const e of G.hunters){ if(!e.alive)continue;
    const ally=e.team===G.player.team;
    mmx.fillStyle = e.isPlayer?'#ffd24a':ally?'#46e08a':'#ff5a5a';
    mmx.beginPath(); mmx.arc(e.x*s,e.y*s, e.isPlayer?3:2,0,TAU); mmx.fill();
  }
}

// ============================================================
//  LOOP
// ============================================================
let lastT=0;
function loop(now){
  const dt=Math.min(0.05,(now-lastT)/1000); lastT=now;
  if (G && !G.over){ update(dt); }
  else if (G && G.over){ /* keep rendering frozen-ish */ }
  if (G){ if(!G.over) {} draw(); }
  requestAnimationFrame(loop);
}

// boot
Lobby.init();
