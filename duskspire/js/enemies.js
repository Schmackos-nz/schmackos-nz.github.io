// ============================================================
// Enemies: defs with hp range, sprite, and an ai() that picks
// the next intent. Intents:
//   {type:'attack', dmg, times?, effect?:{status,n}}
//   {type:'block', n}
//   {type:'buff', status, n}        (on self)
//   {type:'debuff', status, n}      (on player)
// ============================================================
const Enemies = (() => {

  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

  const DEFS = {
    gloop: { name:'Gloop', hp:[42,48], sprite:'gloop', scale:7,
      ai(e) {
        const r = Math.random();
        if (r < 0.50) return { type:'attack', dmg:8 };
        if (r < 0.78) return { type:'attack', dmg:5, effect:{status:'weak', n:1} };
        return { type:'block', n:7 };
      } },
    rat: { name:'Cave Rat', hp:[16,22], sprite:'rat', scale:5,
      ai(e) {
        const r = Math.random();
        if (r < 0.65) return { type:'attack', dmg:6 };
        return { type:'attack', dmg:3, times:2 };
      } },
    zealot: { name:'Dusk Zealot', hp:[44,50], sprite:'zealot', scale:7,
      ai(e, turn) {
        if (turn === 1) return { type:'buff', status:'ritual', n:2 };
        return { type:'attack', dmg:6 };
      } },
    crawler: { name:'Thorn Crawler', hp:[38,44], sprite:'crawler', scale:7,
      init(e) { e.statuses.thorns = 3; },
      ai(e) {
        const r = Math.random();
        if (r < 0.6) return { type:'attack', dmg:7 };
        return { type:'block', n:6 };
      } },
    shroom: { name:'Spore Shroom', hp:[26,32], sprite:'shroom', scale:6,
      ai(e) {
        const r = Math.random();
        if (r < 0.55) return { type:'attack', dmg:5, effect:{status:'poison', n:2} };
        if (r < 0.8) return { type:'attack', dmg:7 };
        return { type:'block', n:6 };
      } },
    bandit: { name:'Spire Bandit', hp:[30,36], sprite:'bandit', scale:7,
      ai(e) {
        const r = Math.random();
        if (r < 0.55) return { type:'attack', dmg:9 };
        if (r < 0.85) return { type:'attack', dmg:4, times:2 };
        return { type:'block', n:8 };
      } },
    // --------- elites ---------
    golem: { name:'Stone Golem', hp:[95,105], sprite:'golem', scale:9, elite:true,
      ai(e, turn) {
        const cycle = (turn - 1) % 3;
        if (cycle === 0) return { type:'block', n:12, effect:{status:'str', n:2} };
        if (cycle === 1) return { type:'attack', dmg:10 };
        return { type:'attack', dmg:16 };
      } },
    champion: { name:'Bone Champion', hp:[85,95], sprite:'champion', scale:9, elite:true,
      ai(e, turn) {
        const cycle = (turn - 1) % 3;
        if (cycle === 0) return { type:'attack', dmg:8, effect:{status:'weak', n:2} };
        if (cycle === 1) return { type:'block', n:10 };
        return { type:'attack', dmg:14 };
      } },
    // --------- boss ---------
    gravelord: { name:'The Gravelord', hp:[150,150], sprite:'gravelord', scale:10, boss:true,
      ai(e, turn) {
        const cycle = (turn - 1) % 4;
        if (cycle === 0) return { type:'buff', status:'str', n:3 };
        if (cycle === 1) return { type:'attack', dmg:5, times:3 };
        if (cycle === 2) return { type:'block', n:14, effect:{status:'weak', n:2, onPlayer:true} };
        return { type:'attack', dmg:18 };
      } },
  };

  Object.keys(DEFS).forEach(id => DEFS[id].id = id);

  const ENCOUNTERS = {
    easy: [ ['gloop'], ['rat','rat'], ['shroom','rat'], ['bandit'] ],
    hard: [ ['zealot'], ['crawler','shroom'], ['bandit','bandit'], ['gloop','gloop'],
            ['zealot','rat'], ['crawler','bandit'], ['rat','rat','rat'] ],
    elite: [ ['golem'], ['champion'] ],
    boss: [ ['gravelord'] ],
  };

  function rollEncounter(kind) {
    const list = ENCOUNTERS[kind];
    return list[Math.floor(Math.random() * list.length)];
  }

  function spawn(defId) {
    const d = DEFS[defId];
    const maxHp = rnd(d.hp[0], d.hp[1]);
    const e = { def: d, maxHp, hp: maxHp, block: 0, statuses: {}, intent: null, turnSeen: 0 };
    if (d.init) d.init(e);
    return e;
  }

  return { DEFS, rollEncounter, spawn };
})();
