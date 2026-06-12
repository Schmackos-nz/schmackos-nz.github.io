// ============================================================
// UI: screen switching, card DOM, combat rendering, overlays.
// ============================================================
const UI = (() => {

  const $ = id => document.getElementById(id);
  let selectedCard = null;

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    $(id).classList.remove('hidden');
    $('topbar').classList.toggle('hidden', id === 'scr-title' || id === 'scr-class');
    refreshTopbar();
  }

  // ---------------- topbar ----------------
  function refreshTopbar() {
    const G = Game.state;
    if (!G) return;
    $('tb-hp').textContent = `❤ ${G.hp}/${G.maxHp}`;
    $('tb-gold').textContent = `◉ ${G.gold}`;
    $('tb-floor').textContent = `Floor ${G.floor}`;
    $('tb-deck').textContent = `Deck (${G.deck.length})`;
    const rel = $('tb-relics');
    rel.innerHTML = '';
    G.relics.forEach(id => {
      const r = Relics.DEFS[id];
      const c = Sprites.icon(r.icon, 3);
      c.title = `${r.name}: ${r.desc}`;
      rel.appendChild(c);
    });
  }

  // ---------------- card DOM ----------------
  function cardEl(inst, opts = {}) {
    const v = Cards.eff(inst);
    const div = document.createElement('div');
    div.className = `card ${v.cls}` + (opts.mini ? ' mini' : '') + (opts.inHand ? ' in-hand' : '');
    const name = document.createElement('div');
    name.className = 'cname' + (inst.up ? ' upg' : '');
    name.textContent = Cards.nameFor(inst);
    const art = document.createElement('div');
    art.className = 'cart';
    art.appendChild(Sprites.icon(v.icon, opts.mini ? 4 : 5));
    const type = document.createElement('div');
    type.className = 'ctype';
    type.textContent = v.type;
    const desc = document.createElement('div');
    desc.className = 'cdesc';
    desc.textContent = Cards.descFor(inst);
    const cost = document.createElement('div');
    cost.className = 'cost';
    cost.textContent = v.cost;
    const rar = document.createElement('div');
    rar.className = 'crarity';
    rar.textContent = v.rarity;
    div.append(cost, name, art, type, desc, rar);
    if (opts.price !== undefined) {
      const p = document.createElement('div');
      p.className = 'price';
      p.textContent = opts.price + ' ◉';
      div.appendChild(p);
    }
    return div;
  }

  // ---------------- combat ----------------
  function buildCombat() {
    const S = Combat.state;
    selectedCard = null;
    // player sprite
    const ps = $('player-sprite');
    ps.innerHTML = '';
    ps.appendChild(Sprites.get(Game.state.cls, 8));
    // enemies
    const row = $('enemies-row');
    row.innerHTML = '';
    S.enemies.forEach((e, i) => {
      const div = document.createElement('div');
      div.className = 'enemy';
      div.id = 'enemy-' + i;
      div.innerHTML = `
        <div class="intent" id="intent-${i}"></div>
        <div class="sprite-holder"></div>
        <div class="enemy-name">${e.def.name}</div>
        <div class="status-row" id="estatus-${i}"></div>
        <div class="hp-wrap">
          <div class="block-chip hidden" id="eblock-${i}">0</div>
          <div class="hp-bar"><div class="hp-fill" id="ehp-${i}"></div><span id="ehptext-${i}"></span></div>
        </div>`;
      div.querySelector('.sprite-holder').appendChild(Sprites.get(e.def.sprite, e.def.scale || 7));
      div.onclick = () => onEnemyClick(i);
      row.appendChild(div);
    });
    refreshCombat();
  }

  function refreshCombat() {
    const S = Combat.state, G = Game.state;
    if (!S) return;
    refreshTopbar();

    // player
    $('player-hp-fill').style.width = (100 * G.hp / G.maxHp) + '%';
    $('player-hp-text').textContent = `${G.hp}/${G.maxHp}`;
    const pb = $('player-block');
    pb.classList.toggle('hidden', S.player.block <= 0);
    pb.textContent = S.player.block;
    renderStatuses($('player-status'), S.player.statuses, S.player.powers);

    // enemies
    S.enemies.forEach((e, i) => {
      const div = $('enemy-' + i);
      if (!div) return;
      div.classList.toggle('dead', e.hp <= 0);
      $('ehp-' + i).style.width = (100 * e.hp / e.maxHp) + '%';
      $('ehptext-' + i).textContent = `${e.hp}/${e.maxHp}`;
      const eb = $('eblock-' + i);
      eb.classList.toggle('hidden', e.block <= 0);
      eb.textContent = e.block;
      renderStatuses($('estatus-' + i), e.statuses);
      renderIntent(i, e);
    });

    // hand
    const hand = $('hand');
    hand.innerHTML = '';
    S.hand.forEach(inst => {
      const v = Cards.eff(inst);
      const el = cardEl(inst, { inHand: true });
      if (v.cost > S.energy) el.classList.add('unplayable');
      if (selectedCard && selectedCard.uid === inst.uid) el.classList.add('selected');
      el.onclick = ev => { ev.stopPropagation(); onCardClick(inst); };
      hand.appendChild(el);
    });

    $('energy-text').textContent = `${S.energy}/${S.maxEnergy + S.player.powers.bonusEnergy}`;
    $('energy-orb').innerHTML = `<span id="energy-text">${S.energy}/${S.maxEnergy + S.player.powers.bonusEnergy}</span>`;
    $('pile-draw').innerHTML = `Draw<br><b>${S.drawPile.length}</b>`;
    $('pile-discard').innerHTML = `Discard<br><b>${S.discardPile.length}</b>`;

    // targeting highlight
    document.querySelectorAll('.enemy').forEach((d, i) => {
      const needsTarget = selectedCard && Cards.eff(selectedCard).target === 'enemy';
      d.classList.toggle('targetable', !!needsTarget && S.enemies[i] && S.enemies[i].hp > 0);
    });
  }

  function renderStatuses(el, statuses, powers) {
    el.innerHTML = '';
    const BUFFS = { str:'Str', thorns:'Thorns', ritual:'Ritual' };
    const DEBUFFS = { weak:'Weak', vuln:'Vuln', poison:'Poison' };
    Object.entries(statuses).forEach(([k, n]) => {
      if (!n) return;
      const chip = document.createElement('span');
      const isBuff = k in BUFFS;
      chip.className = 'status-chip ' + (isBuff ? 'buff' : 'debuff');
      chip.textContent = `${(BUFFS[k] || DEBUFFS[k] || k)} ${n}`;
      el.appendChild(chip);
    });
    if (powers) {
      const POW = { strPerTurn:'Str/turn', blockPerTurn:'Block/turn', bonusEnergy:'Energy/turn', drawPerTurn:'Draw/turn', attackPoison:'Venom' };
      Object.entries(powers).forEach(([k, n]) => {
        if (!n) return;
        const chip = document.createElement('span');
        chip.className = 'status-chip buff';
        chip.textContent = `${POW[k]} ${n}`;
        el.appendChild(chip);
      });
    }
  }

  function renderIntent(i, e) {
    const el = $('intent-' + i);
    if (!el) return;
    el.innerHTML = '';
    if (e.hp <= 0 || !e.intent) return;
    const it = e.intent;
    if (it.type === 'attack') {
      el.appendChild(Sprites.icon('sword', 2));
      const dmg = Combat.enemyAtkDmg(e, it.dmg);
      el.insertAdjacentHTML('beforeend', `<span class="iv">${dmg}${it.times ? '×' + it.times : ''}</span>`);
    } else if (it.type === 'block') {
      el.appendChild(Sprites.icon('shield', 2));
      el.insertAdjacentHTML('beforeend', `<span class="iv">${it.n}</span>`);
    } else {
      el.appendChild(Sprites.icon('buff', 2));
    }
  }

  // ---------------- card play interaction ----------------
  function onCardClick(inst) {
    const S = Combat.state;
    const v = Cards.eff(inst);
    if (v.cost > S.energy) return;
    if (v.target === 'enemy') {
      const alive = S.enemies.map((e, i) => e.hp > 0 ? i : -1).filter(i => i >= 0);
      if (alive.length === 1) { selectedCard = null; Combat.playCard(inst, alive[0]); return; }
      selectedCard = (selectedCard && selectedCard.uid === inst.uid) ? null : inst;
      refreshCombat();
    } else {
      selectedCard = null;
      Combat.playCard(inst, null);
    }
  }

  function onEnemyClick(i) {
    const S = Combat.state;
    if (!selectedCard || S.enemies[i].hp <= 0) return;
    const inst = selectedCard;
    selectedCard = null;
    Combat.playCard(inst, i);
  }

  // ---------------- fx ----------------
  function floatDamage(kind, idx, n, color) {
    const anchor = kind === 'player' ? $('player-pane') : $('enemy-' + idx);
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const f = document.createElement('div');
    f.className = 'float-dmg';
    f.style.color = color;
    f.style.left = (r.left + r.width / 2 - 15 + (Math.random() * 30 - 15)) + 'px';
    f.style.top = (r.top + r.height / 3) + 'px';
    f.textContent = n;
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 900);
  }

  function shake(id) {
    const el = $(id);
    if (!el) return;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  }

  // ---------------- overlay (deck view / pick a card) ----------------
  function showDeck(title, deck, onPick, filter) {
    $('overlay-title').textContent = title;
    const wrap = $('overlay-cards');
    wrap.innerHTML = '';
    const cards = filter ? deck.filter(filter) : deck;
    if (!cards.length) wrap.innerHTML = '<p style="color:#9a92b0">No cards.</p>';
    cards.forEach(inst => {
      const el = cardEl(inst, { mini: true });
      if (onPick) el.onclick = () => { hideOverlay(); onPick(inst); };
      wrap.appendChild(el);
    });
    $('overlay-close').classList.toggle('hidden', !!onPick && !!filter && false);
    $('overlay').classList.remove('hidden');
  }

  function hideOverlay() { $('overlay').classList.add('hidden'); }

  return { $, showScreen, refreshTopbar, cardEl, buildCombat, refreshCombat,
           floatDamage, shake, showDeck, hideOverlay };
})();
