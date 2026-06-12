// ---------- game state machine & raid lifecycle ----------
const Game = {
  state: 'base',         // base | staging | raid | inv | pause | end
  renderer: null, scene: null, camera: null,
  raidT: 0, stormT: 0, elapsed: 0,
  extractT: 0, extractRune: null,
  save: null,
  state_lostRecovered: false,
  _stormSfxT: 0,

  // ===== persistence =====
  defaultSave() {
    return {
      v: 1,
      stash: { wood: 8, cooked_meat: 3, stone: 2 },
      loadout: { weapon: 'club', bow: null, armor: null },
      bring: {},
      stations: { workbench: false, forge: false },
      lostCache: {},
      pendingLoss: null,
      stats: { raids: 0, extracts: 0, deaths: 0 },
    };
  },
  persist() { try { localStorage.setItem('valgrave_save', JSON.stringify(this.save)); } catch (e) {} },
  load() {
    try {
      const raw = localStorage.getItem('valgrave_save');
      this.save = raw ? JSON.parse(raw) : this.defaultSave();
    } catch (e) { this.save = this.defaultSave(); }
    // crashed mid-raid? carried gear goes to the grave cache
    if (this.save.pendingLoss) {
      Inv.merge(this.save.lostCache, this.save.pendingLoss);
      this.save.pendingLoss = null;
      this.persist();
    }
  },

  // ===== boot =====
  init() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.insertBefore(this.renderer.domElement, document.body.firstChild);
    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 900);
    this.scene = new THREE.Scene();

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement === this.renderer.domElement) {
        if (this.state === 'staging' || this.state === 'pause' || this.state === 'inv') {
          this.state = 'raid';
          UI.hide('clickCatch'); UI.hide('pauseScreen'); UI.hide('invScreen');
          UI.show('hud');
        }
      } else if (this.state === 'raid') {
        this.state = 'pause';
        UI.renderPause();
        UI.show('pauseScreen');
      }
    });

    document.addEventListener('mousemove', e => {
      if (this.state === 'raid') P.onMouseMove(e.movementX, e.movementY);
    });
    document.addEventListener('mousedown', e => {
      Sfx.init();
      if (this.state === 'raid' && e.button === 0) P.attackPressed();
    });
    document.addEventListener('mouseup', e => {
      if (this.state === 'raid' && e.button === 0) P.attackReleased();
    });
    document.addEventListener('keydown', e => {
      if (this.state === 'raid') {
        P.keys[e.code] = true;
        if (e.code === 'Digit1') P.mode = 'melee';
        if (e.code === 'Digit2') P.mode = 'bow';
        if (e.code === 'KeyF') P.eatBest();
        if (e.code === 'Tab') { e.preventDefault(); this.openInv(); }
        if (e.code === 'Space') e.preventDefault();
      } else if (this.state === 'inv' && e.code === 'Tab') {
        e.preventDefault(); this.closeInv();
      }
    });
    document.addEventListener('keyup', e => { P.keys[e.code] = false; });

    this.load();
    UI.renderBase();
    this.clock = new THREE.Clock();
    this.loop();
  },

  lock() { Sfx.init(); this.renderer.domElement.requestPointerLock(); },

  // ===== raid lifecycle =====
  deploy() {
    const S = this.save;
    S.stats.raids++;
    const bag = {};
    Inv.merge(bag, S.bring);
    S.bring = {};
    // record carried items in case the session dies mid-raid (loadout stays
    // equipped on crash, so it must NOT go in here or it would duplicate)
    S.pendingLoss = {};
    Inv.merge(S.pendingLoss, bag);
    this.persist();

    this.scene = new THREE.Scene();
    const anchors = World.build(this.scene, (Math.random() * 1e6) | 0, S.lostCache);
    Ent.reset();
    Ent.populate(anchors);
    P.setup(World.spawnPoint(), S.loadout, bag);

    this.raidT = RAID_TIME; this.stormT = 0; this.elapsed = 0;
    this.extractT = 0; this.extractRune = null;
    this.state_lostRecovered = false;

    this.state = 'staging';
    UI.hide('baseScreen'); UI.hide('endScreen');
    UI.show('clickCatch');
    UI.logLines = [];
    setTimeout(() => UI.bigMsg('Find a green extraction rune. ' + Math.floor(RAID_TIME / 60) + ' minutes until the storm.', 4), 600);
  },

  playerDied() { this.endRaid(false); },
  abandon() { document.exitPointerLock(); this.endRaid(false, true); },

  endRaid(survived, wasAbandon) {
    if (this.state === 'end') return;
    const S = this.save;
    const bagSnapshot = {};
    Inv.merge(bagSnapshot, P.bag);

    if (survived) {
      S.stats.extracts++;
      Inv.merge(S.stash, P.bag);
      if (this.state_lostRecovered) S.lostCache = {};
      Sfx.extract();
    } else {
      S.stats.deaths++;
      // carried bag + equipped gear -> grave cache for next raid
      if (this.state_lostRecovered) S.lostCache = {};
      Inv.merge(S.lostCache, P.bag);
      for (const slot of ['weapon', 'bow', 'armor']) {
        if (S.loadout[slot]) { Inv.add(S.lostCache, S.loadout[slot], 1); S.loadout[slot] = null; }
      }
    }
    S.pendingLoss = null;
    this.persist();

    this.state = 'end';
    document.exitPointerLock();
    UI.hide('hud'); UI.hide('pauseScreen'); UI.hide('invScreen'); UI.hide('clickCatch');
    UI.renderEnd(survived, bagSnapshot, this.elapsed);
    UI.show('endScreen');
  },

  toBase() {
    World.dispose(this.scene);
    Ent.reset();
    this.state = 'base';
    UI.hide('endScreen');
    UI.renderBase();
    UI.show('baseScreen');
  },

  openInv() {
    if (this.state !== 'raid') return;
    this.state = 'inv';
    document.exitPointerLock();
    // pointerlockchange would flip us to pause; pre-empt by setting state after exit on next tick
    setTimeout(() => {
      if (this.state === 'pause') { UI.hide('pauseScreen'); this.state = 'inv'; }
      UI.renderInv();
      UI.show('invScreen');
    }, 30);
  },
  closeInv() {
    UI.hide('invScreen');
    this.lock();
  },

  // ===== main loop =====
  loop() {
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;

    if (this.state === 'raid') {
      this.elapsed += dt;
      this.raidT -= dt;
      P.update(dt);
      Ent.update(dt, t);
      World.update(dt, t);
      this.updateStorm(dt);
      this.updateExtraction(dt);
      UI.updateHUD(this.raidT);
    }
    if (this.state !== 'base' && this.scene && this.camera)
      this.renderer.render(this.scene, this.camera);
  },

  updateStorm(dt) {
    if (this.raidT > 0) return;
    if (this.stormT === 0) {
      UI.bigMsg('THE STORM HAS COME', 4);
      Sfx.storm();
    }
    this.stormT += dt;
    if (this.stormT - this._stormSfxT > 6) { this._stormSfxT = this.stormT; Sfx.storm(); }
    // darken & close fog
    const k = Math.min(1, this.stormT / 25);
    const col = new THREE.Color().lerpColors(new THREE.Color(0x8aa3b8), new THREE.Color(0x351015), k);
    this.scene.background = col;
    if (this.scene.fog) {
      this.scene.fog.color = col;
      this.scene.fog.near = 60 - 45 * k;
      this.scene.fog.far = 380 - 300 * k;
    }
    // escalating damage
    if (!P.dead) {
      P.stormTick = (P.stormTick || 0) + dt;
      if (P.stormTick >= 1) {
        P.stormTick = 0;
        P.hp -= 2 + Math.floor(this.stormT / 12) * 2;
        UI.damageFlash();
        if (P.hp <= 0) { P.hp = 0; P.dead = true; Sfx.die(); this.playerDied(); }
      }
    }
  },

  updateExtraction(dt) {
    let near = null;
    for (const r of World.runes)
      if (r.pos.distanceTo(P.pos) < 4.5) { near = r; break; }
    if (near) {
      if (this.extractRune !== near) { this.extractRune = near; this.extractT = 0; }
      this.extractT += dt;
      UI.extractBar(this.extractT / 5, near.name);
      if (this.extractT >= 5) { UI.extractBar(0); this.endRaid(true); }
    } else {
      this.extractRune = null;
      this.extractT = Math.max(0, this.extractT - dt * 2);
      UI.extractBar(0);
    }
  },
};

window.addEventListener('DOMContentLoaded', () => Game.init());
