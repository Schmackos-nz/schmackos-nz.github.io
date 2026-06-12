/* A Villager's Life — survive inside a town that builds itself around you. */
'use strict';

// ---------------------------------------------------------------- constants
const MAP = 260;                 // playable half-size — a big wilderness around one town
const DAY_LEN = 300;             // seconds per full day cycle
const PH = { dawn:[0,.06], day:[.06,.66], dusk:[.66,.74], night:[.74,1] };
const TC_POS = { x:0, z:-24 };   // town center

const rand = (a,b)=>a+Math.random()*(b-a);
const irand = (a,b)=>Math.floor(rand(a,b+1));
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const dist2d = (a,b)=>Math.hypot(a.x-b.x, a.z-b.z);

// ---------------------------------------------------------------- renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fc7e8);
scene.fog = new THREE.Fog(0x9fc7e8, 70, 190);

const camera = new THREE.PerspectiveCamera(55, innerWidth/innerHeight, .1, 400);
const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
addEventListener('resize', ()=>{
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x4a5d3a, .9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -80; sun.shadow.camera.right = 80;
sun.shadow.camera.top = 80;   sun.shadow.camera.bottom = -80;
sun.shadow.camera.far = 260;
sun.target.position.set(0, 0, -20);
scene.add(sun, sun.target);

// ---------------------------------------------------------------- helpers
const MATS = {};
function mat(c){ return MATS[c] || (MATS[c] = new THREE.MeshLambertMaterial({ color:c })); }
function box(w,h,d,c,x=0,y=0,z=0){
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat(c));
  m.position.set(x,y,z); m.castShadow = true; m.receiveShadow = true; return m;
}
function cyl(rt,rb,h,c,x=0,y=0,z=0,seg=10){
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg), mat(c));
  m.position.set(x,y,z); m.castShadow = true; m.receiveShadow = true; return m;
}
function cone(r,h,c,x=0,y=0,z=0,seg=4){
  const m = new THREE.Mesh(new THREE.ConeGeometry(r,h,seg), mat(c));
  m.position.set(x,y,z); m.castShadow = true; m.receiveShadow = true; return m;
}
function sphere(r,c,x=0,y=0,z=0){
  const m = new THREE.Mesh(new THREE.SphereGeometry(r,10,8), mat(c));
  m.position.set(x,y,z); m.castShadow = true; return m;
}

// ---------------------------------------------------------------- audio
let AC = null;
function beep(freq, dur=.1, type='square', vol=.05, slide=0){
  try {
    if (!AC) AC = new (window.AudioContext||window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.value = freq;
    if (slide) o.frequency.linearRampToValueAtTime(freq+slide, AC.currentTime+dur);
    g.gain.value = vol; g.gain.exponentialRampToValueAtTime(.001, AC.currentTime+dur);
    o.connect(g).connect(AC.destination); o.start(); o.stop(AC.currentTime+dur);
  } catch(e){}
}
const sfx = {
  chop:()=>beep(110,.09,'square',.06),
  pick:()=>beep(620,.07,'sine',.05),
  coin:()=>{ beep(900,.07,'sine',.05); setTimeout(()=>beep(1350,.1,'sine',.05),70); },
  build:()=>beep(220,.06,'triangle',.06),
  hurt:()=>beep(90,.18,'sawtooth',.08),
  eat:()=>beep(330,.1,'sine',.05,80),
  note:()=>beep([523,659,784,880,1047][irand(0,4)],.12,'triangle',.05),
  growl:()=>beep(70,.3,'sawtooth',.06,-20),
  mine:()=>{ beep(1500,.04,'square',.04); beep(180,.09,'triangle',.06); },
  ding:()=>{ beep(784,.12,'sine',.06); setTimeout(()=>beep(1175,.18,'sine',.06),110); },
};

// ---------------------------------------------------------------- ground & nature
{
  const g = new THREE.Mesh(new THREE.PlaneGeometry(MAP*2+40, MAP*2+40), mat(0x6a994e));
  g.rotation.x = -Math.PI/2; g.receiveShadow = true; scene.add(g);
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(46, 28), mat(0x8a7448));
  plaza.rotation.x = -Math.PI/2; plaza.position.set(TC_POS.x, .02, TC_POS.z-6);
  plaza.receiveShadow = true; scene.add(plaza);
}

const trees = [], bushes = [];
function inTown(x,z){ return x>-48 && x<48 && z>-72 && z<2; }

function makeTree(x,z){
  const g = new THREE.Group();
  g.add(cyl(.35,.5,2.4,0x6b4423,0,1.2,0));
  const h = rand(2.6,3.6);
  g.add(cone(rand(1.7,2.3), h, 0x3e6b2f, 0, 2.4+h/2, 0, 7));
  g.position.set(x,0,z); scene.add(g);
  trees.push({ mesh:g, x, z, wood:8, alive:true, regrow:0 });
}
function makeBush(x,z){
  const g = new THREE.Group();
  g.add(sphere(rand(.8,1.1), 0x2f5d2a, 0, .7, 0));
  for (let i=0;i<5;i++) g.add(sphere(.09, 0xc0392b, rand(-.6,.6), rand(.5,1.1), rand(-.6,.6)));
  g.position.set(x,0,z); scene.add(g);
  bushes.push({ mesh:g, x, z, food:6, alive:true, regrow:0, isFarm:false });
}
// dense forest near town, sparser wilds beyond
for (let i=0;i<110;i++){
  const a = rand(0,Math.PI*2), d = rand(40,130);
  const x = clamp(TC_POS.x+Math.cos(a)*d, -MAP+4, MAP-4), z = clamp(TC_POS.z+Math.sin(a)*d, -MAP+4, MAP-4);
  if (!inTown(x,z)) makeTree(x,z);
}
for (let i=0;i<150;i++){
  const x = rand(-MAP+4, MAP-4), z = rand(-MAP+4, MAP-4);
  if (!inTown(x,z) && Math.hypot(x,z-8)>9) makeTree(x,z);
}
for (let i=0;i<30;i++){
  const a = rand(0,Math.PI*2), d = rand(30,110);
  const x = clamp(TC_POS.x+Math.cos(a)*d, -MAP+6, MAP-6), z = clamp(TC_POS.z+Math.sin(a)*d, -MAP+6, MAP-6);
  if (!inTown(x,z)) makeBush(x,z);
}
for (let i=0;i<30;i++){
  const x = rand(-MAP+6, MAP-6), z = rand(-MAP+6, MAP-6);
  if (!inTown(x,z) && Math.hypot(x,z-8)>7) makeBush(x,z);
}
// mineable rocks & gold ore veins
const rocks = [], veins = [];
function makeRock(x,z){
  const g = new THREE.Group();
  const a = sphere(rand(.9,1.3), 0x7f8c8d, 0, .4, 0); a.scale.y = .6; g.add(a);
  const b = sphere(rand(.5,.8), 0x95a5a6, rand(-.8,.8), .28, rand(-.8,.8)); b.scale.y = .6; g.add(b);
  g.position.set(x,0,z); scene.add(g);
  rocks.push({ mesh:g, x, z, stone:6, alive:true, regrow:0 });
}
function makeVein(x,z){
  const g = new THREE.Group();
  const r = sphere(1.25, 0x5d6d7e, 0, .5, 0); r.scale.y = .65; g.add(r);
  for (let i=0;i<5;i++) g.add(sphere(.15, 0xd4af37, rand(-.8,.8), rand(.25,.95), rand(-.8,.8)));
  g.position.set(x,0,z); scene.add(g);
  veins.push({ mesh:g, x, z, ore:5, alive:true, regrow:0 });
}
for (let i=0;i<18;i++){
  const a = rand(0,Math.PI*2), d = rand(35,120);
  const x = clamp(TC_POS.x+Math.cos(a)*d, -MAP+5, MAP-5), z = clamp(TC_POS.z+Math.sin(a)*d, -MAP+5, MAP-5);
  if (!inTown(x,z)) makeRock(x,z);
}
for (let i=0;i<25;i++){
  const x = rand(-MAP+5, MAP-5), z = rand(-MAP+5, MAP-5);
  if (!inTown(x,z) && Math.hypot(x,z-8)>10) makeRock(x,z);
}
for (let i=0;i<14;i++){
  const x = rand(-MAP+6, MAP-6), z = rand(-MAP+6, MAP-6);
  if (!inTown(x,z) && Math.hypot(x,z)>55) makeVein(x,z);
}

// ---------------------------------------------------------------- building factories
const FACT = {
  towncenter(){ const g = new THREE.Group();
    g.add(box(9,4.5,9,0xc9b18a,0,2.25,0));
    g.add(cone(7.4,4,0x8c3b2e,0,6.5,0));
    g.add(cyl(.08,.08,5,0x5d4a26,0,9,0));
    const f = new THREE.Mesh(new THREE.PlaneGeometry(2,1.1), new THREE.MeshBasicMaterial({ color:0x2e5fa3, side:THREE.DoubleSide }));
    f.position.set(1,10.6,0); g.add(f); g.userData.flag = f;
    g.add(box(2,2.6,.3,0x5d4123,0,1.3,4.55)); return g; },
  house(){ const g = new THREE.Group();
    g.add(box(4.4,2.8,4.4,0xd9c49a,0,1.4,0));
    g.add(cone(3.6,2.2,0x9c4a35,0,3.9,0));
    g.add(box(1.1,1.8,.25,0x5d4123,0,.9,2.25)); return g; },
  lumbercamp(){ const g = new THREE.Group();
    g.add(box(5,2.4,4,0xa98a5e,0,1.2,0));
    g.add(cone(3.8,1.6,0x6e4a2f,0,3.2,0));
    for (let i=0;i<3;i++){ const l = cyl(.4,.4,3.4,0x8a5a2b,2.2+(i%2)*.5,.4+Math.floor(i/2)*.8,1.2); l.rotation.z = Math.PI/2; g.add(l); }
    return g; },
  mill(){ const g = new THREE.Group();
    g.add(cyl(2.6,3.2,5.5,0xd9c49a,0,2.75,0,8));
    g.add(cone(3,2,0x8c3b2e,0,6.5,0,8));
    const blades = new THREE.Group();
    for (let i=0;i<4;i++){ const b = box(.5,4.6,.08,0xeee8d5,0,2.3,0); const p = new THREE.Group(); p.add(b); p.rotation.z = i*Math.PI/2; blades.add(p); }
    blades.position.set(0,5,3.2); g.add(blades); g.userData.blades = blades; return g; },
  farm(){ const g = new THREE.Group();
    const soil = new THREE.Mesh(new THREE.PlaneGeometry(7,7), mat(0x70522e));
    soil.rotation.x = -Math.PI/2; soil.position.y = .05; soil.receiveShadow = true; g.add(soil);
    for (let r=0;r<4;r++) for (let c=0;c<4;c++) g.add(box(.5,.7,.5,0xb8a13a,-2.4+r*1.6,.4,-2.4+c*1.6));
    return g; },
  market(){ const g = new THREE.Group();
    g.add(box(6,.5,5,0xa98a5e,0,.25,0));
    for (const sx of [-1.6,1.6]){
      g.add(box(2.4,1,1.8,0x8a5a2b,sx,1,0));
      const c = cone(2,1,sx<0?0xc0392b:0x2e5fa3,sx,2.6,0); c.rotation.y = Math.PI/4; g.add(c);
    }
    return g; },
  quarry(){ const g = new THREE.Group();
    g.add(box(4.5,2,3.5,0x8a7a5e,0,1,0));
    g.add(cone(3,1.4,0x6e5a3f,0,2.7,0));
    const p1 = sphere(.9,0x7f8c8d,2.6,.45,1); p1.scale.y=.6; g.add(p1);
    const p2 = sphere(.6,0x95a5a6,3.3,.3,-.5); p2.scale.y=.6; g.add(p2);
    g.add(cyl(.08,.08,3,0x5d4a26,-2.2,1.5,1.4));
    return g; },
  barracks(){ const g = new THREE.Group();
    g.add(box(7,3.4,5.5,0x9a8a7a,0,1.7,0));
    g.add(box(7.4,.8,5.9,0x6e6258,0,3.8,0));
    const f = new THREE.Mesh(new THREE.PlaneGeometry(1.4,2.2), new THREE.MeshBasicMaterial({ color:0xa32e2e, side:THREE.DoubleSide }));
    f.position.set(0,2.2,2.95); g.add(f);
    g.add(box(1.4,2,.3,0x4a3a28,2,1,2.8)); return g; },
  tower(){ const g = new THREE.Group();
    g.add(cyl(1.8,2.2,7,0x95a5a6,0,3.5,0,8));
    g.add(cyl(2.4,2.4,1,0x7f8c8d,0,7.5,0,8));
    for (let i=0;i<6;i++){ const a = i/6*Math.PI*2; g.add(box(.6,.7,.6,0x7f8c8d,Math.cos(a)*2.1,8.3,Math.sin(a)*2.1)); }
    return g; },
  wall(){ const g = new THREE.Group();
    g.add(box(12.5,3,1.4,0x95a5a6,0,1.5,0));
    for (let i=0;i<5;i++) g.add(box(1.1,.7,1.4,0x7f8c8d,-5+i*2.5,3.35,0));
    return g; },
  castle(){ const g = new THREE.Group();
    g.add(box(12,9,12,0x9aa7ad,0,4.5,0));
    for (let i=0;i<8;i++) g.add(box(1.2,1,1.2,0x7f8c8d,-5.4+i*1.55,9.5,5.4));
    for (const [cx,cz] of [[-6,-6],[6,-6],[-6,6],[6,6]]){
      g.add(cyl(2,2.3,12,0x8b9aa1,cx,6,cz,8));
      g.add(cone(2.4,2.6,0x2e5fa3,cx,13.3,cz,8));
    }
    g.add(cyl(.08,.08,5,0x5d4a26,0,12.5,0));
    const f = new THREE.Mesh(new THREE.PlaneGeometry(2.4,1.3), new THREE.MeshBasicMaterial({ color:0xd4af37, side:THREE.DoubleSide }));
    f.position.set(1.2,14.2,0); g.add(f); g.userData.flag = f;
    g.add(box(3,4,.4,0x4a3a28,0,2,6.1)); return g; },
  playerhouse(){ const g = new THREE.Group();
    g.add(box(3.6,2.4,3.6,0xc9a96a,0,1.2,0));
    g.add(cone(3,1.9,0x6e8b3d,0,3.3,0));
    g.add(box(1,1.6,.22,0x5d4123,0,.8,1.85));
    const w = new THREE.PointLight(0xffb347, 0, 8); w.position.set(0,1.6,2.4); g.add(w); g.userData.lamp = w;
    return g; },
};
const FOOTPRINT = { towncenter:6.5, house:3.4, lumbercamp:3.6, mill:3.4, farm:0, market:4, quarry:3.5, barracks:4.8, tower:2.6, wall:0, castle:8.5, playerhouse:2.8 };
const BUILD_TIME = { house:28, lumbercamp:26, mill:34, farm:18, market:30, quarry:26, barracks:38, tower:30, wall:16, castle:90, playerhouse:14 };
const BNAMES = { towncenter:'Town Center', house:'House', lumbercamp:'Lumber Camp', mill:'Mill', farm:'Farm', market:'Market', quarry:'Quarry', barracks:'Barracks', tower:'Watchtower', wall:'Stone Wall', castle:'Castle', playerhouse:'Your House' };

// ---------------------------------------------------------------- town plan
const PLAN = [
  { type:'house',      x: 14, z:-14, t: 12 },
  { type:'lumbercamp', x:-16, z:-12, t: 45 },
  { type:'house',      x: 24, z:-26, t: 95 },
  { type:'farm',       x:-14, z:-34, t:135 },
  { type:'mill',       x:-24, z:-26, t:150 },
  { type:'farm',       x:-24, z:-38, t:185 },
  { type:'market',     x: 12, z:-34, t:215 },
  { type:'quarry',     x: 32, z:-32, t:245 },
  { type:'barracks',   x: 20, z:-46, t:275 },
  { type:'house',      x: 30, z:-14, t:335 },
  { type:'house',      x:-30, z:-14, t:395 },
  { type:'tower',      x: 36, z:-52, t:445, rot:0 },
  { type:'tower',      x:-36, z:-52, t:485, rot:0 },
];
{ // walls: south line + side lines, then the castle
  let t = 525;
  for (let x=-30; x<=30; x+=12.5){ PLAN.push({ type:'wall', x, z:-56, t, rot:0 }); t += 18; }
  for (let z=-48; z<=-10.5; z+=12.5){
    PLAN.push({ type:'wall', x: 39, z, t, rot:Math.PI/2 }); t += 18;
    PLAN.push({ type:'wall', x:-39, z, t, rot:Math.PI/2 }); t += 18;
  }
  PLAN.push({ type:'castle', x:0, z:-44, t:t+30 });
}

const buildings = [];
function addBuilding(type, x, z, rot=0, prebuilt=false){
  const group = FACT[type]();
  group.position.set(x,0,z); group.rotation.y = rot;
  scene.add(group);
  const b = { type, name:BNAMES[type], x, z, rot, group,
              progress: prebuilt?1:0, done: prebuilt, owned:false, bar:null };
  if (!prebuilt){
    group.scale.y = .02;
    const site = new THREE.Mesh(new THREE.CircleGeometry(Math.max(3,FOOTPRINT[type]+1), 16), mat(0x70522e));
    site.rotation.x = -Math.PI/2; site.position.set(x,.03,z); scene.add(site);
    b.siteMesh = site;
    // billboard progress bar
    const bar = new THREE.Group();
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(4.2,.5), new THREE.MeshBasicMaterial({ color:0x1d1812 }));
    const fg = new THREE.Mesh(new THREE.PlaneGeometry(4,.34), new THREE.MeshBasicMaterial({ color:0x58cb58 }));
    fg.position.z = .01; bar.add(bg, fg);
    bar.position.set(x, 5.5, z); scene.add(bar);
    b.bar = bar; b.barFg = fg;
  }
  buildings.push(b);
  return b;
}
addBuilding('towncenter', TC_POS.x, TC_POS.z, 0, true);

function getBuilding(type){ return buildings.find(b=>b.type===type && b.done); }
function activeSites(){ return buildings.filter(b=>!b.done && !b.owned); }

// farm plots double as food sources once built
function farmDone(b){
  bushes.push({ mesh:b.group, x:b.x, z:b.z, food:10, alive:true, regrow:0, isFarm:true });
}

// ---------------------------------------------------------------- NPCs
const npcs = [];
// a friendly face (eyes + mouth) and little swinging arms, shared by all humanoids
function addFaceArms(g, bodyColor, skin=0xe8b88a){
  for (const s of [-1,1]){
    g.add(sphere(.07, 0xffffff, .11*s, 1.86, .26));
    g.add(sphere(.035, 0x222222, .11*s, 1.86, .315));
  }
  g.add(box(.13,.04,.03, 0x7a4a3a, 0, 1.68, .31)); // mouth
  const arms = {};
  for (const [key, s] of [['armL',-1],['armR',1]]){
    const arm = new THREE.Group();
    arm.add(cyl(.085,.085,.7, bodyColor, 0, -.27, 0, 6));
    arm.add(sphere(.09, skin, 0, -.62, 0)); // hand
    arm.position.set(.5*s, 1.32, 0);
    arm.rotation.z = -.18*s;
    g.add(arm);
    arms[key] = arm;
  }
  g.userData.arms = arms;
  return arms;
}
function makeNpcMesh(bodyColor, helmet){
  const g = new THREE.Group();
  g.add(cyl(.42,.5,1.25,bodyColor,0,.85,0,8));
  g.add(sphere(.32,0xe8b88a,0,1.8,0));
  if (helmet) g.add(cyl(.36,.36,.25,0x95a5a6,0,2.0,0,8));
  else g.add(cyl(.34,.34,.18,0x6e4a2f,0,2.05,0,8));
  addFaceArms(g, bodyColor);
  scene.add(g);
  return g;
}
function spawnNpc(role, x, z){
  const colors = { villager:0xb08d57, builder:0xd4a017, soldier:0xa32e2e };
  const n = {
    role, mesh: makeNpcMesh(colors[role], role==='soldier'),
    x, z, tx:x, tz:z, speed: role==='soldier'?5.2:4.2,
    state:'idle', timer: rand(0,2), hp:50, cheered:false,
    bobT: rand(0,9), site:null, target:null, patrolIdx: irand(0,5), attackCd:0,
  };
  if (role==='soldier'){ // spear
    const s = cyl(.05,.05,2.2,0x8a5a2b,.45,1.5,0); s.rotation.x = .15;
    n.mesh.add(s); n.mesh.add(cone(.12,.35,0x95a5a6,.45,2.7,.17,6));
  }
  if (role==='builder'){ // hammer
    const h = new THREE.Group();
    h.add(cyl(.05,.05,.8,0x8a5a2b,0,.4,0)); h.add(box(.3,.18,.18,0x7f8c8d,0,.8,0));
    h.position.set(.5,1.1,0); n.mesh.add(h); n.hammer = h;
  }
  n.mesh.position.set(x,0,z);
  npcs.push(n);
  return n;
}
spawnNpc('builder', 4, -18); spawnNpc('builder', -4, -18);
spawnNpc('villager', 6, -28); spawnNpc('villager', -8, -24); spawnNpc('villager', 2, -34);

// idle chatter — folk greet you as you pass
const SMALL_TALK = {
  villager: ['How are you?','Good weather today!','Fine harvest this year.','Wolves kept me up all night…','Hard work, honest pay.','Lovely day, neighbour!','Have you seen the new mill?','My feet ache something awful.'],
  soldier: ['Stay out of trouble.','Seen any wolves about?','The captain works us hard.','Move along, citizen.','A fine day for a patrol.','Keep your axe sharp, friend.'],
  builder: ['So much to build, so little time.','Mind the scaffolding!','This town grows fast, eh?','My back is killing me…','Measure twice, cut once.'],
};
function say(n, text){
  if (n.bubble){ n.mesh.remove(n.bubble); n.bubble.material.map.dispose(); n.bubble.material.dispose(); }
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
  const c = cv.getContext('2d');
  c.fillStyle = 'rgba(20,16,10,.85)'; c.fillRect(4,10,248,44);
  c.strokeStyle = '#8a6d3b'; c.strokeRect(4,10,248,44);
  c.font = '20px Georgia'; c.fillStyle = '#ffe9b0'; c.textAlign = 'center';
  c.fillText(text, 128, 38);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(cv), transparent:true }));
  sp.scale.set(4.6,1.15,1); sp.position.y = 3.0;
  n.mesh.add(sp); n.bubble = sp; n.bubbleT = 3.2;
}

const PATROL = [];
for (let i=0;i<6;i++){ const a = i/6*Math.PI*2; PATROL.push({ x:TC_POS.x+Math.cos(a)*30, z:TC_POS.z-4+Math.sin(a)*26 }); }

function moveToward(n, tx, tz, dt){
  const dx = tx-n.x, dz = tz-n.z, d = Math.hypot(dx,dz);
  if (d < .25) return true;
  n.x += dx/d*n.speed*dt; n.z += dz/d*n.speed*dt;
  n.mesh.rotation.y = Math.atan2(dx,dz);
  n.bobT += dt*10;
  n.mesh.position.set(n.x, Math.abs(Math.sin(n.bobT))*.12, n.z);
  const arms = n.mesh.userData.arms;
  if (arms){ arms.armL.rotation.x = -Math.sin(n.bobT)*.55; arms.armR.rotation.x = Math.sin(n.bobT)*.55; }
  return false;
}

function updateNpc(n, dt){
  n.timer -= dt;
  if (n.hp <= 0){ // slain — remove, town replaces later
    scene.remove(n.mesh); npcs.splice(npcs.indexOf(n),1);
    town.respawnQueue.push({ role:n.role, t: game.time + 25 });
    addMsg(`A ${n.role} has been slain!`, '#e0908a');
    return;
  }
  // small talk when the player passes by
  if (n.bubble){
    n.bubbleT -= dt;
    if (n.bubbleT <= 0){ n.mesh.remove(n.bubble); n.bubble.material.map.dispose(); n.bubble.material.dispose(); n.bubble = null; }
  } else {
    if (n.nextTalk === undefined) n.nextTalk = game.time + rand(4,25);
    if (game.time >= n.nextTalk && Math.hypot(player.x-n.x, player.z-n.z) < 9){
      const lines = SMALL_TALK[n.role] || SMALL_TALK.villager;
      say(n, lines[irand(0,lines.length-1)]);
      n.nextTalk = game.time + rand(18,45);
    }
  }
  if (n.role === 'builder'){
    const sites = activeSites();
    if (sites.length){
      const s = sites[0];
      if (Math.hypot(s.x-n.x, s.z-n.z) > FOOTPRINT[s.type]+2.2)
        moveToward(n, s.x+rand(-1,1), s.z+FOOTPRINT[s.type]+1.8, dt);
      else { // hammering
        s.progress += dt / BUILD_TIME[s.type];
        if (n.hammer){ n.bobT += dt*14; n.hammer.rotation.z = Math.sin(n.bobT)*.8; }
        if (Math.random() < dt*2.5) sfx.build();
      }
    } else if (n.timer <= 0){ n.tx = TC_POS.x+rand(-8,8); n.tz = TC_POS.z+rand(-4,8); n.timer = rand(3,7); }
    else moveToward(n, n.tx, n.tz, dt);
  }
  else if (n.role === 'soldier'){
    // fight nearby wolves and raiders first
    let w = null, wd = 28, isRaider = false;
    for (const wolf of wolves){ const d = Math.hypot(wolf.x-n.x, wolf.z-n.z); if (d<wd){ wd=d; w=wolf; isRaider=false; } }
    for (const rd of raiders){ if (rd.guard) continue; const d = Math.hypot(rd.x-n.x, rd.z-n.z); if (d<wd){ wd=d; w=rd; isRaider=true; } }
    n.attackCd -= dt;
    if (w){
      if (wd > 1.9) moveToward(n, w.x, w.z, dt);
      else if (n.attackCd <= 0){
        n.attackCd = .8; w.hp -= 14; w.flash = .15;
        if (w.hp<=0){ if (isRaider) killRaider(w, n); else killWolf(w, n); }
      }
    } else {
      const p = PATROL[n.patrolIdx];
      if (moveToward(n, p.x, p.z, dt)) n.patrolIdx = (n.patrolIdx+1)%PATROL.length;
    }
  }
  else { // villager ambience: wander between town and nature
    if (n.state==='idle' && n.timer<=0){
      const t = trees.filter(t=>t.alive && Math.hypot(t.x-TC_POS.x, t.z-TC_POS.z) < 70);
      const pick = Math.random()<.5 && t.length ? t[irand(0,t.length-1)] : null;
      if (pick){ n.target = pick; n.state='walk'; }
      else { n.tx = TC_POS.x+rand(-18,18); n.tz = TC_POS.z+rand(-16,12); n.state='stroll'; }
    } else if (n.state==='walk' && n.target){
      if (moveToward(n, n.target.x+1.2, n.target.z, dt)){ n.state='gather'; n.timer = rand(2.5,4); }
    } else if (n.state==='gather'){
      n.bobT += dt*9; n.mesh.position.y = Math.abs(Math.sin(n.bobT))*.08;
      if (n.timer<=0){ n.state='return'; }
    } else if (n.state==='return'){
      if (moveToward(n, TC_POS.x+rand(-3,3), TC_POS.z+5, dt)){ n.state='idle'; n.timer = rand(2,5); }
    } else if (n.state==='stroll'){
      if (moveToward(n, n.tx, n.tz, dt)){ n.state='idle'; n.timer = rand(2,6); }
    } else if (n.timer<=0) n.state='idle';
  }
  // cheer marker handled in entertain logic
}

// ---------------------------------------------------------------- wolves
const wolves = [];
function spawnWolf(){
  if (game.phase !== 'night') return; // delayed spawns must not land in daytime
  // half threaten the town, half stalk wherever the player wandered off to
  const nearPlayer = Math.random() < .5;
  const cx = nearPlayer ? player.x : TC_POS.x, cz = nearPlayer ? player.z : TC_POS.z;
  const ang = rand(0,Math.PI*2), d = rand(45,65);
  const x = clamp(cx+Math.cos(ang)*d, -MAP+4, MAP-4);
  const z = clamp(cz+Math.sin(ang)*d, -MAP+4, MAP-4);
  const g = new THREE.Group();
  const body = box(1.5,.7,.7,0x4a4a4a,0,.65,0); g.add(body);
  g.add(box(.55,.5,.5,0x3d3d3d,.95,.85,0));
  g.add(cone(.12,.3,0x3d3d3d,1.05,1.25,.15,4));
  g.add(cone(.12,.3,0x3d3d3d,1.05,1.25,-.15,4));
  const e1 = sphere(.06,0xff2222,1.25,.9,.14), e2 = sphere(.06,0xff2222,1.25,.9,-.14);
  e1.material = new THREE.MeshBasicMaterial({ color:0xff3322 }); e2.material = e1.material;
  g.add(e1,e2);
  g.add(box(.9,.18,.18,0x4a4a4a,-1,.8,0));
  scene.add(g); g.position.set(x,0,z);
  wolves.push({ mesh:g, x, z, hp:30, speed:5.6, attackCd:0, flash:0, bobT:rand(0,9) });
  sfx.growl();
}
function killWolf(w, killer){
  scene.remove(w.mesh); wolves.splice(wolves.indexOf(w),1);
  if (killer === player){
    addMsg('You slew a wolf!', '#bfe8a0');
    if (game.job && (game.job.type==='guard'||game.job.type==='knight')) jobProgress(1);
    game.gold += 2; sfx.coin();
  }
}
function updateWolf(w, dt){
  w.flash = Math.max(0, w.flash-dt);
  w.mesh.children[0].material = w.flash>0 ? mat(0xaa3333) : mat(0x4a4a4a);
  // nearest target: player (unless safely asleep) or npc
  let best = null, bd = Infinity;
  if (!game.sleeping){ best = player; bd = Math.hypot(player.x-w.x, player.z-w.z); }
  for (const n of npcs){ const d = Math.hypot(n.x-w.x, n.z-w.z); if (d<bd){ bd=d; best=n; } }
  w.attackCd -= dt;
  if (!best) return;
  if (bd > 1.7){
    const dx = best.x-w.x, dz = best.z-w.z, d = Math.hypot(dx,dz)||1;
    w.x += dx/d*w.speed*dt; w.z += dz/d*w.speed*dt;
    w.mesh.rotation.y = Math.atan2(dx,dz)-Math.PI/2;
    w.bobT += dt*12; w.mesh.position.set(w.x, Math.abs(Math.sin(w.bobT))*.1, w.z);
  } else if (w.attackCd <= 0){
    w.attackCd = 1;
    if (best === player){ damagePlayer(8, 'a wolf'); }
    else { best.hp -= 12; }
  }
}

// ---------------------------------------------------------------- animals (huntable)
const ANIMAL_DEFS = {
  deer:   { count:5, hp:20, speed:7.0, flee:9, food:5 },
  boar:   { count:3, hp:35, speed:6.2, flee:0, food:8, dmg:6 },
  rabbit: { count:4, hp:8,  speed:8.6, flee:6, food:2 },
};
const animals = [];
function makeAnimalMesh(kind){
  const g = new THREE.Group();
  if (kind==='deer'){
    const body = box(.7,.8,1.5,0xb5895a,0,1,0); g.userData.body = body; g.add(body);
    g.add(box(.3,.7,.3,0xb5895a,0,1.6,.6));
    g.add(box(.34,.34,.5,0xa07845,0,2.05,.8));
    g.add(cone(.06,.4,0x8a6d3b,-.14,2.45,.7,4));
    g.add(cone(.06,.4,0x8a6d3b,.14,2.45,.7,4));
    for (const [lx,lz] of [[-.25,.5],[.25,.5],[-.25,-.5],[.25,-.5]]) g.add(cyl(.07,.07,.7,0x9c7748,lx,.35,lz,6));
  } else if (kind==='boar'){
    const body = box(.85,.8,1.4,0x5d4123,0,.6,0); g.userData.body = body; g.add(body);
    g.add(box(.5,.5,.5,0x4a3318,0,.6,.85));
    g.add(cone(.05,.25,0xeee8d5,-.15,.45,1.1,4));
    g.add(cone(.05,.25,0xeee8d5,.15,.45,1.1,4));
  } else {
    const body = box(.38,.35,.55,0xbcb8b0,0,.28,0); g.userData.body = body; g.add(body);
    g.add(box(.07,.32,.1,0xbcb8b0,-.08,.65,.18));
    g.add(box(.07,.32,.1,0xbcb8b0,.08,.65,.18));
  }
  scene.add(g);
  return g;
}
function spawnAnimal(kind){
  for (let tries=0; tries<20; tries++){
    const a = rand(0,Math.PI*2), d = rand(30,90);
    const x = clamp(player.x+Math.cos(a)*d, -MAP+6, MAP-6), z = clamp(player.z+Math.sin(a)*d, -MAP+6, MAP-6);
    if (inTown(x,z)) continue;
    const mesh = makeAnimalMesh(kind);
    mesh.position.set(x,0,z);
    animals.push({ kind, mesh, x, z, tx:x, tz:z, hp:ANIMAL_DEFS[kind].hp,
                   timer:rand(0,3), bobT:rand(0,9), flash:0, enraged:false, enrageT:0, attackCd:0 });
    return;
  }
}
function killAnimal(a){
  scene.remove(a.mesh); animals.splice(animals.indexOf(a),1);
  const f = ANIMAL_DEFS[a.kind].food;
  game.food += f; sfx.pick();
  addMsg(`You hunted a ${a.kind}! +${f} food.`, '#bfe8a0');
}
function moveAnimal(a, tx, tz, sp, dt){
  const dx = tx-a.x, dz = tz-a.z, l = Math.hypot(dx,dz)||1;
  a.x = clamp(a.x+dx/l*sp*dt, -MAP, MAP); a.z = clamp(a.z+dz/l*sp*dt, -MAP, MAP);
  a.mesh.rotation.y = Math.atan2(dx,dz);
  a.bobT += dt*12;
  a.mesh.position.set(a.x, Math.abs(Math.sin(a.bobT))*.12, a.z);
}
function updateAnimal(a, dt){
  const d = ANIMAL_DEFS[a.kind];
  a.flash = Math.max(0, a.flash-dt);
  a.mesh.userData.body.material = a.flash>0 ? mat(0xaa3333) : mat(a.kind==='deer'?0xb5895a:a.kind==='boar'?0x5d4123:0xbcb8b0);
  const pd = Math.hypot(player.x-a.x, player.z-a.z);
  if (a.kind==='boar' && a.enraged){
    a.enrageT -= dt; a.attackCd -= dt;
    if (a.enrageT <= 0 || pd > 28 || game.sleeping){ a.enraged = false; return; }
    if (pd > 1.7) moveAnimal(a, player.x, player.z, d.speed*1.2, dt);
    else if (a.attackCd <= 0){ a.attackCd = 1; damagePlayer(d.dmg, 'an enraged boar'); }
    return;
  }
  if (d.flee && pd < d.flee && !game.sleeping){
    const dx = a.x-player.x, dz = a.z-player.z, l = Math.hypot(dx,dz)||1;
    moveAnimal(a, a.x+dx/l*8, a.z+dz/l*8, d.speed, dt);
    a.timer = rand(1,3);
    return;
  }
  a.timer -= dt;
  if (a.timer <= 0){
    a.tx = clamp(a.x+rand(-12,12), -MAP+4, MAP-4);
    a.tz = clamp(a.z+rand(-12,12), -MAP+4, MAP-4);
    if (inTown(a.tx,a.tz)){ a.tx = a.x; a.tz = a.z; }
    a.timer = rand(3,8);
  }
  if (Math.hypot(a.tx-a.x, a.tz-a.z) > .4) moveAnimal(a, a.tx, a.tz, d.speed*.45, dt);
}
// ---------------------------------------------------------------- enemy factions
const factions = [
  { name:'Crimson Banner', color:0xa32e2e, camp:{ x: 190, z: 150 }, tribute:25, firstScout:380 },
  { name:'Violet Horde',   color:0x6c3483, camp:{ x:-205, z: 170 }, tribute:35, firstScout:650 },
].map(f=>Object.assign(f, { state:'hidden', anger:0, nextEvent:f.firstScout,
                            discovered:false, scout:null, truceOffer:false }));
const raiders = [];

function makeRaiderMesh(color){
  const g = new THREE.Group();
  g.add(cyl(.42,.5,1.25,color,0,.85,0,8));
  g.add(sphere(.32,0xd8a878,0,1.8,0));
  g.add(cyl(.38,.38,.28,0x333333,0,2.0,0,8));
  const s = cyl(.05,.05,2,0x4a3a28,.45,1.4,0); s.rotation.x = .12; g.add(s);
  g.add(cone(.13,.4,0x666666,.45,2.5,.14,6));
  addFaceArms(g, color, 0xd8a878);
  scene.add(g);
  return g;
}
function spawnRaider(f, guard){
  const mesh = makeRaiderMesh(f.color);
  const x = f.camp.x + rand(-6,6), z = f.camp.z + rand(-6,6);
  mesh.position.set(x,0,z);
  raiders.push({ faction:f, guard, mesh, x, z, tx:x, tz:z, hp:40, dmg:8, speed:5.4,
                 attackCd:0, flash:0, bobT:rand(0,9), state:'march', timer:0, retreatAt:Infinity });
}
function killRaider(r, killer){
  scene.remove(r.mesh); raiders.splice(raiders.indexOf(r),1);
  if (killer && killer.isPlayer){
    game.gold += 3; sfx.coin();
    addMsg(`You felled a ${r.faction.name} raider! +3🪙`, '#bfe8a0');
    if (game.job && (game.job.type==='guard'||game.job.type==='knight')) jobProgress(1);
  }
}
function buildCamp(f){
  const g = new THREE.Group();
  for (const [tx,tz] of [[-5,0],[5,-1],[0,6]]){
    g.add(cone(3,3.4,0x6e5a3f,tx,1.7,tz,8));
    g.add(cone(.6,1,f.color,tx,3.9,tz,6));
  }
  g.add(cyl(.1,.1,7,0x5d4a26,0,3.5,0));
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.6,1.4), new THREE.MeshBasicMaterial({ color:f.color, side:THREE.DoubleSide }));
  flag.position.set(1.3,6.2,0); g.add(flag);
  g.add(cyl(.5,.7,.5,0x3d2b1a,0,.25,3));
  const fire = new THREE.PointLight(0xff7733, 1.2, 14); fire.position.set(0,1.4,3); g.add(fire);
  g.position.set(f.camp.x, 0, f.camp.z);
  scene.add(g);
  spawnRaider(f, true); spawnRaider(f, true);
}
for (const f of factions) buildCamp(f);

function launchRaid(f){
  const n = Math.min(8, 3 + Math.floor(game.day/2));
  for (let i=0;i<n;i++){
    spawnRaider(f, false);
    raiders[raiders.length-1].retreatAt = game.time + 110;
  }
  addMsg(`⚔ ${f.name} raiders are marching on the town!`, '#ff8080'); sfx.growl();
}
function updateRaider(r, dt){
  r.flash = Math.max(0, r.flash-dt);
  r.mesh.children[0].material = r.flash>0 ? mat(0xff6666) : mat(r.faction.color);
  r.attackCd -= dt;
  if (r.guard){ // stays home, savages trespassers
    const pd = Math.hypot(player.x-r.x, player.z-r.z);
    if (pd < 10 && !game.sleeping && !game.over){
      if (pd > 1.7) moveToward(r, player.x, player.z, dt);
      else if (r.attackCd <= 0){ r.attackCd = 1; damagePlayer(r.dmg, `a ${r.faction.name} camp guard`); }
    } else if (Math.hypot(r.faction.camp.x-r.x, r.faction.camp.z-r.z) > 12){
      moveToward(r, r.faction.camp.x, r.faction.camp.z, dt);
    } else {
      r.timer -= dt;
      if (r.timer <= 0){ r.tx = r.faction.camp.x+rand(-7,7); r.tz = r.faction.camp.z+rand(-7,7); r.timer = rand(2,6); }
      else moveToward(r, r.tx, r.tz, dt);
    }
    return;
  }
  if (r.state==='retreat'){
    if (moveToward(r, r.faction.camp.x, r.faction.camp.z, dt)){
      scene.remove(r.mesh); raiders.splice(raiders.indexOf(r),1);
    }
    return;
  }
  if (game.time > r.retreatAt){ r.state = 'retreat'; return; }
  let best = null, bd = 14;
  if (!game.sleeping){ const d = Math.hypot(player.x-r.x, player.z-r.z); if (d < bd){ bd = d; best = player; } }
  for (const n of npcs){ const d = Math.hypot(n.x-r.x, n.z-r.z); if (d < bd){ bd = d; best = n; } }
  if (best){
    if (bd > 1.7) moveToward(r, best.x, best.z, dt);
    else if (r.attackCd <= 0){
      r.attackCd = 1;
      if (best === player) damagePlayer(r.dmg, `a ${r.faction.name} raider`);
      else best.hp -= r.dmg;
    }
  } else moveToward(r, TC_POS.x, TC_POS.z, dt);
}

function showOffer(f){
  game.diploOpen = true; game.diploFaction = f;
  if (document.exitPointerLock) document.exitPointerLock();
  const amount = f.truceOffer ? f.tribute*2 : f.tribute;
  document.getElementById('diplotitle').textContent = `Envoy of the ${f.name}`;
  document.getElementById('diplotext').textContent = (f.truceOffer
    ? `"Enough blood has been spilled. Pay ${amount} gold and the ${f.name} will end this war."`
    : `"Your town grows fat on our borders. Pay ${amount} gold in tribute and we shall remain friends."`)
    + (f.anger>0 && !f.truceOffer ? " The envoy's patience is clearly wearing thin." : '');
  document.getElementById('diplo').style.display = 'flex';
  f.state = 'offered';
}
function closeDiplo(){
  game.diploOpen = false; game.diploFaction = null;
  document.getElementById('diplo').style.display = 'none';
}
document.getElementById('diploaccept').addEventListener('click', ()=>{
  const f = game.diploFaction; if (!f) return;
  const amount = f.truceOffer ? f.tribute*2 : f.tribute;
  if (game.gold < amount){ addMsg(`You can't afford ${amount}🪙 — decline, or find the gold.`, '#e0908a'); return; }
  game.gold -= amount; sfx.coin();
  const wasWar = f.truceOffer;
  f.truceOffer = false; f.anger = Math.max(0, f.anger-1);
  f.state = 'peace'; f.nextEvent = game.time + DAY_LEN*1.6;
  f.tribute = Math.round(f.tribute*1.35);
  addMsg(wasWar ? `The war with the ${f.name} is over.` : `Peace with the ${f.name} — for now. They'll want more next time.`, '#bfe8a0');
  closeDiplo();
});
document.getElementById('diplodecline').addEventListener('click', ()=>{
  const f = game.diploFaction; if (!f) return;
  if (f.truceOffer){
    f.truceOffer = false; f.state = 'war'; f.nextEvent = game.time + 30;
    addMsg(`The war with the ${f.name} rages on.`, '#e0908a');
  } else {
    f.anger++;
    if (f.anger >= 2){
      f.state = 'war'; f.nextEvent = game.time + 25;
      addMsg(`⚔ The ${f.name} declare WAR on the town!`, '#ff8080'); sfx.growl();
    } else {
      f.state = 'sulking'; f.nextEvent = game.time + DAY_LEN*.9;
      addMsg(`The ${f.name} envoy leaves, visibly angered.`, '#e0908a');
    }
  }
  closeDiplo();
});

function updateFactions(dt){
  for (const f of factions){
    if (f.scout){
      const s = f.scout;
      if (s.phase==='go'){
        if (moveToward(s, TC_POS.x+28, TC_POS.z+20, dt)){
          s.phase = 'watch'; s.waitT = 8;
          if (!f.discovered){ f.discovered = true; addMsg(`A ${f.name} scout is watching the town! Their camp is now marked on your minimap.`, '#e0908a'); }
        }
      } else if (s.phase==='watch'){
        s.waitT -= dt;
        if (s.waitT <= 0) s.phase = 'home';
      } else if (moveToward(s, f.camp.x, f.camp.z, dt)){
        scene.remove(s.mesh); f.scout = null;
        f.state = 'offer-pending'; f.nextEvent = game.time + 30;
      }
      continue;
    }
    if (game.time < f.nextEvent) continue;
    if (f.state==='hidden'){
      f.scout = { mesh:makeRaiderMesh(f.color), x:f.camp.x, z:f.camp.z, speed:7, bobT:0, phase:'go', waitT:8 };
      f.scout.mesh.position.set(f.camp.x, 0, f.camp.z);
      f.state = 'scouting'; f.nextEvent = Infinity;
    }
    else if (f.state==='offer-pending'){
      if (game.diploOpen || game.shopOpen || game.buildMenuOpen) f.nextEvent = game.time + 20;
      else showOffer(f);
    }
    else if (f.state==='peace' || f.state==='sulking'){ f.state = 'offer-pending'; f.nextEvent = game.time; }
    else if (f.state==='war'){
      if (Math.random() < .3){ f.truceOffer = true; f.state = 'offer-pending'; f.nextEvent = game.time; }
      else { launchRaid(f); f.nextEvent = game.time + DAY_LEN*1.1; }
    }
  }
  for (const r of [...raiders]) updateRaider(r, dt);
}

let animalTimer = 0;
function updateAnimals(dt){
  animalTimer -= dt;
  if (animalTimer <= 0){
    animalTimer = 15;
    for (const k in ANIMAL_DEFS)
      if (animals.filter(a=>a.kind===k).length < ANIMAL_DEFS[k].count) spawnAnimal(k);
  }
  for (const a of [...animals]) updateAnimal(a, dt);
}

// ---------------------------------------------------------------- player
const player = {
  mesh: new THREE.Group(), x:0, z:8, hp:100, hunger:100, speed:8,
  action:null, attackCd:0, anim:0, hasSword:false, house:null, isPlayer:true, bobT:0,
};
{
  player.mesh.add(cyl(.42,.5,1.25,0x2e5fa3,0,.85,0,8));
  player.mesh.add(sphere(.32,0xe8b88a,0,1.8,0));
  player.mesh.add(cyl(.34,.34,.18,0x6e4a2f,0,2.05,0,8));
  const arms = addFaceArms(player.mesh, 0x2e5fa3);
  player.armL = arms.armL; player.armR = arms.armR;
  const tool = new THREE.Group();
  tool.add(cyl(.05,.05,1,0x8a5a2b,0,.5,0));
  tool.add(box(.34,.22,.1,0xb0b8bd,.12,.95,0));
  tool.position.set(.5,1,0); tool.visible = false;
  player.mesh.add(tool); player.tool = tool;
  player.mesh.position.set(player.x,0,player.z);
  scene.add(player.mesh);
}
// white slash arc shown while swinging
const swingArc = new THREE.Mesh(
  new THREE.TorusGeometry(1.15, .07, 6, 14, Math.PI*.95),
  new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0 }));
swingArc.rotation.order = 'YXZ';
swingArc.rotation.x = -Math.PI/2.4;
swingArc.visible = false;
scene.add(swingArc);

function damagePlayer(amount, source){
  player.hp -= amount; sfx.hurt();
  if (player.hp <= 0){ player.hp = 0; die(source); }
}
function die(source){
  game.over = true;
  if (document.exitPointerLock) document.exitPointerLock();
  document.getElementById('deathmsg').textContent =
    `Killed by ${source} on day ${game.day}. The town carried on without you.`;
  document.getElementById('death').style.display = 'flex';
}

// ---------------------------------------------------------------- game state
const game = {
  time: 0, day: 1, phase:'day', dayT: .07, // start at morning
  wood: 0, food: 4, gold: 5, stone: 0,
  job: null, jobsTakenToday: false, over: false, started: false,
  sleeping: false, shopOpen: false, buildMenuOpen: false, diploOpen: false, diploFaction: null,
  paused: false,
};
const town = { planIdx: 0, respawnQueue: [], soldierTimer: 0, soldierCap: 0, villagerCap: 5, castleDone: false,
               wood: 60, stone: 40 }; // communal stockpile, used by employed builders

// ---------------------------------------------------------------- jobs
const JOB_DEFS = {
  lumberjack: { name:'Lumberjack', at:'lumbercamp', quota:14, wage:30, desc:'Deliver wood to the Lumber Camp', unit:'wood delivered' },
  farmer:     { name:'Farmer',     at:'mill',       quota:12, wage:28, desc:'Deliver food to the Mill',        unit:'food delivered' },
  miner:      { name:'Miner',      at:'quarry',     quota:12, wage:32, desc:'Deliver stone to the Quarry',     unit:'stone delivered' },
  builder:    { name:'Builder',    at:'towncenter', quota:0,  wage:0,  desc:'Build what the town commissions — paid per building', unit:'' },
  guard:      { name:'Guard',      at:'barracks',   quota:6,  wage:40, desc:'Visit the 6 glowing patrol posts; wolf kills count too', unit:'patrols done' },
  entertainer:{ name:'Entertainer',at:'market',     quota:8,  wage:15, desc:'Perform for townsfolk (E near them) — they tip on the spot!', unit:'folk entertained' },
  knight:     { name:'Knight',     at:'castle',     quota:3,  wage:80, desc:'Slay wolves in defense of the realm', unit:'wolves slain' },
};
let patrolMarkers = [];
function spawnPatrolMarkers(){
  for (const p of PATROL){
    const m = cyl(.7,.9,2.6,0xffd97a,p.x,1.3,p.z,10);
    m.material = new THREE.MeshBasicMaterial({ color:0xffd97a, transparent:true, opacity:.55 });
    scene.add(m); patrolMarkers.push({ mesh:m, x:p.x, z:p.z, visited:false });
  }
}

function assignCommission(){
  const pool = ['house','farm','tower','wall','quarry','lumbercamp','house','farm','wall','tower'];
  const type = pool[irand(0,pool.length-1)];
  const c = BUILD_COSTS[type];
  game.job.commission = type;
  game.job.commissionDone = false;
  game.job.commissionSite = null;
  game.job.pay = 15 + (c.wood||0) + (c.stone||0)*2;
  addMsg(`New commission: build a ${BNAMES[type]} (press B — town supplies cover the cost). Pay: ${game.job.pay}🪙`, '#ffd97a');
  updateJobPanel();
}
function takeJob(type){
  const d = JOB_DEFS[type];
  if (type === 'builder'){
    game.job = { type:'builder', tips:0 };
    game.jobsTakenToday = true;
    addMsg('Hired as Builder! The town commissions buildings from you — collect pay at the Town Center per finished building.', '#ffd97a');
    sfx.ding();
    assignCommission();
    return;
  }
  game.job = { type, quota:d.quota, progress:0, wage:d.wage + (game.day-1)*4, tips:0 };
  game.jobsTakenToday = true;
  addMsg(`Hired as ${d.name}! ${d.desc}. Pay at dusk: ${game.job.wage}🪙`, '#ffd97a');
  sfx.ding();
  if (type==='guard') spawnPatrolMarkers();
  if (type==='entertainer') for (const n of npcs) n.cheered = false;
  updateJobPanel();
}
function jobProgress(n){
  if (!game.job) return;
  const before = game.job.progress;
  game.job.progress = Math.min(game.job.quota, game.job.progress + n);
  if (game.job.progress >= game.job.quota && before < game.job.quota){
    addMsg('Daily quota complete! Collect full pay at dusk.', '#bfe8a0'); sfx.ding();
  }
  updateJobPanel();
}
function payDay(){
  if (!game.job) return;
  if (game.job.type === 'builder'){ // builders keep their post; they're paid per commission
    addMsg('Builders are paid per commission, not by the day. Your post is safe.', '#bca97c');
    return;
  }
  const d = JOB_DEFS[game.job.type];
  const frac = Math.min(1, game.job.progress / game.job.quota);
  const pay = Math.round(game.job.wage * frac);
  game.gold += pay;
  const tip = game.job.tips ? ` (+${game.job.tips}🪙 tips earned today)` : '';
  addMsg(`Day's end: paid ${pay}🪙 as ${d.name} (${Math.round(frac*100)}% of quota)${tip}.`, '#ffd97a');
  if (pay>0) sfx.coin();
  game.job = null;
  for (const m of patrolMarkers) scene.remove(m.mesh);
  patrolMarkers = [];
  updateJobPanel();
}
function updateJobPanel(){
  const el = document.getElementById('jobpanel');
  if (!game.job){ el.style.display = 'none'; return; }
  const d = JOB_DEFS[game.job.type];
  el.style.display = 'block';
  document.getElementById('jobtitle').textContent = `⚒ ${d.name}`;
  if (game.job.type === 'builder'){
    document.getElementById('jobquota').textContent = game.job.commissionDone
      ? `${BNAMES[game.job.commission]} ✓ — collect pay at Town Center`
      : `Commission: ${BNAMES[game.job.commission]} (press B)`;
    document.getElementById('jobwage').textContent = `Pay on completion: ${game.job.pay}🪙`;
    return;
  }
  document.getElementById('jobquota').textContent = `${game.job.progress} / ${game.job.quota} ${d.unit}`;
  document.getElementById('jobwage').textContent = `Wage at dusk: ${game.job.wage}🪙`;
}

// ---------------------------------------------------------------- notes / particles (entertainer)
const notes = [];
function spawnNote(x,y,z){
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.font = '48px serif'; ctx.fillStyle = ['#ffd97a','#8ad9ff','#ffa0c8'][irand(0,2)];
  ctx.fillText('♪', 14, 48);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(cv), transparent:true }));
  sp.scale.set(.9,.9,1); sp.position.set(x+rand(-.5,.5), y, z+rand(-.5,.5));
  scene.add(sp);
  notes.push({ sp, life:1.4 });
}
function updateNotes(dt){
  for (let i=notes.length-1;i>=0;i--){
    const n = notes[i];
    n.life -= dt; n.sp.position.y += dt*1.6; n.sp.material.opacity = n.life/1.4;
    if (n.life<=0){ scene.remove(n.sp); n.sp.material.map.dispose(); n.sp.material.dispose(); notes.splice(i,1); }
  }
}

// ---------------------------------------------------------------- messages
const logEl = document.getElementById('log');
function addMsg(text, color='#e8d9b0'){
  const d = document.createElement('div');
  d.textContent = text; d.style.color = color;
  logEl.appendChild(d);
  while (logEl.children.length > 5) logEl.removeChild(logEl.firstChild);
  setTimeout(()=>{ d.style.opacity = '0'; }, 7000);
  setTimeout(()=>{ if (d.parentNode) d.parentNode.removeChild(d); }, 8400);
}

// ---------------------------------------------------------------- input
const keys = {};
let camYaw = 0, camDist = 18; // camera south of player, looking at the town
addEventListener('keydown', e=>{
  if (e.code==='Space') e.preventDefault();
  if (keys[e.code]) return;
  keys[e.code] = true;
  if (!game.started || game.over) return;
  if (game.shopOpen){ if (e.code==='KeyE'||e.code==='Escape') closeShop(); return; }
  if (game.diploOpen) return; // the envoy demands an answer by mouse
  if (game.paused){ if (e.code==='KeyP'||e.code==='Escape') closePause(); return; }
  if (game.buildMenuOpen){ if (e.code==='KeyB'||e.code==='Escape') closeBuildMenu(); return; }
  if (e.code==='KeyE') doInteract();
  if (e.code==='KeyF') eatFood();
  if (e.code==='KeyB'){ if (placement.active) cancelPlacement(); else openBuildMenu(); }
  if (e.code==='KeyP') openPause();
  if (e.code==='Escape' && placement.active) cancelPlacement();
});
addEventListener('keyup', e=>{ keys[e.code] = false; });
addEventListener('wheel', e=>{ camDist = clamp(camDist + Math.sign(e.deltaY)*2, 9, 38); });
addEventListener('contextmenu', e=>e.preventDefault());

// mouse look via pointer lock: click the world to capture, Esc to release
let camPitch = .62;
const canvasEl = renderer.domElement;
function pointerLocked(){ return document.pointerLockElement === canvasEl; }
canvasEl.addEventListener('click', ()=>{
  if (typeof IS_MOBILE !== 'undefined' && IS_MOBILE) return; // touch devices use drag-look, no pointer lock
  if (game.started && !game.over && !game.shopOpen && !game.diploOpen && !game.buildMenuOpen && !game.paused && !pointerLocked())
    canvasEl.requestPointerLock();
});
document.addEventListener('mousemove', e=>{
  if (!pointerLocked()) return;
  camYaw -= e.movementX * .0025;
  camPitch = clamp(camPitch + e.movementY * .0018, .18, 1.15);
});
document.addEventListener('mousedown', e=>{
  if (e.button === 0 && pointerLocked()) tryAttack();
});

function forwardVec(){ return { x:-Math.sin(camYaw), z:-Math.cos(camYaw) }; }
function tryAttack(){
  if (!game.started || game.over || game.shopOpen || game.diploOpen || game.buildMenuOpen || game.paused || game.sleeping) return;
  if (player.attackCd > 0) return;
  player.attackCd = .55; player.anim = 1; player.tool.visible = true;
  sfx.chop();
  const f = forwardVec();
  // generous melee cone in the camera's facing direction:
  // anything very close counts at up to ~80° off-axis, farther needs better aim
  let best = null, bd = 4.5, bestList = null;
  for (const list of [wolves, animals, raiders]) for (const t of list){
    const dx = t.x-player.x, dz = t.z-player.z, dd = Math.hypot(dx,dz);
    if (dd >= bd) continue;
    const dot = (dx*f.x + dz*f.z)/(dd||1);
    if (dot > (dd < 2.2 ? .15 : .45)){ bd = dd; best = t; bestList = list; }
  }
  if (!best) return;
  best.hp -= player.hasSword ? 22 : 10;
  best.flash = .15;
  best.x = clamp(best.x + f.x*.9, -MAP, MAP); // knockback
  best.z = clamp(best.z + f.z*.9, -MAP, MAP);
  best.mesh.position.x = best.x; best.mesh.position.z = best.z;
  if (best.hp <= 0){
    if (bestList === wolves) killWolf(best, player);
    else if (bestList === raiders) killRaider(best, player);
    else killAnimal(best);
  }
  else if (best.kind === 'boar'){ best.enraged = true; best.enrageT = 10; }
}

// ---------------------------------------------------------------- building: menu & placement
const BUILD_COSTS = {
  playerhouse:{ wood:30, stone:0 },
  house:      { wood:25, stone:0 },
  farm:       { wood:15, stone:0 },
  lumbercamp: { wood:30, stone:0 },
  quarry:     { wood:20, stone:10 },
  mill:       { wood:40, stone:0 },
  market:     { wood:35, stone:5 },
  tower:      { wood:10, stone:20 },
  wall:       { wood:0,  stone:12 },
};
const placement = { active:false, ghost:null, type:null };
function isBuilder(){ return game.job && game.job.type==='builder'; }
function canAfford(c){
  if (isBuilder()) return town.wood >= (c.wood||0) && town.stone >= (c.stone||0);
  return game.wood >= (c.wood||0) && game.stone >= (c.stone||0);
}
function openBuildMenu(){
  if (placement.active){ cancelPlacement(); return; }
  game.buildMenuOpen = true;
  if (document.exitPointerLock) document.exitPointerLock();
  document.getElementById('buildsupplies').textContent = isBuilder()
    ? `Builder's privilege: costs come from the town stockpile (🪵${Math.floor(town.wood)}  🪨${Math.floor(town.stone)})`
    : 'Costs come from your own resources.';
  const list = document.getElementById('buildlist');
  list.innerHTML = '';
  for (const [type,c] of Object.entries(BUILD_COSTS)){
    if (type==='playerhouse' && player.house) continue;
    const row = document.createElement('div');
    row.className = 'shoprow';
    const name = type==='playerhouse' ? 'Cottage (your home)' : BNAMES[type];
    const star = isBuilder() && !game.job.commissionDone && game.job.commission===type ? ' ⭐ COMMISSION' : '';
    const cost = [c.wood?`${c.wood}🪵`:'', c.stone?`${c.stone}🪨`:''].filter(Boolean).join(' + ');
    const span = document.createElement('span');
    span.textContent = `${name} — ${cost}${star}`;
    if (star) span.style.color = '#ffd97a';
    const btn = document.createElement('button');
    btn.textContent = 'Build';
    btn.addEventListener('click', ()=>startPlacement(type));
    row.append(span, btn);
    list.appendChild(row);
  }
  document.getElementById('build').style.display = 'flex';
}
function closeBuildMenu(){ game.buildMenuOpen = false; document.getElementById('build').style.display = 'none'; }
document.getElementById('buildclose').addEventListener('click', closeBuildMenu);
function startPlacement(type){
  const c = BUILD_COSTS[type];
  if (!canAfford(c)){
    addMsg(isBuilder() ? 'The town stockpile lacks the materials — supplies trickle in over time.' : 'Not enough materials.', '#e0908a');
    return;
  }
  closeBuildMenu();
  placement.active = true; placement.type = type;
  placement.ghost = FACT[type]();
  placement.ghost.traverse(o=>{ if (o.material){ o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = .55; } });
  scene.add(placement.ghost);
  addMsg('Choose a spot — E to place, B/Esc to cancel.', '#8ad9ff');
}
function cancelPlacement(){
  if (placement.ghost) scene.remove(placement.ghost);
  placement.active = false; placement.ghost = null; placement.type = null;
}
function placementValid(x,z){
  if (Math.abs(x)>MAP-4 || Math.abs(z)>MAP-4) return false;
  for (const b of buildings) if (Math.hypot(b.x-x,b.z-z) < FOOTPRINT[b.type]+4) return false;
  for (const t of trees) if (t.alive && Math.hypot(t.x-x,t.z-z) < 3.4) return false;
  return true;
}
function confirmPlacement(){
  const x = placement.ghost.position.x, z = placement.ghost.position.z;
  if (!placementValid(x,z)){ addMsg("Can't build here.", '#e0908a'); return; }
  const type = placement.type, c = BUILD_COSTS[type];
  if (!canAfford(c)){ cancelPlacement(); addMsg('The materials ran out.', '#e0908a'); return; }
  if (isBuilder()){ town.wood -= c.wood||0; town.stone -= c.stone||0; }
  else { game.wood -= c.wood||0; game.stone -= c.stone||0; }
  cancelPlacement();
  const b = addBuilding(type, x, z);
  b.owned = true; b.playerBuilt = true;
  if (type==='playerhouse') player.house = b;
  if (isBuilder() && !game.job.commissionDone && game.job.commission===type && !game.job.commissionSite){
    b.commission = true; game.job.commissionSite = b;
  }
  addMsg('Foundation laid! Stand close and press E to build it.', '#8ad9ff');
}

// ---------------------------------------------------------------- interaction
function nearestOf(list, maxD, pred){
  let best = null, bd = maxD;
  for (const o of list){
    if (pred && !pred(o)) continue;
    const d = Math.hypot(o.x-player.x, o.z-player.z);
    if (d < bd){ bd = d; best = o; }
  }
  return best;
}
function computeInteract(){
  if (placement.active) return { label:`Place ${BNAMES[placement.type]} here  (B to cancel)`, fn:confirmPlacement };
  // your own construction sites
  const mySite = buildings.find(b=>b.playerBuilt && !b.done && Math.hypot(b.x-player.x,b.z-player.z) < FOOTPRINT[b.type]+4);
  if (mySite) return { label:`Build the ${mySite.name}`, fn:()=>{ player.action = { type:'buildsite', site:mySite }; } };
  if (player.house && player.house.done && (game.phase==='night'||game.phase==='dusk')
      && Math.hypot(player.house.x-player.x, player.house.z-player.z) < 5)
    return { label:'Sleep until dawn  (restores health)', fn:sleep };
  // job-specific
  if (game.job){
    const j = game.job;
    if (j.type==='lumberjack' && j.progress < j.quota && game.wood > 0){
      const c = getBuilding('lumbercamp');
      if (c && Math.hypot(c.x-player.x,c.z-player.z) < 6)
        return { label:`Deliver wood  (${game.wood} carried)`, fn:()=>{
          const n = Math.min(game.wood, j.quota-j.progress);
          game.wood -= n; jobProgress(n); sfx.coin(); addMsg(`Delivered ${n} wood.`, '#bfe8a0');
        }};
    }
    if (j.type==='farmer' && j.progress < j.quota && game.food > 0){
      const m = getBuilding('mill');
      if (m && Math.hypot(m.x-player.x,m.z-player.z) < 6)
        return { label:`Deliver food  (${game.food} carried)`, fn:()=>{
          const n = Math.min(game.food, j.quota-j.progress);
          game.food -= n; jobProgress(n); sfx.coin(); addMsg(`Delivered ${n} food.`, '#bfe8a0');
        }};
    }
    if (j.type==='miner' && j.progress < j.quota && game.stone > 0){
      const q = getBuilding('quarry');
      if (q && Math.hypot(q.x-player.x,q.z-player.z) < 6)
        return { label:`Deliver stone  (${game.stone} carried)`, fn:()=>{
          const n = Math.min(game.stone, j.quota-j.progress);
          game.stone -= n; jobProgress(n); sfx.coin(); addMsg(`Delivered ${n} stone.`, '#bfe8a0');
        }};
    }
    if (j.type==='builder' && j.commissionDone){
      const tc = getBuilding('towncenter');
      if (tc && Math.hypot(tc.x-player.x,tc.z-player.z) < FOOTPRINT.towncenter+4)
        return { label:`Collect ${j.pay}🪙 & take the next commission`, fn:()=>{
          game.gold += j.pay; sfx.coin();
          addMsg(`Paid ${j.pay}🪙 for your craftsmanship.`, '#ffd97a');
          assignCommission();
        }};
    }
    if (j.type==='entertainer'){
      const n = nearestOf(npcs, 3.5, n=>!n.cheered);
      if (n) return { label:`Perform for the ${n.role}`, fn:()=>{ player.action = { type:'perform', npc:n, t:0 }; } };
    }
  }
  // job applications & shop (daytime)
  if (!game.shopOpen){
    for (const [type, d] of Object.entries(JOB_DEFS)){
      const b = getBuilding(d.at);
      if (!b || Math.hypot(b.x-player.x,b.z-player.z) > FOOTPRINT[d.at==='castle'?'castle':b.type]+3.5) continue;
      if (d.at==='market'){ /* market is shop first, busker via second pass below */ }
      if (!game.job && !game.jobsTakenToday && game.phase==='day' && d.at!=='market')
        return { label: type==='builder'
          ? 'Apply: Builder  (paid per commissioned building)'
          : `Apply: ${d.name}  (quota ${d.quota}, wage ${d.wage + (game.day-1)*4}🪙)`, fn:()=>takeJob(type) };
    }
    const mk = getBuilding('market');
    if (mk && Math.hypot(mk.x-player.x,mk.z-player.z) < 7){
      if (!game.job && !game.jobsTakenToday && game.phase==='day' && keys['ShiftLeft'])
        return { label:`Apply: Entertainer  (busk for tips, wage ${JOB_DEFS.entertainer.wage + (game.day-1)*4}🪙)`, fn:()=>takeJob('entertainer') };
      return { label: (!game.job && !game.jobsTakenToday && game.phase==='day')
        ? 'Open Market  (hold Shift+E to apply as Entertainer)' : 'Open Market', fn:openShop };
    }
  }
  // resources
  const tree = nearestOf(trees, 3.2, t=>t.alive);
  if (tree) return { label:'Chop tree', fn:()=>{ player.action = { type:'chop', target:tree, t:0 }; } };
  const bush = nearestOf(bushes, 3.2, b=>b.alive);
  if (bush) return { label: bush.isFarm ? 'Harvest crops' : 'Pick berries', fn:()=>{ player.action = { type:'pick', target:bush, t:0 }; } };
  const rock = nearestOf(rocks, 3.2, r=>r.alive);
  if (rock) return { label:'Mine stone', fn:()=>{ player.action = { type:'mine', target:rock, t:0 }; } };
  const vein = nearestOf(veins, 3.2, v=>v.alive);
  if (vein) return { label:'Mine gold ore', fn:()=>{ player.action = { type:'vein', target:vein, t:0 }; } };
  return null;
}
let currentInteract = null;
function doInteract(){ if (currentInteract) currentInteract.fn(); }

function eatFood(){
  if (game.food <= 0){ addMsg('No food! Pick berries or buy some at the market.', '#e0908a'); return; }
  if (player.hunger > 92){ addMsg("You're full.", '#bca97c'); return; }
  game.food--; player.hunger = clamp(player.hunger+32, 0, 100); sfx.eat();
}
function sleep(){
  game.sleeping = true;
  player.x = player.house.x; player.z = player.house.z; // tucked away inside
  player.mesh.visible = false;
  if (document.exitPointerLock) document.exitPointerLock();
  addMsg('You sleep soundly in your own house…', '#8ad9ff');
}
function wakeUp(){
  if (!game.sleeping) return;
  game.sleeping = false;
  player.hp = 100;
  player.x = player.house.x; player.z = player.house.z + FOOTPRINT.playerhouse + 1.4; // step out the door
  player.mesh.visible = true;
  player.mesh.position.set(player.x, 0, player.z);
  addMsg('You wake refreshed outside your door. Health restored.', '#bfe8a0');
  saveGame(true);
}

// ---------------------------------------------------------------- shop
function openShop(){
  game.shopOpen = true;
  if (document.exitPointerLock) document.exitPointerLock();
  document.getElementById('shop').style.display = 'flex';
}
function closeShop(){ game.shopOpen = false; document.getElementById('shop').style.display = 'none'; }
document.getElementById('shop').addEventListener('click', e=>{
  const act = e.target.dataset && e.target.dataset.act;
  if (!act) return;
  if (act==='close') return closeShop();
  if (act==='buyfood'){ if (game.gold>=6){ game.gold-=6; game.food++; sfx.coin(); } else addMsg('Not enough gold.', '#e0908a'); }
  if (act==='buywood'){ if (game.gold>=5){ game.gold-=5; game.wood++; sfx.coin(); } else addMsg('Not enough gold.', '#e0908a'); }
  if (act==='sellfood'){ if (game.food>0){ game.food--; game.gold+=3; sfx.coin(); } }
  if (act==='sellwood'){ if (game.wood>0){ game.wood--; game.gold+=2; sfx.coin(); } }
  if (act==='sellstone'){ if (game.stone>0){ game.stone--; game.gold+=2; sfx.coin(); } }
  if (act==='sword'){
    if (player.hasSword) addMsg('You already carry a sword.', '#bca97c');
    else if (game.gold>=50){ game.gold-=50; player.hasSword=true; sfx.ding(); addMsg('Steel sword purchased! Your strikes hit twice as hard.', '#ffd97a'); }
    else addMsg('Not enough gold.', '#e0908a');
  }
  updateHud();
});

// ---------------------------------------------------------------- town simulation
function updateTown(dt){
  // villagers keep the communal stockpile slowly topped up
  town.wood = Math.min(250, town.wood + dt*.2);
  town.stone = Math.min(250, town.stone + dt*.13);
  // release planned construction sites
  while (town.planIdx < PLAN.length && game.time >= PLAN[town.planIdx].t){
    const p = PLAN[town.planIdx++];
    addBuilding(p.type, p.x, p.z, p.rot||0);
    if (p.type!=='wall') addMsg(`The town has begun building a ${BNAMES[p.type]}.`, '#bca97c');
  }
  // construction progress + completion
  for (const b of buildings){
    if (b.done) continue;
    b.progress = Math.min(1, b.progress);
    b.group.scale.y = .02 + .98*b.progress;
    if (b.barFg){ b.barFg.scale.x = Math.max(.02, b.progress); b.barFg.position.x = -2*(1-b.progress); }
    if (b.bar) b.bar.lookAt(camera.position);
    if (b.progress >= 1){
      b.done = true;
      if (b.bar){ scene.remove(b.bar); b.bar = null; }
      if (b.siteMesh){ scene.remove(b.siteMesh); b.siteMesh = null; }
      if (b.type==='playerhouse'){ addMsg('Your house is finished! Sleep there at night to recover.', '#8ad9ff'); sfx.ding(); }
      else {
        if (b.type!=='wall' || b.playerBuilt) addMsg(`The ${b.name} is complete!`, '#bfe8a0');
        if (b.type==='farm') farmDone(b);
        if (b.type==='house') town.villagerCap = Math.min(9, town.villagerCap+1);
        if (b.type==='barracks') town.soldierCap = Math.max(town.soldierCap, 3);
        if (b.type==='tower') town.soldierCap = Math.min(6, town.soldierCap+1);
        if (b.type==='castle'){ town.castleDone = true; town.soldierCap = 8;
          addMsg('🏰 The castle stands complete! The realm seeks knights…', '#ffd97a'); sfx.ding(); }
      }
      if (b.commission && game.job && game.job.type==='builder'){
        game.job.commissionDone = true; game.job.commissionSite = null;
        addMsg('Commission complete! Collect your pay at the Town Center.', '#ffd97a'); sfx.ding();
        updateJobPanel();
      }
    }
  }
  // population
  town.soldierTimer -= dt;
  const soldiers = npcs.filter(n=>n.role==='soldier').length;
  if (town.soldierCap > soldiers && town.soldierTimer <= 0){
    const b = getBuilding('barracks') || getBuilding('castle');
    if (b){ spawnNpc('soldier', b.x+rand(-2,2), b.z+5); town.soldierTimer = 40; addMsg('A soldier reports for duty.', '#bca97c'); }
  }
  const villagers = npcs.filter(n=>n.role==='villager').length;
  if (villagers < town.villagerCap && Math.random() < dt*.06)
    spawnNpc('villager', TC_POS.x+rand(-4,4), TC_POS.z+6);
  for (let i=town.respawnQueue.length-1;i>=0;i--){
    const r = town.respawnQueue[i];
    if (game.time >= r.t){ spawnNpc(r.role, TC_POS.x+rand(-4,4), TC_POS.z+6); town.respawnQueue.splice(i,1); }
  }
  // animated bits
  for (const b of buildings){
    if (b.group.userData.blades && b.done) b.group.userData.blades.rotation.z += dt*1.2;
    if (b.group.userData.flag) b.group.userData.flag.rotation.y = Math.sin(game.time*2)*.3;
  }
}

// ---------------------------------------------------------------- day / night
function phaseOf(t){ for (const [k,[a,b]] of Object.entries(PH)) if (t>=a && t<b) return k; return 'night'; }
const SKY = {
  dawn:  [0xf4b183, 0xffd9b0, .9],
  day:   [0x9fc7e8, 0xfff2d8, 1.6],
  dusk:  [0xd98555, 0xffc285, .8],
  night: [0x101a30, 0x90a8d0, .18],
};
const skyColor = new THREE.Color(), sunColor = new THREE.Color();
function updateDayCycle(dt){
  const speed = game.sleeping ? 40 : 1;
  game.dayT += dt*speed / DAY_LEN;
  if (game.dayT >= 1){
    game.dayT -= 1; game.day++;
    document.getElementById('dayno').textContent = `Day ${game.day}`;
    addMsg(`☀ Day ${game.day} dawns. Jobs are open!`, '#ffd97a');
    game.jobsTakenToday = false;
    if (saveGame(true)) addMsg('(autosaved)', '#bca97c');
  }
  const prev = game.phase;
  game.phase = phaseOf(game.dayT);
  if (prev !== game.phase){
    if (game.phase==='dusk'){ payDay(); addMsg('Dusk falls. Get indoors — wolves prowl at night.', '#e0908a'); }
    if (game.phase==='night'){
      const count = Math.min(6, 1 + Math.floor(game.day*.8));
      for (let i=0;i<count;i++) setTimeout(spawnWolf, i*3000);
    }
    if (game.phase==='dawn'){
      for (const w of [...wolves]){ scene.remove(w.mesh); wolves.splice(wolves.indexOf(w),1); }
      wakeUp();
    }
  }
  if (game.sleeping && game.phase==='day') wakeUp();
  // sun position
  const ang = (game.dayT - .25) * Math.PI * 2;
  sun.position.set(Math.cos(ang)*90, Math.max(8, Math.sin(ang)*110), -20+Math.sin(ang*.7)*30);
  // blend sky between phases
  const ph = game.phase, [a,b] = PH[ph];
  const within = (game.dayT-a)/(b-a);
  const order = ['dawn','day','dusk','night'];
  const next = order[(order.indexOf(ph)+1)%4];
  const lerpT = within > .8 ? (within-.8)/.2 : 0;
  skyColor.setHex(SKY[ph][0]).lerp(new THREE.Color(SKY[next][0]), lerpT);
  sunColor.setHex(SKY[ph][1]).lerp(new THREE.Color(SKY[next][1]), lerpT);
  scene.background.copy(skyColor); scene.fog.color.copy(skyColor);
  sun.color.copy(sunColor);
  sun.intensity = SKY[ph][2] + (SKY[next][2]-SKY[ph][2])*lerpT;
  hemi.intensity = .25 + sun.intensity*.45;
  // player house lamp at night
  if (player.house && player.house.done && player.house.group.userData.lamp)
    player.house.group.userData.lamp.intensity = (ph==='night'||ph==='dusk') ? 1.4 : 0;
  const names = { dawn:'Dawn', day: game.dayT<.36?'Morning':'Afternoon', dusk:'Dusk', night:'Night' };
  document.getElementById('daytime').textContent = names[ph];
}

// ---------------------------------------------------------------- player update
function updatePlayer(dt){
  if (game.sleeping) return;
  // movement
  let mx = 0, mz = 0;
  if (keys['KeyW']) mz -= 1; if (keys['KeyS']) mz += 1;
  if (keys['KeyA']) mx -= 1; if (keys['KeyD']) mx += 1;
  if (joy.active && (joy.x || joy.y)){ mx += joy.x; mz += joy.y; }
  if (keys['KeyZ']) camYaw += dt*2; if (keys['KeyC']) camYaw -= dt*2;
  const moving = mx||mz;
  if (moving){
    player.action = null;
    const len = Math.hypot(mx,mz);
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
    const dx = (fx*mz + fz*mx)/len, dz = (fz*mz - fx*mx)/len;
    player.x = clamp(player.x + dx*player.speed*dt, -MAP, MAP);
    player.z = clamp(player.z + dz*player.speed*dt, -MAP, MAP);
    player.bobT += dt*11;
    // collide with finished buildings
    for (const b of buildings){
      if (!b.done || !FOOTPRINT[b.type]) continue;
      const r = FOOTPRINT[b.type]+.6, d = Math.hypot(b.x-player.x, b.z-player.z);
      if (d < r && d > .01){ player.x = b.x + (player.x-b.x)/d*r; player.z = b.z + (player.z-b.z)/d*r; }
    }
  }
  player.mesh.rotation.y = camYaw + Math.PI; // always face where the camera looks
  player.mesh.position.set(player.x, moving?Math.abs(Math.sin(player.bobT))*.13:0, player.z);
  // hunger & health
  player.hunger = Math.max(0, player.hunger - dt/3.2);
  if (player.hunger <= 0){ player.hp -= dt*2.5; if (player.hp<=0 && !game.over) die('starvation'); }
  else if (player.hunger > 55 && player.hp < 100) player.hp = Math.min(100, player.hp + dt*1.2);
  if (player.hunger < 20 && Math.random() < dt*.1) addMsg('Your stomach growls… (F to eat)', '#e0908a');
  // attack (Space or left click) — strikes whatever is in front of the camera
  player.attackCd -= dt; player.anim = Math.max(0, player.anim - dt*4);
  player.tool.rotation.x = -player.anim*1.7; // overhead chop, forward
  if (player.armR) player.armR.rotation.x = player.anim > 0 ? -player.anim*1.9 : (moving ? Math.sin(player.bobT)*.5 : 0);
  if (player.armL) player.armL.rotation.x = moving ? -Math.sin(player.bobT)*.5 : 0;
  // swing arc flash in front of the player
  if (player.anim > 0){
    const f = forwardVec();
    swingArc.visible = true;
    swingArc.material.opacity = player.anim*.55;
    swingArc.position.set(player.x + f.x*1.7, 1.2, player.z + f.z*1.7);
    swingArc.rotation.y = camYaw + Math.PI;
  } else swingArc.visible = false;
  if (keys['Space']) tryAttack();
  if (player.anim<=0 && (!player.action || player.action.type==='perform')) player.tool.visible = false;
  // ongoing actions
  const act = player.action;
  if (act){
    act.t = (act.t||0) + dt;
    player.tool.visible = act.type!=='perform';
    if (act.type==='chop' || act.type==='pick' || act.type==='mine' || act.type==='vein'){
      const tgt = act.target;
      const tick = (act.type==='mine'||act.type==='vein') ? .9 : .7;
      if (!tgt.alive || Math.hypot(tgt.x-player.x,tgt.z-player.z) > 3.6) player.action = null;
      else if (act.t >= tick){
        act.t = 0; player.anim = 1;
        if (act.type==='chop'){
          game.wood++; tgt.wood--; sfx.chop();
          tgt.mesh.rotation.z = rand(-.05,.05);
          if (tgt.wood<=0){ tgt.alive=false; tgt.regrow=60; tgt.mesh.visible=false; player.action=null; }
        } else if (act.type==='pick'){
          game.food++; tgt.food--; sfx.pick();
          if (tgt.food<=0){ tgt.alive=false; tgt.regrow=45; if (!tgt.isFarm) tgt.mesh.visible=false; else tgt.mesh.scale.y=.25; player.action=null; }
        } else if (act.type==='mine'){
          game.stone++; tgt.stone--; sfx.mine();
          if (tgt.stone<=0){ tgt.alive=false; tgt.regrow=90; tgt.mesh.visible=false; player.action=null; }
        } else {
          const g = irand(2,3); game.gold += g; tgt.ore--; sfx.coin();
          addMsg(`Struck gold! +${g}🪙`, '#ffd97a');
          if (tgt.ore<=0){ tgt.alive=false; tgt.regrow=150; tgt.mesh.visible=false; player.action=null; }
        }
      }
    }
    else if (act.type==='buildsite'){
      const h = act.site;
      if (!h || h.done || Math.hypot(h.x-player.x,h.z-player.z) > FOOTPRINT[h.type]+4.5) player.action = null;
      else {
        h.progress += dt / BUILD_TIME[h.type];
        player.anim = Math.abs(Math.sin(game.time*8));
        if (Math.random()<dt*3) sfx.build();
      }
    }
    else if (act.type==='perform'){
      const n = act.npc;
      if (!npcs.includes(n) || n.cheered || Math.hypot(n.x-player.x,n.z-player.z) > 4.5){ player.action = null; }
      else {
        if (Math.random() < dt*5) sfx.note();
        if (Math.random() < dt*8) spawnNote(player.x, 2.4, player.z);
        n.mesh.position.y = Math.abs(Math.sin(game.time*9))*.25; // they dance along
        if (act.t >= 2.5){
          n.cheered = true;
          const tip = irand(1,4);
          game.gold += tip; game.job.tips += tip;
          jobProgress(1); sfx.coin();
          spawnNote(n.x, 2.6, n.z); spawnNote(n.x, 2.2, n.z);
          addMsg(`The ${n.role} loved it! +${tip}🪙 tip.`, '#bfe8a0');
          player.action = null;
        }
      }
    }
  }
  // guard patrol markers
  if (game.job && game.job.type==='guard'){
    for (const m of patrolMarkers){
      if (m.visited) continue;
      m.mesh.rotation.y += dt*2;
      if (Math.hypot(m.x-player.x, m.z-player.z) < 2.6){
        m.visited = true; m.mesh.material.color.setHex(0x58cb58); m.mesh.material.opacity = .25;
        jobProgress(1); sfx.ding();
      }
    }
  }
  // placement ghost follows player
  if (placement.active && placement.ghost){
    const fx = Math.sin(player.mesh.rotation.y), fz = Math.cos(player.mesh.rotation.y);
    const gx = Math.round((player.x+fx*4.5)/2)*2, gz = Math.round((player.z+fz*4.5)/2)*2;
    placement.ghost.position.set(gx,0,gz);
    const ok = placementValid(gx,gz);
    placement.ghost.traverse(o=>{ if (o.material && o.material.color) o.material.color.setHex(ok?0x7adf7a:0xdf7a7a); });
  }
}

// ---------------------------------------------------------------- nature regrowth
function updateNature(dt){
  for (const t of trees){
    if (!t.alive){ t.regrow -= dt; if (t.regrow<=0){ t.alive=true; t.wood=8; t.mesh.visible=true; t.mesh.rotation.z=0; } }
  }
  for (const b of bushes){
    if (!b.alive){ b.regrow -= dt; if (b.regrow<=0){ b.alive=true; b.food = b.isFarm?10:6; b.mesh.visible=true; b.mesh.scale.y=1; } }
  }
  for (const r of rocks){
    if (!r.alive){ r.regrow -= dt; if (r.regrow<=0){ r.alive=true; r.stone=6; r.mesh.visible=true; } }
  }
  for (const v of veins){
    if (!v.alive){ v.regrow -= dt; if (v.regrow<=0){ v.alive=true; v.ore=5; v.mesh.visible=true; } }
  }
}

// ---------------------------------------------------------------- HUD
function updateHud(){
  document.getElementById('rwood').textContent = game.wood;
  document.getElementById('rfood').textContent = game.food;
  document.getElementById('rstone').textContent = game.stone;
  document.getElementById('rgold').textContent = game.gold;
  document.querySelector('#hpbar > div').style.width = player.hp+'%';
  document.querySelector('#hungerbar > div').style.width = player.hunger+'%';
  const pr = document.getElementById('prompt');
  currentInteract = (!game.over && !game.shopOpen) ? computeInteract() : null;
  if (IS_MOBILE) document.getElementById('tbinteract').classList.toggle('avail', !!currentInteract);
  if (currentInteract && !player.action){
    pr.style.display = 'block';
    pr.innerHTML = (IS_MOBILE ? '✋ ' : '<b>[E]</b> ') + currentInteract.label;
  } else if (player.action){
    pr.style.display = 'block';
    const labels = { chop:'Chopping… (move to stop)', pick:'Gathering… (move to stop)',
      mine:'Mining… (move to stop)', vein:'Mining gold… (move to stop)',
      buildsite:'Building… '+(player.action.site?Math.round(player.action.site.progress*100):0)+'%',
      perform:'🎵 Performing…' };
    pr.innerHTML = labels[player.action.type] || '';
  } else pr.style.display = 'none';
  updateJobPanel();
}

// ---------------------------------------------------------------- minimap
const mmEl = document.getElementById('minimap'), mmCtx = mmEl.getContext('2d');
function drawMinimap(){
  const W = mmEl.width, s = W/(MAP*2);
  const px = v=>(v+MAP)*s;
  mmCtx.fillStyle = '#3e5d33'; mmCtx.fillRect(0,0,W,W);
  mmCtx.fillStyle = '#2c4424';
  for (const t of trees) if (t.alive) mmCtx.fillRect(px(t.x)-.5, px(t.z)-.5, 1.5, 1.5);
  for (const b of buildings){
    mmCtx.fillStyle = b.type==='playerhouse' ? '#6ec1ff' : (b.done ? '#d9c49a' : '#8a7448');
    mmCtx.fillRect(px(b.x)-2, px(b.z)-2, 4, 4);
  }
  for (const f of factions){
    if (!f.discovered) continue;
    mmCtx.fillStyle = '#'+f.color.toString(16).padStart(6,'0');
    mmCtx.fillRect(px(f.camp.x)-3, px(f.camp.z)-3, 6, 6);
  }
  mmCtx.fillStyle = '#e8d9b0';
  for (const n of npcs) mmCtx.fillRect(px(n.x)-1, px(n.z)-1, 2, 2);
  mmCtx.fillStyle = '#caa66a';
  for (const a of animals) mmCtx.fillRect(px(a.x)-1, px(a.z)-1, 2, 2);
  mmCtx.fillStyle = '#ff5544';
  for (const w of wolves) mmCtx.fillRect(px(w.x)-1.5, px(w.z)-1.5, 3, 3);
  for (const r of raiders) mmCtx.fillRect(px(r.x)-1.5, px(r.z)-1.5, 3, 3);
  for (const f of factions) if (f.scout) mmCtx.fillRect(px(f.scout.x)-1.5, px(f.scout.z)-1.5, 3, 3);
  mmCtx.fillStyle = '#ffffff';
  mmCtx.beginPath(); mmCtx.arc(px(player.x), px(player.z), 2.5, 0, Math.PI*2); mmCtx.fill();
  const fv = forwardVec();
  mmCtx.strokeStyle = '#ffffff';
  mmCtx.beginPath();
  mmCtx.moveTo(px(player.x), px(player.z));
  mmCtx.lineTo(px(player.x)+fv.x*8, px(player.z)+fv.z*8);
  mmCtx.stroke();
}

// ---------------------------------------------------------------- camera
function updateCamera(){
  const hd = Math.cos(camPitch)*camDist, v = Math.sin(camPitch)*camDist;
  camera.position.set(player.x + Math.sin(camYaw)*hd, 2 + v, player.z + Math.cos(camYaw)*hd);
  camera.lookAt(player.x, 2.2, player.z);
}

// ---------------------------------------------------------------- save / load / pause
const SAVE_KEY = 'villagerlife_save';
function saveGame(silent){
  if (game.over || game.sleeping){ if (!silent) addMsg("Can't save right now.", '#e0908a'); return false; }
  const bIdx = b=>buildings.indexOf(b);
  const s = {
    v:1, when:Date.now(),
    game:{ time:game.time, day:game.day, dayT:game.dayT, wood:game.wood, food:game.food,
           stone:game.stone, gold:game.gold, jobsTakenToday:game.jobsTakenToday },
    job: game.job ? Object.assign({}, game.job,
           { commissionSite: game.job.commissionSite ? bIdx(game.job.commissionSite) : -1 }) : null,
    patrol: patrolMarkers.map(m=>m.visited),
    player:{ x:player.x, z:player.z, hp:player.hp, hunger:player.hunger,
             hasSword:player.hasSword, house: player.house ? bIdx(player.house) : -1 },
    town:{ planIdx:town.planIdx, soldierTimer:town.soldierTimer, soldierCap:town.soldierCap,
           villagerCap:town.villagerCap, castleDone:town.castleDone, wood:town.wood, stone:town.stone,
           respawnQueue:town.respawnQueue.map(r=>({ role:r.role, t:r.t })) },
    buildings: buildings.map(b=>({ type:b.type, x:b.x, z:b.z, rot:b.rot||0, progress:b.progress,
                                   done:b.done, owned:!!b.owned, playerBuilt:!!b.playerBuilt, commission:!!b.commission })),
    npcs: npcs.map(n=>({ role:n.role, x:n.x, z:n.z, hp:n.hp })),
    trees: trees.map(t=>({ x:t.x, z:t.z, wood:t.wood, alive:t.alive, regrow:t.regrow })),
    bushes: bushes.filter(b=>!b.isFarm).map(b=>({ x:b.x, z:b.z, food:b.food, alive:b.alive, regrow:b.regrow })),
    rocks: rocks.map(r=>({ x:r.x, z:r.z, stone:r.stone, alive:r.alive, regrow:r.regrow })),
    veins: veins.map(v=>({ x:v.x, z:v.z, ore:v.ore, alive:v.alive, regrow:v.regrow })),
    factions: factions.map(f=>{
      let state = f.state, next = f.nextEvent;
      if (state==='scouting'){ state = 'hidden'; next = game.time+15; }
      if (state==='offered'){ state = 'offer-pending'; next = game.time+10; }
      if (!isFinite(next)) next = game.time+30;
      return { state, nextEvent:next, anger:f.anger, tribute:f.tribute,
               discovered:f.discovered, truceOffer:f.truceOffer };
    }),
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    if (!silent){ addMsg('Game saved.', '#8ad9ff'); sfx.ding(); }
    return true;
  } catch(e){ addMsg('Save failed: '+e.message, '#e0908a'); return false; }
}
function applySave(s){
  // nature: tear down what was generated, rebuild from the save
  for (const t of trees) scene.remove(t.mesh); trees.length = 0;
  for (const b of bushes) if (!b.isFarm) scene.remove(b.mesh);
  bushes.length = 0;
  for (const r of rocks) scene.remove(r.mesh); rocks.length = 0;
  for (const v of veins) scene.remove(v.mesh); veins.length = 0;
  for (const o of s.trees){ makeTree(o.x,o.z); const t = trees[trees.length-1]; Object.assign(t,o); t.mesh.visible = o.alive; }
  for (const o of s.bushes){ makeBush(o.x,o.z); const b = bushes[bushes.length-1]; Object.assign(b,o); b.mesh.visible = o.alive; }
  for (const o of s.rocks){ makeRock(o.x,o.z); const r = rocks[rocks.length-1]; Object.assign(r,o); r.mesh.visible = o.alive; }
  for (const o of s.veins){ makeVein(o.x,o.z); const v = veins[veins.length-1]; Object.assign(v,o); v.mesh.visible = o.alive; }
  // buildings
  for (const b of buildings){
    scene.remove(b.group);
    if (b.bar) scene.remove(b.bar);
    if (b.siteMesh) scene.remove(b.siteMesh);
  }
  buildings.length = 0;
  for (const o of s.buildings){
    const b = addBuilding(o.type, o.x, o.z, o.rot, o.done);
    b.progress = o.progress; b.owned = o.owned; b.playerBuilt = o.playerBuilt; b.commission = o.commission;
    if (!o.done) b.group.scale.y = .02 + .98*o.progress;
    if (o.done && o.type==='farm') farmDone(b);
  }
  // townsfolk
  for (const n of npcs) scene.remove(n.mesh);
  npcs.length = 0;
  for (const o of s.npcs) spawnNpc(o.role, o.x, o.z).hp = o.hp;
  // state
  Object.assign(town, s.town);
  Object.assign(game, s.game);
  game.phase = phaseOf(game.dayT);
  player.x = s.player.x; player.z = s.player.z;
  player.hp = s.player.hp; player.hunger = s.player.hunger; player.hasSword = s.player.hasSword;
  player.house = s.player.house >= 0 ? buildings[s.player.house] : null;
  player.mesh.position.set(player.x, 0, player.z);
  for (const m of patrolMarkers) scene.remove(m.mesh);
  patrolMarkers = [];
  game.job = s.job;
  if (game.job){
    if (typeof game.job.commissionSite === 'number')
      game.job.commissionSite = game.job.commissionSite >= 0 ? buildings[game.job.commissionSite] : null;
    if (game.job.type === 'guard'){
      spawnPatrolMarkers();
      patrolMarkers.forEach((m,i)=>{
        if (s.patrol[i]){ m.visited = true; m.mesh.material.color.setHex(0x58cb58); m.mesh.material.opacity = .25; }
      });
    }
  }
  s.factions.forEach((o,i)=>Object.assign(factions[i], o));
  document.getElementById('dayno').textContent = `Day ${game.day}`;
  updateJobPanel(); updateHud();
}

function openPause(){
  if (!game.started || game.over || game.diploOpen || game.shopOpen || game.buildMenuOpen) return;
  cancelPlacement();
  game.paused = true;
  if (document.exitPointerLock) document.exitPointerLock();
  refreshPauseInfo();
  document.getElementById('pause').style.display = 'flex';
}
function refreshPauseInfo(){
  let info = 'No save yet.';
  try { const s = localStorage.getItem(SAVE_KEY); if (s) info = `Last save: Day ${JSON.parse(s).game.day}`; } catch(e){}
  document.getElementById('pauseinfo').textContent = info + ' · Autosaves at every dawn.';
}
function closePause(){ game.paused = false; document.getElementById('pause').style.display = 'none'; }
document.getElementById('resumebtn').addEventListener('click', closePause);
document.getElementById('savebtn').addEventListener('click', ()=>{ if (saveGame(false)) refreshPauseInfo(); });
document.getElementById('loadbtn').addEventListener('click', ()=>{
  if (!localStorage.getItem(SAVE_KEY)){ addMsg('No save to load.', '#e0908a'); return; }
  sessionStorage.setItem('vl_autoload', '1');
  location.reload();
});

// ---------------------------------------------------------------- mobile / touch controls
const IS_MOBILE = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window
                  || location.search.includes('mobile');
const joy = { active:false, id:null, bx:0, by:0, x:0, y:0 };
function requestLandscape(){
  if (!IS_MOBILE) return;
  const el = document.documentElement;
  const fs = el.requestFullscreen || el.webkitRequestFullscreen;
  if (fs) Promise.resolve(fs.call(el)).then(()=>{
    if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(()=>{});
  }).catch(()=>{});
}
if (IS_MOBILE){
  document.body.classList.add('mobile');
  const zone = document.getElementById('joyzone');
  const base = document.getElementById('joybase'), knob = document.getElementById('joyknob');
  const JR = 50; // joystick radius in px
  function placeKnob(x,y){ knob.style.left = x+'px'; knob.style.top = y+'px'; }
  zone.addEventListener('touchstart', e=>{
    e.preventDefault();
    if (joy.active) return;
    const t = e.changedTouches[0];
    joy.active = true; joy.id = t.identifier;
    joy.bx = t.clientX; joy.by = t.clientY; joy.x = 0; joy.y = 0;
    base.style.display = knob.style.display = 'block';
    base.style.left = joy.bx+'px'; base.style.top = joy.by+'px';
    placeKnob(joy.bx, joy.by);
  }, { passive:false });
  zone.addEventListener('touchmove', e=>{
    e.preventDefault();
    for (const t of e.changedTouches){
      if (t.identifier !== joy.id) continue;
      let dx = t.clientX-joy.bx, dy = t.clientY-joy.by;
      const d = Math.hypot(dx,dy);
      if (d > JR){ dx = dx/d*JR; dy = dy/d*JR; }
      joy.x = dx/JR; joy.y = dy/JR; // y: down=+1, so up = forward (negative, like W)
      placeKnob(joy.bx+dx, joy.by+dy);
    }
  }, { passive:false });
  const joyEnd = e=>{
    for (const t of e.changedTouches){
      if (t.identifier !== joy.id) continue;
      joy.active = false; joy.id = null; joy.x = 0; joy.y = 0;
      base.style.display = knob.style.display = 'none';
    }
  };
  zone.addEventListener('touchend', joyEnd);
  zone.addEventListener('touchcancel', joyEnd);

  // camera look: drag anywhere on the world that isn't joystick or a button
  let lookId = null, lx = 0, ly = 0;
  canvasEl.addEventListener('touchstart', e=>{
    e.preventDefault();
    if (lookId !== null) return;
    const t = e.changedTouches[0];
    lookId = t.identifier; lx = t.clientX; ly = t.clientY;
  }, { passive:false });
  canvasEl.addEventListener('touchmove', e=>{
    e.preventDefault();
    for (const t of e.changedTouches){
      if (t.identifier !== lookId) continue;
      camYaw -= (t.clientX-lx)*.006;
      camPitch = clamp(camPitch + (t.clientY-ly)*.004, .18, 1.15);
      lx = t.clientX; ly = t.clientY;
    }
  }, { passive:false });
  const lookEnd = e=>{ for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null; };
  canvasEl.addEventListener('touchend', lookEnd);
  canvasEl.addEventListener('touchcancel', lookEnd);

  // action buttons
  const tb = id=>document.getElementById(id);
  tb('tbattack').addEventListener('touchstart', e=>{ e.preventDefault(); keys['Space'] = true; tryAttack(); }, { passive:false });
  tb('tbattack').addEventListener('touchend', e=>{ e.preventDefault(); keys['Space'] = false; }, { passive:false });
  tb('tbinteract').addEventListener('touchstart', e=>{ e.preventDefault();
    if (game.shopOpen) closeShop(); else doInteract(); }, { passive:false });
  tb('tbeat').addEventListener('touchstart', e=>{ e.preventDefault(); eatFood(); }, { passive:false });
  tb('tbbuild').addEventListener('touchstart', e=>{ e.preventDefault();
    if (game.buildMenuOpen) closeBuildMenu();
    else if (placement.active) cancelPlacement();
    else openBuildMenu(); }, { passive:false });
}
document.getElementById('burger').addEventListener('click', ()=>{
  if (game.paused) closePause(); else openPause();
});

// ---------------------------------------------------------------- main loop
let last = performance.now();
function loop(now){
  requestAnimationFrame(loop);
  const dt = Math.min(.05, (now-last)/1000); last = now;
  if (!game.started || game.over || game.paused){ renderer.render(scene, camera); return; }
  game.time += dt;
  updateDayCycle(dt);
  updateTown(dt);
  updatePlayer(dt);
  for (const n of [...npcs]) updateNpc(n, dt);
  for (const w of [...wolves]) updateWolf(w, dt);
  updateAnimals(dt);
  updateFactions(dt);
  updateNature(dt);
  updateNotes(dt);
  updateHud();
  updateCamera();
  drawMinimap();
  renderer.render(scene, camera);
}
updateCamera();
requestAnimationFrame(loop);

document.getElementById('startbtn').addEventListener('click', ()=>{
  document.getElementById('intro').style.display = 'none';
  game.started = true;
  requestLandscape();
  if (!AC) try { AC = new (window.AudioContext||window.webkitAudioContext)(); } catch(e){}
  addMsg('Gather food before you go hungry. The town is already growing…', '#ffd97a');
});

// resume from a save: either auto (Load from the pause menu reloads the page),
// or via the Continue button on the title screen
{
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw && sessionStorage.getItem('vl_autoload')){
    sessionStorage.removeItem('vl_autoload');
    try {
      applySave(JSON.parse(raw));
      document.getElementById('intro').style.display = 'none';
      game.started = true;
      addMsg(`Game loaded — Day ${game.day}.`, '#8ad9ff');
    } catch(e){ console.error('Load failed:', e); addMsg('Load failed — starting fresh.', '#e0908a'); }
  } else if (raw){
    try {
      const day = JSON.parse(raw).game.day;
      const cb = document.getElementById('continuebtn');
      cb.style.display = '';
      cb.textContent = `Continue (Day ${day})`;
      cb.addEventListener('click', ()=>{
        try { applySave(JSON.parse(localStorage.getItem(SAVE_KEY))); }
        catch(e){ console.error('Load failed:', e); addMsg('Load failed — starting fresh.', '#e0908a'); }
        document.getElementById('intro').style.display = 'none';
        game.started = true;
        requestLandscape();
        if (!AC) try { AC = new (window.AudioContext||window.webkitAudioContext)(); } catch(e){}
        addMsg(`Welcome back — Day ${game.day}.`, '#8ad9ff');
      });
    } catch(e){}
  }
}
