// ============================================================
// Relics: passive items with hooks.
//   onPickup(G), combatStart(), turnStart(), combatEnd()
// ============================================================
const Relics = (() => {

  const DEFS = {
    // ---- class starters ----
    bloodied_standard: { name:'Bloodied Standard', icon:'heart', starter:'knight',
      desc:'Heal 6 HP after each combat.',
      combatEnd() { Game.heal(6); } },
    serpent_charm: { name:'Serpent Charm', icon:'poison', starter:'huntress',
      desc:'At the start of combat, apply 3 Poison to a random enemy.',
      combatStart() {
        const alive = Combat.state.enemies.map((e,i)=>e.hp>0?i:-1).filter(i=>i>=0);
        if (alive.length) Combat.applyToEnemy(alive[Math.floor(Math.random()*alive.length)], 'poison', 3);
      } },
    crystal_focus: { name:'Crystal Focus', icon:'star', starter:'arcanist',
      desc:'Gain 1 extra Energy on the first turn of combat.',
      combatStart() { Combat.state.firstTurnEnergy = 1; } },

    // ---- pool ----
    lucky_coin: { name:'Lucky Coin', icon:'coin',
      desc:'Gain 15 extra gold after each combat.' },
    whetstone: { name:'Whetstone', icon:'sword',
      desc:'Start each combat with 1 Strength.',
      combatStart() { Combat.applyToPlayer('str', 1); } },
    tough_hide: { name:'Tough Hide', icon:'heart',
      desc:'Gain 10 Max HP.',
      onPickup(G) { G.maxHp += 10; Game.heal(10); } },
    power_crystal: { name:'Power Crystal', icon:'star', rare:true,
      desc:'Gain 1 extra Energy at the start of each turn.',
      turnStart() { Combat.gainEnergy(1); } },
    eagle_feather: { name:'Eagle Feather', icon:'draw', rare:true,
      desc:'Draw 1 extra card at the start of each turn.',
      turnStart() { Combat.draw(1); } },
    spiked_shield: { name:'Spiked Shield', icon:'shield',
      desc:'Start each combat with 3 Thorns.',
      combatStart() { Combat.applyToPlayer('thorns', 3); } },
    sand_hourglass: { name:'Sand Hourglass', icon:'shield',
      desc:'Gain 3 Block at the start of each turn.',
      turnStart() { Combat.gainBlock(3); } },
    iron_flask: { name:'Iron Flask', icon:'heart',
      desc:'Heal 4 HP after each combat.',
      combatEnd() { Game.heal(4); } },
    bottled_storm: { name:'Bottled Storm', icon:'bolt',
      desc:'Start each combat with 8 Block.',
      combatStart() { Combat.gainBlock(8); } },
    cursed_idol: { name:'Cursed Idol', icon:'skull', rare:true,
      desc:'Gain 1 extra Energy each turn. Take 6 damage at the start of each combat.',
      combatStart() { Combat.damagePlayer(6, true); },
      turnStart() { Combat.gainEnergy(1); } },
    gold_ring: { name:'Gold Ring', icon:'coin',
      desc:'Gain 50 gold when picked up.',
      onPickup(G) { G.gold += 50; } },
    old_map: { name:'Old Map', icon:'mystery',
      desc:'Campfires heal 45% of Max HP instead of 30%.' },
  };

  Object.keys(DEFS).forEach(id => DEFS[id].id = id);

  function starterFor(cls) {
    return Object.values(DEFS).find(r => r.starter === cls);
  }

  function rollRelic(owned) {
    const pool = Object.values(DEFS).filter(r => !r.starter && !owned.includes(r.id));
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function has(G, id) { return G.relics.includes(id); }

  function fire(G, hook) {
    G.relics.forEach(id => { const r = DEFS[id]; if (r[hook]) r[hook](G); });
  }

  return { DEFS, starterFor, rollRelic, has, fire };
})();
