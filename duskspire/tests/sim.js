// Headless combat simulator: stubs UI/Game, makes setTimeout
// synchronous, and plays hundreds of random combats per class
// against every encounter type. Catches engine wiring bugs.
// Run: node tests/sim.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console, Math, Object, Array, JSON, Error,
  setTimeout: fn => fn(),   // synchronous so combat resolves inline
};
ctx.globalThis = ctx;
vm.createContext(ctx);
['sprites.js', 'cards.js', 'enemies.js', 'relics.js', 'combat.js'].forEach(f => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
  vm.runInContext(src, ctx, { filename: f });
});

// stub UI (combat.js only needs these to exist)
vm.runInContext(`
  const UI = { showScreen(){}, buildCombat(){}, refreshCombat(){},
               floatDamage(){}, shake(){}, refreshTopbar(){} };
  let _result = null;
  const Game = {
    state: null,
    heal(n) { const G = Game.state; G.hp = Math.min(G.maxHp, G.hp + n); },
    die() { _result = 'died'; },
    combatWon() { _result = 'won'; },
  };
  function _setup(cls, deck) {
    _result = null;
    Game.state = { cls, maxHp: 80, hp: 80, gold: 99, deck,
                   relics: [Relics.starterFor(cls).id] };
  }
`, ctx);

const { Cards, Enemies, Combat } = vm.runInContext('({ Cards, Enemies, Combat })', ctx);
const setup = (cls, deck) => vm.runInContext('_setup', ctx)(cls, deck);
const result = () => vm.runInContext('_result', ctx);

let fails = 0;
const classes = ['knight', 'huntress', 'arcanist'];
const kinds = ['easy', 'hard', 'elite', 'boss'];
let runs = 0, wins = 0, deaths = 0;

for (const cls of classes) {
  // starter deck plus every class+generic card once, so all play() paths run
  const fullDeck = Cards.starterDeck(cls).concat(
    Object.values(Cards.DEFS)
      .filter(d => (d.cls === cls || d.cls === 'any') && d.rarity !== 'basic')
      .map(d => Cards.make(d.id, Math.random() < 0.5)));

  for (const kind of kinds) {
    for (let i = 0; i < 60; i++) {
      runs++;
      try {
        setup(cls, fullDeck);
        Combat.start(Enemies.rollEncounter(kind));
        let safety = 0;
        while (result() === null && safety++ < 300) {
          const S = Combat.state;
          // play random affordable cards, then end turn
          let played = true;
          while (played && result() === null) {
            played = false;
            const playable = S.hand.filter(c => Cards.eff(c).cost <= S.energy);
            if (playable.length && Math.random() < 0.9) {
              const inst = playable[Math.floor(Math.random() * playable.length)];
              const alive = S.enemies.map((e, j) => e.hp > 0 ? j : -1).filter(j => j >= 0);
              if (!alive.length) break;
              const t = alive[Math.floor(Math.random() * alive.length)];
              played = Combat.playCard(inst, t);
            }
          }
          if (result() === null) Combat.endTurn();
        }
        if (result() === null) { console.error(`STALL: ${cls} vs ${kind}`); fails++; }
        else if (result() === 'won') wins++;
        else deaths++;
      } catch (err) {
        console.error(`CRASH: ${cls} vs ${kind}:`, err.message);
        fails++;
      }
    }
  }
}

console.log(`${runs} combats simulated: ${wins} won, ${deaths} lost.`);
if (fails) { console.error(`${fails} failure(s)`); process.exit(1); }
console.log('Simulation clean — no crashes, no stalls.');
