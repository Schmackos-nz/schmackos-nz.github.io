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
const VISION = 1200;          // fog-of-war sight radius per squad member
const BOSS_TRIGGER = 20;      // Storm Titan boss appears when <= this many hunters remain

// neutral PvE creeps that drop gear when killed
const CREEP_TYPES = {
  little:   { hp:55,   r:15, dmg:6,  speed:60, aggro:240, color:'#9bd36b', name:'Creep' },
  leader:   { hp:140,  r:21, dmg:11, speed:52, aggro:300, color:'#6bd3a0', name:'Pack Alpha' },
  miniboss: { hp:600,  r:31, dmg:18, speed:46, aggro:380, color:'#d36b9b', name:'Mini-Boss' },
  boss:     { hp:3000, r:54, dmg:34, speed:40, aggro:700, color:'#ff5a5a', name:'Storm Titan' },
};
const CREEP_IDS = Object.keys(CREEP_TYPES);

// Shadow Priest tuning: a faint long DoT, and a burst that detonates for 400% of it.
const SHADOW_DOT = { dps:5, dur:8 };
const SHADOW_BURST = Math.round(4 * SHADOW_DOT.dps * SHADOW_DOT.dur);  // 160

// ---------- hunters ----------
const HUNTERS = {
  vanguard: {
    name:'Vanguard', emoji:'🛡️', color:'#ff8a3d', role:'Bruiser', weapon:'sword',
    maxHp:360, speed:205, radius:21,
    desc:'Front-line bruiser. A wide cleave, dashes into the fray, slams the ground and shrugs off hits with a barrier.',
    basic:{ key:'LMB', name:'Cleave', emoji:'⚔️', cd:0.48, kind:'cone', dmg:32, range:165, arc:2.0, snare:true },
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
  },
  warlock: {
    name:'Warlock', emoji:'💀', color:'#9b5de5', role:'Warlock', weapon:'staff',
    maxHp:235, speed:212, radius:18,
    desc:'Damage-over-time caster. Afflicts foes with curses and plagues that rot their health over time, then slips away through shadow.',
    basic:{ key:'LMB', name:'Affliction', emoji:'🟣', cd:0.55, kind:'proj', dmg:10, speed:600, range:580, radius:8, dot:{dps:4, dur:4} },
    q:{ key:'Q', name:'Plague', emoji:'☣️', cd:7, kind:'dotaoe', dmg:14, radius:175, delay:0.4, atCursor:true, dot:{dps:7, dur:5} },
    e:{ key:'E', name:'Shadowstep', emoji:'🌑', cd:7, kind:'blink', range:350 },
    r:{ key:'R', name:'Apocalypse', emoji:'☠️', cd:24, kind:'dotaoe', dmg:40, radius:300, delay:0.6, atCursor:true, dot:{dps:13, dur:6} }
  },
  priest: {
    name:'Priest', emoji:'⛪', color:'#cdb4ff', role:'Cleric', weapon:'staff',
    maxHp:250, speed:218, radius:18, defaultForm:'holy',
    holyColor:'#ffe08a', shadowColor:'#b15cff',
    desc:'Form-shifting cleric. The ultimate swaps between Holy (squad heals & shields) and Shadow (a faint 8s curse plus a Mind Blast that detonates it for 400%).',
    r:{ key:'R', name:'Form Swap', emoji:'🔁', cd:6, kind:'swap' },
    forms:{
      holy:{
        basic:{ key:'LMB', name:'Smite', emoji:'✨', cd:0.5, kind:'proj', dmg:26, speed:720, range:560, radius:8 },
        q:{ key:'Q', name:'Heal', emoji:'💚', cd:7, kind:'heal', amount:130, radius:280 },
        e:{ key:'E', name:'Power Word: Shield', emoji:'🛡️', cd:10, kind:'shieldAura', amount:140, dur:6, radius:300 }
      },
      shadow:{
        basic:{ key:'LMB', name:'Shadow Word: Pain', emoji:'🟣', cd:0.5, kind:'proj', dmg:6, speed:620, range:580, radius:8, dot:{dps:SHADOW_DOT.dps, dur:SHADOW_DOT.dur} },
        q:{ key:'Q', name:'Mind Blast', emoji:'💥', cd:5, kind:'proj', dmg:SHADOW_BURST, speed:1400, range:720, radius:9,
            descText:`Instantly blasts a foe for <b>${SHADOW_BURST}</b> — <b>400%</b> of your Shadow Word: Pain damage-over-time.` },
        e:{ key:'E', name:'Shadowstep', emoji:'🌑', cd:7, kind:'blink', range:340 }
      }
    }
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
  if (d.descText) return d.descText;
  switch (d.kind){
    case 'swap':  return 'Transform between Holy and Shadow forms.';
    case 'proj':  return `Fires ${d.pierce?'a piercing ':'a '}bolt for <b>${d.dmg}</b> damage.`+(d.dot?` Afflicts a faint DoT (<b>${d.dot.dps}</b>/s for ${d.dot.dur}s).`:'');
    case 'burst': return `Looses ${d.count} bolts in a spread, <b>${d.dmg}</b> each.`;
    case 'dotaoe':return `Curses an area: <b>${d.dmg}</b> on impact, then <b>${d.dot.dps}</b>/s for ${d.dot.dur}s to everyone caught.`;
    case 'cone':  return `Cleaves enemies in front for <b>${d.dmg}</b> damage.`+(d.snare?` Snares hits <b>−10%</b> move speed (stacks to −50%).`:'');
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

// Resolve a hunter's effective ability for a slot, accounting for form-shifters (Priest).
function abilityOf(ent, slot){
  const d = ent.def;
  if (!d.forms) return d[slot];
  if (slot==='r'){
    const toShadow = (ent.form||d.defaultForm)==='holy';
    return { key:'R', cd:d.r.cd, kind:'swap',
      name: toShadow?'Enter Shadowform':'Enter Holy Form',
      emoji: toShadow?'🌑':'☀️',
      descText: toShadow
        ? 'Transform into a <b>Shadow Priest</b>: a faint 8s curse plus Mind Blast that detonates it for 400%.'
        : 'Transform into a <b>Holy Priest</b>: squad heals and Power Word: Shield.' };
  }
  return d.forms[ent.form||d.defaultForm][slot];
}
// Effective color (Priest changes with form)
function effColor(ent){
  const d = ent.def;
  if (d.forms) return (ent.form==='shadow') ? (d.shadowColor||'#b15cff') : (d.holyColor||'#ffe08a');
  return d.color;
}

// ============================================================
//  LOBBY
// ============================================================
const Lobby = {
  hunter:'vanguard', squadSize:1, partyCode:null, handle:null, netStatus:'', difficulty:'normal',
  init(){
    const list = document.getElementById('hunterList');
    HUNTER_IDS.forEach(id => {
      const h = HUNTERS[id];
      const c = document.createElement('button');
      c.className = 'hunter-card' + (id===this.hunter?' active':'');
      c.innerHTML = `<span class="hunter-emoji" style="background:${h.color}22;color:${h.color}">${h.emoji}</span>
        <span><b>${h.name}</b><small>${h.role}</small></span>`;
      c.onclick = () => { Sfx.click(); this.hunter = id; this.netSyncMyHunter(); this.refresh(); };
      list.appendChild(c);
    });
    document.querySelectorAll('.size-btn').forEach(b =>
      b.onclick = () => { Sfx.click(); this.squadSize = +b.dataset.size; this.refresh(); });
    document.querySelectorAll('.diff-btn').forEach(b =>
      b.onclick = () => { Sfx.click(); this.difficulty = b.dataset.diff; this.refresh(); });
    document.getElementById('btnCreateParty').onclick = () => { Sfx.click(); this.partyCode = this.makeCode(); this.joinedViaLink=false; this.connectAsHost(); this.refresh(); };
    document.getElementById('btnCopyCode').onclick = () => {
      Sfx.click();
      if (!this.partyCode) this.partyCode = this.makeCode();
      const link = this.inviteLink();
      const b = document.getElementById('btnCopyCode');
      navigator.clipboard?.writeText(link).then(
        ()=>{ b.textContent='Link Copied!'; setTimeout(()=>b.textContent='Copy Invite Link',1400); },
        ()=>{ const el=document.getElementById('inviteLink'); el.select(); b.textContent='Select+Copy'; setTimeout(()=>b.textContent='Copy Invite Link',1400); }
      );
      this.refresh();
    };
    const ji = document.getElementById('joinInput');
    ji.addEventListener('input', () => { ji.value = ji.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6); });
    const doJoin = () => {
      Sfx.click();
      const v = ji.value.trim().toUpperCase();
      const btn = document.getElementById('btnJoin');
      if (v.length===6){ this.partyCode = v; this.joinedViaLink=true; this.squadSize=3; this.connectAsClient(); this.refresh();
        btn.textContent='Joined!'; setTimeout(()=>btn.textContent='Join',1200); }
      else { btn.textContent='6 chars'; setTimeout(()=>btn.textContent='Join',1000); }
    };
    document.getElementById('btnJoin').onclick = doJoin;
    ji.addEventListener('keydown', e => { if (e.key==='Enter') doJoin(); });
    document.getElementById('btnPlay').onclick = () => {
      if (NETROLE==='client') return;                    // clients wait for the host
      Sfx.click();
      if (NETROLE==='host') Net.broadcast({t:'start'});
      startMatch();
    };
    document.getElementById('btnReturn').onclick = () => {
      Sfx.click();
      Net.cleanup(); NETROLE='solo'; netRoster=[]; this.netStatus='';
      document.getElementById('game').classList.add('hidden');
      document.getElementById('menu').classList.remove('hidden');
      this.refresh();
    };
    // joined via an invite link?  ?party=CODE
    const pc = new URLSearchParams(location.search).get('party');
    if (pc){ this.partyCode = pc.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6); this.joinedViaLink=true; this.squadSize=3; this.connectAsClient(); }
    this.refresh();
  },
  makeCode(){ let s=''; const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; for(let i=0;i<6;i++) s+=A[randi(0,A.length-1)]; return s; },
  inviteLink(){ const base = location.href.replace(/[?#].*$/,''); return base + '?party=' + (this.partyCode||''); },
  myName(){ if(!this.handle) this.handle = BOT_NAMES[randi(0,BOT_NAMES.length-1)]+randi(10,99); return this.handle; },
  netSyncMyHunter(){
    if (NETROLE==='client' && Net.ready) Net.toHost({t:'hello', name:this.myName(), hunter:this.hunter});
    else if (NETROLE==='host'){ if(netRoster[0]) netRoster[0].hunter=this.hunter; this.broadcastRoster(); }
  },
  connectAsHost(){
    if (!Net.available()){ this.netStatus='Offline — networking unavailable; squad will be AI.'; return; }
    NETROLE='host'; netRoster=[{id:'host', name:this.myName(), hunter:this.hunter, host:true}];
    this.netStatus='Starting party…'; netWire();
    Net.startHost(this.partyCode,
      ()=>{ this.netStatus='Party live — send the invite link to friends.'; this.refresh(); },
      (err)=>{ this.netStatus = err==='unavailable-id' ? 'Code already in use — create a new party.' : 'Could not start party (offline?). Squad will be AI.'; NETROLE='solo'; netRoster=[]; this.refresh(); });
  },
  connectAsClient(){
    if (!Net.available()){ this.netStatus='Offline — networking unavailable; playing solo vs AI.'; NETROLE='solo'; return; }
    NETROLE='client'; this.netStatus='Connecting to host…'; netWire();
    Net.startClient(this.partyCode,
      ()=>{ Net.toHost({t:'hello', name:this.myName(), hunter:this.hunter}); this.netStatus='Connected — waiting for host to start.'; this.refresh(); },
      (err)=>{ this.netStatus='Could not reach host (offline or wrong code). Playing solo vs AI.'; NETROLE='solo'; this.refresh(); });
  },
  broadcastRoster(){ if(NETROLE==='host'){ Net.broadcast({t:'roster', members:netRoster}); this.refresh(); } },
  renderGlossary(){
    const h=HUNTERS[this.hunter];
    document.getElementById('glossaryTitle').innerHTML = `${h.emoji} ${h.name} — Ability Glossary`;
    let rows;
    if (h.forms){
      const sub=(prefix,d)=>[{emoji:d.emoji, name:prefix+d.name, key:d.key, cd:d.cd}, abilityDesc(d), false];
      rows=[
        [{key:'SPACE', name:'Dash', emoji:'💨', cd:3}, DASH_DESC, false],
        [{key:'R', name:'Form Swap', emoji:'🔁', cd:h.r.cd}, 'Toggle between Holy and Shadow forms (changes your LMB/Q/E).', true],
        sub('☀️ ', h.forms.holy.basic), sub('☀️ ', h.forms.holy.q), sub('☀️ ', h.forms.holy.e),
        sub('🌑 ', h.forms.shadow.basic), sub('🌑 ', h.forms.shadow.q), sub('🌑 ', h.forms.shadow.e),
      ];
    } else {
      rows=[
        [h.basic, abilityDesc(h.basic), false],
        [{key:'SPACE', name:'Dash', emoji:'💨', cd:3}, DASH_DESC, false],
        [h.q, abilityDesc(h.q), false],
        [h.e, abilityDesc(h.e), false],
        [h.r, abilityDesc(h.r), true],
      ];
    }
    document.getElementById('abilityGlossary').innerHTML = rows.map(([def,desc,ult])=>`
      <div class="gl-row ${ult?'ult':''}">
        <span class="gl-emoji">${def.emoji}</span>
        <span class="gl-body"><b>${def.name}</b><span class="gl-key">${def.key}</span>${ult?'<span class="gl-key">ULT</span>':''}
          <div class="gl-desc">${desc}${def.cd?` <i>· ${def.cd}s cooldown</i>`:''}</div></span>
      </div>`).join('');
  },
  refresh(){
    document.querySelectorAll('.hunter-card').forEach((c,i)=>c.classList.toggle('active', HUNTER_IDS[i]===this.hunter));
    document.getElementById('hunterDesc').textContent = HUNTERS[this.hunter].desc;
    this.renderGlossary();
    document.querySelectorAll('.size-btn').forEach(b=>b.classList.toggle('active', +b.dataset.size===this.squadSize));
    document.querySelectorAll('.diff-btn').forEach(b=>b.classList.toggle('active', b.dataset.diff===this.difficulty));
    document.getElementById('diffHint').textContent = {
      easy:'Easy — enemies aim poorly and rarely upgrade gear.',
      normal:'Normal — balanced enemies.',
      hard:'Hard — enemies aim sharper and constantly grab loot.'
    }[this.difficulty];
    document.getElementById('partyCode').textContent = this.partyCode || '——————';
    const link=document.getElementById('inviteLink'), hint=document.getElementById('partyHint');
    if (this.partyCode){
      link.value=this.inviteLink(); link.classList.remove('hidden');
      hint.innerHTML = this.joinedViaLink
        ? `You joined party <b>${this.partyCode}</b> via an invite link. Pick a hunter and find a match — open slots fill with AI.`
        : `Party <b>${this.partyCode}</b> ready. Send the <b>invite link</b> above to friends; opening it drops them into this party. Open slots fill with AI.`;
    } else { link.classList.add('hidden');
      hint.innerHTML = `Create a party, then <b>Copy Invite Link</b> and send it to friends — opening the link drops them into your party lobby. Empty slots are filled by AI hunters.`; }
    if (this.netStatus) hint.innerHTML += `<br><span style="color:var(--accent)">${this.netStatus}</span>`;
    // squad slots — real party members when networked
    const net = NETROLE!=='solo';
    const slots = document.getElementById('partySlots'); slots.innerHTML='';
    const n = net ? SQUAD_SIZE : this.squadSize;
    for (let i=0;i<n;i++){
      const d=document.createElement('div');
      if (net){
        const m=netRoster[i];
        if (m){ const isMe=(NETROLE==='host'&&m.id==='host')||(m.name===this.handle);
          d.className='slot you'; d.innerHTML=`<span class="dot"></span> ${m.host?'⭐ ':''}${m.name}${isMe?' (you)':''} — ${HUNTERS[m.hunter].name}`; }
        else { d.className='slot bot'; d.innerHTML=`<span class="dot"></span> Open slot — invite a friend (AI until filled)`; }
      } else {
        if (i===0){ d.className='slot you'; d.innerHTML=`<span class="dot"></span> You — ${HUNTERS[this.hunter].name}`; }
        else { d.className='slot bot'; d.innerHTML=`<span class="dot"></span> ${this.partyCode?'Open slot — invite a friend':BOT_NAMES[i]+' (AI fill)'}`; }
      }
      slots.appendChild(d);
    }
    const pb=document.getElementById('btnPlay');
    if (NETROLE==='client'){ pb.textContent='WAITING FOR HOST…'; pb.disabled=true; pb.style.opacity=.6; }
    else { pb.textContent='FIND MATCH ▸'; pb.disabled=false; pb.style.opacity=1; }
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

// ---------- networking glue ----------
let NETROLE='solo';            // 'solo' | 'host' | 'client'
let netRoster=[];              // lobby members [{id,name,hunter,host}]
let netAccum=0;                // host: snapshot send timer
let clientInAccum=0, clientPing=null, clientAct=false, clientVHeld=false, clientFHeld=false;
const PALETTE = HUNTER_IDS.map(id=>HUNTERS[id].color).concat(['#ffffff']);
function palIdx(c){ const i=PALETTE.indexOf(c); return i<0?PALETTE.length-1:i; }
function hidIdx(hid){ return HUNTER_IDS.indexOf(hid); }
function gIdx(id){ return GEAR_IDS.indexOf(id); }
function setHunterHid(h,hid){ const d=HUNTERS[hid]; h.hid=hid; h.def=d; h.maxHp=d.maxHp; h.hp=d.maxHp; h.radius=d.radius; h.speed=d.speed*SPEED_SCALE; h.form = d.forms ? d.defaultForm : null; }

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
// origin (ox,oy) = the hunter's hand height; sizes scale with radius r
function drawWeapon(g, ox, oy, aim, h, r){
  g.save(); g.translate(ox, oy); g.rotate(aim);
  const col=h.color, lite=shade(col,0.5), dark=shade(col,-0.3);
  if (h.weapon==='sword'){
    g.fillStyle=lite; g.fillRect(r*0.5, -r*0.11, r*1.35, r*0.22);   // blade reaches past the body
    g.fillStyle=dark; g.fillRect(r*0.32, -r*0.24, r*0.20, r*0.48);  // crossguard
  } else if (h.weapon==='bow'){
    g.strokeStyle=lite; g.lineWidth=r*0.16;
    g.beginPath(); g.arc(r*0.55, 0, r*0.7, -1.15, 1.15); g.stroke();
    g.strokeStyle='#eee'; g.lineWidth=r*0.05;
    g.beginPath(); g.moveTo(r*0.55+Math.cos(-1.15)*r*0.7, Math.sin(-1.15)*r*0.7);
    g.lineTo(r*0.55+Math.cos(1.15)*r*0.7, Math.sin(1.15)*r*0.7); g.stroke();
  } else { // staff
    g.strokeStyle=shade('#7a5230',0.15); g.lineWidth=r*0.15;
    g.beginPath(); g.moveTo(r*0.2, 0); g.lineTo(r*1.2, 0); g.stroke();
    g.fillStyle=lite; g.beginPath(); g.arc(r*1.3, 0, r*0.24, 0, TAU); g.fill();
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
    this.alive=true; this.downed=false; this.bleed=0; this.reviveProg=0; this.reviving=null; this.dots=[];
    this.snareStacks=0; this.snareT=0; this.threatT=0; this.regenLockT=0;
    this.form = h.forms ? h.defaultForm : null;
    this.speedBuffT=0; this.speedBuffMul=1; this.dashVx=0; this.dashVy=0; this.dashT=0;
    this.kills=0; this.hasCrown=false; this.walkT=0;
    // gear
    this.slots=[]; this.recomputeGear();
    // ai
    this.aiTimer=0; this.aiTarget=null; this.wander=rand(0,TAU); this.pingCd=0; this.lootCd=0;
  }
  get effSpeed(){ const snare = 1 - Math.min(0.5, this.snareStacks*0.1);
    return this.speed * (this.speedBuffT>0 ? this.speedBuffMul : 1) * snare; }
  addSnare(){ this.snareStacks = Math.min(5, this.snareStacks+1); this.snareT = 2.5; }

  recomputeGear(){
    let dmg=0, abil=0, steal=0, sh=0, dr=0, atk=1, regen=0, t4=false;
    for (const s of this.slots){
      const lv=GEAR[s.id].levels[s.lvl-1];
      dmg+=lv.dmg||0; abil+=lv.abil||0; steal=Math.max(steal,lv.steal||0);
      sh+=lv.sh||0; dr+=lv.dr||0; regen+=lv.regen||0; if(lv.atk) atk=Math.min(atk,lv.atk);
      if (s.t4) t4=true;
    }
    this.dmgMul=1+dmg; this.abilityMul=1+abil; this.lifesteal=steal;
    this.maxShield=sh; this.dr=dr; this.atkSpeedMul=atk; this.shieldRegen=regen;
    this.trueDamage=t4;                       // Tier-4 gear: damage pierces shields
    if (this.shield < this.maxShield) this.shield = this.maxShield;
  }
  equip(id, lvl=1, t4=false){
    const s = this.slots.find(x=>x.id===id);
    let res;
    if (s){ if (s.lvl<3 || (t4 && !s.t4)){ s.lvl=Math.min(3, Math.max(s.lvl+1, lvl)); if(t4)s.t4=true; res='up'; } else res='max'; }
    else {
      if (this.slots.length<MAX_SLOTS){ this.slots.push({id, lvl:Math.min(3,lvl), t4}); res='new'; }
      else { let lo=this.slots[0]; for(const x of this.slots) if(x.lvl<lo.lvl) lo=x; lo.id=id; lo.lvl=Math.min(3,lvl); lo.t4=t4; res='swap'; }
    }
    this.recomputeGear();
    return res;
  }

  addDot(dps, dur, src){
    const ex = this.dots.find(d=>d.src===src && d.dps===dps);
    if (ex) ex.t = Math.max(ex.t, dur);
    else if (this.dots.length<8) this.dots.push({ dps, t:dur, src });
  }
  takeDamage(amt, src){
    if (!this.alive || (G && G.phase!=='live')) return;   // invulnerable until the drop completes
    amt *= (1 - this.dr);
    const dealt = amt;
    const bypass = src && src.trueDamage;     // Tier-4 attacker pierces shields
    if (!bypass && this.shield>0){ const a=Math.min(this.shield,amt); this.shield-=a; amt-=a; }
    if (amt>0){
      if (this.downed){ this.bleed -= amt*0.04; if(this.bleed<=0) this.die(src); }
      else { this.hp-=amt; if(this.hp<=0){ this.hp=0; this.goDown(src); } }
    }
    if (src && src!==this && src.lifesteal>0 && src.alive && !src.downed)
      src.hp=Math.min(src.maxHp, src.hp+dealt*src.lifesteal);
    if (src && src.team>=0 && src.team!==this.team) this.threatT=6;   // retaliate when attacked
    if (dealt>0) this.regenLockT=5;                                   // out-of-combat regen pauses
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
      dropItem(s.id, s.lvl, this.x+Math.cos(a)*d, this.y+Math.sin(a)*d, s.t4);
    }
    this.slots=[];
    if (this.hasCrown && src && src.team>=0){ this.hasCrown=false; src.hasCrown=true; }
  }
  reviveTo(){ this.downed=false; this.hp=this.maxHp*0.4; this.bleed=0; this.reviveProg=0; this.dots=[];
    Sfx.revive(volAt(this.x,this.y)); addFeed(`${this.name} was revived`); }
}

// ---------- neutral creeps (PvE loot) ----------
class Creep {
  constructor(type, x, y){
    const c=CREEP_TYPES[type];
    this.id=UID++; this.type=type; this.cfg=c; this.team=-1;
    this.x=x; this.y=y; this.spawnX=x; this.spawnY=y;
    this.maxHp=c.hp; this.hp=c.hp; this.radius=c.r; this.color=c.color; this.name=c.name;
    this.alive=true; this.atkCd=0; this.wander=rand(0,TAU); this.wt=rand(1,3);
    this.kills=0; this.bob=rand(0,TAU); this.flash=0; this.drops=[];
  }
  takeDamage(amt, src){
    if (!this.alive || (G && G.phase!=='live')) return;
    this.hp-=amt; this.flash=0.12;
    if (this.hp<=0){ this.hp=0; this.die(src); }
  }
  die(src){
    if (!this.alive) return; this.alive=false;
    spawnBurst(this.x,this.y,this.color, this.type==='boss'?70:24);
    spawnRing(this.x,this.y, this.radius*3, this.color);
    for (const d of this.drops){ const a=rand(0,TAU), r=rand(20,this.radius+40);
      dropItem(d.id, d.lvl, this.x+Math.cos(a)*r, this.y+Math.sin(a)*r, d.t4); }
    if (src && src.kills!=null) src.kills++;
    if (this.type==='boss'){ addFeed('💀 The Storm Titan falls — Tier-4 gear drops!'); Sfx.victory(); }
    else if (this.type==='miniboss') addFeed(`${src?src.name:'Someone'} slew a Mini-Boss`);
    Sfx.kill(volAt(this.x,this.y));
  }
}

// ============================================================
//  MATCH SETUP
// ============================================================
function startMatch(){
  document.getElementById('menu').classList.add('hidden');
  document.getElementById('game').classList.remove('hidden');
  document.getElementById('endScreen').classList.add('hidden');
  resize();
  Input.keys.clear(); Input.mdown=false;
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  Sfx.ambientStart();
  Terrain.generate();
  HUNTER_IDS.forEach(id => Sprites[id] = buildSprite(HUNTERS[id]));

  G = {
    hunters:[], projectiles:[], aoes:[], items:[], pings:[], particles:[], motes:[], swings:[],
    cam:{x:0,y:0}, t:0, over:false, placeWhenDead:0, flash:0, bolt:null, lightT:rand(5,12),
    diff: Lobby.difficulty, phase:'choose', deployT:20, landX:null, landY:null,
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
  G.landX=G.player.x; G.landY=G.player.y;     // default landing = squad spawn
  G.cam.x=G.player.x-canvas.width/2; G.cam.y=G.player.y-canvas.height/2;
  netHostAssign();

  // creeps are the loot source — no random gear scatter anymore
  G.creeps=[]; G.bossSpawned=false;
  spawnCreeps();

  for (let i=0;i<60;i++) G.motes.push({x:rand(0,canvas.width),y:rand(0,canvas.height),
    vx:rand(-8,8),vy:rand(-14,-3),r:rand(0.6,2),a:rand(0.1,0.4)});

  buildAbilityBar();
  G.feedEl=document.getElementById('killfeed');
  lastT=performance.now();
  if (!loopStarted){ loopStarted=true; requestAnimationFrame(loop); }
}

function dropItem(id,lvl,x,y,t4){ id=id||GEAR_IDS[randi(0,GEAR_IDS.length-1)];
  G.items.push({ id, lvl, t4:!!t4, x:clamp(x,20,WORLD-20), y:clamp(y,20,WORLD-20), bob:rand(0,TAU) }); }
const randGear=()=>GEAR_IDS[randi(0,GEAR_IDS.length-1)];

// ---- creep spawning ----
function addCreep(type,x,y,drops){ const c=new Creep(type,clamp(x,80,WORLD-80),clamp(y,80,WORLD-80)); c.drops=drops||[]; G.creeps.push(c); return c; }
function spawnCreeps(){
  const A=WORLD*WORLD;
  // lone little creeps — drop 1 unupgraded piece each
  const littles=Math.floor(A/3000000);
  for (let i=0;i<littles;i++){ const a=rand(0,TAU), r=rand(0,WORLD*0.46);
    addCreep('little', WORLD/2+Math.cos(a)*r, WORLD/2+Math.sin(a)*r, [{id:randGear(),lvl:1}]); }
  // big packs — several little + an alpha that drops a 2/3 piece
  const packs=Math.floor(A/14000000);
  for (let i=0;i<packs;i++){
    const a=rand(0,TAU), r=rand(WORLD*0.1,WORLD*0.44), cx=WORLD/2+Math.cos(a)*r, cy=WORLD/2+Math.sin(a)*r;
    for (let k=0;k<randi(4,6);k++) addCreep('little', cx+rand(-120,120), cy+rand(-120,120), [{id:randGear(),lvl:1}]);
    addCreep('leader', cx+rand(-40,40), cy+rand(-40,40), [{id:randGear(),lvl:1},{id:randGear(),lvl:2}]);
  }
  // mini-bosses — drop 1-2 maxed (3/3) pieces
  const minis=Math.max(2,Math.floor(A/40000000));
  for (let i=0;i<minis;i++){ const a=rand(0,TAU), r=rand(WORLD*0.15,WORLD*0.42);
    const drops=[]; for(let k=0;k<randi(1,2);k++) drops.push({id:randGear(),lvl:3});
    addCreep('miniboss', WORLD/2+Math.cos(a)*r, WORLD/2+Math.sin(a)*r, drops); }
}
function spawnBoss(){
  const drops=[]; for(let k=0;k<randi(1,2);k++) drops.push({id:randGear(),lvl:3,t4:true});
  const b=addCreep('boss', G.zone.cx+rand(-60,60), G.zone.cy+rand(-60,60), drops);
  G.bossSpawned=true; addFeed('☠ THE STORM TITAN HAS AWOKEN at the centre!'); Sfx.zone();
  return b;
}

// ---- deploy / landing ----
function dropSquads(){
  // your squad lands at the chosen spot; enemy squads keep their own spawns
  G.hunters.filter(h=>h.team===G.player.team).forEach(h=>{
    h.x=clamp(G.landX+rand(-90,90),60,WORLD-60); h.y=clamp(G.landY+rand(-90,90),60,WORLD-60);
  });
  spawnBurst(G.landX,G.landY,'#34e3ff',30);
}
function updateDeployCamera(dt){
  const tx=(G.landX!=null?G.landX:G.player.x)-canvas.width/2;
  const ty=(G.landY!=null?G.landY:G.player.y)-canvas.height/2;
  G.cam.x=lerp(G.cam.x,tx,0.15); G.cam.y=lerp(G.cam.y,ty,0.15);
}
function chooseLanding(ev){
  if (!G || G.phase!=='choose') return;
  ev.preventDefault();
  const r=mm.getBoundingClientRect();
  const px=(ev.touches?ev.touches[0].clientX:ev.clientX)-r.left;
  const py=(ev.touches?ev.touches[0].clientY:ev.clientY)-r.top;
  G.landX=clamp(px/r.width*WORLD,0,WORLD); G.landY=clamp(py/r.height*WORLD,0,WORLD);
  if (NETROLE==='client') Net.toHost({t:'land', x:G.landX, y:G.landY});
  Sfx.ping(0.6);
}

// ============================================================
//  ABILITIES
// ============================================================
function cast(ent, slot){
  if (!ent.alive || ent.downed) return false;       // no attacking while downed or dead
  const def = abilityOf(ent, slot);
  if (ent.cd[slot] > 0) return false;
  ent.cd[slot] = def.cd * (slot==='basic' ? ent.atkSpeedMul : 1);
  const isAb = slot!=='basic';
  const dmg = (def.dmg||0) * ent.dmgMul * (isAb ? ent.abilityMul : 1);
  const ax=Math.cos(ent.aim), ay=Math.sin(ent.aim);
  const v=volAt(ent.x,ent.y);

  switch(def.kind){
    case 'swap':
      ent.form = (ent.form==='shadow') ? 'holy' : 'shadow';
      spawnRing(ent.x,ent.y, 70, effColor(ent)); spawnBurst(ent.x,ent.y,effColor(ent),16); Sfx.cast(v);
      if (ent.isPlayer && NETROLE!=='client') buildAbilityBar();
      break;
    case 'proj': fireProj(ent,def,ent.aim,dmg); Sfx.shoot(v); break;
    case 'burst': { const start=ent.aim-def.spread/2;
      for(let i=0;i<def.count;i++) fireProj(ent,def,start+def.spread*(i/(def.count-1||1)),dmg);
      Sfx.shoot(v); break; }
    case 'cone': coneHit(ent,def,dmg); spawnSwing(ent,def); Sfx.dash(v); break;
    case 'dash': {
      ent.dashVx=ax*(def.range*4); ent.dashVy=ay*(def.range*4); ent.dashT=0.25;
      if (def.hitRange>0) setTimeout(()=>{ if(ent.alive) coneHit(ent,{...def,range:def.hitRange},dmg); },120);
      spawnBurst(ent.x,ent.y,effColor(ent),8); Sfx.dash(v); break; }
    case 'blink': ent.x=clamp(ent.x+ax*def.range,40,WORLD-40); ent.y=clamp(ent.y+ay*def.range,40,WORLD-40);
      spawnBurst(ent.x,ent.y,effColor(ent),14); Sfx.cast(v); break;
    case 'shield': ent.shield=Math.max(ent.shield,def.amount); Sfx.cast(v); break;
    case 'aoe': case 'dotaoe': { let tx=ent.x,ty=ent.y;
      if (def.atCursor){ if(ent.isPlayer){const w=worldMouse();tx=w.x;ty=w.y;}
        else if(ent.aiTarget){tx=ent.aiTarget.x;ty=ent.aiTarget.y;} else {tx=ent.x+ax*220;ty=ent.y+ay*220;} }
      addAoe(ent,tx,ty,def.radius,dmg,def.delay,def.dot||null); Sfx.cast(v); break; }
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
    radius:def.radius*1.45, life:def.range/def.speed, pierce:!!def.pierce, color:effColor(ent), hits:new Set(), dot:def.dot||null });
}
function coneHit(ent,def,dmg){
  const inArc=o=>dist(o.x,o.y,ent.x,ent.y)<=def.range+o.radius && Math.abs(angDiff(angTo(ent.x,ent.y,o.x,o.y),ent.aim))<=def.arc/2;
  G.hunters.forEach(o=>{ if(o.team===ent.team||!o.alive) return;
    if (inArc(o)){ o.takeDamage(dmg,ent); if(def.snare) o.addSnare(); spawnBurst(o.x,o.y,'#fff',6); Sfx.hit(volAt(o.x,o.y)); }});
  if (ent.team>=0) for(const c of G.creeps){ if(c.alive && inArc(c)){ c.takeDamage(dmg,ent); spawnBurst(c.x,c.y,'#fff',6); } }
}
function addAoe(ent,x,y,r,dmg,delay,dot){ G.aoes.push({x,y,r,dmg,team:ent.team,owner:ent,t:delay,max:delay,color:effColor(ent),dot:dot||null}); }

// ============================================================
//  CONTROL
// ============================================================
// ----- input source (keyboard/mouse or touch) -----
const Mobile = {
  on:false,
  move:{id:null, ox:0, oy:0, nx:0, ny:0, active:false, cx:0, cy:0},
  aim:{id:null, ox:0, oy:0, ang:0, active:false, firing:false, cx:0, cy:0},
  lastAim:0
};
function readMoveAim(p){
  if (Mobile.on){
    if (Mobile.aim.active) Mobile.lastAim=Mobile.aim.ang;
    const aim=Mobile.lastAim;
    if (G && G.cam){ Input.mx=(p.x+Math.cos(aim)*420)-G.cam.x; Input.my=(p.y+Math.sin(aim)*420)-G.cam.y; }
    return { mx:Mobile.move.nx, my:Mobile.move.ny, aim, fire:Mobile.aim.firing };
  }
  let mx=0,my=0;
  if (Input.keys.has('w')) my--; if (Input.keys.has('s')) my++;
  if (Input.keys.has('a')) mx--; if (Input.keys.has('d')) mx++;
  const ml=Math.hypot(mx,my)||1;
  const w=worldMouse();
  return { mx:mx/ml, my:my/ml, aim:angTo(p.x,p.y,w.x,w.y), fire:Input.mdown };
}

function controlPlayer(p, dt){
  const r=readMoveAim(p);
  p.moveX=r.mx; p.moveY=r.my; p.aim=r.aim;
  const w=worldMouse();

  p.reviving=null;
  if (p.downed) return;

  if (r.fire) cast(p,'basic');
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

// difficulty helpers (apply to enemy squads; your allied AI stays Normal)
function isEnemyAI(e){ return e.team!==G.player.team; }
function aimErr(e){ if(!isEnemyAI(e)) return 0.05; return G.diff==='easy'?0.24 : G.diff==='hard'?0.015 : 0.05; }
function lootRange(e){ if(!isEnemyAI(e)) return 1100; return G.diff==='easy'?500 : G.diff==='hard'?2000 : 1100; }
function gearCap(e){ return (isEnemyAI(e) && G.diff==='easy') ? 1 : 3; }   // easy enemies don't upgrade
function engageRange(e){ // easy enemies don't seek players early — but still fight back when attacked
  if (isEnemyAI(e) && G.diff==='easy' && G.zone.stage<2 && e.threatT<=0) return 300;
  return G.diff==='hard' ? 900 : 820;
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
  else if (foe && fd < engageRange(e)){
    fight=true; e.aiTarget=foe;
    const ranged=abilityOf(e,'basic').kind==='proj'; const ideal=ranged?340:64;
    const a=angTo(e.x,e.y,foe.x,foe.y); const err=aimErr(e); e.aim=a+rand(-err,err);
    if (fd>ideal+40){ gx=foe.x; gy=foe.y; }
    else if (fd<ideal-40){ gx=e.x-(foe.x-e.x); gy=e.y-(foe.y-e.y); }
    else { e.moveX=Math.cos(a+Math.PI/2)*((e.id%2)?1:-1); e.moveY=Math.sin(a+Math.PI/2)*((e.id%2)?1:-1); }
    cast(e,'basic');
    if (fd<560) cast(e,'q');
    if (e.hp<e.maxHp*0.6) cast(e,'e');
    if (fd<480) cast(e,'r');
    if (abilityOf(e,'q').kind==='heal'||abilityOf(e,'e').kind==='speed'){ cast(e,'q'); cast(e,'e'); }
  }
  else {
    // grab dropped gear first, otherwise farm a creep, otherwise roam toward centre
    const item=nearestNeededItem(e);
    const cr = (!item || dist2(e.x,e.y,item.x,item.y)>360*360) ? nearestCreep(e, lootRange(e)) : null;
    if (item && dist(e.x,e.y,item.x,item.y)<280){ gx=item.x; gy=item.y; if(dist(e.x,e.y,item.x,item.y)<32 && e.lootCd<=0){ equipItem(e,item); e.lootCd=0.5; } }
    else if (cr && (cr.type!=='boss' || e.team===G.player.team)){      // AI farms creeps; only your squad rushes the boss
      fight=true; const a=angTo(e.x,e.y,cr.x,cr.y); const err=aimErr(e); e.aim=a+rand(-err,err);
      const reach=e.radius+cr.radius+(abilityOf(e,'basic').kind==='proj'?260:30);
      if (dist(e.x,e.y,cr.x,cr.y)>reach){ gx=cr.x; gy=cr.y; }
      cast(e,'basic'); cast(e,'q');
    }
    else if (item){ gx=item.x; gy=item.y; if(dist(e.x,e.y,item.x,item.y)<32 && e.lootCd<=0){ equipItem(e,item); e.lootCd=0.5; } }
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
  return Math.sqrt(bd)<lootRange(e)?best:null; }
function aiNeedsItem(e,it){ const s=e.slots.find(x=>x.id===it.id);
  const cap=gearCap(e);
  if (it.t4 && cap>=3) return !s || !s.t4;   // tier-4 true-damage gear is always wanted
  if (!s) return cap>=1;                      // new item — grab it (easy enemies still grab one)
  return s.lvl<cap || (it.lvl>s.lvl && s.lvl<cap);
}
function equipItem(ent,it){
  const res=ent.equip(it.id, it.lvl, it.t4);
  const i=G.items.indexOf(it); if(i>=0) G.items.splice(i,1);
  if (res==='max') return;
  Sfx.pickup(volAt(ent.x,ent.y)); spawnBurst(ent.x,ent.y, it.t4?'#ffd24a':GEAR[it.id].color,8);
  if (ent.isPlayer){ const g=GEAR[it.id]; const s=ent.slots.find(x=>x.id===it.id);
    addFeed(`${res==='up'?'Upgraded':'Equipped'} ${g.name} ${s&&s.t4?'T4 (true damage!)':(s?'Lv'+s.lvl:'')} — ${g.blurb[(s?s.lvl:1)-1]}`); }
}

// ============================================================
//  PINGS / EFFECTS
// ============================================================
function addPing(x,y,team,by){ G.pings.push({x,y,team,t:4,by}); Sfx.ping(volAt(x,y)*(by===G.player?1.4:1)); }
function addFeedDOM(txt){ if(!G||!G.feedEl) return; const el=document.createElement('div'); el.className='kf'; el.textContent=txt;
  G.feedEl.prepend(el); while(G.feedEl.children.length>6) G.feedEl.lastChild.remove(); setTimeout(()=>el.remove(),5000); }
function addFeed(txt){ addFeedDOM(txt); if(NETROLE==='host') Net.broadcast({t:'feed', x:txt}); }
function spawnBurst(x,y,color,n){ for(let i=0;i<n;i++){ const a=rand(0,TAU),s=rand(40,220);
  G.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rand(.3,.6),color,r:rand(2,4)}); } }
function spawnRing(x,y,r,color){ G.particles.push({ring:true,x,y,maxR:r,life:.5,color}); }
function spawnSwing(ent,def){ if(!G.swings) G.swings=[];
  G.swings.push({ x:ent.x, y:ent.y, aim:ent.aim, arc:def.arc, range:def.range, t:0.2, max:0.2 }); }

// ============================================================
//  UPDATE
// ============================================================
function update(dt){
  const z=G.zone; G.t+=dt;

  // --- deploy / landing phase ---
  if (G.phase!=='live'){
    G.deployT-=dt;
    if (G.phase==='choose' && G.deployT<=5){ G.phase='grace'; dropSquads(); Sfx.zone(); addFeed('Hunters deployed — grace period'); }
    if (G.deployT<=0){ G.phase='live'; addFeed('⚔ The hunt begins!'); }
  }
  if (G.phase==='choose'){
    // world frozen while everyone picks a landing zone
    updateDeployCamera(dt);
    if (NETROLE==='host' && Net.count()>0){ netAccum+=dt; if(netAccum>=1/12){ netAccum=0; for(const id in Net.conns) Net.send(id, encodeSnapshot(id)); } }
    updateHUD();
    return;
  }
  const live = G.phase==='live';

  // zone shrink (only once live)
  if (live){
    z.nextShrink-=dt;
    if (z.nextShrink<=0 && z.target>WORLD*0.05){
      z.stage++; z.target=Math.max(WORLD*0.05, z.target*0.7);
      z.nextShrink=Math.max(20, 40-z.stage*2.5);
      addFeed('⚠ The storm is closing in'); Sfx.zone();
    }
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
    // damage-over-time ticks
    if (e.dots.length){ for(let i=e.dots.length-1;i>=0;i--){ const d=e.dots[i]; d.t-=dt;
      e.takeDamage(d.dps*dt, d.src); if(!e.alive) break; if(d.t<=0) e.dots.splice(i,1); }
      if(!e.alive) continue; }
    for (const k in e.cd) if (e.cd[k]>0) e.cd[k]-=dt;
    if (e.speedBuffT>0) e.speedBuffT-=dt;
    if (e.snareT>0){ e.snareT-=dt; if(e.snareT<=0) e.snareStacks=0; }
    if (e.threatT>0) e.threatT-=dt;
    if (e.pingCd>0) e.pingCd-=dt;
    if (e.lootCd>0) e.lootCd-=dt;
    if (e.reviveProg>0 && !e.beingRevived) e.reviveProg=Math.max(0,e.reviveProg-dt*0.5);
    e.beingRevived=false;
    if (e.shieldRegen>0 && e.shield<e.maxShield && !e.downed) e.shield=Math.min(e.maxShield,e.shield+e.shieldRegen*dt);
    // passive healing while out of combat (no damage taken for 5s)
    if (e.regenLockT>0) e.regenLockT-=dt;
    else if (!e.downed && e.hp<e.maxHp) e.hp=Math.min(e.maxHp, e.hp + e.maxHp*0.06*dt);

    if (e.isPlayer) controlPlayer(e,dt);
    else if (e.human) applyRemoteControl(e,dt);
    else controlAI(e,dt);

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
      if (dist(p.x,p.y,o.x,o.y)<o.radius+p.radius){ o.takeDamage(p.dmg,p.owner); if(p.dot) o.addDot(p.dot.dps,p.dot.dur,p.owner); spawnBurst(p.x,p.y,p.color,5);
        Sfx.hit(volAt(p.x,p.y)); p.hits.add(o.id); if(!p.pierce){dead=true;break;} } }
    if (!dead && p.owner && p.owner.team>=0) for (const c of G.creeps){ if(!c.alive||p.hits.has(c.id)) continue;
      if (dist(p.x,p.y,c.x,c.y)<c.radius+p.radius){ c.takeDamage(p.dmg,p.owner); spawnBurst(p.x,p.y,p.color,5);
        Sfx.hit(volAt(p.x,p.y)); p.hits.add(c.id); if(!p.pierce){dead=true;break;} } }
    if (dead) G.projectiles.splice(i,1);
  }
  // aoes
  for (let i=G.aoes.length-1;i>=0;i--){ const a=G.aoes[i]; a.t-=dt;
    if (a.t<=0){ for(const o of G.hunters){ if(o.team===a.team||!o.alive) continue;
        if(dist(a.x,a.y,o.x,o.y)<a.r+o.radius){ o.takeDamage(a.dmg,a.owner); if(a.dot) o.addDot(a.dot.dps,a.dot.dur,a.owner); } }
      if (a.owner && a.owner.team>=0) for(const c of G.creeps){ if(c.alive && dist(a.x,a.y,c.x,c.y)<a.r+c.radius) c.takeDamage(a.dmg,a.owner); }
      spawnBurst(a.x,a.y,a.color,18); spawnRing(a.x,a.y,a.r,a.color); Sfx.explode(volAt(a.x,a.y)); G.aoes.splice(i,1); }
  }
  for (let i=G.pings.length-1;i>=0;i--){ G.pings[i].t-=dt; if(G.pings[i].t<=0) G.pings.splice(i,1); }
  for (let i=G.particles.length-1;i>=0;i--){ const p=G.particles[i]; p.life-=dt;
    if(!p.ring){ p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=0.9; p.vy*=0.9; } if(p.life<=0) G.particles.splice(i,1); }
  if (G.swings) for(let i=G.swings.length-1;i>=0;i--){ G.swings[i].t-=dt; if(G.swings[i].t<=0) G.swings.splice(i,1); }

  // motes (screen space)
  for (const m of G.motes){ m.x+=m.vx*dt; m.y+=m.vy*dt;
    if(m.y<-5){m.y=canvas.height+5;m.x=rand(0,canvas.width);} if(m.x<-5)m.x=canvas.width+5; if(m.x>canvas.width+5)m.x=-5; }

  // creeps (movement, aggro, contact damage, death)
  updateCreeps(dt);
  // the Storm Titan awakens at the centre once the lobby thins out
  if (live && !G.bossSpawned && G.hunters.filter(h=>h.alive).length<=BOSS_TRIGGER) spawnBoss();

  // camera follow (player, or living teammate if dead)
  G.camFollow = G.player.alive ? G.player : (G.hunters.find(o=>o.team===G.player.team&&o.alive)||G.player);
  G.cam.x=lerp(G.cam.x,G.camFollow.x-canvas.width/2,0.1);
  G.cam.y=lerp(G.cam.y,G.camFollow.y-canvas.height/2,0.1);

  // host: stream world snapshots to clients (~12 Hz)
  if (NETROLE==='host' && Net.count()>0){ netAccum+=dt; if(netAccum>=1/12){ netAccum=0; for(const id in Net.conns) Net.send(id, encodeSnapshot(id)); } }

  checkEnd(); updateHUD();
}

function updateCreeps(dt){
  for (let i=G.creeps.length-1;i>=0;i--){
    const c=G.creeps[i]; if(!c.alive){ G.creeps.splice(i,1); continue; }
    if (c.flash>0) c.flash-=dt; if (c.atkCd>0) c.atkCd-=dt;
    // nearest hunter
    let tgt=null,td=c.cfg.aggro*c.cfg.aggro;
    for (const h of G.hunters){ if(!h.alive||h.downed) continue; const d=dist2(c.x,c.y,h.x,h.y); if(d<td){td=d;tgt=h;} }
    if (tgt){
      const a=angTo(c.x,c.y,tgt.x,tgt.y), reach=c.radius+tgt.radius+6, d=dist(c.x,c.y,tgt.x,tgt.y);
      if (d>reach){ c.x+=Math.cos(a)*c.cfg.speed*dt; c.y+=Math.sin(a)*c.cfg.speed*dt; }
      else if (c.atkCd<=0){ tgt.takeDamage(c.cfg.dmg, c); c.atkCd=1; spawnBurst(tgt.x,tgt.y,c.color,5); }
    } else {
      // wander near spawn (boss holds the centre)
      c.wt-=dt; if(c.wt<=0){ c.wander=rand(0,TAU); c.wt=rand(1.5,4); }
      const home = c.type==='boss' ? dist(c.x,c.y,G.zone.cx,G.zone.cy)>120 : dist(c.x,c.y,c.spawnX,c.spawnY)>180;
      const ang = home ? angTo(c.x,c.y, c.type==='boss'?G.zone.cx:c.spawnX, c.type==='boss'?G.zone.cy:c.spawnY) : c.wander;
      c.x+=Math.cos(ang)*c.cfg.speed*0.5*dt; c.y+=Math.sin(ang)*c.cfg.speed*0.5*dt;
    }
    c.x=clamp(c.x,40,WORLD-40); c.y=clamp(c.y,40,WORLD-40);
    // storm hurts creeps too (keeps the field clean late game)
    if (dist(c.x,c.y,G.zone.cx,G.zone.cy)>G.zone.r) c.takeDamage((6+G.zone.stage*3)*dt, null);
  }
}
function nearestCreep(e,range){ let best=null,bd=range*range;
  for(const c of G.creeps){ if(!c.alive) continue; const d=dist2(e.x,e.y,c.x,c.y); if(d<bd){bd=d;best=c;} } return best; }

function checkEnd(){
  if (G.over) return;
  const teams=new Set(); for(const e of G.hunters) if(e.alive) teams.add(e.team);
  if (teams.size<=1){ G.over=true; const won=teams.has(G.player.team); setTimeout(()=>showEnd(won),800); }
  else if (!G.hunters.some(e=>e.team===G.player.team&&e.alive)){ G.over=true; G.placeWhenDead=teams.size+1; setTimeout(()=>showEnd(false),800); }
}
function endScreenShow(won, place, yourKills, squadKills, sub){
  Sfx.ambientStop(); won?Sfx.victory():Sfx.defeat();
  document.getElementById('endScreen').classList.remove('hidden');
  document.getElementById('endIcon').textContent = won?'👑':'💀';
  document.getElementById('endTitle').textContent = won?'VICTORY':'DEFEATED';
  document.getElementById('endSub').textContent = sub || (won
    ? 'Your squad is the last team standing. The crown is yours.'
    : `Your squad placed #${place} of ${SQUADS}.`);
  document.getElementById('endStats').innerHTML =
    `<div><b>#${place}</b><span>Placement</span></div>
     <div><b>${yourKills}</b><span>Your Kills</span></div>
     <div><b>${squadKills}</b><span>Squad Kills</span></div>`;
  if (won){ localStorage.setItem('stormfall_crown','1'); localStorage.setItem('stormfall_wins', (+(localStorage.getItem('stormfall_wins')||0)+1)); }
  else localStorage.setItem('stormfall_crown','0');
}
function showEnd(won){   // host / solo
  const place = won?1:(G.placeWhenDead||2);
  const sk = G.hunters.filter(e=>e.team===G.player.team).reduce((a,e)=>a+e.kills,0);
  endScreenShow(won, place, G.player.kills, sk);
  if (NETROLE==='host'){
    for (const id in Net.conns){ const me=G.hunters.find(h=>h.controlledBy===id);
      Net.send(id, {t:'end', won, place, yourKills: me?me.kills:0, squadKills: sk}); }
  }
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
  const a=s=>abilityOf(p,s);
  make('basic', a('basic'), abilityDesc(a('basic')));
  make('dash', {key:'SPC',emoji:'💨',name:'Dash',cd:3}, DASH_DESC);
  make('q', a('q'), abilityDesc(a('q')));
  make('e', a('e'), abilityDesc(a('e')));
  make('r', a('r'), abilityDesc(a('r')));
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
  // mobile ability buttons cooldowns
  document.querySelectorAll('#mobileButtons .mbtn[data-slot]').forEach(el=>{ const slot=el.dataset.slot; if(!slot) return;
    const cd=p.cd[slot]||0; const cool=el.querySelector('.cool');
    if(cd>0.05){ cool.classList.remove('hidden'); cool.textContent=cd.toFixed(1); } else cool.classList.add('hidden'); });

  // deploy / landing banner
  const db=document.getElementById('deployBanner'), mini=document.getElementById('minimap');
  if (G.phase && G.phase!=='live'){
    db.classList.remove('hidden');
    if (G.phase==='choose'){
      db.innerHTML=`<b>DROP IN ${Math.max(0,Math.ceil(G.deployT-5))}s</b><small>Click the map to choose your squad's landing zone — green = loot</small>`;
      mini.style.display='none';
    } else {
      db.innerHTML=`<b>GRACE — ${Math.max(0,Math.ceil(G.deployT))}s</b><small>Grab gear &amp; position — you're invulnerable until the storm hits</small>`;
      mini.style.display='';
    }
  } else { db.classList.add('hidden'); mini.style.display=''; }

  // gear bar
  const gb=document.getElementById('gearBar'); let html='';
  for (let i=0;i<MAX_SLOTS;i++){ const s=p.slots[i];
    if (s){ const g=GEAR[s.id]; let pips=''; for(let l=0;l<3;l++) pips+=`<span class="pip ${l<s.lvl?'on':''}"></span>`;
      html+=`<div class="gear-slot"${s.t4?' style="border-color:var(--gold)"':''}><span class="gi">${g.emoji}</span>
        <span class="gn">${g.name}${s.t4?' <b style="color:var(--gold)">T4</b>':''} <small>${s.t4?'pierces shields':g.blurb[s.lvl-1]}</small></span>
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
function inVision(x,y){ const t=G.player?G.player.team:0;
  for(const h of G.hunters){ if(h.alive && h.team===t && dist2(h.x,h.y,x,y)<VISION*VISION) return true; }
  return false; }

let fogCanvas=null, fogCtx=null;
function drawFog(cam){
  const w=canvas.width, h=canvas.height;
  if(!fogCanvas){ fogCanvas=document.createElement('canvas'); fogCtx=fogCanvas.getContext('2d'); }
  if(fogCanvas.width!==w||fogCanvas.height!==h){ fogCanvas.width=w; fogCanvas.height=h; }
  const fc=fogCtx; fc.clearRect(0,0,w,h);
  fc.fillStyle='rgba(4,7,14,0.88)'; fc.fillRect(0,0,w,h);
  fc.globalCompositeOperation='destination-out';
  const t=G.player?G.player.team:0;
  for(const o of G.hunters){ if(!o.alive||o.team!==t) continue;
    const sx=o.x-cam.x, sy=o.y-cam.y;
    const g=fc.createRadialGradient(sx,sy,VISION*0.55,sx,sy,VISION);
    g.addColorStop(0,'rgba(0,0,0,1)'); g.addColorStop(1,'rgba(0,0,0,0)');
    fc.fillStyle=g; fc.beginPath(); fc.arc(sx,sy,VISION,0,TAU); fc.fill(); }
  fc.globalCompositeOperation='source-over';
  ctx.drawImage(fogCanvas,0,0);
}

function draw(){
  if (G.phase==='choose'){ drawDeployOverview(); return; }
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
    const g=GEAR[it.id], bob=Math.sin(G.t*3+it.bob)*3, col=it.t4?'#ffd24a':g.color;
    if (it.t4){ ctx.beginPath(); ctx.arc(sx,sy+bob,15,0,TAU); ctx.strokeStyle='rgba(255,210,74,.5)'; ctx.lineWidth=1; ctx.stroke(); }
    ctx.beginPath(); ctx.arc(sx,sy+bob,12,0,TAU); ctx.fillStyle=col+'33'; ctx.fill();
    ctx.strokeStyle=col; ctx.lineWidth=2; ctx.stroke();
    ctx.font='14px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle='#fff'; ctx.fillText(g.emoji,sx,sy+bob+1);
    ctx.font='11px sans-serif'; ctx.fillStyle=col;
    ctx.fillText(g.name+(it.t4?' T4✦':(it.lvl>1?' Lv'+it.lvl:'')), sx, sy+bob-20);
  }

  // aoes
  for (const a of G.aoes){ const sx=a.x-cam.x, sy=a.y-cam.y, f=1-a.t/a.max;
    ctx.beginPath(); ctx.arc(sx,sy,a.r,0,TAU); ctx.fillStyle=a.color+'22'; ctx.fill();
    ctx.beginPath(); ctx.arc(sx,sy,a.r*f,0,TAU); ctx.strokeStyle=a.color; ctx.lineWidth=3; ctx.stroke(); }

  // cleave swings (Vanguard)
  if (G.swings) for (const s of G.swings){ const sx=s.x-cam.x, sy=s.y-cam.y;
    const k=s.t/s.max, p=clamp((1-k)*1.25,0,1);
    const a0=s.aim-s.arc/2, a1=a0+s.arc*p;
    ctx.beginPath(); ctx.moveTo(sx,sy); ctx.arc(sx,sy,s.range,a0,a1); ctx.closePath();
    ctx.fillStyle=`rgba(255,205,130,${0.30*k})`; ctx.fill();
    ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(sx+Math.cos(a1)*s.range, sy+Math.sin(a1)*s.range);
    ctx.strokeStyle=`rgba(255,245,210,${0.85*k})`; ctx.lineWidth=3.5; ctx.stroke(); }

  // pings
  for (const pg of G.pings){ const sx=pg.x-cam.x, sy=pg.y-cam.y, pulse=1+Math.sin(G.t*8)*0.15;
    ctx.beginPath(); ctx.arc(sx,sy,16*pulse,0,TAU); ctx.strokeStyle='#ffd24a'; ctx.lineWidth=3; ctx.stroke();
    ctx.fillStyle='#ffd24a'; ctx.font='16px sans-serif'; ctx.textAlign='center'; ctx.fillText('⚑',sx,sy-22); }

  // projectiles
  for (const p of G.projectiles){ const sx=p.x-cam.x, sy=p.y-cam.y;
    ctx.beginPath(); ctx.arc(sx,sy,p.radius,0,TAU); ctx.fillStyle=p.color; ctx.shadowColor=p.color; ctx.shadowBlur=10; ctx.fill(); ctx.shadowBlur=0; }

  // creeps (only those your squad can see)
  for (const c of G.creeps){ if(!c.alive) continue;
    if (!inVision(c.x,c.y)) continue;
    const sx=c.x-cam.x, sy=c.y-cam.y;
    if(sx<-90||sy<-90||sx>w+90||sy>h+90) continue;
    const big=c.type==='boss'||c.type==='miniboss';
    ctx.fillStyle='rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(sx,sy+c.radius*0.6,c.radius*0.9,c.radius*0.4,0,0,TAU); ctx.fill();
    const bob=Math.sin(G.t*4+c.bob)*c.radius*0.06;
    ctx.beginPath(); ctx.arc(sx,sy+bob,c.radius,0,TAU);
    ctx.fillStyle=c.flash>0?'#fff':c.color; ctx.fill();
    ctx.strokeStyle=shade(c.color,-0.4); ctx.lineWidth=big?4:2; ctx.stroke();
    // eyes
    ctx.fillStyle='#1a1a1a'; ctx.beginPath(); ctx.arc(sx-c.radius*0.32,sy+bob-c.radius*0.1,c.radius*0.16,0,TAU); ctx.arc(sx+c.radius*0.32,sy+bob-c.radius*0.1,c.radius*0.16,0,TAU); ctx.fill();
    // hp bar
    const bw=c.radius*2.2, by=sy-c.radius-(big?16:9);
    ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(sx-bw/2,by,bw,big?6:4);
    ctx.fillStyle=c.color; ctx.fillRect(sx-bw/2,by,bw*clamp(c.hp/c.maxHp,0,1),big?6:4);
    if (big){ ctx.font='bold 12px sans-serif'; ctx.textAlign='center'; ctx.fillStyle=c.type==='boss'?'#ff7a7a':'#d9a0c0'; ctx.fillText(c.type==='boss'?'⚠ STORM TITAN':'MINI-BOSS', sx, by-6); }
  }

  // entities (allies always; enemies only in vision)
  for (const e of G.hunters){ if(!e.alive) continue;
    const ally=e.team===G.player.team;
    if (!ally && !inVision(e.x,e.y)) continue;
    const sx=e.x-cam.x, sy=e.y-cam.y;
    if(sx<-80||sy<-100||sx>w+80||sy>h+100) continue;
    const ring=e.isPlayer?'#ffd24a':ally?'#46e08a':'#ff5a5a';

    if (e.reviving){ ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(e.reviving.x-cam.x,e.reviving.y-cam.y);
      ctx.strokeStyle='rgba(70,224,138,.6)'; ctx.lineWidth=3; ctx.stroke(); }

    // ground ring (team)
    ctx.beginPath(); ctx.ellipse(sx, sy+e.radius*0.55, e.radius*0.95, e.radius*0.42, 0,0,TAU);
    ctx.fillStyle=ring+'33'; ctx.fill(); ctx.strokeStyle=ring; ctx.lineWidth=2; ctx.stroke();

    // weapon behind if aiming up
    const sprite=Sprites[e.hid]; const H=e.radius*2.7, sc=H/18, W=16*sc;
    const handY=sy - e.radius*0.35;
    const aimingUp=Math.sin(e.aim)<0;
    if (aimingUp) drawWeapon(ctx,sx,handY,e.aim,e.def,e.radius);

    // Priest form aura (gold = Holy, violet = Shadow)
    if (e.def.forms){ const fc=e.form==='shadow'?'#b15cff':'#ffe08a';
      ctx.globalAlpha=0.45+0.2*Math.sin(G.t*4); ctx.beginPath(); ctx.arc(sx,sy,e.radius+5,0,TAU);
      ctx.strokeStyle=fc; ctx.lineWidth=3; ctx.stroke(); ctx.globalAlpha=1; }
    // affliction (DoT) aura
    if (e.dots.length){ ctx.beginPath(); ctx.arc(sx,sy,e.radius+4,0,TAU); ctx.strokeStyle='rgba(155,93,229,.8)';
      ctx.lineWidth=2; ctx.setLineDash([3,4]); ctx.stroke(); ctx.setLineDash([]);
      if (Math.random()<0.25) G.particles.push({x:e.x+rand(-e.radius,e.radius),y:e.y+rand(-e.radius,e.radius),vx:0,vy:rand(-20,-50),life:.5,color:'#9b5de5',r:2}); }
    // snare shackle (Vanguard cleave)
    if (e.snareStacks>0){ ctx.beginPath(); ctx.arc(sx,sy+e.radius*0.55,e.radius*0.8,0.2,Math.PI-0.2);
      ctx.strokeStyle=`rgba(255,138,61,${0.4+e.snareStacks*0.12})`; ctx.lineWidth=2.5; ctx.stroke(); }
    // shield ring
    if (e.shield>0){ ctx.beginPath(); ctx.arc(sx,sy,e.radius+6,0,TAU); ctx.strokeStyle='rgba(52,227,255,.8)'; ctx.lineWidth=3; ctx.stroke(); }

    // sprite
    const bob=(e.moveX||e.moveY)&&!e.downed?Math.abs(Math.sin(e.walkT))*-2.5:0;
    const flip=Math.cos(e.aim)<0;
    ctx.save();
    if (e.downed) ctx.globalAlpha=0.7;
    ctx.translate(sx - W/2, sy+e.radius*0.55 - H + bob);   // centre sprite over the ring
    if (flip){ ctx.translate(W,0); ctx.scale(-1,1); }
    ctx.drawImage(sprite, 0,0, W, H);
    ctx.restore();

    if (!aimingUp) drawWeapon(ctx,sx,handY,e.aim,e.def,e.radius);

    if (e.hasCrown){ ctx.font='18px sans-serif'; ctx.textAlign='center'; ctx.fillText('👑',sx,sy-H+e.radius*0.55-8); }

    // hp bar
    const bw=44,bh=5,by=sy-H+e.radius*0.55-(e.hasCrown?22:6);
    ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(sx-bw/2,by,bw,bh);
    ctx.fillStyle=e.downed?'#ff5a5a':ally?'#46e08a':'#ff7a7a';
    ctx.fillRect(sx-bw/2,by,bw*clamp(e.downed?e.bleed/12:e.hp/e.maxHp,0,1),bh);
    if (e.shield>0 && !e.downed){ ctx.fillStyle='#34e3ff'; ctx.fillRect(sx-bw/2,by-3,bw*clamp(e.shield/300,0,1),2); }

    ctx.font='11px sans-serif'; ctx.textAlign='center'; ctx.fillStyle=e.isPlayer?'#ffd24a':ring; ctx.fillText(e.isPlayer?'You':e.name,sx,by-7);
    if (e.downed){ ctx.fillStyle='#ff5a5a'; ctx.font='bold 12px sans-serif'; ctx.fillText('DOWN',sx,sy+e.radius+14); }
    // teammate marker — a bobbing chevron so allies are easy to spot
    if (ally && !e.isPlayer){
      const cyy=by-16+Math.sin(G.t*4+e.id)*2;
      ctx.fillStyle='#46e08a'; ctx.strokeStyle='#0a1018'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(sx-8,cyy); ctx.lineTo(sx+8,cyy); ctx.lineTo(sx,cyy+9); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
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

  // landing marker (deploy choose phase)
  if (G.phase==='choose' && G.landX!=null){
    const sx=G.landX-cam.x, sy=G.landY-cam.y;
    ctx.strokeStyle='#34e3ff'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(sx,sy,28+Math.sin(G.t*5)*5,0,TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx,sy-40); ctx.lineTo(sx,sy+40); ctx.moveTo(sx-40,sy); ctx.lineTo(sx+40,sy); ctx.globalAlpha=0.5; ctx.stroke(); ctx.globalAlpha=1;
    ctx.fillStyle='#34e3ff'; ctx.font='bold 14px sans-serif'; ctx.textAlign='center'; ctx.fillText('DROP ZONE',sx,sy-48);
  }

  // fog of war
  drawFog(cam);

  // dust motes (screen space)
  for (const m of G.motes){ ctx.globalAlpha=m.a; ctx.fillStyle='#cfe2ff';
    ctx.beginPath(); ctx.arc(m.x,m.y,m.r,0,TAU); ctx.fill(); } ctx.globalAlpha=1;

  // vignette
  const vg=ctx.createRadialGradient(w/2,h/2,Math.min(w,h)*0.35, w/2,h/2,Math.max(w,h)*0.75);
  vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,.45)');
  ctx.fillStyle=vg; ctx.fillRect(0,0,w,h);

  // off-screen teammate direction arrows
  drawTeammateArrows(cam);

  // mobile joysticks
  if (Mobile.on){
    const drawStick=(s,col)=>{ if(s.id===null) return;
      ctx.globalAlpha=0.5; ctx.strokeStyle=col; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(s.ox,s.oy,64,0,TAU); ctx.stroke();
      ctx.fillStyle=col; ctx.beginPath(); ctx.arc(s.cx,s.cy,26,0,TAU); ctx.fill(); ctx.globalAlpha=1; };
    drawStick(Mobile.move,'#34e3ff'); drawStick(Mobile.aim,'#ff5da2');
  }

  drawMinimap();
}

function drawTeammateArrows(cam){
  const ref=G.camFollow||G.player; if(!ref) return;
  const w=canvas.width, h=canvas.height, cx=w/2, cy=h/2, t=G.player?G.player.team:0, mg=58;
  for (const o of G.hunters){
    if (!o.alive || o.team!==t || o===ref) continue;
    const sx=o.x-cam.x, sy=o.y-cam.y;
    if (sx>=0&&sy>=0&&sx<=w&&sy<=h) continue;            // on-screen already has a chevron
    const ang=Math.atan2(sy-cy, sx-cx);
    const hw=cx-mg, hh=cy-mg;
    const d=Math.min(Math.abs(hw/Math.cos(ang))||1e9, Math.abs(hh/Math.sin(ang))||1e9);
    const ex=cx+Math.cos(ang)*d, ey=cy+Math.sin(ang)*d;
    const dist_m=Math.round(dist(o.x,o.y,G.camFollow.x,G.camFollow.y)/10);
    ctx.save(); ctx.translate(ex,ey);
    ctx.fillStyle=o.downed?'#ff5a5a':'#46e08a'; ctx.strokeStyle='#0a1018'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(0,0,15,0,TAU); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.rotate(ang); ctx.fillStyle='#0a1018';
    ctx.beginPath(); ctx.moveTo(14,0); ctx.lineTo(4,-6); ctx.lineTo(4,6); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.fillStyle='#0a1018'; ctx.font='bold 9px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText((o.name||'').slice(0,4), 0, -1);
    ctx.fillStyle=o.downed?'#ff5a5a':'#46e08a'; ctx.font='10px sans-serif';
    ctx.fillText(`${o.downed?'DOWN ':''}${dist_m}m`, 0, 24);
    ctx.restore();
  }
}

function drawMinimap(){
  const s=160/WORLD; const z=G.zone;
  mmx.fillStyle='#0a0e1a'; mmx.fillRect(0,0,160,160);
  mmx.beginPath(); mmx.arc(z.cx*s,z.cy*s,z.r*s,0,TAU); mmx.strokeStyle='rgba(190,100,255,.8)'; mmx.lineWidth=1.5; mmx.stroke();
  for (const pg of G.pings){ mmx.fillStyle='#ffd24a'; mmx.fillRect(pg.x*s-1.5,pg.y*s-1.5,3,3); }
  // creeps visible to your squad
  for (const c of G.creeps){ if(!c.alive||!inVision(c.x,c.y)) continue;
    mmx.fillStyle=c.type==='boss'?'#ff5a5a':c.type==='miniboss'?'#d36b9b':'#9bd36b';
    mmx.beginPath(); mmx.arc(c.x*s,c.y*s, c.type==='boss'?3.5:c.type==='miniboss'?2.5:1.5,0,TAU); mmx.fill(); }
  for (const e of G.hunters){ if(!e.alive) continue; const ally=e.team===G.player.team;
    if (!ally && !inVision(e.x,e.y)) continue;     // enemies hidden by fog of war
    if (ally && !e.isPlayer){                        // teammates: bigger, ringed, easy to spot
      mmx.fillStyle='#46e08a'; mmx.beginPath(); mmx.arc(e.x*s,e.y*s,3.5,0,TAU); mmx.fill();
      mmx.strokeStyle='#0a1018'; mmx.lineWidth=1; mmx.stroke(); continue; }
    mmx.fillStyle=e.isPlayer?'#ffd24a':'#ff5a5a';
    mmx.beginPath(); mmx.arc(e.x*s,e.y*s,e.isPlayer?3:2,0,TAU); mmx.fill(); }
  // landing marker during deploy
  if (G.phase==='choose' && G.landX!=null){
    mmx.strokeStyle='#34e3ff'; mmx.lineWidth=2;
    mmx.beginPath(); mmx.arc(G.landX*s,G.landY*s,6+Math.sin(G.t*5)*2,0,TAU); mmx.stroke();
  }
}

// full-screen map for choosing a drop zone (players/hunters hidden; creep packs shown)
function drawDeployOverview(){
  const w=canvas.width, h=canvas.height;
  ctx.imageSmoothingEnabled=true;
  ctx.fillStyle='#060a12'; ctx.fillRect(0,0,w,h);
  const pad=70, scale=Math.min((w-pad*2)/WORLD,(h-pad*2)/WORLD);
  const ox=(w-WORLD*scale)/2, oy=(h-WORLD*scale)/2;
  G.ovScale=scale; G.ovX=ox; G.ovY=oy;
  const X=x=>ox+x*scale, Y=y=>oy+y*scale;
  ctx.fillStyle='#0c1626'; ctx.fillRect(ox,oy,WORLD*scale,WORLD*scale);
  ctx.strokeStyle='rgba(255,255,255,.14)'; ctx.lineWidth=2; ctx.strokeRect(ox,oy,WORLD*scale,WORLD*scale);
  ctx.strokeStyle='rgba(52,227,255,.07)'; ctx.lineWidth=1;
  for(let g=0;g<=WORLD;g+=1000){ ctx.beginPath(); ctx.moveTo(X(g),oy); ctx.lineTo(X(g),oy+WORLD*scale); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox,Y(g)); ctx.lineTo(ox+WORLD*scale,Y(g)); ctx.stroke(); }
  // storm ring
  ctx.beginPath(); ctx.arc(X(G.zone.cx),Y(G.zone.cy),G.zone.r*scale,0,TAU); ctx.strokeStyle='rgba(190,100,255,.7)'; ctx.lineWidth=2; ctx.stroke();
  // creep packs (loot hints) — NOT players/AI
  for(const c of G.creeps){ if(!c.alive) continue;
    const col=c.type==='boss'?'#ff5a5a':c.type==='miniboss'?'#d36b9b':c.type==='leader'?'#6bd3a0':'#9bd36b';
    const rad=c.type==='boss'?10:c.type==='miniboss'?7:c.type==='leader'?5:3;
    ctx.fillStyle=col; ctx.beginPath(); ctx.arc(X(c.x),Y(c.y),rad,0,TAU); ctx.fill();
    if(c.type==='miniboss'||c.type==='boss'){ ctx.fillStyle=col; ctx.font='bold 10px sans-serif'; ctx.textAlign='center';
      ctx.fillText(c.type==='boss'?'BOSS':'mini-boss',X(c.x),Y(c.y)-rad-4); }
  }
  // your chosen drop
  if (G.landX!=null){ const sx=X(G.landX), sy=Y(G.landY);
    ctx.strokeStyle='#34e3ff'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(sx,sy,14+Math.sin(G.t*5)*3,0,TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx-22,sy); ctx.lineTo(sx+22,sy); ctx.moveTo(sx,sy-22); ctx.lineTo(sx,sy+22); ctx.globalAlpha=0.5; ctx.stroke(); ctx.globalAlpha=1;
    ctx.fillStyle='#34e3ff'; ctx.font='bold 13px sans-serif'; ctx.textAlign='center'; ctx.fillText('YOUR DROP',sx,sy-22); }
  // legend
  ctx.textAlign='left'; ctx.font='11px sans-serif';
  const lg=[['#9bd36b','Creeps — basic gear'],['#6bd3a0','Packs — +1 upgraded piece'],['#d36b9b','Mini-boss — maxed gear'],['#ff5a5a','Boss (centre, late game) — Tier-4']];
  lg.forEach((l,i)=>{ const ly=oy+14+i*16; ctx.fillStyle=l[0]; ctx.beginPath(); ctx.arc(ox+10,ly,4,0,TAU); ctx.fill();
    ctx.fillStyle='#c8d6f0'; ctx.fillText(l[1],ox+20,ly+4); });
}

// ============================================================
//  LOOP
// ============================================================
let lastT=0, loopStarted=false;
function loop(now){
  const dt=Math.min(0.05,(now-lastT)/1000); lastT=now;
  try { if (G && !G.over){ if (NETROLE==='client') clientTick(dt); else update(dt); } } catch(err){ console.error('Stormfall update error:', err); }
  try { if (G) draw(); } catch(err){ console.error('Stormfall draw error:', err); }
  requestAnimationFrame(loop);   // always reschedule — never let one bad frame freeze the game
}

// ============================================================
//  NETWORK — host authoritative; clients send input, render state
// ============================================================
const clientEdge = {};

function netWire(){
  Net.onData = (fromId,msg)=>{ try{ if(Net.isHost) netHostData(fromId,msg); else netClientData(msg); }catch(e){ console.error('net data',e); } };
  Net.onConn = ()=>{};                                   // host waits for client's 'hello'
  Net.onClose = (id)=>{ try{ if(Net.isHost) netHostClose(id); else netClientClose(); }catch(e){} };
}

// ---- host ----
function netHostData(fromId, msg){
  if (msg.t==='hello'){
    let m=netRoster.find(x=>x.id===fromId);
    if (!m){ if (netRoster.length>=SQUAD_SIZE){ Net.send(fromId,{t:'full'}); return; }
      m={id:fromId, name:msg.name||'Hunter', hunter:HUNTERS[msg.hunter]?msg.hunter:'sable', host:false}; netRoster.push(m); }
    else { if(msg.name) m.name=msg.name; if(HUNTERS[msg.hunter]) m.hunter=msg.hunter; }
    Lobby.broadcastRoster();
  } else if (msg.t==='in'){
    const h = G && G.hunters && G.hunters.find(x=>x.controlledBy===fromId);
    if (h) h._in=msg;
  } else if (msg.t==='land'){
    if (G && G.phase==='choose'){ G.landX=msg.x; G.landY=msg.y; }
  }
}
function netHostClose(id){
  netRoster = netRoster.filter(x=>x.id!==id);
  Lobby.broadcastRoster();
  if (G){ const h=G.hunters.find(x=>x.controlledBy===id); if(h){ h.human=false; h.controlledBy=null; h._in=null; } }
}
function netHostAssign(){
  if (NETROLE!=='host') return;
  const team0=G.hunters.filter(h=>h.team===0);
  netRoster.forEach((mem,i)=>{ const h=team0[i]; if(!h) return;
    setHunterHid(h, mem.hunter); h.name=mem.name;
    if (mem.id!=='host'){ h.isPlayer=false; h.human=true; h.controlledBy=mem.id; h._in=null; }
  });
  const names={}; for(const h of G.hunters) names[h.id]=h.name;
  for (const id in Net.conns){ const me=G.hunters.find(h=>h.controlledBy===id);
    Net.send(id, {t:'init', youId: me?me.id:null, names}); }
  netAccum=0;
}
function applyRemoteControl(h, dt){
  const inp=h._in; h.reviving=null;
  if (!inp){ h.moveX=0; h.moveY=0; return; }
  h.moveX = inp.mv?inp.mv[0]:0; h.moveY = inp.mv?inp.mv[1]:0;
  if (inp.aim!=null) h.aim=inp.aim;
  if (h.downed) return;
  if (inp.fire) cast(h,'basic');
  if (inp.q) cast(h,'q');
  if (inp.e) cast(h,'e');
  if (inp.r) cast(h,'r');
  if (inp.dash && h.cd.dash<=0){ const a=h.aim; h.dashVx=Math.cos(a)*900; h.dashVy=Math.sin(a)*900; h.dashT=0.2; h.cd.dash=3; spawnBurst(h.x,h.y,h.def.color,6); }
  if (inp.ping){ if(h.pingCd<=0){ addPing(inp.ping[0],inp.ping[1],h.team,h); h.pingCd=1; } inp.ping=null; }
  const item = nearestGroundItem(h,90);
  if (inp.act){ inp.act=false; if(item) equipItem(h,item); }
  if (inp.fhold && !item){ const ally=G.hunters.find(o=>o.team===h.team&&o!==h&&o.downed&&dist(o.x,o.y,h.x,h.y)<90);
    if (ally){ ally.reviveProg+=dt; h.reviving=ally; if(ally.reviveProg>=2.5) ally.reviveTo(); } }
}
function encodeSnapshot(forId){
  const z=G.zone, H=[],P=[],A=[],I=[],PG=[];
  for (const e of G.hunters){ if(!e.alive) continue;
    let fl=0; if(e.downed)fl|=1; if(e.hasCrown)fl|=2; if(e.snareStacks>0)fl|=4; if(e.dots.length)fl|=8; if(e.shield>0)fl|=16; if(e.form==='shadow')fl|=32;
    H.push([e.id, hidIdx(e.hid), e.team, e.x|0, e.y|0, Math.round(e.aim*100), e.hp|0, e.maxHp|0, e.shield|0, Math.round((e.downed?e.bleed/12:1)*100), fl]);
  }
  for (const p of G.projectiles) P.push([p.x|0,p.y|0, p.radius, palIdx(p.color)]);
  for (const a of G.aoes) A.push([a.x|0,a.y|0, a.r|0, Math.round((1-a.t/a.max)*100), palIdx(a.color)]);
  for (const it of G.items) I.push([gIdx(it.id), it.lvl, it.x|0, it.y|0, it.t4?1:0]);
  for (const pg of G.pings) PG.push([pg.x|0,pg.y|0]);
  const Cr=[]; for (const c of G.creeps){ if(!c.alive) continue; Cr.push([CREEP_IDS.indexOf(c.type), c.x|0, c.y|0, Math.round(c.hp/c.maxHp*100)]); }
  const me=G.hunters.find(h=>h.controlledBy===forId);
  const you = me ? { cd:me.cd, slots:me.slots, kills:me.kills } : null;
  return { t:'state', z:[z.cx|0,z.cy|0,z.r|0,z.target|0,z.stage,Math.ceil(z.nextShrink)], H,P,A,I,PG,Cr, you,
    ph:G.phase, dT:Math.max(0,Math.round(G.deployT*10)/10) };
}

// ---- client ----
function netClientData(msg){
  switch (msg.t){
    case 'roster': netRoster=msg.members||[]; Lobby.refresh(); break;
    case 'full': Lobby.netStatus='Party is full (max '+SQUAD_SIZE+' players).'; NETROLE='solo'; Net.cleanup(); Lobby.refresh(); break;
    case 'start': clientStartMatch(); break;
    case 'init': if(G){ G.myHunterId=msg.youId; G.names=msg.names||{}; } break;
    case 'state': clientApplySnapshot(msg); break;
    case 'feed': addFeedDOM(msg.x); break;
    case 'end': if(G){ G.over=true; endScreenShow(msg.won, msg.place, msg.yourKills, msg.squadKills); } break;
  }
}
function netClientClose(){
  if (G && !G.over){ G.over=true; endScreenShow(false, '—', G.player?G.player.kills:0, 0, 'Host disconnected — match ended.'); }
  NETROLE='solo';
}
function clientStartMatch(){
  document.getElementById('menu').classList.add('hidden');
  document.getElementById('game').classList.remove('hidden');
  document.getElementById('endScreen').classList.add('hidden');
  resize(); Input.keys.clear(); Input.mdown=false;
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  Sfx.ambientStart(); Terrain.generate();
  HUNTER_IDS.forEach(id => Sprites[id]=buildSprite(HUNTERS[id]));
  G = { hunters:[], hmap:new Map(), projectiles:[], aoes:[], items:[], pings:[], particles:[], motes:[], swings:[], creeps:[],
    cam:{x:WORLD/2-canvas.width/2,y:WORLD/2-canvas.height/2}, t:0, over:false, names:{}, myHunterId:null, barBuilt:false, clientSwingCd:0,
    phase:'choose', deployT:20, landX:null, landY:null,
    zone:{cx:WORLD/2,cy:WORLD/2,r:WORLD*0.82,target:WORLD*0.82,stage:0,nextShrink:40} };
  for (let i=0;i<60;i++) G.motes.push({x:rand(0,canvas.width),y:rand(0,canvas.height),vx:rand(-8,8),vy:rand(-14,-3),r:rand(0.6,2),a:rand(0.1,0.4)});
  G.feedEl=document.getElementById('killfeed');
  lastT=performance.now();
  if (!loopStarted){ loopStarted=true; requestAnimationFrame(loop); }
}
function clientApplySnapshot(snap){
  if (!G) return;
  const z=snap.z; G.zone={cx:z[0],cy:z[1],r:z[2],target:z[3],stage:z[4],nextShrink:z[5]};
  if (snap.ph) G.phase=snap.ph; if (snap.dT!=null) G.deployT=snap.dT;
  const seen=new Set();
  for (const a of snap.H){
    const id=a[0]; let h=G.hmap.get(id);
    if (!h){ h={id, x:a[3], y:a[4], tx:a[3], ty:a[4], walkT:rand(0,6), cd:{}, slots:[], kills:0}; G.hmap.set(id,h); }
    h.tx=a[3]; h.ty=a[4];
    h.hid=HUNTER_IDS[a[1]]||'sable'; h.def=HUNTERS[h.hid]; h.radius=h.def.radius; h.team=a[2];
    h.aim=a[5]/100; h.hp=a[6]; h.maxHp=a[7]; h.shield=a[8]; h.bleed=(a[9]/100)*12;
    const fl=a[10];
    h.downed=!!(fl&1); h.hasCrown=!!(fl&2); h.snareStacks=(fl&4)?3:0; h.dots=(fl&8)?[1]:[]; h.form=(fl&32)?'shadow':'holy';
    h.alive=true; h.reviving=null; h.isPlayer=(id===G.myHunterId);
    h.name = h.isPlayer?'You':((G.names&&G.names[id])||'Hunter');
    seen.add(id);
  }
  for (const id of [...G.hmap.keys()]) if(!seen.has(id)) G.hmap.delete(id);
  G.hunters=[...G.hmap.values()];
  if (G.myHunterId!=null) G.player=G.hmap.get(G.myHunterId)||G.player;
  if (snap.you && G.player){ G.player.cd=snap.you.cd||{}; G.player.slots=snap.you.slots||[]; G.player.kills=snap.you.kills||0; }
  G.items=snap.I.map((a,i)=>({id:GEAR_IDS[a[0]]||GEAR_IDS[0], lvl:a[1], x:a[2], y:a[3], t4:!!a[4], bob:i*0.6}));
  G.creeps=(snap.Cr||[]).map((a,i)=>{ const type=CREEP_IDS[a[0]]||'little', cfg=CREEP_TYPES[type];
    return { type, cfg, x:a[1], y:a[2], maxHp:cfg.hp, hp:cfg.hp*a[3]/100, radius:cfg.r, color:cfg.color, alive:true, flash:0, bob:i*0.7 }; });
  G.projectiles=snap.P.map(a=>({x:a[0],y:a[1],radius:a[2],color:PALETTE[a[3]]||'#fff'}));
  G.aoes=snap.A.map(a=>({x:a[0],y:a[1],r:a[2],t:1-a[3]/100,max:1,color:PALETTE[a[4]]||'#fff'}));
  G.pings=snap.PG.map(a=>({x:a[0],y:a[1],t:2,team:0,by:null}));
  if (!G.barBuilt && G.player && G.player.def){ buildAbilityBar(); G.barBuilt=true; G._lastForm=G.player.form; }
  else if (G.barBuilt && G.player && G.player.def.forms && G.player.form!==G._lastForm){ buildAbilityBar(); G._lastForm=G.player.form; }
}
function clientSendInput(dt){
  const r = G.player ? readMoveAim(G.player) : {mx:0,my:0,aim:0,fire:false};
  const w = G.player ? worldMouse() : {x:0,y:0};
  const able = G.player && G.player.alive && !G.player.downed;   // can't attack while downed/dead
  // edge-detected ping (V) and interact (F)
  if (Input.keys.has('v')){ if(!clientVHeld){ clientVHeld=true; clientPing=[w.x|0,w.y|0]; Sfx.ping(1); } } else clientVHeld=false;
  if (Input.keys.has('f')){ if(!clientFHeld){ clientFHeld=true; clientAct=true; } } else clientFHeld=false;
  // optimistic local ability sounds (only when able to act)
  ['q','e','r',' '].forEach(k=>{ const down=Input.keys.has(k);
    if (able && down && !clientEdge[k]){ clientEdge[k]=true; (k===' '?Sfx.dash:Sfx.cast)(0.7); } else if(!down) clientEdge[k]=false; });
  clientInAccum+=dt; if (clientInAccum < 1/30) return; clientInAccum=0;
  if (!Net.ready || !G.player) return;
  const msg={ t:'in', mv:[r.mx,r.my], aim:r.aim,
    fire:able&&r.fire?1:0, q:able&&Input.keys.has('q')?1:0, e:able&&Input.keys.has('e')?1:0, r:able&&Input.keys.has('r')?1:0,
    dash:able&&Input.keys.has(' ')?1:0, fhold:Input.keys.has('f')?1:0 };
  if (clientPing){ msg.ping=clientPing; clientPing=null; }
  if (clientAct){ msg.act=1; clientAct=false; }
  Net.toHost(msg);
}
function clientTick(dt){
  G.t+=dt;
  clientSendInput(dt);
  for (const h of G.hunters){
    const moving = h.tx!==undefined && dist(h.x,h.y,h.tx,h.ty)>0.5;
    if (h.tx!==undefined){ h.x=lerp(h.x,h.tx,clamp(dt*16,0,1)); h.y=lerp(h.y,h.ty,clamp(dt*16,0,1)); }
    h.moveX=moving?1:0; h.moveY=0; if(moving) h.walkT+=dt*10;
  }
  if (G.player && G.phase!=='choose'){ const w=worldMouse(); G.player.aim=angTo(G.player.x,G.player.y,w.x,w.y); }
  if (G.phase==='choose'){ updateDeployCamera(dt); }
  else { const cf=G.player||G.camFollow;
    if (cf){ G.camFollow=cf; G.cam.x=lerp(G.cam.x,cf.x-canvas.width/2,0.12); G.cam.y=lerp(G.cam.y,cf.y-canvas.height/2,0.12); } }
  for (const m of G.motes){ m.x+=m.vx*dt; m.y+=m.vy*dt;
    if(m.y<-5){m.y=canvas.height+5;m.x=rand(0,canvas.width);} if(m.x<-5)m.x=canvas.width+5; if(m.x>canvas.width+5)m.x=-5; }
  for (let i=G.particles.length-1;i>=0;i--){ const p=G.particles[i]; p.life-=dt;
    if(!p.ring){ p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=0.9; p.vy*=0.9; } if(p.life<=0) G.particles.splice(i,1); }
  if (G.swings) for(let i=G.swings.length-1;i>=0;i--){ G.swings[i].t-=dt; if(G.swings[i].t<=0) G.swings.splice(i,1); }
  // optimistic cleave swing for a client controlling Vanguard
  if (G.clientSwingCd>0) G.clientSwingCd-=dt;
  if (G.player && G.player.alive && !G.player.downed && G.player.hid==='vanguard' && Input.mdown && G.clientSwingCd<=0){
    spawnSwing(G.player, HUNTERS.vanguard.basic); G.clientSwingCd=HUNTERS.vanguard.basic.cd;
  }
  if (G.player) updateHUD();
}

// ============================================================
//  MOBILE / TOUCH
// ============================================================
function updStick(s,x,y){
  const dx=x-s.ox, dy=y-s.oy, mag=Math.hypot(dx,dy), R=64, dead=10;
  if (mag>dead){ const m=Math.min(mag,R); s.nx=dx/mag*(m/R); s.ny=dy/mag*(m/R); s.ang=Math.atan2(dy,dx); s.active=true; }
  else { s.nx=0; s.ny=0; s.active=false; }
  s.cx=x; s.cy=y;
}
function mobileTouch(e){
  if (!Mobile.on) return;
  if (G && G.phase==='choose') return;   // deploy map handles taps
  e.preventDefault();
  for (const t of e.changedTouches){
    if (e.type!=='touchstart') continue;
    const left = t.clientX < innerWidth*0.5;
    if (left && Mobile.move.id===null){ Mobile.move.id=t.identifier; Mobile.move.ox=t.clientX; Mobile.move.oy=t.clientY; updStick(Mobile.move,t.clientX,t.clientY); }
    else if (!left && Mobile.aim.id===null){ Mobile.aim.id=t.identifier; Mobile.aim.ox=t.clientX; Mobile.aim.oy=t.clientY; updStick(Mobile.aim,t.clientX,t.clientY); Mobile.aim.firing=Mobile.aim.active; }
  }
  for (const t of e.touches){
    if (t.identifier===Mobile.move.id) updStick(Mobile.move,t.clientX,t.clientY);
    if (t.identifier===Mobile.aim.id){ updStick(Mobile.aim,t.clientX,t.clientY); Mobile.aim.firing=Mobile.aim.active; }
  }
}
function mobileTouchEnd(e){
  for (const t of e.changedTouches){
    if (t.identifier===Mobile.move.id){ Mobile.move.id=null; Mobile.move.nx=0; Mobile.move.ny=0; Mobile.move.active=false; }
    if (t.identifier===Mobile.aim.id){ Mobile.aim.id=null; Mobile.aim.active=false; Mobile.aim.firing=false; }
  }
}
function buildMobileButtons(){
  const wrap=document.getElementById('mobileButtons'); wrap.innerHTML='';
  const defs=[['q','Q'],['e','E'],['r','R'],[' ','⚡'],['v','⚑'],['f','✋']];
  defs.forEach(([key,label])=>{
    const b=document.createElement('div'); b.className='mbtn';
    const slot = key===' '?'dash':((key==='v'||key==='f')?'':key);
    if (slot) b.dataset.slot=slot;
    b.innerHTML=`<span class="mlabel">${label}</span><span class="cool hidden"></span>`;
    const press=ev=>{ ev.preventDefault(); Input.keys.add(key); };
    const release=ev=>{ ev.preventDefault(); Input.keys.delete(key); };
    b.addEventListener('touchstart',press,{passive:false});
    b.addEventListener('touchend',release,{passive:false});
    b.addEventListener('touchcancel',release,{passive:false});
    wrap.appendChild(b);
  });
}
function setupMobile(){
  const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  const touch = ('ontouchstart' in window) || navigator.maxTouchPoints>0;
  Mobile.on = coarse || (touch && Math.min(innerWidth,innerHeight)<820);
  if (!Mobile.on) return;
  document.body.classList.add('mobile');
  document.getElementById('mobileControls').classList.remove('hidden');
  buildMobileButtons();
  canvas.addEventListener('touchstart', mobileTouch, {passive:false});
  canvas.addEventListener('touchmove', mobileTouch, {passive:false});
  canvas.addEventListener('touchend', mobileTouchEnd, {passive:false});
  canvas.addEventListener('touchcancel', mobileTouchEnd, {passive:false});
}
// minimap landing selection (deploy phase)
mm.addEventListener('mousedown', chooseLanding);
mm.addEventListener('touchstart', chooseLanding, {passive:false});

// click/tap the big deploy map to choose a drop zone
function deployClick(ev){
  if (!G || G.phase!=='choose' || G.ovScale==null) return;
  ev.preventDefault();
  const r=canvas.getBoundingClientRect();
  const px=(ev.touches?ev.touches[0].clientX:ev.clientX)-r.left;
  const py=(ev.touches?ev.touches[0].clientY:ev.clientY)-r.top;
  G.landX=clamp((px-G.ovX)/G.ovScale,0,WORLD); G.landY=clamp((py-G.ovY)/G.ovScale,0,WORLD);
  if (NETROLE==='client') Net.toHost({t:'land', x:G.landX, y:G.landY});
  Sfx.ping(0.6);
}
canvas.addEventListener('mousedown', deployClick);
canvas.addEventListener('touchstart', deployClick, {passive:false});

setupMobile();
Lobby.init();
