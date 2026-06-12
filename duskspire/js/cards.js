// ============================================================
// Cards: defs are static; deck entries are instances
// { uid, id, up } — Cards.eff(inst) merges in upgrade values.
// play(v, target, inst) runs the effect via Combat helpers.
// ============================================================
const Cards = (() => {

  const DEFS = {
    // ================= BASICS (per class starters) =================
    strike_k: { name:'Slash', cls:'knight', type:'attack', rarity:'basic', cost:1, dmg:6, target:'enemy', icon:'sword',
      desc:v=>`Deal ${v.dmg} damage.`, up:{dmg:9}, play:(v,t)=>Combat.attack(t,v.dmg) },
    guard_k:  { name:'Guard', cls:'knight', type:'skill', rarity:'basic', cost:1, block:5, icon:'shield',
      desc:v=>`Gain ${v.block} Block.`, up:{block:8}, play:v=>Combat.gainBlock(v.block) },
    shield_bash: { name:'Shield Bash', cls:'knight', type:'attack', rarity:'basic', cost:2, dmg:8, magic:2, target:'enemy', icon:'shield',
      desc:v=>`Deal ${v.dmg} damage. Apply ${v.magic} Vulnerable.`, up:{dmg:10,magic:3},
      play:(v,t)=>{ Combat.attack(t,v.dmg); Combat.applyToEnemy(t,'vuln',v.magic); } },

    strike_h: { name:'Quick Shot', cls:'huntress', type:'attack', rarity:'basic', cost:1, dmg:6, target:'enemy', icon:'sword',
      desc:v=>`Deal ${v.dmg} damage.`, up:{dmg:9}, play:(v,t)=>Combat.attack(t,v.dmg) },
    guard_h:  { name:'Dodge', cls:'huntress', type:'skill', rarity:'basic', cost:1, block:5, icon:'shield',
      desc:v=>`Gain ${v.block} Block.`, up:{block:8}, play:v=>Combat.gainBlock(v.block) },
    envenom_dart: { name:'Envenom Dart', cls:'huntress', type:'attack', rarity:'basic', cost:1, dmg:3, magic:3, target:'enemy', icon:'poison',
      desc:v=>`Deal ${v.dmg} damage. Apply ${v.magic} Poison.`, up:{dmg:4,magic:5},
      play:(v,t)=>{ Combat.attack(t,v.dmg); Combat.applyToEnemy(t,'poison',v.magic); } },

    strike_a: { name:'Spark', cls:'arcanist', type:'attack', rarity:'basic', cost:1, dmg:6, target:'enemy', icon:'bolt',
      desc:v=>`Deal ${v.dmg} damage.`, up:{dmg:9}, play:(v,t)=>Combat.attack(t,v.dmg) },
    guard_a:  { name:'Ward', cls:'arcanist', type:'skill', rarity:'basic', cost:1, block:5, icon:'shield',
      desc:v=>`Gain ${v.block} Block.`, up:{block:8}, play:v=>Combat.gainBlock(v.block) },
    arc_lightning: { name:'Arc Lightning', cls:'arcanist', type:'attack', rarity:'basic', cost:1, dmg:4, target:'all', icon:'bolt',
      desc:v=>`Deal ${v.dmg} damage to ALL enemies.`, up:{dmg:6}, play:v=>Combat.attackAll(v.dmg) },

    // ================= GENERIC (all classes) =================
    swift_strike: { name:'Swift Strike', cls:'any', type:'attack', rarity:'common', cost:0, dmg:4, target:'enemy', icon:'sword',
      desc:v=>`Deal ${v.dmg} damage.`, up:{dmg:7}, play:(v,t)=>Combat.attack(t,v.dmg) },
    brace: { name:'Brace', cls:'any', type:'skill', rarity:'common', cost:1, block:7, icon:'shield',
      desc:v=>`Gain ${v.block} Block.`, up:{block:10}, play:v=>Combat.gainBlock(v.block) },
    sweep_kick: { name:'Sweep Kick', cls:'any', type:'attack', rarity:'common', cost:1, dmg:5, magic:1, target:'enemy', icon:'sword',
      desc:v=>`Deal ${v.dmg} damage. Apply ${v.magic} Weak.`, up:{dmg:7,magic:2},
      play:(v,t)=>{ Combat.attack(t,v.dmg); Combat.applyToEnemy(t,'weak',v.magic); } },
    expose: { name:'Expose', cls:'any', type:'skill', rarity:'common', cost:1, magic:2, target:'enemy', icon:'draw',
      desc:v=>`Apply ${v.magic} Vulnerable. Draw 1 card.`, up:{magic:3},
      play:(v,t)=>{ Combat.applyToEnemy(t,'vuln',v.magic); Combat.draw(1); } },
    battle_focus: { name:'Battle Focus', cls:'any', type:'skill', rarity:'common', cost:1, magic:2, icon:'draw',
      desc:v=>`Draw ${v.magic} cards.`, up:{magic:3}, play:v=>Combat.draw(v.magic) },
    shoulder_check: { name:'Shoulder Check', cls:'any', type:'attack', rarity:'uncommon', cost:1, dmg:8, block:3, target:'enemy', icon:'sword',
      desc:v=>`Deal ${v.dmg} damage. Gain ${v.block} Block.`, up:{dmg:11,block:5},
      play:(v,t)=>{ Combat.attack(t,v.dmg); Combat.gainBlock(v.block); } },
    iron_resolve: { name:'Iron Resolve', cls:'any', type:'skill', rarity:'uncommon', cost:2, block:13, icon:'shield',
      desc:v=>`Gain ${v.block} Block.`, up:{block:18}, play:v=>Combat.gainBlock(v.block) },
    bandages: { name:'Bandages', cls:'any', type:'skill', rarity:'uncommon', cost:1, magic:5, exhaust:true, icon:'heart',
      desc:v=>`Heal ${v.magic} HP. Exhaust.`, up:{magic:8}, play:v=>Combat.healPlayer(v.magic) },
    last_resort: { name:'Last Resort', cls:'any', type:'attack', rarity:'uncommon', cost:1, target:'enemy', icon:'fan',
      desc:()=>`Deal damage equal to 3x the cards in your hand.`,
      up:{}, upDesc:()=>`Deal damage equal to 4x the cards in your hand.`,
      play:(v,t,inst)=>Combat.attack(t,(inst.up?4:3)*Combat.state.hand.length) },
    adrenaline: { name:'Adrenaline', cls:'any', type:'skill', rarity:'rare', cost:0, exhaust:true, icon:'bolt',
      desc:v=>`Gain ${v.magic} Energy. Draw 1 card. Exhaust.`, magic:1, up:{magic:2},
      play:v=>{ Combat.gainEnergy(v.magic); Combat.draw(1); } },

    // ================= KNIGHT =================
    wide_swing: { name:'Wide Swing', cls:'knight', type:'attack', rarity:'common', cost:1, dmg:7, target:'all', icon:'fan',
      desc:v=>`Deal ${v.dmg} damage to ALL enemies.`, up:{dmg:10}, play:v=>Combat.attackAll(v.dmg) },
    heavy_slam: { name:'Heavy Slam', cls:'knight', type:'attack', rarity:'common', cost:2, dmg:14, target:'enemy', icon:'sword',
      desc:v=>`Deal ${v.dmg} damage.`, up:{dmg:19}, play:(v,t)=>Combat.attack(t,v.dmg) },
    tower_shield: { name:'Tower Shield', cls:'knight', type:'skill', rarity:'common', cost:2, block:13, icon:'shield',
      desc:v=>`Gain ${v.block} Block.`, up:{block:18}, play:v=>Combat.gainBlock(v.block) },
    skull_crusher: { name:'Skull Crusher', cls:'knight', type:'attack', rarity:'common', cost:2, dmg:10, magic:2, target:'enemy', icon:'skull',
      desc:v=>`Deal ${v.dmg} damage. Apply ${v.magic} Weak.`, up:{dmg:14,magic:3},
      play:(v,t)=>{ Combat.attack(t,v.dmg); Combat.applyToEnemy(t,'weak',v.magic); } },
    reckless_swing: { name:'Reckless Swing', cls:'knight', type:'attack', rarity:'uncommon', cost:0, dmg:9, magic:3, target:'enemy', icon:'sword',
      desc:v=>`Deal ${v.dmg} damage. Take ${v.magic} damage.`, up:{dmg:13},
      play:(v,t)=>{ Combat.attack(t,v.dmg); Combat.damagePlayer(v.magic,true); } },
    shield_slam: { name:'Shield Slam', cls:'knight', type:'attack', rarity:'uncommon', cost:1, target:'enemy', icon:'shield',
      desc:()=>`Deal damage equal to your Block.`, up:{cost:0}, upDesc:()=>`Deal damage equal to your Block. Costs 0.`,
      play:(v,t)=>Combat.attack(t,Combat.state.player.block) },
    battle_cry: { name:'Battle Cry', cls:'knight', type:'skill', rarity:'uncommon', cost:1, magic:2, exhaust:true, icon:'buff',
      desc:v=>`Gain ${v.magic} Strength. Exhaust.`, up:{magic:3}, play:v=>Combat.applyToPlayer('str',v.magic) },
    momentum: { name:'Momentum', cls:'knight', type:'attack', rarity:'uncommon', cost:1, dmg:6, target:'enemy', icon:'sword',
      desc:(v,inst)=>`Deal ${v.dmg + (inst&&inst.bonus||0)} damage. Gains +${v.magic} damage each time it is played this combat.`, magic:3, up:{magic:5},
      play:(v,t,inst)=>{ Combat.attack(t, v.dmg + (inst.bonus||0)); inst.bonus = (inst.bonus||0) + v.magic; } },
    execute: { name:'Execute', cls:'knight', type:'attack', rarity:'uncommon', cost:1, dmg:7, target:'enemy', icon:'skull',
      desc:v=>`Deal ${v.dmg} damage. Deals double damage if the enemy is at or below half HP.`, up:{dmg:10},
      play:(v,t)=>{ const e=Combat.state.enemies[t]; Combat.attack(t, e.hp<=e.maxHp/2 ? v.dmg*2 : v.dmg); } },
    spiked_plate: { name:'Spiked Plate', cls:'knight', type:'power', rarity:'uncommon', cost:1, magic:3, icon:'star',
      desc:v=>`Enemies that attack you take ${v.magic} damage.`, up:{magic:5}, play:v=>Combat.applyToPlayer('thorns',v.magic) },
    rising_fury: { name:'Rising Fury', cls:'knight', type:'power', rarity:'rare', cost:2, magic:1, icon:'buff',
      desc:v=>`At the start of each turn, gain ${v.magic} Strength.`, up:{magic:2},
      play:v=>{ Combat.state.player.powers.strPerTurn += v.magic; } },
    bulwark: { name:'Bulwark', cls:'knight', type:'power', rarity:'rare', cost:1, magic:3, icon:'shield',
      desc:v=>`At the start of each turn, gain ${v.magic} Block.`, up:{magic:5},
      play:v=>{ Combat.state.player.powers.blockPerTurn += v.magic; } },

    // ================= HUNTRESS =================
    twin_daggers: { name:'Twin Daggers', cls:'huntress', type:'attack', rarity:'common', cost:1, dmg:4, times:2, target:'enemy', icon:'fan',
      desc:v=>`Deal ${v.dmg} damage twice.`, up:{dmg:6}, play:(v,t)=>Combat.attack(t,v.dmg,2) },
    toxic_vial: { name:'Toxic Vial', cls:'huntress', type:'skill', rarity:'common', cost:1, magic:5, target:'enemy', icon:'poison',
      desc:v=>`Apply ${v.magic} Poison.`, up:{magic:8}, play:(v,t)=>Combat.applyToEnemy(t,'poison',v.magic) },
    fan_of_blades: { name:'Fan of Blades', cls:'huntress', type:'attack', rarity:'common', cost:1, dmg:4, target:'all', icon:'fan',
      desc:v=>`Deal ${v.dmg} damage to ALL enemies.`, up:{dmg:6}, play:v=>Combat.attackAll(v.dmg) },
    evasive_roll: { name:'Evasive Roll', cls:'huntress', type:'skill', rarity:'common', cost:1, block:5, icon:'shield',
      desc:v=>`Gain ${v.block} Block. Draw 1 card.`, up:{block:8},
      play:v=>{ Combat.gainBlock(v.block); Combat.draw(1); } },
    crippling_shot: { name:'Crippling Shot', cls:'huntress', type:'attack', rarity:'common', cost:1, dmg:6, magic:2, target:'enemy', icon:'sword',
      desc:v=>`Deal ${v.dmg} damage. Apply ${v.magic} Weak.`, up:{dmg:9,magic:3},
      play:(v,t)=>{ Combat.attack(t,v.dmg); Combat.applyToEnemy(t,'weak',v.magic); } },
    ambush: { name:'Ambush', cls:'huntress', type:'attack', rarity:'uncommon', cost:0, dmg:8, exhaust:true, target:'enemy', icon:'sword',
      desc:v=>`Deal ${v.dmg} damage. Exhaust.`, up:{dmg:12}, play:(v,t)=>Combat.attack(t,v.dmg) },
    hunters_mark: { name:"Hunter's Mark", cls:'huntress', type:'skill', rarity:'uncommon', cost:0, magic:2, target:'enemy', icon:'draw',
      desc:v=>`Apply ${v.magic} Vulnerable. Draw 1 card.`, up:{magic:3},
      play:(v,t)=>{ Combat.applyToEnemy(t,'vuln',v.magic); Combat.draw(1); } },
    toxic_cloud: { name:'Toxic Cloud', cls:'huntress', type:'skill', rarity:'uncommon', cost:2, magic:4, icon:'poison',
      desc:v=>`Apply ${v.magic} Poison to ALL enemies.`, up:{magic:6},
      play:v=>Combat.state.enemies.forEach((e,i)=>{ if(e.hp>0) Combat.applyToEnemy(i,'poison',v.magic); }) },
    blade_flurry: { name:'Blade Flurry', cls:'huntress', type:'attack', rarity:'rare', cost:2, dmg:3, times:4, target:'enemy', icon:'fan',
      desc:v=>`Deal ${v.dmg} damage 4 times.`, up:{dmg:5}, play:(v,t)=>Combat.attack(t,v.dmg,4) },
    spike_trap: { name:'Spike Trap', cls:'huntress', type:'power', rarity:'uncommon', cost:1, magic:4, icon:'star',
      desc:v=>`Enemies that attack you take ${v.magic} damage.`, up:{magic:6}, play:v=>Combat.applyToPlayer('thorns',v.magic) },
    venom_coating: { name:'Venom Coating', cls:'huntress', type:'power', rarity:'rare', cost:1, magic:1, icon:'poison',
      desc:v=>`Your attacks apply ${v.magic} Poison.`, up:{magic:2},
      play:v=>{ Combat.state.player.powers.attackPoison += v.magic; } },
    apex_predator: { name:'Apex Predator', cls:'huntress', type:'power', rarity:'rare', cost:1, magic:1, icon:'draw',
      desc:v=>`At the start of each turn, draw ${v.magic} additional card${v.magic>1?'s':''}.`, up:{magic:2},
      play:v=>{ Combat.state.player.powers.drawPerTurn += v.magic; } },

    // ================= ARCANIST =================
    fireball: { name:'Fireball', cls:'arcanist', type:'attack', rarity:'common', cost:2, dmg:13, target:'enemy', icon:'fire',
      desc:v=>`Deal ${v.dmg} damage.`, up:{dmg:18}, play:(v,t)=>Combat.attack(t,v.dmg) },
    ice_shard: { name:'Ice Shard', cls:'arcanist', type:'attack', rarity:'common', cost:1, dmg:5, magic:1, target:'enemy', icon:'bolt',
      desc:v=>`Deal ${v.dmg} damage. Apply ${v.magic} Weak.`, up:{dmg:8,magic:2},
      play:(v,t)=>{ Combat.attack(t,v.dmg); Combat.applyToEnemy(t,'weak',v.magic); } },
    mind_spike: { name:'Mind Spike', cls:'arcanist', type:'attack', rarity:'common', cost:1, dmg:6, target:'enemy', icon:'draw',
      desc:v=>`Deal ${v.dmg} damage. Draw 1 card.`, up:{dmg:9},
      play:(v,t)=>{ Combat.attack(t,v.dmg); Combat.draw(1); } },
    frost_barrier: { name:'Frost Barrier', cls:'arcanist', type:'skill', rarity:'common', cost:1, block:8, icon:'shield',
      desc:v=>`Gain ${v.block} Block.`, up:{block:11}, play:v=>Combat.gainBlock(v.block) },
    blink: { name:'Blink', cls:'arcanist', type:'skill', rarity:'common', cost:1, block:6, icon:'shield',
      desc:v=>`Gain ${v.block} Block. Draw 1 card.`, up:{block:9},
      play:v=>{ Combat.gainBlock(v.block); Combat.draw(1); } },
    combust_sigil: { name:'Combust Sigil', cls:'arcanist', type:'attack', rarity:'uncommon', cost:1, dmg:4, magic:4, target:'enemy', icon:'fire',
      desc:v=>`Deal ${v.dmg} damage. Apply ${v.magic} Poison.`, up:{dmg:6,magic:6},
      play:(v,t)=>{ Combat.attack(t,v.dmg); Combat.applyToEnemy(t,'poison',v.magic); } },
    chain_lightning: { name:'Chain Lightning', cls:'arcanist', type:'attack', rarity:'uncommon', cost:2, dmg:8, target:'all', icon:'bolt',
      desc:v=>`Deal ${v.dmg} damage to ALL enemies.`, up:{dmg:11}, play:v=>Combat.attackAll(v.dmg) },
    mana_surge: { name:'Mana Surge', cls:'arcanist', type:'skill', rarity:'uncommon', cost:0, magic:2, exhaust:true, icon:'bolt',
      desc:v=>`Gain ${v.magic} Energy. Exhaust.`, up:{magic:3}, play:v=>Combat.gainEnergy(v.magic) },
    arcane_wisdom: { name:'Arcane Wisdom', cls:'arcanist', type:'skill', rarity:'uncommon', cost:1, magic:3, icon:'draw',
      desc:v=>`Draw ${v.magic} cards.`, up:{magic:4}, play:v=>Combat.draw(v.magic) },
    glacial_armor: { name:'Glacial Armor', cls:'arcanist', type:'power', rarity:'uncommon', cost:1, magic:3, icon:'shield',
      desc:v=>`At the start of each turn, gain ${v.magic} Block.`, up:{magic:5},
      play:v=>{ Combat.state.player.powers.blockPerTurn += v.magic; } },
    meteor: { name:'Meteor', cls:'arcanist', type:'attack', rarity:'rare', cost:3, dmg:24, target:'enemy', icon:'fire',
      desc:v=>`Deal ${v.dmg} damage.`, up:{dmg:32}, play:(v,t)=>Combat.attack(t,v.dmg) },
    arcane_battery: { name:'Arcane Battery', cls:'arcanist', type:'power', rarity:'rare', cost:2, magic:1, icon:'star',
      desc:v=>`At the start of each turn, gain ${v.magic} additional Energy.`, up:{cost:1},
      play:v=>{ Combat.state.player.powers.bonusEnergy += v.magic; } },
  };

  Object.keys(DEFS).forEach(id => DEFS[id].id = id);

  let nextUid = 1;
  function make(id, up = false) { return { uid: nextUid++, id, up }; }

  function eff(inst) {
    const d = DEFS[inst.id];
    return inst.up ? { ...d, ...d.up } : d;
  }

  function descFor(inst) {
    const d = DEFS[inst.id], v = eff(inst);
    if (inst.up && d.upDesc) return d.upDesc(v, inst);
    return d.desc(v, inst);
  }

  function nameFor(inst) { return eff(inst).name + (inst.up ? '+' : ''); }

  // reward pool for a class: class cards + generic, weighted by rarity
  function rollReward(cls, n = 3) {
    const pool = Object.values(DEFS).filter(d =>
      (d.cls === cls || d.cls === 'any') && d.rarity !== 'basic');
    const byRarity = r => pool.filter(d => d.rarity === r);
    const picks = [], used = new Set();
    let guard = 0;
    while (picks.length < n && guard++ < 200) {
      const roll = Math.random();
      const r = roll < 0.60 ? 'common' : roll < 0.90 ? 'uncommon' : 'rare';
      const opts = byRarity(r).filter(d => !used.has(d.id));
      if (!opts.length) continue;
      const d = opts[Math.floor(Math.random() * opts.length)];
      used.add(d.id);
      picks.push(make(d.id));
    }
    return picks;
  }

  function starterDeck(cls) {
    const map = {
      knight:   ['strike_k','strike_k','strike_k','strike_k','strike_k','guard_k','guard_k','guard_k','guard_k','shield_bash'],
      huntress: ['strike_h','strike_h','strike_h','strike_h','strike_h','guard_h','guard_h','guard_h','guard_h','envenom_dart'],
      arcanist: ['strike_a','strike_a','strike_a','strike_a','strike_a','guard_a','guard_a','guard_a','guard_a','arc_lightning'],
    };
    return map[cls].map(id => make(id));
  }

  return { DEFS, make, eff, descFor, nameFor, rollReward, starterDeck };
})();
