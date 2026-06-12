// ============================================================
// GameMap: branching node map, 15 rows. Row 0 = entry fights,
// row 13 = campfires, row 14 = boss. Nodes connect upward.
// ============================================================
const GameMap = (() => {

  const ROWS = 15;
  const ROW_H = 86, NODE_AREA_W = 680;

  function typeForRow(row) {
    if (row === 0) return 'monster';
    if (row === ROWS - 1) return 'boss';
    if (row === ROWS - 2) return 'rest';
    if (row === 7) return 'treasure';
    const r = Math.random();
    if (row >= 4 && r < 0.14) return 'elite';
    if (r < 0.26) return 'rest';
    if (r < 0.38) return 'shop';
    return 'monster';
  }

  function generate() {
    const rows = [];
    for (let r = 0; r < ROWS; r++) {
      const count = r === ROWS - 1 ? 1 : r === 0 ? 3 : 2 + Math.floor(Math.random() * 3); // 2-4
      const nodes = [];
      for (let i = 0; i < count; i++) {
        nodes.push({
          id: r + '-' + i, row: r, idx: i,
          type: typeForRow(r),
          // horizontal position as fraction, jittered
          x: count === 1 ? 0.5 : 0.14 + 0.72 * (i / (count - 1)) + (Math.random() - 0.5) * 0.06,
          next: [], visited: false,
        });
      }
      // no two rests/shops adjacent in same row looks nicer; not critical
      rows.push(nodes);
    }
    // connect each row to the next: nearest by x, plus coverage fix
    for (let r = 0; r < ROWS - 1; r++) {
      const cur = rows[r], nxt = rows[r + 1];
      cur.forEach(n => {
        const sorted = [...nxt].sort((a, b) => Math.abs(a.x - n.x) - Math.abs(b.x - n.x));
        n.next.push(sorted[0].id);
        if (sorted[1] && Math.random() < 0.45) n.next.push(sorted[1].id);
      });
      // every next-row node needs at least one incoming edge
      nxt.forEach(m => {
        if (!cur.some(n => n.next.includes(m.id))) {
          const sorted = [...cur].sort((a, b) => Math.abs(a.x - m.x) - Math.abs(b.x - m.x));
          sorted[0].next.push(m.id);
        }
      });
    }
    return rows;
  }

  function byId(rows, id) {
    const [r, i] = id.split('-').map(Number);
    return rows[r][i];
  }

  const NODE_ICON = { monster:'sword', elite:'skull', rest:'rest', shop:'shop', treasure:'coin', boss:'fire' };

  function nodeY(row) { return (ROWS - 1 - row) * ROW_H + 60; }
  function nodeX(n) { return n.x * NODE_AREA_W; }

  function render() {
    const G = Game.state;
    const rows = G.map;
    const wrap = document.getElementById('map-wrap');
    const cv = document.getElementById('map-canvas');
    const nodesDiv = document.getElementById('map-nodes');
    const height = ROWS * ROW_H + 60;
    wrap.style.height = height + 'px';
    nodesDiv.style.height = height + 'px';
    cv.width = NODE_AREA_W; cv.height = height;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    nodesDiv.innerHTML = '';

    // edges
    ctx.strokeStyle = '#4a4066'; ctx.lineWidth = 3; ctx.setLineDash([7, 7]);
    rows.forEach(row => row.forEach(n => {
      n.next.forEach(id => {
        const m = byId(rows, id);
        ctx.beginPath();
        ctx.moveTo(nodeX(n), nodeY(n.row));
        ctx.lineTo(nodeX(m), nodeY(m.row));
        ctx.stroke();
      });
    }));

    // which nodes are clickable
    let reachable = [];
    if (G.currentNode === null) {
      reachable = rows[0].map(n => n.id);
    } else {
      reachable = byId(rows, G.currentNode).next;
    }

    rows.forEach(row => row.forEach(n => {
      const div = document.createElement('div');
      div.className = 'map-node';
      if (n.visited) div.classList.add('visited');
      if (n.id === G.currentNode) div.classList.add('current');
      div.style.left = nodeX(n) + 'px';
      div.style.top = nodeY(n.row) + 'px';
      div.title = n.type.charAt(0).toUpperCase() + n.type.slice(1);
      div.appendChild(Sprites.icon(NODE_ICON[n.type], 3));
      if (reachable.includes(n.id) && !G.inNode) {
        div.classList.add('reachable');
        div.onclick = () => Game.enterNode(n.id);
      }
      nodesDiv.appendChild(div);
    }));

    // scroll to current position
    const scroll = document.getElementById('map-scroll');
    const focusRow = G.currentNode ? byId(rows, G.currentNode).row : 0;
    scroll.scrollTop = Math.max(0, nodeY(focusRow) - scroll.clientHeight + 120);
  }

  return { generate, byId, render, ROWS };
})();
