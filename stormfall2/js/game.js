/* ============================================================
   STORMFALL — Arena Royale
   Top-down MOBA battle-royale. Canvas engine.
   ============================================================ */
'use strict';

// ---------- math ----------
const TAU = Math.PI * 2;
const rand  = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist2 = (x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; };
const dist  = (x1, y1, x2, y2) => Math.sqrt(dist2(x1, y1, x2, y2));
const lerp  = (a, b, t) => a + (b - a) * t;
function angTo(x1, y1, x2, y2){ return Math.atan2(y2 - y1, x2 - x1); }
function angDiff(a, b){ let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
function shade(hex, amt){
  let h = hex.replace('#',''); if (h.length===3) h = h.split('').map(c=>c+c).join('');
  let r=parseInt(h.slice(0,2),16), g=parseInt(h.slice(2,4),16), b=parseInt(h.slice(4,6),16);
  if (amt>=0){ r=lerp(r,255,amt); g=lerp(g,255,amt); b=lerp(b,255,amt); }
  else { const a=-amt; r=lerp(r,0,a); g=lerp(g,0,a); b=lerp(b,0,a); }
  return `rgb(${r|0},${g|0},${b|0})`;
}

// ---------- world ----------
const WORLD = 12000;          // ~8x area of the original map
const SQUADS = 32;            // keeps player density ~constant on the bigger map
const SQUAD_SIZE = 3;
const SPEED_SCALE = 0.82;     // slower, more tactical pacing
const MAX_SLOTS = 4;

// ---------- hunters ----------
const HUNTERS = {
  vanguard: {
    name:'Vanguard', emoji:'🛡️', color:'#ff8a3d', role:'Bruiser', weapon:'sword',
    maxHp:340, speed:205, radius:21,
    desc:'Front-line bruiser. Dashes into the fray, slams the ground and shrugs off hits with a barrier.',
    basic:{ key:'LMB', name:'Cleave', emoji:'⚔️', cd:0.5, kind:'cone', dmg:26, range:100, arc:1.4 },
    q:{ key:'Q', name:'Skewer', emoji:'➹', cd:6, kind:'dash', dmg:55, range:300, hitRange:95, arc:1.6 },
    e:{ key:'E', name:'Bulwark', emoji:'🛡️', cd:9, kind:'shield', amount:170, dur:5 },
    r:{ key:'R', name:'Seismic Slam', emoji:'💥', cd:22, kind:'aoe', dmg:120, radius:240, delay:0.45, self:true }
  },
  sable: {
    name:'Sable', emoji:'🏹', color:'#46e08a', role:'Marksman', weapon:'bow',
    maxHp:240, speed:225, radius:18,
    desc:'Precision marksman. Rapid bolts, a spread volley, an evasive roll and a map-wide piercing railshot.',
    basic:{ key:'LMB', name:'Bolt', emoji:'➶', cd:0.36, kind:'proj', dmg:20, speed:780, range:620, radius:7 },
    q:{ key:'Q', name:'Volley', emoji:'🎯', cd:5.5, kind:'burst', dmg:16, speed:700, range:560, radius:6, count:5, spread:0.5 },
    e:{ key:'E', name:'Evade', emoji:'💨', cd:5, kind:'dash', dmg:0, range:330, hitRange:0 },
    r:{ key:'R', name:'Railshot', emoji:'⚡', cd:20, kind:'proj', dmg:170, speed:1500, range:2000, radius:11, pierce:true }
  },
  ember: {
    name:'Ember', emoji:'🔥', color:'#ff5da2', role:'Mage', weapon:'staff',
    maxHp:230, speed:212, radius:18,
    desc:'Area mage. Lobs heavy embers, blinks out of danger, drops bombs on a point and rains a meteor storm.',
    basic:{ key:'LMB', name:'Ember', emoji:'🔥', cd:0.6, kind:'proj', dmg:30, speed:580, range:560, radius:9 },
    q:{ key:'Q', name:'Firebomb', emoji:'☄️', cd:6, kind:'aoe', dmg:70, radius:150, delay:0.5, atCursor:true },
    e:{ key:'E', name:'Blink', emoji:'🌀', cd:7, kind:'blink', range:360 },
    r:{ key:'R', name:'Meteor Storm', emoji:'🌠', cd:24, kind:'storm', dmg:65, radius:130, count:6, spread:250 }
  },
  lumen: {
    name:'Lumen', emoji:'✨', color:'#34e3ff', role:'Support', weapon:'staff',
    maxHp:250, speed:218, radius:18,
    desc:'Squad support. Heals allies, hastes the team, shields everyone and zaps from range.',
    basic:{ key:'LMB', name:'Spark', emoji:'✦', cd:0.5, kind:'proj', dmg:18, speed:720, range:560, radius:7 },
    q:{ key:'Q', name:'Mend', emoji:'💚', cd:7, kind:'heal', amount:120, radius:280 },
    e:{ key:'E', name:'Tailwind', emoji:'🌬️', cd:10, kind:'speed', mult:1.6, dur:4, radius:280 },
    r:{ key:'R', name:'Aegis', emoji:'🔆', cd:22, kind:'shieldAura', amount:150, dur:6, radius:340 }
  }
};
const HUNTER_IDS = Object.keys(HUNTERS);
const BOT_NAMES = ['Vex','Rook','Nyx','Kael','Juno','Bizz','Orin','Pax','Wren','Zia','Tov','Cyn','Dax','Echo','Fenn','Goro','Hux','Iri','Lux','Mira','Nox','Onyx','Pyre','Quill','Raze','Sol','Thane','ULL','Vail','Wisp'];

// ---------- equippable gear ----------
// A handful of items. Equipping a dup upgrades it (different effects per level).
// Every item boosts damage or shield.
const GEAR = {
  razor:   { name:'Razor',         emoji:'⚔️', color:'#ff5da2', kind:'Damage',
    levels:[{dmg:.15},{dmg:.30},{dmg:.50, atk:.82}],
    blurb:['+15% damage','+30% damage','+50% damage & faster attacks'] },
  emberlens:{name:'Ember Lens',     emoji:'🔮', color:'#ff8a3d', kind:'Damage',
    levels:[{dmg:.10,abil:.15},{dmg:.20,abil:.30},{dmg:.35,abil:.55}],
    blurb:['+10% dmg, +15% ability power','+20% dmg, +30% ability power','+35% dmg, +55% ability power'] },
  fang:    { name:'Vampiric Fang',  emoji:'🩸', color:'#e8466a', kind:'Damage',
    levels:[{dmg:.10},{dmg:.20,steal:.08},{dmg:.35,steal:.16}],
    blurb:['+10% damage','+20% dmg, 8% lifesteal','+35% dmg, 16% lifesteal'] },
  bulwark: { name:'Bulwark',        emoji:'🛡️', color:'#34e3ff', kind:'Shield',
    levels:[{sh:80},{sh:160},{sh:260, regen:14}],
    blurb:['+80 shield','+160 shield','+260 shield that regenerates'] },
  titan:   { name:'Titan Plate',    emoji:'🪨', color:'#b07dff', kind:'Shield',
    levels:[{sh:60},{sh:130,dr:.08},{sh:220,dr:.16}],
    blurb:['+60 shield','+130 shield, 8% resist','+220 shield, 16% resist'] },
};
const GEAR_IDS = Object.keys(GEAR);

// ---------- ability descriptions (tooltips) ----------
function abilityDesc(def){
  const d = def;
  switch (d.kind){
    case 'proj':  return `Fires ${d.pierce?'a piercing ':'a '}bolt for <b>${d.dmg}</b> damage.`;
    case 'burst': return `Looses ${d.count} bolts in a spread, <b>${d.dmg}</b> each.`;
    case 'cone':  return `Cleaves enemies in front for <b>${d.dmg}</b> damage.`;
    case 'dash':  return d.dmg>0 ? `Dashes forward, striking for <b>${d.dmg}</b> damage.` : `Quick evasive dash in your aim direction.`;
    case 'blink': return `Teleports instantly to your cursor.`;
    case 'shield':return `Gain a <b>${d.amount}</b>-point shield for ${d.dur}s.`;
    case 'aoe':   return `Calls a blast ${d.atCursor?'at your cursor':'around you'} dealing <b>${d.dmg}</b> in an area.`;
    case 'storm': return `Rains ${d.count} meteors, <b>${d.dmg}</b> damage each, over a wide area.`;
    case 'heal':  return `Heals your squad for <b>${d.amount}</b> HP nearby.`;
    case 'speed': return `Hastes your squad (+${Math.round((d.mult-1)*100)}% move speed) for ${d.dur}s.`;
    case 'shieldAura': return `Shields your whole squad for <b>${d.amount}</b> for ${d.dur}s.`;
  }
  return '';
}
const DASH_DESC = 'Burst of speed in your aim direction. Dodge danger or close gaps.';

// ============================================================
//  LOBBY
// ============================================================
const Lobby = {
  hunter:'vanguard', squadSize:1, partyCode:null,
  init(){
    const list = document.getElementById('hunterList');
    HUNTER_IDS.forEach(id => {
      const h = HUNTERS[id];
      const c = document.createElement('button');
      c.className = 'hunter-card' + (id===this.hunter?' active':'');
      c.innerHTML = `<span class="hunter-emoji" style="background:${h.color}22;color:${h.color}">${h.emoji}</span>
        <span><b>${h.name}</b><small>${h.role}</small></span>`;
      c.onclick = () => { Sfx.click(); this.hunter = id; this.refresh(); };
      list.appendChild(c);
    });
    document.querySelectorAll('.size-btn').forEach(b =>
      b.onclick = () => { Sfx.click(); this.squadSize = +b.dataset.size; this.refresh(); });
    document.getElementById('btnCreateParty').onclick = () => { Sfx.click(); this.partyCode = this.makeCode(); this.refresh(); };
    document.getElementById('btnCopyCode').onclick = () => {
      Sfx.click();
      if (this.partyCode){ navigator.clipboard?.writeText(this.partyCode);
        const b = document.getElementById('btnCopyCode'); b.textContent='Copied!'; setTimeout(()=>b.textContent='Copy',1200); }
    };
    const ji = document.getElementById('joinInput');
    ji.addEventListener('input', () => { ji.value = ji.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6); });
    const doJoin = () => {
      Sfx.click();
      const v = ji.value.trim().toUpperCase();
      const btn = document.getElementById('btnJoin');
      if (v.length===6){ this.partyCode = v; this.refresh();
        btn.textContent='Joined!'; setTimeout(()=>btn.textContent='Join',1200); }
      else { btn.textContent='6 chars'; setTimeout(()=>btn.textContent='Join',1000); }
    };
    document.getElementById('btnJoin').onclick = doJoin;
    ji.addEventListener('keydown', e => { if (e.key==='Enter') doJoin(); });
    document.getElementById('btnPlay').onclick = () => { Sfx.click(); startMatch(); };
    document.getElementById('btnReturn').onclick = () => {
      Sfx.click();
      document.getElementById('game').classList.add('hidden');
      document.getElementById('menu').classList.remove('hidden');
      this.refresh();
    };
    this.refresh();
  },
  makeCode(){ let s=''; const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; for(let i=0;i<6;i++) s+=A[randi(0,A.length-1)]; return s; },
  refresh(){
    document.querySelectorAll('.hunter-card').forEach((c,i)=>c.classList.toggle('active', HUNTER_IDS[i]===this.hunter));
    document.getElementById('hunterDesc').textContent = HUNTERS[this.hunter].desc;
    document.querySelectorAll('.size-btn').forEach(b=>b.classList.toggle('active', +b.dataset.size===this.squadSize));
    document.getElementById('partyCode').textContent = this.partyCode || '——————';
    const slots = document.getElementById('partySlots'); slots.innerHTML='';
    for (let i=0;i<this.squadSize;i++){
      const d=document.createElement('div');
      if (i===0){ d.className='slot you'; d.innerHTML=`<span class="dot"></span> You — ${HUNTERS[this.hunter].name}`; }
      else { d.className='slot bot'; d.innerHTML=`<span class="dot"></span> ${BOT_NAMES[i]} (AI fill)`; }
      slots.appendChild(d);
    }
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
//  STATE & INPUT
// ============================================================
let G = null;
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const mm = document.getElementById('minimapCanvas');
const mmx = mm.getContext('2d');

const Input = { keys:new Set(), mx:0, my:0, mdown:false };
function typingInField(e){ const t=(e.target.tagName||'').toLowerCase(); return t==='input'||t==='textarea'; }
window.addEventListener('keydown', e => {
  if (typingInField(e)) return;            // don't hijack keys while typing a party code
  Input.keys.add(e.key.toLowerCase());
  if ([' ','q','e','r','f','v'].includes(e.key.toLowerCase())) e.preventDefault();
});
window.addEventListener('keyup', e => Input.keys.delete(e.key.toLowerCase()));
canvas.addEventListener('mousemove', e => { const r=canvas.getBoundingClientRect(); Input.mx=e.clientX-r.left; Input.my=e.clientY-r.top; });
canvas.addEventListener('mousedown', e => { if(e.button===0) Input.mdown=true; });
window.addEventListener('mouseup', e => { if(e.button===0) Input.mdown=false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
function resize(){ canvas.width=innerWidth; canvas.height=innerHeight; }
window.addEventListener('resize', resize); resize();

function worldMouse(){ return { x:Input.mx+G.cam.x, y:Input.my+G.cam.y }; }
function volAt(x,y){ const c=G.camFollow||G.player; return clamp(1 - dist(x,y,c.x,c.y)/1500, 0, 1); }

// ============================================================
//  SPRITES (procedural pixel characters)
// ============================================================
const Sprites = {};
function buildSprite(h){
  const c=document.createElement('canvas'); c.width=16; c.height=18;
  const x=c.getContext('2d');
  const col=h.color, dark=shade(col,-0.4), light=shade(col,0.35), skin='#f1c9a0';
  // legs
  x.fillStyle=dark; x.fillRect(5,14,2,3); x.fillRect(9,14,2,3);
  // body
  x.fillStyle=col;  x.fillRect(4,8,8,7);
  x.fillStyle=light;x.fillRect(4,8,8,2);
  x.fillStyle=dark; x.fillRect(4,12,8,1);
  // arms
  x.fillStyle=col;  x.fillRect(3,9,1,4); x.fillRect(12,9,1,4);
  // head
  x.fillStyle=skin; x.fillRect(5,3,6,6);
  // helmet/hair
  x.fillStyle=dark; x.fillRect(5,3,6,2); x.fillRect(4,4,1,3); x.fillRect(11,4,1,3);
  // eyes
  x.fillStyle='#222'; x.fillRect(6,6,1,1); x.fillRect(9,6,1,1);
  return c;
}
function drawWeapon(g, sx, sy, aim, h, sc){
  g.save(); g.translate(sx, sy); g.rotate(aim);
  const col=h.color, d=shade(col,-0.3);
  if (h.weapon==='sword'){
    g.fillStyle=shade(col,0.5); g.fillRect(8*sc,-1.4*sc, 12*sc, 2.8*sc);
    g.fillStyle=d; g.fillRect(6*sc,-3*sc, 3*sc, 6*sc);
  } else if (h.weapon==='bow'){
    g.strokeStyle=shade(col,0.3); g.lineWidth=2*sc;
    g.beginPath(); g.arc(8*sc,0, 7*sc, -1.1, 1.1); g.stroke();
    g.strokeStyle='#eee'; g.lineWidth=1*sc;
    g.beginPath(); g.moveTo(8*sc+Math.cos(-1.1)*7*sc, Math.sin(-1.1)*7*sc);
    g.lineTo(8*sc+Math.cos(1.1)*7*sc, Math.sin(1.1)*7*sc); g.stroke();
  } else { // staff
    g.strokeStyle=shade('#7a5230',0.1); g.lineWidth=2*sc;
    g.beginPath(); g.moveTo(4*sc,0); g.lineTo(15*sc,0); g.stroke();
    g.fillStyle=shade(col,0.4); g.beginPath(); g.arc(16*sc,0,3*sc,0,TAU); g.fill();
  }
  g.restore();
}

// ============================================================
//  TERRAIN
// ============================================================
const Terrain = {
  size:220, cols:0, rows:0, tiles:[], props:[],
  _f(a,b){ const s=Math.sin(a*127.1+b*311.7)*43758.5453; return s-Math.floor(s); },
  noise(i,j){
    let v=0, amp=0.6, sc=0.15;
    for (let o=0;o<3;o++){
      const x=i*sc, y=j*sc, xi=Math.floor(x), yi=Math.floor(y), xf=x-xi, yf=y-yi;
      const tl=this._f(xi,yi), tr=this._f(xi+1,yi), bl=this._f(xi,yi+1), br=this._f(xi+1,yi+1);
      const u=xf*xf*(3-2*xf), w=yf*yf*(3-2*yf);
      const top=tl+(tr-tl)*u, bot=bl+(br-bl)*u;
      v += (top+(bot-top)*w)*amp; amp*=0.5; sc*=2;
    }
    return v;
  },
  sample(x,y){ return this.noise(x/this.size, y/this.size); },
  colorFor(hv,i,j){
    const jit = (this._f(i*3.1,j*1.7)-0.5)*0.06;
    if (hv<0.30) return {c:'#16324f', w:true};
    if (hv<0.37) return {c:'#1e4d70', w:true};
    if (hv<0.43) return {c:'#c3b079', w:false};
    if (hv<0.52) return {c:shade('#2f6b3a',jit), w:false};
    if (hv<0.74) return {c:shade('#3c8a4a',jit), w:false};
    if (hv<0.88) return {c:shade('#4fa85c',jit), w:false};
    return {c:shade('#6a6f7c',jit), w:false};
  },
  generate(){
    this.cols=Math.ceil(WORLD/this.size); this.rows=this.cols; this.tiles=[]; this.props=[];
    for (let j=0;j<this.rows;j++) for (let i=0;i<this.cols;i++)
      this.tiles.push(this.colorFor(this.noise(i,j),i,j));
    const count=Math.floor(WORLD*WORLD/55000);
    for (let k=0;k<count;k++){
      const x=rand(0,WORLD), y=rand(0,WORLD), hv=this.sample(x,y);
      if (hv<0.46) continue;
      const r=Math.random();
      const type = r<0.42?'tree': r<0.66?'rock': r<0.86?'bush':'flower';
      this.props.push({x,y,type,s:rand(0.8,1.35),h:Math.random()});
    }
    this.props.sort((a,b)=>a.y-b.y);
  },
  draw(g,cam,w,hgt,t){
    const s=this.size;
    const i0=Math.max(0,Math.floor(cam.x/s)), i1=Math.min(this.cols-1,Math.ceil((cam.x+w)/s));
    const j0=Math.max(0,Math.floor(cam.y/s)), j1=Math.min(this.rows-1,Math.ceil((cam.y+hgt)/s));
    for (let j=j0;j<=j1;j++) for (let i=i0;i<=i1;i++){
      const tl=this.tiles[j*this.cols+i]; if(!tl) continue;
      const x=i*s-cam.x, y=j*s-cam.y;
      g.fillStyle=tl.c; g.fillRect(x,y,s+1,s+1);
      if (tl.w){ g.globalAlpha=0.10+0.06*Math.sin(t*1.5+i*0.7+j*0.5);
        g.fillStyle='#bfe6ff'; g.fillRect(x,y,s+1,s+1); g.globalAlpha=1; }
    }
  },
  drawProps(g,cam,w,hgt){
    for (const p of this.props){
      const sx=p.x-cam.x, sy=p.y-cam.y;
      if (sx<-60||sy<-80||sx>w+60||sy>hgt+60) continue;
      g.fillStyle='rgba(0,0,0,.22)';
      g.beginPath(); g.ellipse(sx, sy+4, 9*p.s, 4*p.s, 0,0,TAU); g.fill();
      if (p.type==='tree'){
        g.fillStyle='#6b4a2b'; g.fillRect(sx-2*p.s, sy-6*p.s, 4*p.s, 12*p.s);
        const gc = p.h<0.5?'#2f7d3e':'#367f46';
        g.fillStyle=shade(gc,-0.1); g.beginPath(); g.arc(sx, sy-16*p.s, 12*p.s,0,TAU); g.fill();
        g.fillStyle=gc; g.beginPath(); g.arc(sx-6*p.s, sy-12*p.s, 8*p.s,0,TAU); g.fill();
        g.beginPath(); g.arc(sx+6*p.s, sy-12*p.s, 8*p.s,0,TAU); g.fill();
        g.fillStyle=shade(gc,0.2); g.beginPath(); g.arc(sx-3*p.s, sy-19*p.s, 6*p.s,0,TAU); g.fill();
      } else if (p.type==='rock'){
        g.fillStyle='#7c818c'; g.beginPath(); g.ellipse(sx, sy-4*p.s, 10*p.s, 8*p.s,0,0,TAU); g.fill();
        g.fillStyle='#9aa0ab'; g.beginPath(); g.ellipse(sx-3*p.s, sy-7*p.s, 5*p.s, 4*p.s,0,0,TAU); g.fill();
      } else if (p.type==='bush'){
        const gc='#357a44'; g.fillStyle=gc;
        g.beginPath(); g.arc(sx, sy-4*p.s, 7*p.s,0,TAU); g.arc(sx-5*p.s, sy-2*p.s, 5*p.s,0,TAU);
        g.arc(sx+5*p.s, sy-2*p.s, 5*p.s,0,TAU); g.fill();
        g.fillStyle=shade(gc,0.2); g.beginPath(); g.arc(sx-1*p.s, sy-6*p.s, 4*p.s,0,TAU); g.fill();
      } else {
        g.strokeStyle='#3a7d44'; g.lineWidth=1.5*p.s;
        g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx, sy-7*p.s); g.stroke();
        g.fillStyle=['#ff6f91','#ffd24a','#b07dff','#ff8a3d'][Math.floor(p.h*4)%4];
        g.beginPath(); g.arc(sx, sy-8*p.s, 2.4*p.s,0,TAU); g.fill();
      }
    }
  }
};

// ============================================================
//  ENTITY
// ============================================================
let UID = 1;
class Hunter {
  constructor(hid, team, isPlayer, name){
    const h = HUNTERS[hid];
    this.id=UID++; this.hid=hid; this.def=h;
    this.team=team; this.isPlayer=isPlayer; this.name=name;
    this.x=0; this.y=0; this.moveX=0; this.moveY=0; this.aim=0;
    this.maxHp=h.maxHp; this.hp=h.maxHp; this.shield=0;
    this.radius=h.radius; this.speed=h.speed*SPEED_SCALE;
    this.cd={ basic:0,q:0,e:0,r:0,dash:0 };
    this.alive=true; this.downed=false; this.bleed=0; this.reviveProg=0; this.reviving=null;
    this.speedBuffT=0; this.speedBuffMul=1; this.dashVx=0; this.dashVy=0; this.dashT=0;
    this.kills=0; this.hasCrown=false; this.walkT=0;
    // gear
    this.slots=[]; this.recomputeGear();
    // ai
    this.aiTimer=0; this.aiTarget=null; this.wander=rand(0,TAU); this.pingCd=0; this.lootCd=0;
  }
  get effSpeed(){ return this.speed * (this.speedBuffT>0 ? this.speedBuffMul : 1); }

  recomputeGear(){
    let dmg=0, abil=0, steal=0, sh=0, dr=0, atk=1, regen=0;
    for (const s of this.slots){
      const lv=GEAR[s.id].levels[s.lvl-1];
      dmg+=lv.dmg||0; abil+=lv.abil||0; steal=Math.max(steal,lv.steal||0);
      sh+=lv.sh||0; dr+=lv.dr||0; regen+=lv.regen||0; if(lv.atk) atk=Math.min(atk,lv.atk);
    }
    this.dmgMul=1+dmg; this.abilityMul=1+abil; this.lifesteal=steal;
    this.maxShield=sh; this.dr=dr; this.atkSpeedMul=atk; this.shieldRegen=regen;
    if (this.shield < this.maxShield) this.shield = this.maxShield;
  }
  equip(id, lvl=1){
    const s = this.slots.find(x=>x.id===id);
    let res;
    if (s){ if (s.lvl<3){ s.lvl=Math.min(3, Math.max(s.lvl+1, lvl)); res='up'; } else res='max'; }
    else {
      if (this.slots.length<MAX_SLOTS){ this.slots.push({id, lvl:Math.min(3,lvl)}); res='new'; }
      else { let lo=this.slots[0]; for(const x of this.slots) if(x.lvl<lo.lvl) lo=x; lo.id=id; lo.lvl=Math.min(3,lvl); res='swap'; }
    }
    this.recomputeGear();
    return res;
  }

  takeDamage(amt, src){
    if (!this.alive) return;
    amt *= (1 - this.dr);
    const dealt = amt;
    if (this.shield>0){ const a=Math.min(this.shield,amt); this.shield-=a; amt-=a; }
    if (amt>0){
      if (this.downed){ this.bleed -= amt*0.04; if(this.bleed<=0) this.die(src); }
      else { this.hp-=amt; if(this.hp<=0){ this.hp=0; this.goDown(src); } }
    }
    if (src && src!==this && src.lifesteal>0 && src.alive && !src.downed)
      src.hp=Math.min(src.maxHp, src.hp+dealt*src.lifesteal);
  }
  goDown(src){
    const matesUp = G.hunters.some(o=>o.team===this.team && o!==this && o.alive && !o.downed);
    if (!matesUp){ this.die(src); return; }
    this.downed=true; this.bleed=12; this.shield=0;
    Sfx.down(volAt(this.x,this.y));
    addFeed(`${src?src.name:'Storm'} downed ${this.name}`);
  }
  die(src){
    if (!this.alive) return;
    this.alive=false; this.downed=false;
    if (src && src!==this) src.kills++;
    Sfx.kill(volAt(this.x,this.y));
    addFeed(`${src&&src!==this?src.name:'The Storm'} eliminated ${this.name}`);
    spawnBurst(this.x,this.y,this.def.color,24);
    // drop all equipped gear on the ground
    for (const s of this.slots){
      const a=rand(0,TAU), d=rand(20,55);
      dropItem(s.id, s.lvl, this.x+Math.cos(a)*d, this.y+Math.sin(a)*d);
    }
    this.slots=[];
    if (this.hasCrown && src){ this.hasCrown=false; src.hasCrown=true; }
  }
  reviveTo(){ this.downed=false; this.hp=this.maxHp*0.4; this.bleed=0; this.reviveProg=0;
    Sfx.revive(volAt(this.x,this.y)); addFeed(`${this.name} was revived`); }
}

// ============================================================
//  MATCH SETUP
// ============================================================
function startMatch(){
  document.getElementById('menu').classList.add('hidden');
  document.getElementById('game').classList.remove('hidden');
  document.getElementById('endScreen').classList.add('hidden');
  resize();
  Sfx.ambientStart();
  Terrain.generate();
  HUNTER_IDS.forEach(id => Sprites[id] = buildSprite(HUNTERS[id]));

  G = {
    hunters:[], projectiles:[], aoes:[], items:[], pings:[], particles:[], motes:[],
    cam:{x:0,y:0}, t:0, over:false, placeWhenDead:0, flash:0, bolt:null, lightT:rand(5,12),
    zone:{ cx:WORLD/2, cy:WORLD/2, r:WORLD*0.82, target:WORLD*0.82, nextShrink:40, stage:0 }
  };

  for (let s=0; s<SQUADS; s++){
    const a=rand(0,TAU), rr=rand(WORLD*0.12, WORLD*0.46);
    const sx=clamp(WORLD/2+Math.cos(a)*rr, 200, WORLD-200);
    const sy=clamp(WORLD/2+Math.sin(a)*rr, 200, WORLD-200);
    for (let m=0;m<SQUAD_SIZE;m++){
      const isPlayer=(s===0&&m===0);
      const hid = isPlayer ? Lobby.hunter : HUNTER_IDS[randi(0,HUNTER_IDS.length-1)];
      const name = isPlayer ? 'You' : BOT_NAMES[randi(0,BOT_NAMES.length-1)];
      const e=new Hunter(hid,s,isPlayer,name);
      e.x=sx+rand(-80,80); e.y=sy+rand(-80,80);
      if (isPlayer && localStorage.getItem('stormfall_crown')==='1') e.hasCrown=true;
      G.hunters.push(e);
    }
  }
  G.player=G.hunters.find(h=>h.isPlayer); G.camFollow=G.player;
  G.cam.x=G.player.x-canvas.width/2; G.cam.y=G.player.y-canvas.height/2;

  const itemCount=Math.floor(WORLD*WORLD/900000);
  for (let i=0;i<itemCount;i++) spawnItem();

  for (let i=0;i<60;i++) G.motes.push({x:rand(0,canvas.width),y:rand(0,canvas.height),
    vx:rand(-8,8),vy:rand(-14,-3),r:rand(0.6,2),a:rand(0.1,0.4)});

  buildAbilityBar();
  G.feedEl=document.getElementById('killfeed');
  lastT=performance.now();
  if (!loopStarted){ loopStarted=true; requestAnimationFrame(loop); }
}

function spawnItem(x,y,id,lvl){
  id = id || GEAR_IDS[randi(0,GEAR_IDS.length-1)];
  if (x===undefined){ const a=rand(0,TAU), r=rand(0,WORLD*0.46); x=WORLD/2+Math.cos(a)*r; y=WORLD/2+Math.sin(a)*r; }
  G.items.push({ id, lvl:lvl||1, x, y, bob:rand(0,TAU) });
}
function dropItem(id,lvl,x,y){ G.items.push({ id, lvl, x:clamp(x,20,WORLD-20), y:clamp(y,20,WORLD-20), bob:rand(0,TAU) }); }

// ============================================================
//  ABILITIES
// ============================================================
function cast(ent, slot){
  const def = ent.def[slot];
  if (ent.cd[slot] > 0) return false;
  ent.cd[slot] = def.cd * (slot==='basic' ? ent.atkSpeedMul : 1);
  const isAb = slot!=='basic';
  const dmg = (def.dmg||0) * ent.dmgMul * (isAb ? ent.abilityMul : 1);
  const ax=Math.cos(ent.aim), ay=Math.sin(ent.aim);
  const v=volAt(ent.x,ent.y);

  switch(def.kind){
    case 'proj': fireProj(ent,def,ent.aim,dmg); Sfx.shoot(v); break;
    case 'burst': { const start=ent.aim-def.spread/2;
      for(let i=0;i<def.count;i++) fireProj(ent,def,start+def.spread*(i/(def.count-1||1)),dmg);
      Sfx.shoot(v); break; }
    case 'cone': coneHit(ent,def,dmg); spawnBurst(ent.x+ax*45,ent.y+ay*45,ent.def.color,5); Sfx.dash(v); break;
    case 'dash': {
      ent.dashVx=ax*(def.range*4); ent.dashVy=ay*(def.range*4); ent.dashT=0.25;
      if (def.hitRange>0) setTimeout(()=>{ if(ent.alive) coneHit(ent,{...def,range:def.hitRange},dmg); },120);
      spawnBurst(ent.x,ent.y,ent.def.color,8); Sfx.dash(v); break; }
    case 'blink': ent.x=clamp(ent.x+ax*def.range,40,WORLD-40); ent.y=clamp(ent.y+ay*def.range,40,WORLD-40);
      spawnBurst(ent.x,ent.y,ent.def.color,14); Sfx.cast(v); break;
    case 'shield': ent.shield=Math.max(ent.shield,def.amount); Sfx.cast(v); break;
    case 'aoe': { let tx=ent.x,ty=ent.y;
      if (def.atCursor){ if(ent.isPlayer){const w=worldMouse();tx=w.x;ty=w.y;}
        else if(ent.aiTarget){tx=ent.aiTarget.x;ty=ent.aiTarget.y;} else {tx=ent.x+ax*220;ty=ent.y+ay*220;} }
      addAoe(ent,tx,ty,def.radius,dmg,def.delay); Sfx.cast(v); break; }
    case 'storm': { let tx=ent.x+ax*260,ty=ent.y+ay*260;
      if (ent.isPlayer){const w=worldMouse();tx=w.x;ty=w.y;} else if(ent.aiTarget){tx=ent.aiTarget.x;ty=ent.aiTarget.y;}
      for(let i=0;i<def.count;i++){ const dx=rand(-def.spread,def.spread),dy=rand(-def.spread,def.spread);
        setTimeout(()=>{ if(G&&!G.over) addAoe(ent,tx+dx,ty+dy,def.radius,dmg,0.5); }, i*180); }
      Sfx.cast(v); break; }
    case 'heal': G.hunters.forEach(o=>{ if(o.team===ent.team&&o.alive&&dist(o.x,o.y,ent.x,ent.y)<def.radius){
        if(o.downed) o.bleed=Math.min(12,o.bleed+5); else o.hp=Math.min(o.maxHp,o.hp+def.amount*ent.abilityMul); }});
      spawnRing(ent.x,ent.y,def.radius,'#46e08a'); Sfx.cast(v); break;
    case 'speed': G.hunters.forEach(o=>{ if(o.team===ent.team&&o.alive&&dist(o.x,o.y,ent.x,ent.y)<def.radius){
        o.speedBuffT=def.dur; o.speedBuffMul=def.mult; }});
      spawnRing(ent.x,ent.y,def.radius,'#ffd24a'); Sfx.cast(v); break;
    case 'shieldAura': G.hunters.forEach(o=>{ if(o.team===ent.team&&o.alive&&!o.downed&&dist(o.x,o.y,ent.x,ent.y)<def.radius){
        o.shield=Math.max(o.shield,def.amount); }});
      spawnRing(ent.x,ent.y,def.radius,'#34e3ff'); Sfx.cast(v); break;
  }
  return true;
}
function fireProj(ent,def,ang,dmg){
  G.projectiles.push({ x:ent.x+Math.cos(ang)*ent.radius, y:ent.y+Math.sin(ang)*ent.radius,
    vx:Math.cos(ang)*def.speed, vy:Math.sin(ang)*def.speed, dmg, team:ent.team, owner:ent,
    radius:def.radius, life:def.range/def.speed, pierce:!!def.pierce, color:ent.def.color, hits:new Set() });
}
function coneHit(ent,def,dmg){
  G.hunters.forEach(o=>{ if(o.team===ent.team||!o.alive) return;
    if (dist(o.x,o.y,ent.x,ent.y)<=def.range+o.radius && Math.abs(angDiff(angTo(ent.x,ent.y,o.x,o.y),ent.aim))<=def.arc/2){
      o.takeDamage(dmg,ent); spawnBurst(o.x,o.y,'#fff',6); Sfx.hit(volAt(o.x,o.y)); }});
}
function addAoe(ent,x,y,r,dmg,delay){ G.aoes.push({x,y,r,dmg,team:ent.team,owner:ent,t:delay,max:delay,color:ent.def.color}); }

// ============================================================
//  CONTROL
// ============================================================
function controlPlayer(p, dt){
  let mx=0,my=0;
  if (Input.keys.has('w')) my--; if (Input.keys.has('s')) my++;
  if (Input.keys.has('a')) mx--; if (Input.keys.has('d')) mx++;
  const ml=Math.hypot(mx,my)||1; p.moveX=mx/ml; p.moveY=my/ml;
  const w=worldMouse(); p.aim=angTo(p.x,p.y,w.x,w.y);

  p.reviving=null;
  if (p.downed) return;

  if (Input.mdown) cast(p,'basic');
  if (Input.keys.has('q')) cast(p,'q');
  if (Input.keys.has('e')) cast(p,'e');
  if (Input.keys.has('r')) cast(p,'r');
  if (Input.keys.has(' ') && p.cd.dash<=0){ const a=p.aim; p.dashVx=Math.cos(a)*900; p.dashVy=Math.sin(a)*900; p.dashT=0.2; p.cd.dash=3; spawnBurst(p.x,p.y,p.def.color,6); Sfx.dash(1); }
  if (Input.keys.has('v') && p.pingCd<=0){ addPing(w.x,w.y,p.team,p); p.pingCd=1; Input.keys.delete('v'); }

  // F = interact: equip nearby item (tap) else revive ally (hold)
  if (Input.keys.has('f')){
    const item=nearestGroundItem(p,90);
    if (item){ equipItem(p,item); Input.keys.delete('f'); }
    else { const ally=G.hunters.find(o=>o.team===p.team&&o!==p&&o.downed&&dist(o.x,o.y,p.x,p.y)<90);
      if (ally){ ally.reviveProg+=dt; p.reviving=ally; if(ally.reviveProg>=2.5) ally.reviveTo(); } }
  }
}

function controlAI(e, dt){
  e.moveX=0; e.moveY=0; e.reviving=null;
  e.aiTimer-=dt;
  const inStorm = dist(e.x,e.y,G.zone.cx,G.zone.cy) > G.zone.r;

  let foe=null, fd=1e18;
  for (const o of G.hunters){ if(o.team===e.team||!o.alive) continue; const d=dist2(e.x,e.y,o.x,o.y); if(d<fd){fd=d;foe=o;} }
  fd=Math.sqrt(fd);
  let downAlly=null, dad=1e9;
  for (const o of G.hunters){ if(o.team===e.team&&o!==e&&o.downed){ const d=dist(e.x,e.y,o.x,o.y); if(d<dad){dad=d;downAlly=o;} } }

  let gx=null, gy=null, fight=false;

  if (e.downed){
    let ally=null,ad=1e9;
    for(const o of G.hunters) if(o.team===e.team&&o.alive&&!o.downed){const d=dist(e.x,e.y,o.x,o.y);if(d<ad){ad=d;ally=o;}}
    if(ally){ gx=ally.x; gy=ally.y; }
  } else if (inStorm){ gx=G.zone.cx; gy=G.zone.cy; }
  else if (e.hp<e.maxHp*0.3 && foe && fd<460){
    gx=e.x+(e.x-foe.x); gy=e.y+(e.y-foe.y);   // retreat
  }
  else if (downAlly && dad<560 && (!foe||fd>360)){
    gx=downAlly.x; gy=downAlly.y;
    if (dad<80){ downAlly.reviveProg+=dt; e.reviving=downAlly; if(downAlly.reviveProg>=2.8) downAlly.reviveTo(); }
  }
  else if (foe && fd<820){
    fight=true; e.aiTarget=foe;
    const ranged=e.def.basic.kind==='proj'; const ideal=ranged?340:64;
    const a=angTo(e.x,e.y,foe.x,foe.y); e.aim=a+rand(-0.05,0.05);
    if (fd>ideal+40){ gx=foe.x; gy=foe.y; }
    else if (fd<ideal-40){ gx=e.x-(foe.x-e.x); gy=e.y-(foe.y-e.y); }
    else { e.moveX=Math.cos(a+Math.PI/2)*((e.id%2)?1:-1); e.moveY=Math.sin(a+Math.PI/2)*((e.id%2)?1:-1); }
    cast(e,'basic');
    if (fd<560) cast(e,'q');
    if (e.hp<e.maxHp*0.6) cast(e,'e');
    if (fd<480) cast(e,'r');
    if (e.def.q.kind==='heal'||e.def.e.kind==='speed'){ cast(e,'q'); cast(e,'e'); }
  }
  else {
    const item=nearestNeededItem(e);
    if (item){ gx=item.x; gy=item.y; if(dist(e.x,e.y,item.x,item.y)<32 && e.lootCd<=0){ equipItem(e,item); e.lootCd=0.5; } }
    else {
      if (e.aiTimer<=0){ e.wander=rand(0,TAU); e.aiTimer=rand(2,4); }
      gx=clamp(e.x+Math.cos(e.wander)*260,150,WORLD-150);
      gy=clamp(e.y+Math.sin(e.wander)*260,150,WORLD-150);
      gx=lerp(gx,G.zone.cx,0.25); gy=lerp(gy,G.zone.cy,0.25);
    }
  }

  if (gx!==null){ const a=angTo(e.x,e.y,gx,gy);
    if (dist(e.x,e.y,gx,gy)>22){ e.moveX=Math.cos(a); e.moveY=Math.sin(a); }
    if (!fight) e.aim=a;
  }

  // friendly AI pings loot it no longer needs (maxed already)
  if (e.team===G.player.team && e.pingCd<=0){
    for (const it of G.items){
      if (dist(e.x,e.y,it.x,it.y)<90 && !aiNeedsItem(e,it)){ addPing(it.x,it.y,e.team,e); e.pingCd=rand(5,9); break; }
    }
  }
}

function nearestGroundItem(e,range){ let best=null,bd=range*range;
  for(const it of G.items){ const d=dist2(e.x,e.y,it.x,it.y); if(d<bd){bd=d;best=it;} } return best; }
function nearestNeededItem(e){ let best=null,bd=1e18;
  for(const it of G.items){ if(!aiNeedsItem(e,it)) continue; const d=dist2(e.x,e.y,it.x,it.y); if(d<bd){bd=d;best=it;} }
  return Math.sqrt(bd)<1100?best:null; }
function aiNeedsItem(e,it){ const s=e.slots.find(x=>x.id===it.id);
  if (!s) return true;            // new item — always worth grabbing
  return s.lvl<3 || it.lvl>s.lvl; // upgrade if not maxed
}
function equipItem(ent,it){
  const res=ent.equip(it.id, it.lvl);
  const i=G.items.indexOf(it); if(i>=0) G.items.splice(i,1);
  if (res==='max') return;
  Sfx.pickup(volAt(ent.x,ent.y)); spawnBurst(ent.x,ent.y,GEAR[it.id].color,8);
  if (ent.isPlayer){ const g=GEAR[it.id]; const s=ent.slots.find(x=>x.id===it.id);
    addFeed(`${res==='up'?'Upgraded':'Equipped'} ${g.name} ${s?'Lv'+s.lvl:''} — ${g.blurb[(s?s.lvl:1)-1]}`); }
}

// ============================================================
//  PINGS / EFFECTS
// ============================================================
function addPing(x,y,team,by){ G.pings.push({x,y,team,t:4,by}); Sfx.ping(volAt(x,y)*(by===G.player?1.4:1)); }
function addFeed(txt){ const el=document.createElement('div'); el.className='kf'; el.textContent=txt;
  G.feedEl.prepend(el); while(G.feedEl.children.length>6) G.feedEl.lastChild.remove(); setTimeout(()=>el.remove(),5000); }
function spawnBurst(x,y,color,n){ for(let i=0;i<n;i++){ const a=rand(0,TAU),s=rand(40,220);
  G.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rand(.3,.6),color,r:rand(2,4)}); } }
function spawnRing(x,y,r,color){ G.particles.push({ring:true,x,y,maxR:r,life:.5,color}); }

// ============================================================
//  UPDATE
// ============================================================
function update(dt){
  const z=G.zone; G.t+=dt;

  // zone shrink
  z.nextShrink-=dt;
  if (z.nextShrink<=0 && z.target>WORLD*0.05){
    z.stage++; z.target=Math.max(WORLD*0.05, z.target*0.7);
    z.nextShrink=Math.max(20, 40-z.stage*2.5);
    addFeed('⚠ The storm is closing in'); Sfx.zone();
  }
  z.r=lerp(z.r,z.target,dt*0.4);
  Sfx.ambientIntensity(clamp(1 - z.r/(WORLD*0.82), 0, 1));

  // lightning flashes (stronger as storm tightens)
  G.lightT-=dt; if(G.flash>0) G.flash-=dt;
  if (G.lightT<=0){ G.lightT=rand(5,13)-z.stage*0.4; G.flash=0.16;
    const a=rand(0,TAU); const ex=z.cx+Math.cos(a)*z.r, ey=z.cy+Math.sin(a)*z.r;
    G.bolt=[]; let bx=ex,by=ey-rand(200,500); for(let i=0;i<6;i++){ G.bolt.push({x:bx,y:by}); bx+=rand(-40,40); by+=Math.abs(rand(40,110)); }
    G.bolt.push({x:ex,y:ey}); }

  for (const e of G.hunters){
    if (!e.alive) continue;
    for (const k in e.cd) if (e.cd[k]>0) e.cd[k]-=dt;
    if (e.speedBuffT>0) e.speedBuffT-=dt;
    if (e.pingCd>0) e.pingCd-=dt;
    if (e.lootCd>0) e.lootCd-=dt;
    if (e.reviveProg>0 && !e.beingRevived) e.reviveProg=Math.max(0,e.reviveProg-dt*0.5);
    e.beingRevived=false;
    if (e.shieldRegen>0 && e.shield<e.maxShield && !e.downed) e.shield=Math.min(e.maxShield,e.shield+e.shieldRegen*dt);

    if (e.isPlayer) controlPlayer(e,dt); else controlAI(e,dt);

    if (e.downed){ e.bleed-=dt; if(e.bleed<=0) e.die(null); }

    const moving = (e.moveX||e.moveY);
    const spd = e.downed ? e.effSpeed*0.35 : e.effSpeed;
    if (e.dashT>0){ e.x+=e.dashVx*dt; e.y+=e.dashVy*dt; e.dashT-=dt; }
    else { e.x+=(e.moveX||0)*spd*dt; e.y+=(e.moveY||0)*spd*dt; }
    if (moving) e.walkT+=dt*10;
    e.x=clamp(e.x,e.radius,WORLD-e.radius); e.y=clamp(e.y,e.radius,WORLD-e.radius);

    if (dist(e.x,e.y,z.cx,z.cy)>z.r) e.takeDamage((7+z.stage*3)*dt, null);
  }
  for (const e of G.hunters) if (e.reviving) e.reviving.beingRevived=true;

  // projectiles
  for (let i=G.projectiles.length-1;i>=0;i--){ const p=G.projectiles[i];
    p.x+=p.vx*dt; p.y+=p.vy*dt; p.life-=dt;
    let dead=p.life<=0||p.x<0||p.y<0||p.x>WORLD||p.y>WORLD;
    if (!dead) for (const o of G.hunters){ if(o.team===p.team||!o.alive||p.hits.has(o.id)) continue;
      if (dist(p.x,p.y,o.x,o.y)<o.radius+p.radius){ o.takeDamage(p.dmg,p.owner); spawnBurst(p.x,p.y,p.color,5);
        Sfx.hit(volAt(p.x,p.y)); p.hits.add(o.id); if(!p.pierce){dead=true;break;} } }
    if (dead) G.projectiles.splice(i,1);
  }
  // aoes
  for (let i=G.aoes.length-1;i>=0;i--){ const a=G.aoes[i]; a.t-=dt;
    if (a.t<=0){ for(const o of G.hunters){ if(o.team===a.team||!o.alive) continue;
        if(dist(a.x,a.y,o.x,o.y)<a.r+o.radius) o.takeDamage(a.dmg,a.owner); }
      spawnBurst(a.x,a.y,a.color,18); spawnRing(a.x,a.y,a.r,a.color); Sfx.explode(volAt(a.x,a.y)); G.aoes.splice(i,1); }
  }
  for (let i=G.pings.length-1;i>=0;i--){ G.pings[i].t-=dt; if(G.pings[i].t<=0) G.pings.splice(i,1); }
  for (let i=G.particles.length-1;i>=0;i--){ const p=G.particles[i]; p.life-=dt;
    if(!p.ring){ p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=0.9; p.vy*=0.9; } if(p.life<=0) G.particles.splice(i,1); }

  // motes (screen space)
  for (const m of G.motes){ m.x+=m.vx*dt; m.y+=m.vy*dt;
    if(m.y<-5){m.y=canvas.height+5;m.x=rand(0,canvas.width);} if(m.x<-5)m.x=canvas.width+5; if(m.x>canvas.width+5)m.x=-5; }

  // keep map stocked within the zone
  if (G.items.length < itemTarget() && Math.random()<dt*2){
    const a=rand(0,TAU), r=rand(0,z.r*0.85); spawnItem(z.cx+Math.cos(a)*r, z.cy+Math.sin(a)*r);
  }

  // camera follow (player, or living teammate if dead)
  G.camFollow = G.player.alive ? G.player : (G.hunters.find(o=>o.team===G.player.team&&o.alive)||G.player);
  G.cam.x=lerp(G.cam.x,G.camFollow.x-canvas.width/2,0.1);
  G.cam.y=lerp(G.cam.y,G.camFollow.y-canvas.height/2,0.1);

  checkEnd(); updateHUD();
}
function itemTarget(){ return Math.floor(WORLD*WORLD/1400000); }

function checkEnd(){
  if (G.over) return;
  const teams=new Set(); for(const e of G.hunters) if(e.alive) teams.add(e.team);
  if (teams.size<=1){ G.over=true; const won=teams.has(G.player.team); setTimeout(()=>showEnd(won),800); }
  else if (!G.hunters.some(e=>e.team===G.player.team&&e.alive)){ G.over=true; G.placeWhenDead=teams.size+1; setTimeout(()=>showEnd(false),800); }
}
function showEnd(won){
  Sfx.ambientStop(); won?Sfx.victory():Sfx.defeat();
  const place = won?1:(G.placeWhenDead||2);
  document.getElementById('endScreen').classList.remove('hidden');
  document.getElementById('endIcon').textContent = won?'👑':'💀';
  document.getElementById('endTitle').textContent = won?'VICTORY':'DEFEATED';
  document.getElementById('endSub').textContent = won
    ? 'Your squad is the last team standing. The crown is yours.'
    : `Your squad placed #${place} of ${SQUADS}.`;
  const sk=G.hunters.filter(e=>e.team===G.player.team).reduce((a,e)=>a+e.kills,0);
  document.getElementById('endStats').innerHTML =
    `<div><b>#${won?1:place}</b><span>Placement</span></div>
     <div><b>${G.player.kills}</b><span>Your Kills</span></div>
     <div><b>${sk}</b><span>Squad Kills</span></div>`;
  if (won){ localStorage.setItem('stormfall_crown','1'); localStorage.setItem('stormfall_wins', (+(localStorage.getItem('stormfall_wins')||0)+1)); }
  else localStorage.setItem('stormfall_crown','0');
}

// ============================================================
//  HUD
// ============================================================
function buildAbilityBar(){
  const bar=document.getElementById('abilityBar'); bar.innerHTML='';
  const p=G.player; const tip=document.getElementById('abilityTooltip');
  const make=(slot,def,descHtml)=>{
    const el=document.createElement('div'); el.className='ab'; el.dataset.slot=slot;
    el.innerHTML=`<span class="key">${def.key}</span><span class="emoji">${def.emoji}</span><span class="cool hidden"></span>`;
    el.onmouseenter=()=>{ tip.innerHTML=`<b>${def.name}</b>${descHtml}<div class="cd">Cooldown: ${def.cd?def.cd+'s':'—'}</div>`; tip.classList.remove('hidden'); };
    el.onmouseleave=()=>tip.classList.add('hidden');
    bar.appendChild(el);
  };
  make('basic', p.def.basic, abilityDesc(p.def.basic));
  make('dash', {key:'SPC',emoji:'💨',name:'Dash',cd:3}, DASH_DESC);
  make('q', p.def.q, abilityDesc(p.def.q));
  make('e', p.def.e, abilityDesc(p.def.e));
  make('r', p.def.r, abilityDesc(p.def.r));
}
function updateHUD(){
  const p=G.player;
  const alive=G.hunters.filter(e=>e.alive).length;
  const squads=new Set(G.hunters.filter(e=>e.alive).map(e=>e.team)).size;
  document.getElementById('aliveCount').textContent=alive;
  document.getElementById('squadCount').textContent=squads;
  document.getElementById('zoneTimer').textContent =
    G.zone.target<=WORLD*0.06?'Final zone!':`Storm closes in ${Math.ceil(G.zone.nextShrink)}s`;

  const panel=document.getElementById('squadPanel'); panel.innerHTML='';
  G.hunters.filter(e=>e.team===p.team).forEach(e=>{
    const d=document.createElement('div'); d.className='mate'+(e.downed?' downed':'')+(!e.alive?' dead':'');
    const hp=clamp(e.hp/e.maxHp*100,0,100);
    d.innerHTML=`<div class="mate-name"><span>${e.isPlayer?'You':e.name} ${e.hasCrown?'👑':''}</span>
      <span class="tag">${e.def.name}${e.downed?' · DOWN':''}</span></div>
      <div class="bar"><i style="width:${e.alive?hp:0}%"></i></div>`;
    panel.appendChild(d);
  });

  document.querySelectorAll('.ab').forEach(el=>{ const cd=p.cd[el.dataset.slot]||0; const cool=el.querySelector('.cool');
    if(cd>0.05){ cool.classList.remove('hidden'); cool.textContent=cd.toFixed(1); el.classList.remove('ready'); }
    else { cool.classList.add('hidden'); el.classList.add('ready'); } });

  // gear bar
  const gb=document.getElementById('gearBar'); let html='';
  for (let i=0;i<MAX_SLOTS;i++){ const s=p.slots[i];
    if (s){ const g=GEAR[s.id]; let pips=''; for(let l=0;l<3;l++) pips+=`<span class="pip ${l<s.lvl?'on':''}"></span>`;
      html+=`<div class="gear-slot"><span class="gi">${g.emoji}</span>
        <span class="gn">${g.name} <small>${g.blurb[s.lvl-1]}</small></span>
        <span class="pips">${pips}</span></div>`; }
    else html+=`<div class="gear-slot empty"><span class="gi">▫</span><span class="gn">Empty slot</span></div>`;
  }
  gb.innerHTML=html;

  // interact prompt
  const prompt=document.getElementById('interactPrompt');
  if (p.alive && !p.downed){
    const it=nearestGroundItem(p,90);
    if (it){ const g=GEAR[it.id], owned=p.slots.find(x=>x.id===it.id);
      prompt.innerHTML=`<b>F</b> ${owned?(owned.lvl<3?'Upgrade':'Max'):'Equip'} ${g.name}${it.lvl>1?' Lv'+it.lvl:''}`;
      prompt.classList.remove('hidden'); }
    else { const ally=G.hunters.find(o=>o.team===p.team&&o!==p&&o.downed&&dist(o.x,o.y,p.x,p.y)<90);
      if (ally){ prompt.innerHTML=`<b>F</b> Revive ${ally.name}`; prompt.classList.remove('hidden'); }
      else prompt.classList.add('hidden'); }
  } else prompt.classList.add('hidden');

  document.getElementById('downedBanner').classList.toggle('hidden', !p.downed);
}

// ============================================================
//  RENDER
// ============================================================
function draw(){
  const w=canvas.width, h=canvas.height, cam=G.cam;
  ctx.imageSmoothingEnabled=false;
  ctx.fillStyle='#0a1018'; ctx.fillRect(0,0,w,h);

  Terrain.draw(ctx,cam,w,h,G.t);

  // world border
  ctx.strokeStyle='rgba(255,255,255,.08)'; ctx.lineWidth=4; ctx.strokeRect(-cam.x,-cam.y,WORLD,WORLD);

  Terrain.drawProps(ctx,cam,w,h);

  // storm
  const z=G.zone;
  ctx.save(); ctx.beginPath(); ctx.rect(0,0,w,h);
  ctx.arc(z.cx-cam.x,z.cy-cam.y,z.r,0,TAU,true);
  ctx.fillStyle='rgba(150,40,200,.18)'; ctx.fill('evenodd'); ctx.restore();
  ctx.beginPath(); ctx.arc(z.cx-cam.x,z.cy-cam.y,z.r,0,TAU); ctx.strokeStyle='rgba(190,100,255,.75)'; ctx.lineWidth=3; ctx.stroke();
  ctx.beginPath(); ctx.arc(z.cx-cam.x,z.cy-cam.y,z.target,0,TAU); ctx.setLineDash([10,10]); ctx.strokeStyle='rgba(255,255,255,.25)'; ctx.lineWidth=2; ctx.stroke(); ctx.setLineDash([]);

  // ground items + names
  for (const it of G.items){ const sx=it.x-cam.x, sy=it.y-cam.y;
    if(sx<-40||sy<-40||sx>w+40||sy>h+40) continue;
    const g=GEAR[it.id], bob=Math.sin(G.t*3+it.bob)*3;
    ctx.beginPath(); ctx.arc(sx,sy+bob,12,0,TAU); ctx.fillStyle=g.color+'33'; ctx.fill();
    ctx.strokeStyle=g.color; ctx.lineWidth=2; ctx.stroke();
    ctx.font='14px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle='#fff'; ctx.fillText(g.emoji,sx,sy+bob+1);
    ctx.font='11px sans-serif'; ctx.fillStyle=g.color;
    ctx.fillText(g.name+(it.lvl>1?' Lv'+it.lvl:''), sx, sy+bob-20);
  }

  // aoes
  for (const a of G.aoes){ const sx=a.x-cam.x, sy=a.y-cam.y, f=1-a.t/a.max;
    ctx.beginPath(); ctx.arc(sx,sy,a.r,0,TAU); ctx.fillStyle=a.color+'22'; ctx.fill();
    ctx.beginPath(); ctx.arc(sx,sy,a.r*f,0,TAU); ctx.strokeStyle=a.color; ctx.lineWidth=3; ctx.stroke(); }

  // pings
  for (const pg of G.pings){ const sx=pg.x-cam.x, sy=pg.y-cam.y, pulse=1+Math.sin(G.t*8)*0.15;
    ctx.beginPath(); ctx.arc(sx,sy,16*pulse,0,TAU); ctx.strokeStyle='#ffd24a'; ctx.lineWidth=3; ctx.stroke();
    ctx.fillStyle='#ffd24a'; ctx.font='16px sans-serif'; ctx.textAlign='center'; ctx.fillText('⚑',sx,sy-22); }

  // projectiles
  for (const p of G.projectiles){ const sx=p.x-cam.x, sy=p.y-cam.y;
    ctx.beginPath(); ctx.arc(sx,sy,p.radius,0,TAU); ctx.fillStyle=p.color; ctx.shadowColor=p.color; ctx.shadowBlur=10; ctx.fill(); ctx.shadowBlur=0; }

  // entities
  for (const e of G.hunters){ if(!e.alive) continue;
    const sx=e.x-cam.x, sy=e.y-cam.y;
    if(sx<-80||sy<-100||sx>w+80||sy>h+100) continue;
    const ally=e.team===G.player.team, ring=e.isPlayer?'#ffd24a':ally?'#46e08a':'#ff5a5a';

    if (e.reviving){ ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(e.reviving.x-cam.x,e.reviving.y-cam.y);
      ctx.strokeStyle='rgba(70,224,138,.6)'; ctx.lineWidth=3; ctx.stroke(); }

    // ground ring (team)
    ctx.beginPath(); ctx.ellipse(sx, sy+e.radius*0.55, e.radius*0.95, e.radius*0.42, 0,0,TAU);
    ctx.fillStyle=ring+'33'; ctx.fill(); ctx.strokeStyle=ring; ctx.lineWidth=2; ctx.stroke();

    // weapon behind if aiming up
    const sprite=Sprites[e.hid]; const H=e.radius*2.7, sc=H/18, W=16*sc;
    const aimingUp=Math.sin(e.aim)<0;
    if (aimingUp) drawWeapon(ctx,sx,sy,e.aim,e.def,sc/2.4);

    // shield ring
    if (e.shield>0){ ctx.beginPath(); ctx.arc(sx,sy,e.radius+6,0,TAU); ctx.strokeStyle='rgba(52,227,255,.8)'; ctx.lineWidth=3; ctx.stroke(); }

    // sprite
    const bob=(e.moveX||e.moveY)&&!e.downed?Math.abs(Math.sin(e.walkT))*-2.5:0;
    const flip=Math.cos(e.aim)<0;
    ctx.save();
    if (e.downed) ctx.globalAlpha=0.7;
    ctx.translate(sx, sy+e.radius*0.55 - H + bob);
    if (flip){ ctx.translate(W,0); ctx.scale(-1,1); }
    ctx.drawImage(sprite, 0,0, W, H);
    ctx.restore();

    if (!aimingUp) drawWeapon(ctx,sx,sy,e.aim,e.def,sc/2.4);

    if (e.hasCrown){ ctx.font='18px sans-serif'; ctx.textAlign='center'; ctx.fillText('👑',sx,sy-H+e.radius*0.55-8); }

    // hp bar
    const bw=44,bh=5,by=sy-H+e.radius*0.55-(e.hasCrown?22:6);
    ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(sx-bw/2,by,bw,bh);
    ctx.fillStyle=e.downed?'#ff5a5a':ally?'#46e08a':'#ff7a7a';
    ctx.fillRect(sx-bw/2,by,bw*clamp(e.downed?e.bleed/12:e.hp/e.maxHp,0,1),bh);
    if (e.shield>0 && !e.downed){ ctx.fillStyle='#34e3ff'; ctx.fillRect(sx-bw/2,by-3,bw*clamp(e.shield/300,0,1),2); }

    ctx.font='11px sans-serif'; ctx.textAlign='center'; ctx.fillStyle=e.isPlayer?'#ffd24a':ring; ctx.fillText(e.isPlayer?'You':e.name,sx,by-7);
    if (e.downed){ ctx.fillStyle='#ff5a5a'; ctx.font='bold 12px sans-serif'; ctx.fillText('DOWN',sx,sy+e.radius+14); }
  }

  // particles
  for (const p of G.particles){ const sx=p.x-cam.x, sy=p.y-cam.y;
    if (p.ring){ const f=p.life/0.5; ctx.beginPath(); ctx.arc(sx,sy,p.maxR*(1-f),0,TAU);
      ctx.strokeStyle=p.color; ctx.globalAlpha=f; ctx.lineWidth=3; ctx.stroke(); ctx.globalAlpha=1; }
    else { ctx.globalAlpha=clamp(p.life*2,0,1); ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(sx,sy,p.r,0,TAU); ctx.fill(); ctx.globalAlpha=1; } }

  // lightning bolt + flash
  if (G.flash>0 && G.bolt){
    ctx.strokeStyle='rgba(220,230,255,.9)'; ctx.lineWidth=2; ctx.beginPath();
    ctx.moveTo(G.bolt[0].x-cam.x,G.bolt[0].y-cam.y);
    for(const b of G.bolt) ctx.lineTo(b.x-cam.x,b.y-cam.y); ctx.stroke();
    ctx.fillStyle=`rgba(180,160,255,${G.flash*0.6})`; ctx.fillRect(0,0,w,h);
  }

  // dust motes (screen space)
  for (const m of G.motes){ ctx.globalAlpha=m.a; ctx.fillStyle='#cfe2ff';
    ctx.beginPath(); ctx.arc(m.x,m.y,m.r,0,TAU); ctx.fill(); } ctx.globalAlpha=1;

  // vignette
  const vg=ctx.createRadialGradient(w/2,h/2,Math.min(w,h)*0.35, w/2,h/2,Math.max(w,h)*0.75);
  vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,.45)');
  ctx.fillStyle=vg; ctx.fillRect(0,0,w,h);

  drawMinimap();
}

function drawMinimap(){
  const s=160/WORLD; const z=G.zone;
  mmx.fillStyle='#0a0e1a'; mmx.fillRect(0,0,160,160);
  mmx.beginPath(); mmx.arc(z.cx*s,z.cy*s,z.r*s,0,TAU); mmx.strokeStyle='rgba(190,100,255,.8)'; mmx.lineWidth=1.5; mmx.stroke();
  for (const pg of G.pings){ mmx.fillStyle='#ffd24a'; mmx.fillRect(pg.x*s-1.5,pg.y*s-1.5,3,3); }
  for (const e of G.hunters){ if(!e.alive) continue; const ally=e.team===G.player.team;
    mmx.fillStyle=e.isPlayer?'#ffd24a':ally?'#46e08a':'#ff5a5a';
    mmx.beginPath(); mmx.arc(e.x*s,e.y*s,e.isPlayer?3:2,0,TAU); mmx.fill(); }
}

// ============================================================
//  LOOP
// ============================================================
let lastT=0, loopStarted=false;
function loop(now){
  const dt=Math.min(0.05,(now-lastT)/1000); lastT=now;
  if (G && !G.over) update(dt);
  if (G) draw();
  requestAnimationFrame(loop);
}

Lobby.init();
