// ---------- all DOM UI: HUD, hideout, inventory, summaries ----------
const UI = {
  el(id) { return document.getElementById(id); },
  logLines: [],
  bigT: 0,

  // ===== HUD =====
  logMsg(txt) {
    this.logLines.push(txt);
    if (this.logLines.length > 6) this.logLines.shift();
    this.el('log').innerHTML = this.logLines.map(l => '<div>' + l + '</div>').join('');
    clearTimeout(this._logFade);
    this._logFade = setTimeout(() => { this.logLines = []; this.el('log').innerHTML = ''; }, 6000);
  },

  bigMsg(txt, dur) {
    const b = this.el('bigMsg');
    b.textContent = txt; b.style.opacity = 1;
    clearTimeout(this._bigFade);
    this._bigFade = setTimeout(() => b.style.opacity = 0, (dur || 2.4) * 1000);
  },

  damageFlash() {
    const v = this.el('dmgVignette');
    v.style.boxShadow = 'inset 0 0 140px rgba(200,20,10,.6)';
    clearTimeout(this._dmgT);
    this._dmgT = setTimeout(() => v.style.boxShadow = 'inset 0 0 140px rgba(200,20,10,0)', 180);
  },

  swingAnim() {
    const c = this.el('crosshair');
    c.style.transform = 'translate(-50%,-50%) rotate(45deg) scale(1.6)';
    setTimeout(() => c.style.transform = 'translate(-50%,-50%)', 120);
  },

  showInteract(target, holding) {
    const box = this.el('interact');
    if (!target) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    this.el('interactTxt').textContent = (holding ? '' : 'Hold E — ') + target.label;
    this.el('interactBar').firstElementChild.style.width =
      Math.min(100, target.progress / target.time * 100) + '%';
  },

  updateHUD(raidT) {
    this.el('hpFill').style.width = (P.hp / P.maxHp * 100) + '%';
    this.el('stamFill').style.width = (P.stam / P.maxStam * 100) + '%';
    const w = P.totalWeight();
    const wt = this.el('weightTxt');
    wt.textContent = 'Weight ' + w.toFixed(1) + ' / ' + WEIGHT_CAP + (w > WEIGHT_CAP ? '  — OVERLOADED' : '');
    wt.className = w > WEIGHT_CAP ? 'over' : '';

    const t = Math.max(0, raidT);
    const mm = Math.floor(t / 60), ss = Math.floor(t % 60);
    const timer = this.el('timer');
    timer.textContent = raidT <= 0 ? 'THE STORM' : mm + ':' + (ss < 10 ? '0' : '') + ss;
    timer.className = raidT <= 60 ? 'storm' : '';

    // rune distances
    this.el('runeList').innerHTML = World.runes.map(r =>
      '▲ ' + r.name + ' — ' + Math.round(r.pos.distanceTo(P.pos)) + 'm').join('<br>') +
      (World.grave ? '<br><span style="color:#9aa">⚰ Remains — ' + Math.round(World.grave.pos.distanceTo(P.pos)) + 'm</span>' : '');

    // hotbar
    const wn = P.weapon ? ITEMS[P.weapon].name : 'Fists';
    const bn = P.bow ? ITEMS[P.bow].name + ' (' + (P.bag['arrow'] || 0) + ')' : '— no bow —';
    const foodCount = (P.bag['mead'] || 0) + (P.bag['cooked_meat'] || 0) + (P.bag['berries'] || 0);
    this.el('slotMelee').querySelector('span').textContent = wn;
    this.el('slotBow').querySelector('span').textContent = bn;
    this.el('slotFood').querySelector('span').textContent = foodCount + ' food';
    this.el('slotArmor').querySelector('span').textContent = P.armor ? ITEMS[P.armor].name : 'None';
    this.el('slotMelee').className = 'slot' + (P.mode === 'melee' ? ' active' : '');
    this.el('slotBow').className = 'slot' + (P.mode === 'bow' ? ' active' : '');

    // bow draw bar
    const db = this.el('drawBar');
    if (P.drawing) {
      db.classList.remove('hidden');
      db.firstElementChild.style.width = Math.min(100, P.drawT / 0.9 * 100) + '%';
    } else db.classList.add('hidden');

    // compass
    const fwd = P.forward();
    let html = '';
    const markers = World.runes.map(r => ({ pos: r.pos, icon: '▲', color: '#40ff80' }));
    if (World.grave) markers.push({ pos: World.grave.pos, icon: '⚰', color: '#aab' });
    for (const mk of markers) {
      const dx = mk.pos.x - P.pos.x, dz = mk.pos.z - P.pos.z;
      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      const vx = dx / len, vz = dz / len;
      const dot = fwd.x * vx + fwd.z * vz;
      const cross = fwd.x * vz - fwd.z * vx;
      const rel = Math.atan2(cross, dot);
      if (Math.abs(rel) < 1.15)
        html += '<span style="left:' + (50 + rel / 1.15 * 50) + '%;color:' + mk.color + '">' + mk.icon + '</span>';
    }
    this.el('compass').innerHTML = html;
  },

  extractBar(frac, name) {
    const eb = this.el('extractBox');
    if (frac <= 0) { eb.classList.add('hidden'); return; }
    eb.classList.remove('hidden');
    eb.innerHTML = 'EXTRACTING — ' + name + '<div style="width:240px;height:8px;border:1px solid #4a8;margin:8px auto;border-radius:3px;overflow:hidden"><div style="height:100%;background:#40ff80;width:' + (frac * 100) + '%"></div></div>';
  },

  // ===== shared item-row rendering =====
  itemRow(id, qty, buttons) {
    return '<tr><td>' + ITEMS[id].name + '</td><td class="num">×' + qty +
      '</td><td class="num">' + (ITEMS[id].w * qty).toFixed(1) + 'kg</td><td>' + (buttons || '') + '</td></tr>';
  },

  // ===== hideout (base) =====
  renderBase() {
    const S = Game.save;
    const stash = S.stash;
    const coins = stash.coin || 0;
    let h = '<h1>VALGRAVE<small>HIDEOUT — gear up, deploy, extract or die</small></h1>';
    h += '<div id="statsLine">Raids: ' + S.stats.raids + ' · Extractions: ' + S.stats.extracts +
         ' · Deaths: ' + S.stats.deaths + ' · <span class="gold">' + coins + ' coins</span>' +
         (Inv.count(S.lostCache) ? ' · <span style="color:#aab">⚰ your remains await recovery in the next raid</span>' : '') + '</div>';

    h += '<div class="cols">';

    // --- left: stash ---
    h += '<div class="col" style="flex:1.2"><h2>STASH (' + Inv.weight(stash).toFixed(0) + 'kg)</h2><table>';
    const ids = Object.keys(stash).sort((a, b) => ITEMS[a].name.localeCompare(ITEMS[b].name));
    if (!ids.length) h += '<tr><td class="muted">Empty. Go raid.</td></tr>';
    for (const id of ids) {
      const it = ITEMS[id];
      let btns = '';
      if (it.weapon) btns += '<button onclick="UI.equip(\'' + id + '\',\'weapon\')">Equip</button> ';
      if (it.bow) btns += '<button onclick="UI.equip(\'' + id + '\',\'bow\')">Equip</button> ';
      if (it.armor) btns += '<button onclick="UI.equip(\'' + id + '\',\'armor\')">Equip</button> ';
      if (!it.weapon && !it.bow && !it.armor && id !== 'coin')
        btns += '<button onclick="UI.bring(\'' + id + '\',1)">Bring</button> <button onclick="UI.bring(\'' + id + '\',5)">×5</button>';
      if (id === 'relic') btns += ' <button onclick="UI.sellRelic()">Sell 40c</button>';
      h += this.itemRow(id, stash[id], btns);
    }
    h += '</table></div>';

    // --- middle: loadout + raid pack ---
    h += '<div class="col"><h2>LOADOUT</h2>';
    for (const slot of ['weapon', 'bow', 'armor']) {
      const id = S.loadout[slot];
      h += '<div class="slotrow"><span>' + slot.toUpperCase() + ': <b>' + (id ? ITEMS[id].name : '—') + '</b></span>' +
        (id ? '<button onclick="UI.unequip(\'' + slot + '\')">Unequip</button>' : '') + '</div>';
    }
    h += '<h2>RAID PACK (' + Inv.weight(S.bring).toFixed(1) + 'kg)</h2><table>';
    const bids = Object.keys(S.bring);
    if (!bids.length) h += '<tr><td class="muted">Bring food & arrows…</td></tr>';
    for (const id of bids)
      h += this.itemRow(id, S.bring[id], '<button onclick="UI.unbring(\'' + id + '\')">Return</button>');
    h += '</table>';
    h += '<div style="margin-top:18px;text-align:center"><button class="primary" onclick="Game.deploy()">⚔ DEPLOY ON RAID</button>';
    if (!S.loadout.weapon && !S.loadout.bow) h += '<div class="muted" style="color:#c08030;margin-top:6px">No weapon equipped — fists only!</div>';
    h += '</div></div>';

    // --- right: crafting + trader ---
    h += '<div class="col" style="flex:1"><h2>CRAFTING <span class="muted">(campfire' +
      (S.stations.workbench ? ' + workbench' : '') + (S.stations.forge ? ' + forge' : '') + ')</span></h2><table>';
    for (const st of STATIONS) {
      if (S.stations[st.id]) continue;
      if (st.needs && !S.stations[st.needs]) continue;
      const ok = Inv.has(stash, st.req);
      h += '<tr><td><b>Build ' + st.name + '</b><br><span class="muted">' + st.desc + '</span></td><td colspan="2" class="' +
        (ok ? 'req-ok' : 'req-no') + '">' + this.reqTxt(st.req, stash) + '</td><td><button ' + (ok ? '' : 'disabled') +
        ' onclick="UI.buildStation(\'' + st.id + '\')">Build</button></td></tr>';
    }
    for (const r of RECIPES) {
      if (r.station && !S.stations[r.station]) continue;
      const ok = Inv.has(stash, r.req);
      const it = ITEMS[r.id];
      let info = '';
      if (it.weapon) info = it.weapon.dmg + ' dmg';
      else if (it.bow) info = it.bow.dmg + ' dmg';
      else if (it.armor) info = Math.round(it.armor * 100) + '% armor';
      else if (it.food) info = '+' + it.food.heal + ' hp';
      h += '<tr><td>' + it.name + (r.qty > 1 ? ' ×' + r.qty : '') + (info ? ' <span class="muted">(' + info + ')</span>' : '') +
        '</td><td colspan="2" class="' + (ok ? 'req-ok' : 'req-no') + '">' + this.reqTxt(r.req, stash) +
        '</td><td><button ' + (ok ? '' : 'disabled') + ' onclick="UI.craft(\'' + r.id + '\')">Craft</button></td></tr>';
    }
    h += '</table><h2>WANDERING TRADER</h2><table>';
    for (let i = 0; i < TRADER.length; i++) {
      const t = TRADER[i];
      const ok = coins >= t.cost;
      h += '<tr><td>' + ITEMS[t.id].name + ' ×' + t.qty + '</td><td class="gold">' + t.cost + 'c</td><td></td>' +
        '<td><button ' + (ok ? '' : 'disabled') + ' onclick="UI.buy(' + i + ')">Buy</button></td></tr>';
    }
    h += '</table></div></div>';

    h += '<div class="keys"><b>WASD</b> move · <b>Shift</b> sprint · <b>Space</b> jump · <b>Mouse</b> attack (hold to draw bow) · ' +
      '<b>1</b>/<b>2</b> melee/bow · <b>E</b> hold to gather/loot · <b>F</b> eat · <b>Tab</b> bag · <b>Esc</b> pause<br>' +
      'Extract at a green rune to keep your loot. Die and you lose everything you carried — a gravestone in your next raid holds it.</div>';

    this.el('basePanel').innerHTML = h;
  },

  reqTxt(req, stash) {
    return Object.keys(req).map(k => req[k] + ' ' + ITEMS[k].name.toLowerCase() +
      ' (' + (stash[k] || 0) + ')').join(', ');
  },

  equip(id, slot) {
    const S = Game.save;
    if ((S.stash[id] || 0) <= 0) return;
    Inv.add(S.stash, id, -1);
    if (S.loadout[slot]) Inv.add(S.stash, S.loadout[slot], 1);
    S.loadout[slot] = id;
    Game.persist(); this.renderBase();
  },
  unequip(slot) {
    const S = Game.save;
    if (S.loadout[slot]) { Inv.add(S.stash, S.loadout[slot], 1); S.loadout[slot] = null; }
    Game.persist(); this.renderBase();
  },
  bring(id, q) {
    const S = Game.save;
    q = Math.min(q, S.stash[id] || 0);
    if (q <= 0) return;
    Inv.add(S.stash, id, -q); Inv.add(S.bring, id, q);
    Game.persist(); this.renderBase();
  },
  unbring(id) {
    const S = Game.save;
    const q = S.bring[id] || 0;
    if (q <= 0) return;
    Inv.add(S.bring, id, -q); Inv.add(S.stash, id, q);
    Game.persist(); this.renderBase();
  },
  craft(id) {
    const S = Game.save;
    const r = RECIPES.find(x => x.id === id);
    if (!r || !Inv.has(S.stash, r.req)) return;
    Inv.pay(S.stash, r.req);
    Inv.add(S.stash, r.id, r.qty);
    Sfx.craft();
    Game.persist(); this.renderBase();
  },
  buildStation(id) {
    const S = Game.save;
    const st = STATIONS.find(x => x.id === id);
    if (!st || !Inv.has(S.stash, st.req)) return;
    Inv.pay(S.stash, st.req);
    S.stations[id] = true;
    Sfx.craft();
    Game.persist(); this.renderBase();
  },
  buy(i) {
    const S = Game.save, t = TRADER[i];
    if ((S.stash.coin || 0) < t.cost) return;
    Inv.add(S.stash, 'coin', -t.cost);
    Inv.add(S.stash, t.id, t.qty);
    Sfx.coin();
    Game.persist(); this.renderBase();
  },
  sellRelic() {
    const S = Game.save;
    if ((S.stash.relic || 0) <= 0) return;
    Inv.add(S.stash, 'relic', -1);
    Inv.add(S.stash, 'coin', ITEMS.relic.sell);
    Sfx.coin();
    Game.persist(); this.renderBase();
  },

  // ===== in-raid bag =====
  renderInv() {
    let h = '<h2 style="margin-top:0">BAG — ' + P.totalWeight().toFixed(1) + ' / ' + WEIGHT_CAP + 'kg</h2><table>';
    const ids = Object.keys(P.bag).sort((a, b) => ITEMS[a].name.localeCompare(ITEMS[b].name));
    if (!ids.length) h += '<tr><td class="muted">Empty.</td></tr>';
    for (const id of ids) {
      let btns = '';
      if (ITEMS[id].food) btns = '<button onclick="UI.eatFromInv(\'' + id + '\')">Eat</button>';
      h += this.itemRow(id, P.bag[id], btns);
    }
    h += '</table><p class="muted" style="margin-top:12px">Everything here is lost if you die. Press Tab or click below to resume.</p>' +
      '<div style="text-align:center;margin-top:10px"><button class="primary" onclick="Game.closeInv()">RESUME</button></div>';
    this.el('invPanel').innerHTML = h;
  },
  eatFromInv(id) {
    if ((P.bag[id] || 0) > 0) {
      Inv.add(P.bag, id, -1);
      P.healPool += ITEMS[id].food.heal;
      Sfx.eat();
      this.renderInv();
    }
  },

  // ===== pause =====
  renderPause() {
    this.el('pausePanel').innerHTML =
      '<h1 style="font-size:24px;letter-spacing:3px">PAUSED</h1>' +
      '<p class="muted" style="margin:12px 0 20px">The island waits. Your loot is not safe until you extract.</p>' +
      '<button class="primary" onclick="Game.lock()">RESUME RAID</button> ' +
      '<button class="danger" style="margin-left:10px;padding:10px 18px" onclick="Game.abandon()">ABANDON (lose carried loot)</button>';
  },

  // ===== raid end =====
  renderEnd(survived, bag, elapsed) {
    const mm = Math.floor(elapsed / 60), ss = Math.floor(elapsed % 60);
    let h;
    if (survived) {
      h = '<h1 style="color:#7ec850;font-size:28px;letter-spacing:3px">EXTRACTED</h1>' +
        '<p class="muted">Raid time ' + mm + ':' + (ss < 10 ? '0' : '') + ss + ' — loot secured to stash:</p>';
    } else {
      h = '<h1 style="color:#c05050;font-size:28px;letter-spacing:3px">KILLED IN ACTION</h1>' +
        '<p class="muted">Everything you carried was lost. A gravestone holding it will appear in your next raid.</p>' +
        '<p class="muted">Lost:</p>';
    }
    h += '<div class="summary-list">';
    const ids = Object.keys(bag);
    h += ids.length ? ids.map(id => ITEMS[id].name + ' ×' + bag[id]).join('<br>') : '<span class="muted">Nothing.</span>';
    h += '</div><button class="primary" onclick="Game.toBase()">RETURN TO HIDEOUT</button>';
    this.el('endPanel').innerHTML = h;
  },

  show(id) { this.el(id).classList.remove('hidden'); },
  hide(id) { this.el(id).classList.add('hidden'); },
};
