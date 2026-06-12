// ---------- first-person player: movement, combat, gathering ----------
const P = {
  pos: new THREE.Vector3(), vy: 0, grounded: true,
  yaw: 0, pitch: 0,
  hp: 100, maxHp: 100, stam: 100, maxStam: 100,
  healPool: 0,
  bag: {}, weapon: null, bow: null, armor: null,
  mode: 'melee',           // 'melee' | 'bow'
  atkCd: 0, drawing: false, drawT: 0, stamUse: 0,
  dead: false,
  keys: {},

  setup(spawn, loadout, bag) {
    this.pos.copy(spawn); this.pos.y += 1.6;
    this.vy = 0; this.yaw = Math.atan2(spawn.x, spawn.z); this.pitch = 0; // face island center
    this.hp = this.maxHp; this.stam = this.maxStam; this.healPool = 0;
    this.bag = bag;
    this.weapon = loadout.weapon; this.bow = loadout.bow; this.armor = loadout.armor;
    this.mode = 'melee';
    this.atkCd = 0; this.drawing = false; this.drawT = 0;
    this.dead = false; this.keys = {};
  },

  hasTool() { return !!(this.weapon && ITEMS[this.weapon].tool); },
  armorVal() { return this.armor ? ITEMS[this.armor].armor : 0; },
  weaponDef() { return this.weapon ? ITEMS[this.weapon].weapon : { dmg: 3, range: 2.2, cd: 0.7 }; },
  totalWeight() { return Inv.weight(this.bag); },

  forward() {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  },

  onMouseMove(dx, dy) {
    this.yaw -= dx * 0.0023;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - dy * 0.0023));
  },

  takeDamage(dmg, fromPos) {
    if (this.dead) return;
    const real = Math.max(1, Math.round(dmg * (1 - this.armorVal())));
    this.hp -= real;
    Sfx.hurt();
    UI.damageFlash();
    if (this.hp <= 0) { this.hp = 0; this.dead = true; Sfx.die(); Game.playerDied(); }
  },

  knockback(dir, force) {
    const d = dir.clone().setY(0);
    if (d.lengthSq() > 0.0001) this.pos.add(d.normalize().multiplyScalar(force * 0.5));
    this.vy = 3;
    this.grounded = false;
  },

  eatBest() {
    const order = ['mead', 'cooked_meat', 'berries', 'raw_meat'];
    for (const id of order) {
      if ((this.bag[id] || 0) > 0) {
        if (id === 'raw_meat' && (this.bag['cooked_meat'] || this.bag['berries'] || this.bag['mead'])) continue;
        Inv.add(this.bag, id, -1);
        const heal = id === 'raw_meat' ? 8 : ITEMS[id].food.heal;
        this.healPool += heal;
        Sfx.eat();
        UI.logMsg('Ate ' + ITEMS[id].name + ' (+' + heal + ' hp over time)');
        return;
      }
    }
    UI.logMsg('No food in bag');
  },

  attackPressed() {
    if (this.dead) return;
    if (this.mode === 'bow') {
      if (!this.bow) { UI.logMsg('No bow equipped'); return; }
      if ((this.bag['arrow'] || 0) <= 0) { UI.logMsg('Out of arrows!'); return; }
      this.drawing = true; this.drawT = 0;
    } else {
      this.melee();
    }
  },

  attackReleased() {
    if (this.mode === 'bow' && this.drawing) {
      this.drawing = false;
      if (this.drawT < 0.15) return;
      if ((this.bag['arrow'] || 0) <= 0) return;
      Inv.add(this.bag, 'arrow', -1);
      Sfx.bow();
      const power = Math.min(1, this.drawT / 0.9);
      const dir = new THREE.Vector3();
      Game.camera.getWorldDirection(dir);
      const from = this.pos.clone().add(dir.clone().multiplyScalar(0.6));
      Ent.fireArrow(from, dir, Math.round(ITEMS[this.bow].bow.dmg * (0.5 + power * 0.7)), 16 + power * 22);
    }
  },

  melee() {
    if (this.atkCd > 0 || this.stam < 5) return;
    const wd = this.weaponDef();
    this.atkCd = wd.cd;
    this.stam -= 6; this.stamUse = 1;
    Sfx.swing();
    UI.swingAnim();
    const fwd = new THREE.Vector3();
    Game.camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    let hitAny = false;
    for (const m of Ent.mobs) {
      if (m.dead) continue;
      const to = m.mesh.position.clone().sub(this.pos); to.y = 0;
      const d = to.length();
      if (d < wd.range + m.def.r && to.normalize().dot(fwd) > 0.55) {
        Ent.damageMob(m, wd.dmg, fwd);
        hitAny = true;
      }
    }
    if (hitAny) Sfx.hit();
  },

  // returns current interact target or null
  findInteract() {
    const fwd = new THREE.Vector3();
    Game.camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    let best = null, bestD = 3.4;
    for (const it of World.inter) {
      if (it.done) continue;
      const to = it.pos.clone().sub(this.pos); to.y = 0;
      const d = to.length();
      if (d < bestD && (d < 1.4 || to.normalize().dot(fwd) > 0.35)) { best = it; bestD = d; }
    }
    return best;
  },

  update(dt) {
    if (this.dead) return;
    const k = this.keys;

    // --- movement ---
    const fwd = this.forward();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const move = new THREE.Vector3();
    if (k['KeyW']) move.add(fwd);
    if (k['KeyS']) move.sub(fwd);
    if (k['KeyD']) move.add(right);
    if (k['KeyA']) move.sub(right);

    const w = this.totalWeight();
    const over = w > WEIGHT_CAP;
    let speed = 5.2;
    if (over) speed *= 0.55;
    if (w > WEIGHT_CAP * 1.5) speed *= 0.5;

    let sprinting = false;
    if (k['ShiftLeft'] && move.lengthSq() > 0 && this.stam > 1 && !over && !this.drawing) {
      speed *= 1.65; sprinting = true;
      this.stam -= 12 * dt; this.stamUse = 1;
    }
    if (this.drawing) speed *= 0.5;

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed * dt);
      const nx = this.pos.x + move.x, nz = this.pos.z + move.z;
      // soft sea limit
      if (World.height(nx, nz) > -1.0) { this.pos.x = nx; this.pos.z = nz; }
    }

    // jump & gravity
    if (k['Space'] && this.grounded && this.stam > 8) {
      this.vy = 6.2; this.grounded = false; this.stam -= 8; this.stamUse = 1;
    }
    this.vy -= 16 * dt;
    this.pos.y += this.vy * dt;
    const ground = Math.max(World.height(this.pos.x, this.pos.z), -0.4) + 1.6;
    if (this.pos.y <= ground) { this.pos.y = ground; this.vy = 0; this.grounded = true; }

    // stamina regen
    this.stamUse = Math.max(0, this.stamUse - dt);
    if (this.stamUse <= 0 && !sprinting && !this.drawing)
      this.stam = Math.min(this.maxStam, this.stam + 16 * dt);
    if (this.drawing) { this.drawT += dt; this.stam = Math.max(0, this.stam - 3 * dt); }

    // healing from food
    if (this.healPool > 0 && this.hp < this.maxHp) {
      const amt = Math.min(this.healPool, 6 * dt, this.maxHp - this.hp);
      this.hp += amt; this.healPool -= amt;
    }

    this.atkCd = Math.max(0, this.atkCd - dt);

    // camera
    Game.camera.position.copy(this.pos);
    Game.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));

    // --- interaction (hold E) ---
    const target = this.findInteract();
    UI.showInteract(target, k['KeyE']);
    if (target && k['KeyE']) {
      target.progress += dt;
      if (target.type === 'tree' || target.type === 'rock' || target.type === 'iron') {
        if (Math.floor(target.progress * 3) !== Math.floor((target.progress - dt) * 3)) Sfx.chop();
      }
      if (target.progress >= target.time) {
        target.done = true;
        const loot = target.loot();
        for (const it of loot) {
          Inv.add(this.bag, it.id, it.qty);
          UI.logMsg('+' + it.qty + ' ' + ITEMS[it.id].name);
        }
        Sfx.pickup();
        if (target.type === 'grave') {
          Game.state_lostRecovered = true;
          World.grave = null;
          UI.bigMsg('Remains recovered');
        }
        if (target.type === 'chest') {
          target.mesh.children.forEach(c => c.material = c.material.clone());
          target.mesh.children.forEach(c => c.material.color.multiplyScalar(0.4));
        } else {
          World.group.remove(target.mesh);
        }
      }
    } else if (target) {
      target.progress = 0;
    }
  },
};
