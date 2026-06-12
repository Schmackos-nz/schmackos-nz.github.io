// ============================================================
// Game: run state, screen flow, node resolution, rewards.
// ============================================================
const Game = (() => {

  const $ = UI.$;
  let G = null;

  const CLASSES = {
    knight:   { name:'The Knight',   hp:80, desc:'A wall of steel. Strength, heavy blows, and shields that bite back.' },
    huntress: { name:'The Huntress', hp:70, desc:'Death by a thousand cuts. Poison, multi-hits, and card flow.' },
    arcanist: { name:'The Arcanist', hp:65, desc:'Raw power on a budget. Big spells, energy tricks, and AoE.' },
  };

  const api = {
    get state() { return G; },
    CLASSES,

    // ---------------- run lifecycle ----------------
    newRun() {
      UI.showScreen('scr-class');
      const row = $('class-row');
      row.innerHTML = '';
      Object.entries(CLASSES).forEach(([id, c]) => {
        const relic = Relics.starterFor(id);
        const div = document.createElement('div');
        div.className = 'class-panel';
        div.style.borderColor = `var(--${id})`;
        div.innerHTML = `<h3 style="color:var(--${id})">${c.name}</h3>`;
        div.appendChild(Sprites.get(id, 8));
        div.insertAdjacentHTML('beforeend', `
          <div class="class-desc">${c.desc}</div>
          <div class="class-stats">❤ ${c.hp} HP</div>
          <div class="class-stats" style="color:var(--gold)">${relic.name}</div>
          <div class="class-desc">${relic.desc}</div>`);
        div.onclick = () => api.startRun(id);
        row.appendChild(div);
      });
    },

    startRun(cls) {
      G = {
        cls, maxHp: CLASSES[cls].hp, hp: CLASSES[cls].hp,
        gold: 99, floor: 0,
        deck: Cards.starterDeck(cls),
        relics: [Relics.starterFor(cls).id],
        map: GameMap.generate(),
        currentNode: null, inNode: false,
        kills: 0, removeCost: 75,
      };
      UI.showScreen('scr-map');
      GameMap.render();
    },

    // ---------------- map / nodes ----------------
    toMap() {
      G.inNode = false;
      UI.showScreen('scr-map');
      GameMap.render();
    },

    enterNode(id) {
      const node = GameMap.byId(G.map, id);
      G.currentNode = id;
      G.inNode = true;
      node.visited = true;
      G.floor = node.row + 1;
      UI.refreshTopbar();

      switch (node.type) {
        case 'monster': Combat.start(Enemies.rollEncounter(node.row < 4 ? 'easy' : 'hard')); break;
        case 'elite':   Combat.start(Enemies.rollEncounter('elite')); break;
        case 'boss':    Combat.start(Enemies.rollEncounter('boss')); break;
        case 'rest':    api.openRest(); break;
        case 'shop':    api.openShop(); break;
        case 'treasure': api.openTreasure(); break;
      }
    },

    nodeType() { return GameMap.byId(G.map, G.currentNode).type; },

    // ---------------- combat results ----------------
    combatWon() {
      const type = api.nodeType();
      G.kills++;
      Relics.fire(G, 'combatEnd');

      if (type === 'boss') { api.win(); return; }

      let gold = 12 + Math.floor(Math.random() * 12);
      if (type === 'elite') gold += 25;
      if (Relics.has(G, 'lucky_coin')) gold += 15;
      G.gold += gold;

      $('reward-gold').textContent = `You found ${gold} gold.`;

      // elite: also a relic
      const relicBox = $('reward-relic');
      relicBox.classList.add('hidden');
      if (type === 'elite') {
        const r = Relics.rollRelic(G.relics);
        if (r) {
          api.addRelic(r.id);
          relicBox.classList.remove('hidden');
          relicBox.innerHTML = '';
          relicBox.appendChild(Sprites.icon(r.icon, 4));
          relicBox.insertAdjacentHTML('beforeend', `<span><b style="color:var(--gold)">${r.name}</b> — ${r.desc}</span>`);
        }
      }

      const choices = Cards.rollReward(G.cls, 3);
      const wrap = $('reward-cards');
      wrap.innerHTML = '';
      choices.forEach(inst => {
        const el = UI.cardEl(inst);
        el.onclick = () => { G.deck.push(inst); api.toMap(); };
        wrap.appendChild(el);
      });
      UI.showScreen('scr-reward');
    },

    die() {
      setTimeout(() => {
        $('over-stats').textContent =
          `${CLASSES[G.cls].name} fell on floor ${G.floor} with ${G.kills} kills and ${G.gold} gold.`;
        UI.showScreen('scr-over');
      }, 800);
    },

    win() {
      $('win-stats').textContent =
        `${CLASSES[G.cls].name} slew the Gravelord with ${G.hp}/${G.maxHp} HP remaining. ` +
        `${G.kills} foes defeated, ${G.deck.length} cards in deck.`;
      UI.showScreen('scr-win');
    },

    // ---------------- rest ----------------
    openRest() {
      drawSceneArt('rest-art', 'campfire', 9);
      $('btn-rest-upgrade').disabled = !G.deck.some(c => !c.up);
      UI.showScreen('scr-rest');
    },

    restHeal() {
      const pct = Relics.has(G, 'old_map') ? 0.45 : 0.30;
      api.heal(Math.floor(G.maxHp * pct));
      api.toMap();
    },

    restUpgrade() {
      UI.showDeck('Choose a card to upgrade', G.deck, inst => {
        inst.up = true;
        api.toMap();
      }, c => !c.up);
    },

    // ---------------- shop ----------------
    openShop() {
      const PRICE = { common: 50, uncommon: 75, rare: 120 };
      const cardWrap = $('shop-cards');
      cardWrap.innerHTML = '';
      Cards.rollReward(G.cls, 5).forEach(inst => {
        const price = PRICE[Cards.eff(inst).rarity] || 60;
        const el = UI.cardEl(inst, { price, mini: true });
        el.onclick = () => {
          if (G.gold < price || el.classList.contains('unplayable')) return;
          G.gold -= price;
          G.deck.push(inst);
          el.classList.add('unplayable');
          el.onclick = null;
          UI.refreshTopbar();
        };
        cardWrap.appendChild(el);
      });

      const relicWrap = $('shop-relics');
      relicWrap.innerHTML = '';
      for (let i = 0; i < 2; i++) {
        const r = Relics.rollRelic(G.relics.concat(
          [...relicWrap.children].map(d => d.dataset.relic)));
        if (!r) break;
        const price = r.rare ? 180 : 140;
        const div = document.createElement('div');
        div.className = 'relic-row-item';
        div.dataset.relic = r.id;
        div.appendChild(Sprites.icon(r.icon, 4));
        div.insertAdjacentHTML('beforeend',
          `<div class="rname">${r.name}</div><div class="rdesc">${r.desc}</div><div style="color:var(--gold)">${price} ◉</div>`);
        div.onclick = () => {
          if (G.gold < price || div.classList.contains('unplayable')) return;
          G.gold -= price;
          api.addRelic(r.id);
          div.classList.add('unplayable');
          div.style.opacity = .35;
          div.onclick = null;
          UI.refreshTopbar();
        };
        relicWrap.appendChild(div);
      }

      $('btn-shop-remove').textContent = `Remove a card (${G.removeCost} ◉)`;
      UI.showScreen('scr-shop');
    },

    shopRemove() {
      if (G.gold < G.removeCost || G.deck.length <= 5) return;
      UI.showDeck('Choose a card to remove', G.deck, inst => {
        G.gold -= G.removeCost;
        G.removeCost += 25;
        G.deck = G.deck.filter(c => c.uid !== inst.uid);
        $('btn-shop-remove').textContent = `Remove a card (${G.removeCost} ◉)`;
        UI.refreshTopbar();
      });
    },

    // ---------------- treasure ----------------
    openTreasure() {
      drawSceneArt('treasure-art', 'chest', 9);
      const r = Relics.rollRelic(G.relics);
      const box = $('treasure-relic');
      box.innerHTML = '';
      if (r) {
        api.addRelic(r.id);
        const div = document.createElement('div');
        div.className = 'relic-row-item';
        div.style.cursor = 'default';
        div.appendChild(Sprites.icon(r.icon, 4));
        div.insertAdjacentHTML('beforeend', `<div class="rname">${r.name}</div><div class="rdesc">${r.desc}</div>`);
        box.appendChild(div);
      } else {
        G.gold += 60;
        box.innerHTML = '<p>60 gold!</p>';
      }
      UI.showScreen('scr-treasure');
    },

    // ---------------- helpers ----------------
    heal(n) {
      G.hp = Math.min(G.maxHp, G.hp + n);
      UI.refreshTopbar();
    },

    addRelic(id) {
      G.relics.push(id);
      const r = Relics.DEFS[id];
      if (r.onPickup) r.onPickup(G);
      UI.refreshTopbar();
    },
  };

  function drawSceneArt(canvasId, sprite, scale) {
    const cv = $(canvasId);
    const src = Sprites.get(sprite, scale);
    cv.width = src.width; cv.height = src.height;
    cv.getContext('2d').drawImage(src, 0, 0);
  }

  // ---------------- boot ----------------
  window.addEventListener('DOMContentLoaded', () => {
    // title art: the three heroes
    const ta = $('title-art');
    const heroes = ['knight', 'huntress', 'arcanist'].map(n => Sprites.get(n, 7));
    const gap = 40;
    ta.width = heroes.reduce((w, h) => w + h.width, 0) + gap * 2;
    ta.height = Math.max(...heroes.map(h => h.height));
    const ctx = ta.getContext('2d');
    let x = 0;
    heroes.forEach(h => { ctx.drawImage(h, x, ta.height - h.height); x += h.width + gap; });

    $('btn-new-run').onclick = api.newRun;
    $('btn-end-turn').onclick = () => Combat.endTurn();
    $('btn-skip-reward').onclick = api.toMap;
    $('btn-rest-heal').onclick = api.restHeal;
    $('btn-rest-upgrade').onclick = api.restUpgrade;
    $('btn-leave-shop').onclick = api.toMap;
    $('btn-shop-remove').onclick = api.shopRemove;
    $('btn-take-treasure').onclick = api.toMap;
    $('btn-over-restart').onclick = api.newRun;
    $('btn-win-restart').onclick = api.newRun;
    $('overlay-close').onclick = UI.hideOverlay;
    $('tb-deck').onclick = () => { if (G) UI.showDeck(`Deck (${G.deck.length})`, G.deck); };
    $('pile-draw').onclick = () => { if (Combat.state) UI.showDeck('Draw pile (shuffled)', Combat.state.drawPile); };
    $('pile-discard').onclick = () => { if (Combat.state) UI.showDeck('Discard pile', Combat.state.discardPile); };
  });

  return api;
})();
