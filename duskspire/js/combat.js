// ============================================================
// Combat engine. Turn loop, damage math, statuses, piles.
// Statuses: str (permanent), weak/vuln (tick down at end of
// owner's turn), poison (damage at start of owner's turn),
// thorns (retaliate), ritual (enemy gains str each turn).
// ============================================================
const Combat = (() => {

  let S = null; // combat state

  const api = {
    get state() { return S; },

    start(encounterIds) {
      const G = Game.state;
      S = {
        enemies: encounterIds.map(id => Enemies.spawn(id)),
        player: { block: 0, statuses: {}, powers: { strPerTurn:0, blockPerTurn:0, bonusEnergy:0, drawPerTurn:0, attackPoison:0 } },
        drawPile: shuffle(G.deck.map(c => ({ ...c }))), // copy instances so combat-local fields (momentum) reset
        hand: [], discardPile: [], exhaustPile: [],
        energy: 0, maxEnergy: 3,
        turn: 0, firstTurnEnergy: 0,
        over: false,
      };
      UI.showScreen('scr-combat');
      UI.buildCombat();
      Relics.fire(G, 'combatStart');
      api.startPlayerTurn();
    },

    // ---------------- turn flow ----------------
    startPlayerTurn() {
      if (S.over) return;
      S.turn++;
      const p = S.player;
      p.block = 0;

      // poison on player
      if (p.statuses.poison > 0) {
        api.damagePlayer(p.statuses.poison, true);
        p.statuses.poison--;
        if (S.over) return;
      }
      if (p.powers.strPerTurn) api.applyToPlayer('str', p.powers.strPerTurn);
      if (p.powers.blockPerTurn) api.gainBlock(p.powers.blockPerTurn);

      S.energy = S.maxEnergy + p.powers.bonusEnergy + (S.turn === 1 ? S.firstTurnEnergy : 0);
      Relics.fire(Game.state, 'turnStart');

      // enemy intents
      S.enemies.forEach(e => {
        if (e.hp <= 0) return;
        e.turnSeen++;
        e.intent = e.def.ai(e, e.turnSeen);
      });

      api.draw(5 + p.powers.drawPerTurn);
      UI.refreshCombat();
    },

    endTurn() {
      if (S.over) return;
      // weak/vuln on player tick down
      tickDown(S.player.statuses);
      api.discardHand();
      api.enemyTurn();
    },

    enemyTurn() {
      const queue = S.enemies.filter(e => e.hp > 0);
      let i = 0;
      const step = () => {
        if (S.over) return;
        if (i >= queue.length) {
          queue.forEach(e => tickDown(e.statuses));
          api.startPlayerTurn();
          return;
        }
        const e = queue[i++];
        if (e.hp > 0) {
          // poison ticks at start of the enemy's action
          if (e.statuses.poison > 0) {
            api.hurtEnemy(S.enemies.indexOf(e), e.statuses.poison, true);
            e.statuses.poison--;
          }
          if (e.hp > 0) {
            if (e.statuses.ritual) e.statuses.str = (e.statuses.str || 0) + e.statuses.ritual;
            executeIntent(e);
          }
        }
        UI.refreshCombat();
        if (api.checkEnd()) return;
        setTimeout(step, 420);
      };
      e_blockReset(queue);
      step();
    },

    // ---------------- player actions ----------------
    playCard(inst, targetIdx) {
      const v = Cards.eff(inst);
      if (S.energy < v.cost || S.over) return false;
      S.energy -= v.cost;
      S.hand = S.hand.filter(c => c.uid !== inst.uid);

      const def = Cards.DEFS[inst.id];
      def.play(v, targetIdx, inst);

      if (v.type === 'power') S.exhaustPile.push(inst); // powers are consumed
      else if (v.exhaust) S.exhaustPile.push(inst);
      else S.discardPile.push(inst);

      UI.refreshCombat();
      api.checkEnd();
      return true;
    },

    draw(n) {
      for (let i = 0; i < n; i++) {
        if (S.hand.length >= 10) break;
        if (!S.drawPile.length) {
          if (!S.discardPile.length) break;
          S.drawPile = shuffle(S.discardPile);
          S.discardPile = [];
        }
        S.hand.push(S.drawPile.pop());
      }
    },

    discardHand() {
      S.discardPile.push(...S.hand);
      S.hand = [];
    },

    gainEnergy(n) { S.energy += n; },
    gainBlock(n) { S.player.block += n; UI.refreshCombat(); },

    healPlayer(n) { Game.heal(n); UI.refreshCombat(); },

    // ---------------- damage ----------------
    attack(targetIdx, base, times = 1) {
      const e = S.enemies[targetIdx];
      if (!e || e.hp <= 0) return;
      const p = S.player;
      for (let i = 0; i < times; i++) {
        if (e.hp <= 0) break;
        let d = base + (p.statuses.str || 0);
        if (p.statuses.weak > 0) d = Math.floor(d * 0.75);
        if (e.statuses.vuln > 0) d = Math.floor(d * 1.5);
        dealToEnemy(targetIdx, Math.max(0, d));
        if (p.powers.attackPoison && e.hp > 0) api.applyToEnemy(targetIdx, 'poison', p.powers.attackPoison);
        // enemy thorns retaliate
        if (e.statuses.thorns > 0 && e.hp > 0) api.damagePlayer(e.statuses.thorns, true);
      }
      UI.refreshCombat();
    },

    attackAll(base, times = 1) {
      S.enemies.forEach((e, i) => { if (e.hp > 0) api.attack(i, base, times); });
    },

    // raw damage to enemy (poison, thorns) — ignores str/weak/vuln but respects block
    hurtEnemy(targetIdx, n, pierceBlock = false) {
      const e = S.enemies[targetIdx];
      if (!e || e.hp <= 0) return;
      if (pierceBlock) { e.hp -= n; UI.floatDamage('enemy', targetIdx, n, '#9be09b'); }
      else dealToEnemy(targetIdx, n);
      UI.refreshCombat();
    },

    damagePlayer(n, pierceBlock = false) {
      const G = Game.state, p = S.player;
      let dmg = n;
      if (!pierceBlock) {
        const absorbed = Math.min(p.block, dmg);
        p.block -= absorbed; dmg -= absorbed;
      }
      if (dmg > 0) {
        G.hp -= dmg;
        UI.floatDamage('player', 0, dmg, '#ff6b6b');
        UI.shake('player-pane');
      }
      UI.refreshCombat();
      if (G.hp <= 0) { G.hp = 0; S.over = true; Game.die(); }
    },

    // ---------------- statuses ----------------
    applyToEnemy(idx, status, n) {
      const e = S.enemies[idx];
      if (!e || e.hp <= 0) return;
      e.statuses[status] = (e.statuses[status] || 0) + n;
      UI.refreshCombat();
    },

    applyToPlayer(status, n) {
      S.player.statuses[status] = (S.player.statuses[status] || 0) + n;
      UI.refreshCombat();
    },

    // ---------------- end conditions ----------------
    checkEnd() {
      if (S.over) return true;
      if (S.enemies.every(e => e.hp <= 0)) {
        S.over = true;
        setTimeout(() => Game.combatWon(), 600);
        return true;
      }
      return false;
    },
  };

  // ---------------- internals ----------------
  function dealToEnemy(idx, dmg) {
    const e = S.enemies[idx];
    const absorbed = Math.min(e.block, dmg);
    e.block -= absorbed; dmg -= absorbed;
    if (dmg > 0) {
      e.hp -= dmg;
      UI.floatDamage('enemy', idx, dmg, '#ffd24d');
      UI.shake('enemy-' + idx);
    }
    if (e.hp <= 0) e.hp = 0;
  }

  function executeIntent(e) {
    const it = e.intent;
    if (!it) return;
    const idx = S.enemies.indexOf(e);
    if (it.type === 'attack') {
      const times = it.times || 1;
      for (let i = 0; i < times; i++) {
        api.damagePlayer(enemyAtkDmg(e, it.dmg));
        if (S.over) return;
        // player thorns
        const th = S.player.statuses.thorns || 0;
        if (th > 0) {
          api.hurtEnemy(idx, th, true);
          if (e.hp <= 0) return;
        }
      }
      if (it.effect) api.applyToPlayer(it.effect.status, it.effect.n);
    } else if (it.type === 'block') {
      e.block += it.n;
      if (it.effect) {
        if (it.effect.onPlayer) api.applyToPlayer(it.effect.status, it.effect.n);
        else e.statuses[it.effect.status] = (e.statuses[it.effect.status] || 0) + it.effect.n;
      }
    } else if (it.type === 'buff') {
      e.statuses[it.status] = (e.statuses[it.status] || 0) + it.n;
    } else if (it.type === 'debuff') {
      api.applyToPlayer(it.status, it.n);
    }
  }

  function enemyAtkDmg(e, base) {
    let d = base + (e.statuses.str || 0);
    if (e.statuses.weak > 0) d = Math.floor(d * 0.75);
    if (S.player.statuses.vuln > 0) d = Math.floor(d * 1.5);
    return Math.max(0, d);
  }

  function e_blockReset(queue) { queue.forEach(e => { e.block = 0; }); }

  function tickDown(st) {
    ['weak', 'vuln'].forEach(k => { if (st[k] > 0) st[k]--; });
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // expose for cards/relics, and intent damage preview for UI
  api.enemyAtkDmg = enemyAtkDmg;
  return api;
})();
