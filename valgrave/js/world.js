// ---------- procedural island world ----------
const World = {
  R: 250,            // island radius
  seed: 1,
  inter: [],         // interactables: {type, mesh, pos, time, label, loot()}
  runes: [],         // extraction runes {pos, mesh, ring}
  grave: null,
  group: null,

  // -- noise --
  hash(ix, iz) {
    let n = (ix * 374761393 + iz * 668265263 + this.seed * 974711) | 0;
    n = ((n ^ (n >> 13)) * 1274126177) | 0;
    return (((n ^ (n >> 16)) >>> 0) % 100000) / 100000;
  },
  vnoise(x, z) {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = x - ix, fz = z - iz;
    const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
    const a = this.hash(ix, iz), b = this.hash(ix + 1, iz);
    const c = this.hash(ix, iz + 1), d = this.hash(ix + 1, iz + 1);
    return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
  },
  height(x, z) {
    let h = 0, amp = 1, freq = 0.012, tot = 0;
    for (let o = 0; o < 4; o++) {
      h += this.vnoise(x * freq + o * 37.7, z * freq + o * 17.3) * amp;
      tot += amp; amp *= 0.5; freq *= 2.1;
    }
    h /= tot;
    const d = Math.sqrt(x * x + z * z) / this.R;
    const fall = Math.max(0, 1 - Math.max(0, (d - 0.62)) / 0.38);
    return h * 20 * (fall * fall) - 2.2;
  },

  build(scene, seed, lostCache) {
    this.seed = seed;
    this.inter = []; this.runes = []; this.grave = null;
    this.group = new THREE.Group();
    scene.add(this.group);
    const g = this.group;

    // terrain
    const SEG = 130, SIZE = 560;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const col = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = this.height(x, z);
      pos.setY(i, h);
      const tint = 0.9 + this.hash(Math.floor(x * 3), Math.floor(z * 3)) * 0.2;
      if (h < 0.5)       col.setRGB(0.72, 0.66, 0.5);
      else if (h < 7)    col.setRGB(0.22, 0.4, 0.18);
      else if (h < 12)   col.setRGB(0.32, 0.34, 0.3);
      else               col.setRGB(0.8, 0.82, 0.85);
      colors[i * 3] = col.r * tint; colors[i * 3 + 1] = col.g * tint; colors[i * 3 + 2] = col.b * tint;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    terrain.receiveShadow = true;
    g.add(terrain);

    // water
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(1400, 1400),
      new THREE.MeshLambertMaterial({ color: 0x1d4a66, transparent: true, opacity: 0.85 }));
    water.rotation.x = -Math.PI / 2;
    g.add(water);

    // lights & sky
    scene.background = new THREE.Color(0x8aa3b8);
    scene.fog = new THREE.Fog(0x8aa3b8, 60, 380);
    const sun = new THREE.DirectionalLight(0xfff2d8, 1.0);
    sun.position.set(120, 180, 60);
    g.add(sun);
    g.add(new THREE.HemisphereLight(0xbcd3e8, 0x3a4630, 0.55));

    this.scatterNature(g);
    const ruins = this.placeRuins(g);
    this.placeRunes(g);
    if (lostCache && Inv.count(lostCache) > 0) this.placeGrave(g, lostCache);
    return ruins; // mob spawn anchors
  },

  randLand(minH, maxH, tries) {
    for (let i = 0; i < (tries || 60); i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * this.R * 0.92;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const h = this.height(x, z);
      if (h >= minH && h <= maxH) return new THREE.Vector3(x, h, z);
    }
    return null;
  },

  addInter(type, mesh, time, label, loot) {
    this.inter.push({ type, mesh, pos: mesh.position, time, label, loot, done: false, progress: 0 });
  },

  scatterNature(g) {
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a4632 });
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x777a7d });
    const ironMat  = new THREE.MeshLambertMaterial({ color: 0x6b4438 });
    const bushMat  = new THREE.MeshLambertMaterial({ color: 0x2e5a26 });
    const berryMat = new THREE.MeshLambertMaterial({ color: 0xc04060 });

    for (let i = 0; i < 240; i++) {
      const p = this.randLand(0.8, 11, 20); if (!p) continue;
      const tree = new THREE.Group();
      const s = 0.8 + Math.random() * 0.7;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * s, 0.4 * s, 3.2 * s, 6), trunkMat);
      trunk.position.y = 1.6 * s;
      const leafCol = new THREE.Color().setHSL(0.3 + Math.random() * 0.06, 0.45, 0.22 + Math.random() * 0.08);
      const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.7 * s, 4.2 * s, 7), new THREE.MeshLambertMaterial({ color: leafCol }));
      leaves.position.y = 4.6 * s;
      tree.add(trunk, leaves);
      tree.position.copy(p);
      tree.rotation.y = Math.random() * 6.28;
      g.add(tree);
      this.addInter('tree', tree, 2.0, 'Chop Tree', () => [{ id: 'wood', qty: P.hasTool() ? 5 : 3 }]);
    }
    for (let i = 0; i < 70; i++) {
      const p = this.randLand(0.6, 13, 20); if (!p) continue;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8 + Math.random() * 0.8, 0), stoneMat);
      rock.position.copy(p); rock.position.y += 0.4;
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      g.add(rock);
      this.addInter('rock', rock, 2.2, 'Mine Rock', () => [{ id: 'stone', qty: P.hasTool() ? 4 : 3 }]);
    }
    for (let i = 0; i < 10; i++) {
      const p = this.randLand(8, 99, 80); if (!p) continue;
      const ore = new THREE.Mesh(new THREE.DodecahedronGeometry(1.3, 0), ironMat);
      ore.position.copy(p); ore.position.y += 0.6;
      ore.rotation.set(Math.random(), Math.random(), Math.random());
      g.add(ore);
      this.addInter('iron', ore, 3.0, 'Mine Iron Deposit', () => [{ id: 'iron', qty: P.hasTool() ? 3 : 2 }]);
    }
    for (let i = 0; i < 50; i++) {
      const p = this.randLand(0.8, 8, 20); if (!p) continue;
      const bush = new THREE.Group();
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.7, 6, 5), bushMat);
      ball.position.y = 0.5; ball.scale.y = 0.7;
      bush.add(ball);
      for (let b = 0; b < 4; b++) {
        const berry = new THREE.Mesh(new THREE.SphereGeometry(0.09, 5, 4), berryMat);
        berry.position.set((Math.random() - 0.5) * 1.1, 0.5 + Math.random() * 0.4, (Math.random() - 0.5) * 1.1);
        bush.add(berry);
      }
      bush.position.copy(p);
      g.add(bush);
      this.addInter('bush', bush, 0.8, 'Pick Berries', () => [{ id: 'berries', qty: 2 + (Math.random() * 2 | 0) }]);
    }
  },

  chestLoot() {
    const out = [{ id: 'coin', qty: 5 + (Math.random() * 16 | 0) }];
    if (Math.random() < 0.6) out.push({ id: 'iron', qty: 1 + (Math.random() * 3 | 0) });
    if (Math.random() < 0.5) out.push({ id: 'arrow', qty: 4 + (Math.random() * 6 | 0) });
    if (Math.random() < 0.35) out.push({ id: 'hide', qty: 1 + (Math.random() * 2 | 0) });
    if (Math.random() < 0.12) out.push({ id: 'relic', qty: 1 });
    if (Math.random() < 0.1) out.push({ id: 'mead', qty: 1 });
    return out;
  },

  makeChest(g, p) {
    const chest = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.7), new THREE.MeshLambertMaterial({ color: 0x7a5a2a }));
    body.position.y = 0.35;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.25, 0.7), new THREE.MeshLambertMaterial({ color: 0x8a6a34 }));
    lid.position.y = 0.82;
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.72, 0.18), new THREE.MeshLambertMaterial({ color: 0xc8b04a }));
    band.position.y = 0.36;
    chest.add(body, lid, band);
    chest.position.copy(p);
    chest.rotation.y = Math.random() * 6.28;
    g.add(chest);
    this.addInter('chest', chest, 1.5, 'Open Chest', () => this.chestLoot());
  },

  placeRuins(g) {
    const anchors = [];
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x5c5f63 });
    for (let i = 0; i < 5; i++) {
      const p = this.randLand(1.5, 10, 80); if (!p) continue;
      anchors.push({ pos: p.clone(), troll: false });
      for (let w = 0; w < 4 + (Math.random() * 3 | 0); w++) {
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(2.5 + Math.random() * 3, 1 + Math.random() * 2.5, 0.7), wallMat);
        const a = Math.random() * 6.28, r = 3 + Math.random() * 6;
        wall.position.set(p.x + Math.cos(a) * r, 0, p.z + Math.sin(a) * r);
        wall.position.y = this.height(wall.position.x, wall.position.z) + wall.geometry.parameters.height / 2 - 0.3;
        wall.rotation.y = Math.random() * 6.28;
        wall.rotation.z = (Math.random() - 0.5) * 0.15;
        g.add(wall);
      }
      const nChests = 1 + (Math.random() * 2.4 | 0);
      for (let c = 0; c < nChests; c++) {
        const a = Math.random() * 6.28, r = Math.random() * 4;
        const cp = new THREE.Vector3(p.x + Math.cos(a) * r, 0, p.z + Math.sin(a) * r);
        cp.y = this.height(cp.x, cp.z);
        this.makeChest(g, cp);
      }
    }
    // troll camp: bones + boulders, far inland
    const tp = this.randLand(5, 12, 120);
    if (tp) {
      for (let b = 0; b < 3; b++) {
        const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(2 + Math.random(), 0),
          new THREE.MeshLambertMaterial({ color: 0x55585c }));
        const a = Math.random() * 6.28;
        boulder.position.set(tp.x + Math.cos(a) * 5, 0, tp.z + Math.sin(a) * 5);
        boulder.position.y = this.height(boulder.position.x, boulder.position.z) + 0.8;
        g.add(boulder);
      }
      const cp = tp.clone(); cp.y = this.height(cp.x, cp.z);
      this.makeChest(g, cp);
      anchors.push({ pos: tp.clone(), troll: true });
    }
    // a couple of lone chests
    for (let c = 0; c < 2; c++) {
      const p = this.randLand(1, 12, 40);
      if (p) this.makeChest(g, p);
    }
    return anchors;
  },

  placeRunes(g) {
    const baseA = Math.random() * Math.PI * 2;
    for (let i = 0; i < 3; i++) {
      const a = baseA + (i * Math.PI * 2 / 3) + (Math.random() - 0.5) * 0.5;
      let p = null;
      for (let r = 0.78; r > 0.3 && !p; r -= 0.06) {
        const x = Math.cos(a) * this.R * r, z = Math.sin(a) * this.R * r;
        const h = this.height(x, z);
        if (h > 0.6 && h < 11) p = new THREE.Vector3(x, h, z);
      }
      if (!p) p = this.randLand(0.6, 11, 100) || new THREE.Vector3(0, this.height(0, 0), 0);
      const rune = new THREE.Group();
      const stone = new THREE.Mesh(new THREE.BoxGeometry(1.2, 4.2, 0.8),
        new THREE.MeshLambertMaterial({ color: 0x3a4a42, emissive: 0x0a3a1a }));
      stone.position.y = 2.1;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.12, 8, 32),
        new THREE.MeshBasicMaterial({ color: 0x40ff80 }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.25;
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 60, 8, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x40ff80, transparent: true, opacity: 0.25 }));
      beam.position.y = 30;
      rune.add(stone, ring, beam);
      rune.position.copy(p);
      g.add(rune);
      this.runes.push({ pos: p.clone(), mesh: rune, ring, name: 'Rune ' + 'ABC'[i] });
    }
  },

  placeGrave(g, lostCache) {
    const p = this.randLand(1, 11, 120) || new THREE.Vector3(10, this.height(10, 10), 10);
    const grave = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1, 1.6, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x4a4a52 }));
    slab.position.y = 0.8;
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.32),
      new THREE.MeshLambertMaterial({ color: 0x5a5a62 }));
    cross.position.y = 1.1;
    const glow = new THREE.PointLight(0x8888ff, 0.8, 12);
    glow.position.y = 1.5;
    grave.add(slab, cross, glow);
    grave.position.copy(p);
    g.add(grave);
    const items = [];
    for (const k in lostCache) items.push({ id: k, qty: lostCache[k] });
    this.addInter('grave', grave, 2.0, 'Recover Your Remains', () => items);
    this.grave = { pos: p.clone(), mesh: grave };
  },

  spawnPoint() {
    for (let i = 0; i < 200; i++) {
      const a = Math.PI / 2 + (Math.random() - 0.5) * 1.2; // southern shore
      const r = (0.6 + Math.random() * 0.3) * this.R;
      const x = Math.cos(a) * r, z = Math.abs(Math.sin(a)) * r;
      const h = this.height(x, z);
      if (h > 0.3 && h < 3) return new THREE.Vector3(x, h, z);
    }
    return new THREE.Vector3(0, this.height(0, 0), 0);
  },

  update(dt, t) {
    for (const r of this.runes) {
      r.ring.rotation.z += dt * 0.8;
      r.ring.scale.setScalar(1 + Math.sin(t * 2.2) * 0.07);
    }
  },

  dispose(scene) {
    if (this.group) {
      scene.remove(this.group);
      this.group.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
      });
      this.group = null;
    }
    this.inter = []; this.runes = []; this.grave = null;
  },
};
