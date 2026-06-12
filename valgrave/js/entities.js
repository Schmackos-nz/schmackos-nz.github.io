// ---------- mobs, animals, projectiles, loot pickups ----------
const MOB_DEFS = {
  draugr:  { hp: 50,  dmg: 15, speed: 3.6, range: 2.2, aggro: 16, cd: 1.4, r: 0.8,
             color: 0x4a6b4a, scale: 1, name: 'Draugr',
             drops: () => [{ id: 'coin', qty: 2 + (Math.random() * 6 | 0) },
                           ...(Math.random() < 0.3 ? [{ id: 'hide', qty: 1 }] : [])] },
  skeleton:{ hp: 35,  dmg: 12, speed: 3.0, range: 18,  aggro: 24, cd: 2.6, r: 0.8,
             color: 0xcfcfc0, scale: 0.95, name: 'Skeleton Archer', ranged: true,
             drops: () => [{ id: 'arrow', qty: 3 + (Math.random() * 5 | 0) },
                           { id: 'coin', qty: 1 + (Math.random() * 4 | 0) }] },
  troll:   { hp: 300, dmg: 45, speed: 2.3, range: 3.6, aggro: 15, cd: 2.2, r: 2.0,
             color: 0x3a5a8a, scale: 2.6, name: 'Troll',
             drops: () => [{ id: 'troll_hide', qty: 3 + (Math.random() * 3 | 0) },
                           { id: 'coin', qty: 30 + (Math.random() * 31 | 0) },
                           { id: 'relic', qty: 1 }] },
  boar:    { hp: 25,  dmg: 8,  speed: 4.2, range: 1.8, aggro: 0,  cd: 1.2, r: 0.7,
             color: 0x6b4a33, scale: 0.7, name: 'Boar', animal: true, neutral: true,
             drops: () => [{ id: 'raw_meat', qty: 2 }, { id: 'hide', qty: 1 + (Math.random() * 2 | 0) }] },
  deer:    { hp: 20,  dmg: 0,  speed: 7.5, range: 0,   aggro: 0,  cd: 9,   r: 0.7,
             color: 0x8a6a4a, scale: 0.8, name: 'Deer', animal: true, flees: true,
             drops: () => [{ id: 'raw_meat', qty: 2 }, { id: 'hide', qty: 2 }] },
};

const Ent = {
  mobs: [], projectiles: [], pickups: [],

  reset() { this.mobs = []; this.projectiles = []; this.pickups = []; },

  makeBody(def) {
    const grp = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: def.color });
    const s = def.scale;
    if (def.animal) {
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.4 * s, 0.8 * s, 0.7 * s), mat);
      body.position.y = 0.7 * s;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.5 * s, 0.5 * s, 0.5 * s), mat);
      head.position.set(0.85 * s, 1.0 * s, 0);
      grp.add(body, head);
      for (let i = 0; i < 4; i++) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18 * s, 0.7 * s, 0.18 * s), mat);
        leg.position.set((i < 2 ? 0.5 : -0.5) * s, 0.35 * s, (i % 2 ? 0.25 : -0.25) * s);
        grp.add(leg);
      }
    } else {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.8 * s, 1.1 * s, 0.45 * s), mat);
      body.position.y = 1.15 * s;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.45 * s, 0.45 * s, 0.45 * s), mat);
      head.position.y = 1.95 * s;
      const eyeM = new THREE.MeshBasicMaterial({ color: 0xff3020 });
      for (const dx of [-0.11, 0.11]) {
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.08 * s, 0.08 * s, 0.05), eyeM);
        eye.position.set(dx * s, 1.98 * s, 0.24 * s);
        grp.add(eye);
      }
      for (const dx of [-0.55, 0.55]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22 * s, 0.9 * s, 0.22 * s), mat);
        arm.position.set(dx * s, 1.2 * s, 0);
        grp.add(arm);
      }
      for (const dx of [-0.22, 0.22]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.26 * s, 0.7 * s, 0.26 * s), mat);
        leg.position.set(dx * s, 0.35 * s, 0);
        grp.add(leg);
      }
      grp.add(body, head);
    }
    return grp;
  },

  spawn(type, x, z) {
    const def = MOB_DEFS[type];
    const mesh = this.makeBody(def);
    const y = World.height(x, z);
    mesh.position.set(x, y, z);
    Game.scene.add(mesh);
    this.mobs.push({
      type, def, mesh, hp: def.hp, anchor: new THREE.Vector3(x, y, z),
      state: 'idle', atkT: Math.random() * def.cd, wanderT: Math.random() * 4,
      wanderDir: Math.random() * 6.28, fleeT: 0, flash: 0, windup: 0,
    });
  },

  populate(anchors) {
    for (const a of anchors) {
      if (a.troll) { this.spawn('troll', a.pos.x, a.pos.z); continue; }
      const n = 2 + (Math.random() * 3 | 0);
      for (let i = 0; i < n; i++) {
        const t = Math.random() < 0.6 ? 'draugr' : 'skeleton';
        const ang = Math.random() * 6.28, r = 2 + Math.random() * 6;
        this.spawn(t, a.pos.x + Math.cos(ang) * r, a.pos.z + Math.sin(ang) * r);
      }
    }
    for (let i = 0; i < 10; i++) {
      const p = World.randLand(1, 10, 30); if (!p) continue;
      this.spawn(Math.random() < 0.65 ? 'draugr' : 'skeleton', p.x, p.z);
    }
    for (let i = 0; i < 7; i++) { const p = World.randLand(1, 8, 30); if (p) this.spawn('boar', p.x, p.z); }
    for (let i = 0; i < 6; i++) { const p = World.randLand(1, 8, 30); if (p) this.spawn('deer', p.x, p.z); }
  },

  dropLoot(pos, items) {
    if (!items || !items.length) return;
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0),
      new THREE.MeshLambertMaterial({ color: 0xe8c84a, emissive: 0x554410 }));
    mesh.position.copy(pos); mesh.position.y = World.height(pos.x, pos.z) + 0.5;
    Game.scene.add(mesh);
    this.pickups.push({ mesh, items, t: Math.random() * 6.28 });
  },

  damageMob(m, dmg, knockDir) {
    m.hp -= dmg;
    m.flash = 0.12;
    m.mesh.traverse(o => { if (o.material && o.material.emissive) o.material.emissive.setHex(0x801010); });
    if (m.def.neutral || m.def.flees) m.fleeT = 5;
    if (!m.def.animal) m.state = 'chase';
    if (knockDir && m.type !== 'troll') {
      m.mesh.position.add(knockDir.clone().multiplyScalar(0.6));
    }
    if (m.hp <= 0) {
      Sfx.hit();
      UI.logMsg(m.def.name + ' slain');
      this.dropLoot(m.mesh.position, m.def.drops());
      Game.scene.remove(m.mesh);
      m.dead = true;
    }
  },

  fireBolt(from, target, dmg, speed) {
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.7, 5),
      new THREE.MeshBasicMaterial({ color: 0xddddcc }));
    const vel = target.clone().sub(from).normalize().multiplyScalar(speed);
    mesh.position.copy(from);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vel.clone().normalize());
    Game.scene.add(mesh);
    this.projectiles.push({ mesh, vel, dmg, fromPlayer: false, life: 4, grav: 0 });
  },

  fireArrow(from, dir, dmg, speed) {
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.8, 5),
      new THREE.MeshBasicMaterial({ color: 0xc8b888 }));
    mesh.position.copy(from);
    const vel = dir.clone().multiplyScalar(speed);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    Game.scene.add(mesh);
    this.projectiles.push({ mesh, vel, dmg, fromPlayer: true, life: 5, grav: 9.8 });
  },

  update(dt, t) {
    const pp = P.pos;
    // --- mobs ---
    for (const m of this.mobs) {
      if (m.dead) continue;
      const def = m.def;
      const toP = pp.clone().sub(m.mesh.position); toP.y = 0;
      const dist = toP.length();

      if (m.flash > 0) {
        m.flash -= dt;
        if (m.flash <= 0) m.mesh.traverse(o => { if (o.material && o.material.emissive) o.material.emissive.setHex(0x000000); });
      }

      let move = null, spd = def.speed;

      if (m.fleeT > 0 && (def.flees || (def.neutral && m.hp < def.hp * 0.3))) {
        m.fleeT -= dt;
        move = toP.clone().multiplyScalar(-1).normalize();
      } else if (def.flees && dist < 12) {
        m.fleeT = 4;
        move = toP.clone().multiplyScalar(-1).normalize();
      } else if (!def.animal || (def.neutral && m.fleeT > 0)) {
        // hostile logic (boars use this too once angered: fleeT used as anger timer)
        const angered = def.neutral ? m.fleeT > 0 : true;
        if (m.state === 'chase' || (angered && (dist < def.aggro || def.neutral))) {
          if (def.neutral) m.fleeT -= dt;
          m.state = 'chase';
          if (dist > 42 && !def.neutral) {
            m.state = 'idle';
          } else if (def.ranged) {
            if (dist > def.range * 0.8) move = toP.clone().normalize();
            else if (dist < 8) move = toP.clone().multiplyScalar(-1).normalize();
            m.atkT -= dt;
            if (m.atkT <= 0 && dist < def.range + 4 && !P.dead) {
              m.atkT = def.cd;
              Sfx.bow();
              const from = m.mesh.position.clone(); from.y += 1.6;
              const tgt = pp.clone(); tgt.y -= 0.3;
              this.fireBolt(from, tgt, def.dmg, 17);
            }
          } else {
            if (dist > def.range * 0.85) move = toP.clone().normalize();
            m.atkT -= dt;
            if (m.atkT <= 0 && dist < def.range && !P.dead) {
              m.atkT = def.cd;
              m.windup = 0.45;
            }
            if (m.windup > 0) {
              m.windup -= dt;
              m.mesh.scale.y = def.scale ? 1 + m.windup * 0.4 : 1;
              if (m.windup <= 0) {
                m.mesh.scale.y = 1;
                if (dist < def.range + 0.6 && !P.dead) {
                  P.takeDamage(def.dmg, m.mesh.position);
                  if (m.type === 'troll') { Sfx.troll(); P.knockback(toP.normalize(), 9); }
                }
              }
            }
          }
        } else if (m.state === 'idle' && dist < def.aggro && !def.neutral) {
          m.state = 'chase';
          if (m.type === 'troll') Sfx.troll();
        }
      }

      // wander when idle
      if (!move && m.state !== 'chase') {
        m.wanderT -= dt;
        if (m.wanderT <= 0) { m.wanderT = 2 + Math.random() * 4; m.wanderDir = Math.random() * 6.28; }
        if (m.wanderT > 1) { move = new THREE.Vector3(Math.cos(m.wanderDir), 0, Math.sin(m.wanderDir)); spd = def.speed * 0.3; }
        // leash back toward anchor
        if (m.mesh.position.distanceTo(m.anchor) > 25) move = m.anchor.clone().sub(m.mesh.position).setY(0).normalize();
      }

      if (move) {
        const np = m.mesh.position.clone().add(move.clone().multiplyScalar(spd * dt));
        const nh = World.height(np.x, np.z);
        if (nh > 0.2) { // don't walk into the sea
          m.mesh.position.set(np.x, nh, np.z);
          m.mesh.rotation.y = Math.atan2(move.x, move.z);
          m.mesh.position.y += Math.abs(Math.sin(t * 9)) * 0.06; // walk bob
        }
      } else {
        m.mesh.position.y = World.height(m.mesh.position.x, m.mesh.position.z);
      }
    }
    this.mobs = this.mobs.filter(m => !m.dead);

    // --- projectiles ---
    for (const pr of this.projectiles) {
      pr.life -= dt;
      pr.vel.y -= pr.grav * dt;
      pr.mesh.position.add(pr.vel.clone().multiplyScalar(dt));
      if (pr.vel.lengthSq() > 0.01)
        pr.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pr.vel.clone().normalize());
      const mp = pr.mesh.position;
      if (mp.y < World.height(mp.x, mp.z)) pr.life = 0;
      if (pr.fromPlayer) {
        for (const m of this.mobs) {
          if (m.dead) continue;
          const center = m.mesh.position.clone(); center.y += m.def.scale * (m.def.animal ? 0.7 : 1.2);
          if (mp.distanceTo(center) < m.def.r + 0.5) {
            this.damageMob(m, pr.dmg, pr.vel.clone().setY(0).normalize());
            pr.life = 0; break;
          }
        }
      } else {
        const pc = pp.clone(); pc.y -= 0.4;
        if (mp.distanceTo(pc) < 0.9 && !P.dead) { P.takeDamage(pr.dmg, mp); pr.life = 0; }
      }
      if (pr.life <= 0) Game.scene.remove(pr.mesh);
    }
    this.projectiles = this.projectiles.filter(p => p.life > 0);

    // --- pickups ---
    for (const pk of this.pickups) {
      pk.t += dt * 3;
      pk.mesh.rotation.y += dt * 2;
      pk.mesh.position.y = World.height(pk.mesh.position.x, pk.mesh.position.z) + 0.5 + Math.sin(pk.t) * 0.12;
      if (pk.mesh.position.distanceTo(pp) < 2.2) {
        for (const it of pk.items) {
          Inv.add(P.bag, it.id, it.qty);
          UI.logMsg('+' + it.qty + ' ' + ITEMS[it.id].name);
        }
        Sfx.pickup();
        Game.scene.remove(pk.mesh);
        pk.got = true;
      }
    }
    this.pickups = this.pickups.filter(p => !p.got);
  },
};
