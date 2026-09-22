/* ==========================================================================
   render.js — everything that paints: viewport transform, nodes, edges,
   the connection draft and the minimap.
   ========================================================================== */
(function (FD) {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const MIN_K = 0.1;
  const MAX_K = 3.5;
  const DOT_GRID = 12;
  const EMPTY = new Set();

  let canvas = null;
  let nodeLayer = null;
  let edgeG = null;
  let draftG = null;
  let minimap = null;
  let mmCanvas = null;
  let mmCtx = null;

  const nodeEls = new Map();
  const edgeEls = new Map();
  let mmViewport = null;
  let applying = false;

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

  /* ------------------------------------------------------------ viewport */

  const vp = {
    x: 0,
    y: 0,
    k: 1,

    size() {
      if (!canvas) return { w: 1, h: 1 };
      return { w: canvas.clientWidth || 1, h: canvas.clientHeight || 1 };
    },

    rect() {
      return canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0, width: 1, height: 1 };
    },

    toWorld(sx, sy) {
      return { x: (sx - vp.x) / vp.k, y: (sy - vp.y) / vp.k };
    },

    toWorldFromClient(clientX, clientY) {
      const rect = vp.rect();
      return vp.toWorld(clientX - rect.left, clientY - rect.top);
    },

    toScreen(wx, wy) {
      return { x: wx * vp.k + vp.x, y: wy * vp.k + vp.y };
    },

    /** How much of the canvas the floating UI covers. */
    insets() {
      const sidebar = document.getElementById('sidebar');
      const dock = document.getElementById('dock');
      const topbar = document.querySelector('.topbar');

      // layout offsets, not bounding rects: the panels animate in, and a
      // mid-transition rect would report the wrong inset
      let left = 0;
      let right = 0;
      if (sidebar && !sidebar.classList.contains('collapsed')) {
        left = sidebar.offsetLeft + sidebar.offsetWidth;
      }

      const bottom = dock && !dock.classList.contains('hidden') ? dock.offsetHeight + 22 : 0;
      const top = topbar ? topbar.offsetHeight : 0;
      return { left, right, top, bottom };
    },

    /** The part of the canvas that is not behind floating UI. */
    freeArea() {
      const { w, h } = vp.size();
      const insets = vp.insets();
      return {
        x: insets.left,
        y: insets.top,
        w: Math.max(w - insets.left - insets.right, 80),
        h: Math.max(h - insets.top - insets.bottom, 80)
      };
    },

    visible() {
      const { w, h } = vp.size();
      const tl = vp.toWorld(0, 0);
      const br = vp.toWorld(w, h);
      return { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y };
    },

    set(next, opts) {
      const k = clamp(next.k === undefined ? vp.k : next.k, MIN_K, MAX_K);
      vp.x = next.x === undefined ? vp.x : next.x;
      vp.y = next.y === undefined ? vp.y : next.y;
      vp.k = k;
      applyTransform();
      if (!opts || opts.persist !== false) {
        FD.store.setView(FD.store.currentFlowId, { x: vp.x, y: vp.y, k: vp.k });
      }
    },

    panBy(dx, dy, opts) {
      vp.set({ x: vp.x + dx, y: vp.y + dy }, opts);
    },

    zoomAt(factor, clientX, clientY) {
      const rect = vp.rect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      const before = vp.toWorld(sx, sy);
      const k = clamp(vp.k * factor, MIN_K, MAX_K);
      if (k === vp.k) return;
      vp.k = k;
      vp.x = sx - before.x * k;
      vp.y = sy - before.y * k;
      applyTransform();
      FD.store.setView(FD.store.currentFlowId, { x: vp.x, y: vp.y, k: vp.k });
    },

    setZoom(k, anchorClient) {
      const rect = vp.rect();
      const clientX = anchorClient ? anchorClient.x : rect.left + rect.width / 2;
      const clientY = anchorClient ? anchorClient.y : rect.top + rect.height / 2;
      vp.zoomAt(clamp(k, MIN_K, MAX_K) / vp.k, clientX, clientY);
    },

    centerOn(wx, wy) {
      const area = vp.freeArea();
      vp.set({
        x: area.x + area.w / 2 - wx * vp.k,
        y: area.y + area.h / 2 - wy * vp.k
      });
    },

    contentBounds(flow) {
      const f = flow || FD.store.currentFlow();
      if (!f || !f.nodes.length) return null;
      let x1 = Infinity; let y1 = Infinity; let x2 = -Infinity; let y2 = -Infinity;
      for (const n of f.nodes) {
        x1 = Math.min(x1, n.x);
        y1 = Math.min(y1, n.y);
        x2 = Math.max(x2, n.x + n.w);
        y2 = Math.max(y2, n.y + n.h);
      }
      return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
    },

    fit(padding) {
      const pad = padding === undefined ? 90 : padding;
      const bounds = vp.contentBounds();
      const area = vp.freeArea();
      if (!bounds) {
        vp.set({ x: area.x + area.w / 2, y: area.y + area.h / 2, k: 1 });
        return;
      }
      const k = clamp(Math.min(
        (area.w - pad * 2) / Math.max(bounds.w, 1),
        (area.h - pad * 2) / Math.max(bounds.h, 1)
      ), MIN_K, 1.6);
      vp.set({
        k,
        x: area.x + area.w / 2 - (bounds.x + bounds.w / 2) * k,
        y: area.y + area.h / 2 - (bounds.y + bounds.h / 2) * k
      });
    },

    centerPosition() {
      const area = vp.freeArea();
      return vp.toWorld(area.x + area.w / 2, area.y + area.h / 2);
    },

    /** Centre of the view, nudged so a new element does not land on an existing one. */
    spawnPosition() {
      const centre = vp.centerPosition();
      const flow = FD.store.currentFlow();
      let x = Math.round(centre.x);
      let y = Math.round(centre.y);
      if (flow) {
        let guard = 0;
        while (flow.nodes.some((n) => Math.abs(n.x - x) < 24 && Math.abs(n.y - y) < 24) && guard++ < 80) {
          x += FD.store.GRID * 2;
          y += FD.store.GRID * 2;
        }
      }
      return { x, y };
    },

    loadFromStore() {
      const flow = FD.store.currentFlow();
      const view = (flow && flow.view) || { x: 0, y: 0, k: 1 };
      vp.x = view.x;
      vp.y = view.y;
      vp.k = clamp(view.k || 1, MIN_K, MAX_K);
      applyTransform();
    }
  };

  function applyTransform() {
    if (!canvas) return;
    const k = vp.k;
    nodeLayer.style.transform = 'translate(' + vp.x + 'px,' + vp.y + 'px) scale(' + k + ')';
    edgeG.setAttribute('transform', 'translate(' + vp.x + ' ' + vp.y + ') scale(' + k + ')');
    draftG.setAttribute('transform', 'translate(' + vp.x + ' ' + vp.y + ') scale(' + k + ')');

    // the dot grid is finer than the snap grid: dots every 12 units, snapping
    // every 24, and the on-screen spacing stays in a readable band
    let gs = DOT_GRID * k;
    while (gs < 9) gs *= 2;
    while (gs > 56) gs /= 2;
    canvas.style.setProperty('--gs', gs.toFixed(2) + 'px');
    canvas.style.backgroundPosition = vp.x.toFixed(2) + 'px ' + vp.y.toFixed(2) + 'px';

    if (mmViewport) {
      const v = vp.visible();
      mmViewport.view = v;
    }
    drawMinimap();
    FD.bus.emit('viewport', { x: vp.x, y: vp.y, k: vp.k });
  }

  /* --------------------------------------------------------------- nodes */

  const GEO = {
    rect: '<rect x="0.7" y="0.7" width="98.6" height="98.6" rx="7"/>',
    ellipse: '<ellipse cx="50" cy="50" rx="49.4" ry="49.4"/>',
    diamond: '<polygon points="50,0.9 99.1,50 50,99.1 0.9,50"/>'
  };

  function createNodeEl(node) {
    const el = document.createElement('div');
    el.className = 'node';
    el.dataset.id = node.id;
    el.innerHTML =
      '<svg class="node-geo" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"></svg>' +
      '<div class="node-body">' +
        '<div class="node-kind">' +
          '<span class="kind-chip"></span>' +
          '<span class="status-text"></span>' +
        '</div>' +
        '<div class="node-kind-preview-body"></div>' +
        '<div class="node-text"></div>' +
        '<div class="node-foot"></div>' +
      '</div>' +
      '<div class="port" data-side="top" title="Top"></div>' +
      '<div class="port" data-side="right" title="Right"></div>' +
      '<div class="port" data-side="bottom" title="Bottom"></div>' +
      '<div class="port" data-side="left" title="Left"></div>' +
      '<div class="node-resize" title="Drag to resize"></div>';
    return el;
  }

  function syncNodeEl(el, node, flow) {
    const store = FD.store;
    const kind = node.kind || 'node';
    const spec = store.kindSpec(kind);

    if (el.dataset.kind !== kind) el.dataset.kind = kind;

    if (kind === 'shape') {
      const shape = node.shape || 'rect';
      if (el.dataset.shape !== shape) {
        el.dataset.shape = shape;
        el.querySelector('.node-geo').innerHTML = GEO[shape] || GEO.rect;
      }
    }

    const nameEl = el.querySelector('.node-text');
    // never rewrite the text under someone's cursor
    if (el.dataset.editing !== '1' && el.dataset.text !== node.name) {
      el.dataset.text = node.name;
      nameEl.innerHTML = FD.md.html(node.name);
      el.classList.toggle('no-text', FD.md.isEmpty(node.name));
    }

    if (el.dataset.color !== node.color) {
      el.dataset.color = node.color;
      el.style.setProperty('--nc', 'var(--c-' + node.color + ')');
    }

    // text ink: an explicit choice, or whatever the kind asks for
    const ink = node.textColor || '';
    if (el.dataset.ink !== ink) {
      el.dataset.ink = ink;
      if (ink) el.style.setProperty('--ink', 'var(--c-' + ink + ')');
      else el.style.removeProperty('--ink');
    }

    // type / status line — the small, restrained bit of colour
    const tone = store.statusTone(node.status);
    if (el.dataset.status !== tone) el.dataset.status = tone;
    const kindRow = el.querySelector('.node-kind');
    const chip = el.querySelector('.kind-chip');
    const statusText = el.querySelector('.status-text');
    const typeKey = (node.type || '') + '|' + (node.status || '');
    if (el.dataset.kindline !== typeKey) {
      el.dataset.kindline = typeKey;
      chip.textContent = node.type || '';
      chip.hidden = !node.type;
      statusText.textContent = node.status || '';
      statusText.hidden = !node.status;
      kindRow.hidden = !node.type && !node.status;
    }

    el.classList.toggle('connectable', !!spec.ports);
    const hasChild = !!(node.child && store.flow(node.child));

    el.style.transform = 'translate(' + node.x + 'px,' + node.y + 'px)';

    if (kind === 'text') {
      // free text has no inline size: the CSS sizes the box to the words and we
      // follow with the model, so the boundary always wraps the text
      el.style.width = '';
      el.style.height = '';
      const measuredW = Math.round(el.offsetWidth);
      const measuredH = Math.round(el.offsetHeight);
      if (Math.abs(measuredW - node.w) > 2 || Math.abs(measuredH - node.h) > 2) {
        store.updateNode(node.id, { w: measuredW, h: measuredH },
          { silent: true, silentHistory: true });
      }
    } else {
      el.style.width = node.w + 'px';
      el.style.height = node.h + 'px';
    }

    if (kind === 'sticker') {
      const side = Math.min(node.w, node.h);
      // keep the glyphs inside the bubble: assume they wrap into a rough square
      const glyphs = Math.max(1, Array.from(String(node.name).trim()).length);
      const rows = Math.ceil(Math.sqrt(glyphs));
      el.querySelector('.node-text').style.fontSize =
        Math.round(Math.min(side * 0.62, (side * 0.82) / rows)) + 'px';
    }

    const steps = hasChild ? store.flow(node.child).nodes.length : 0;

    // a preview node shows the flow it points at, as text
    if (spec.output) {
      const target = hasChild ? node.child : (flow ? flow.id : null);
      const targetFlow = target ? store.flow(target) : null;
      const previewKey = target + '|' + (targetFlow ? targetFlow.nodes.length + ':' + targetFlow.edges.length : 0);
      if (el.dataset.preview !== previewKey) {
        el.dataset.preview = previewKey;
        el.querySelector('.node-kind-preview-body').textContent =
          targetFlow && FD.exporter ? FD.exporter.semanticOutline(target) : '';
      }
    }
    const members = spec.container && flow ? store.elementChildren(flow.id, node.id).length : 0;
    if (spec.container) el.classList.toggle('empty-group', members === 0);

    // one quiet footer line: what is inside, if anything
    const footKey = (hasChild ? 'c' + steps : '') + '|' + (spec.container ? 'g' + members : '');
    if (el.dataset.foot !== footKey) {
      el.dataset.foot = footKey;
      const foot = el.querySelector('.node-foot');
      const chips = [];
      if (hasChild) {
        chips.push('<span class="node-chip sub" title="' + steps +
          (steps === 1 ? ' element inside' : ' elements inside') + '">' +
          '<svg class="icon"><use href="#i-layers"/></svg>' +
          steps + (steps === 1 ? ' step' : ' steps') + '</span>');
      }
      if (spec.container) {
        chips.push('<span class="node-chip">' + members + (members === 1 ? ' item' : ' items') + '</span>');
      }
      foot.innerHTML = chips.join('');
      foot.hidden = chips.length === 0;
    }
  }

  function renderNodes() {
    const flow = FD.store.currentFlow();
    if (!flow) return;
    const seen = new Set();

    for (const node of flow.nodes) {
      seen.add(node.id);
      let el = nodeEls.get(node.id);
      if (!el) {
        el = createNodeEl(node);
        nodeEls.set(node.id, el);
        nodeLayer.appendChild(el);
      }
      syncNodeEl(el, node, flow);
    }

    for (const [id, el] of Array.from(nodeEls)) {
      if (!seen.has(id)) {
        el.remove();
        nodeEls.delete(id);
      }
    }

    // Groups paint behind everything else on the same level, so a frame never
    // covers the things sitting on it.
    const depth = new Map();
    const order = new Map();
    flow.nodes.forEach((node, index) => {
      depth.set(node.id, FD.store.elementDepth(node, flow));
      order.set(node.id, index);
    });
    flow.nodes
      .slice()
      .sort((a, b) => {
        const byDepth = depth.get(a.id) - depth.get(b.id);
        if (byDepth) return byDepth;
        const byKind = (FD.store.isContainer(a) ? 0 : 1) - (FD.store.isContainer(b) ? 0 : 1);
        if (byKind) return byKind;
        return order.get(a.id) - order.get(b.id);
      })
      .forEach((node) => {
        const el = nodeEls.get(node.id);
        if (el) nodeLayer.appendChild(el);
      });

    renderSelection();
  }

  /* --------------------------------------------------------------- edges */

  /** Where an edge meets a node, given which side it attaches to. */
  function anchor(node, side) {
    switch (side) {
      case 'top': return { x: node.x + node.w / 2, y: node.y, nx: 0, ny: -1 };
      case 'bottom': return { x: node.x + node.w / 2, y: node.y + node.h, nx: 0, ny: 1 };
      case 'left': return { x: node.x, y: node.y + node.h / 2, nx: -1, ny: 0 };
      default: return { x: node.x + node.w, y: node.y + node.h / 2, nx: 1, ny: 0 };
    }
  }

  /** A curve that leaves and enters perpendicular to the sides it uses. */
  function curveBetween(a, b) {
    const stretch = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y), 60);
    const d = clamp(stretch * 0.42, 45, 220);
    const c1 = { x: a.x + a.nx * d, y: a.y + a.ny * d };
    const c2 = { x: b.x + b.nx * d, y: b.y + b.ny * d };
    return {
      d: 'M ' + a.x + ' ' + a.y + ' C ' + c1.x + ' ' + c1.y + ', ' + c2.x + ' ' + c2.y + ', ' + b.x + ' ' + b.y,
      mid: {
        x: (a.x + 3 * c1.x + 3 * c2.x + b.x) / 8,
        y: (a.y + 3 * c1.y + 3 * c2.y + b.y) / 8
      }
    };
  }

  function edgeGeometry(edge, nodes) {
    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to);
    if (!from || !to) return null;
    const a = anchor(from, edge.fromSide || 'right');
    const b = anchor(to, edge.toSide || 'left');
    return curveBetween(a, b);
  }

  function createEdgeEl(edge) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'edge');
    g.dataset.id = edge.id;

    const hit = document.createElementNS(SVG_NS, 'path');
    hit.setAttribute('class', 'edge-hit');

    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('class', 'edge-path');
    path.setAttribute('marker-end', 'url(#arrow)');

    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('class', 'edge-label');
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('dominant-baseline', 'middle');

    g.appendChild(path);
    g.appendChild(hit);
    g.appendChild(label);
    return { g, path, hit, label };
  }

  function edgeGeometry(edge, nodes) {
    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to);
    if (!from || !to) return null;
    return curveBetween(anchor(from, edge.fromSide || 'right'), anchor(to, edge.toSide || 'left'));
  }

  function renderEdges() {
    const flow = FD.store.currentFlow();
    if (!flow) return;
    const seen = new Set();
    for (const edge of flow.edges) {
      seen.add(edge.id);
      let entry = edgeEls.get(edge.id);
      if (!entry) {
        entry = createEdgeEl(edge);
        edgeEls.set(edge.id, entry);
        edgeG.appendChild(entry.g);
      }
      const text = edge.label || '';
      if (entry.label.textContent !== text) entry.label.textContent = text;
      entry.label.style.display = text ? '' : 'none';
    }
    for (const [id, entry] of Array.from(edgeEls)) {
      if (!seen.has(id)) {
        entry.g.remove();
        edgeEls.delete(id);
      }
    }
    updateEdgeGeometry();
    renderSelection();
  }

  function updateEdgeGeometry() {
    const flow = FD.store.currentFlow();
    if (!flow) return;
    const nodes = new Map(flow.nodes.map((n) => [n.id, n]));
    for (const edge of flow.edges) {
      const entry = edgeEls.get(edge.id);
      if (!entry) continue;
      const geo = edgeGeometry(edge, nodes);
      if (!geo) {
        entry.g.style.display = 'none';
        continue;
      }
      entry.g.style.display = '';
      entry.path.setAttribute('d', geo.d);
      entry.hit.setAttribute('d', geo.d);
      if (entry.label.style.display !== 'none') {
        entry.label.setAttribute('x', geo.mid.x.toFixed(1));
        entry.label.setAttribute('y', geo.mid.y.toFixed(1));
      }
    }
  }

  /* ----------------------------------------------------------- selection */

  function renderSelection() {
    const sel = FD.sel || { nodes: EMPTY, edge: null };
    for (const [id, el] of nodeEls) {
      el.classList.toggle('selected', sel.nodes.has(id));
    }
    for (const [id, entry] of edgeEls) {
      const on = sel.edge === id;
      entry.path.classList.toggle('selected', on);
      entry.g.classList.toggle('is-selected', on);
    }
  }

  /* -------------------------------------------------------- draft / link */

  let draftPath = null;
  let draftDot = null;

  function ensureDraft() {
    if (draftPath) return;
    draftPath = document.createElementNS(SVG_NS, 'path');
    draftPath.setAttribute('class', 'draft-path');
    draftPath.setAttribute('marker-end', 'url(#arrow)');
    draftDot = document.createElementNS(SVG_NS, 'circle');
    draftDot.setAttribute('class', 'draft-port');
    draftDot.setAttribute('r', '5');
    draftG.appendChild(draftPath);
    draftG.appendChild(draftDot);
  }

  function showDraft(fromNode, toWorld, opts) {
    ensureDraft();
    const side = (opts && opts.side) || 'right';
    const a = anchor(fromNode, side);
    const b = { x: toWorld.x, y: toWorld.y, nx: -a.nx, ny: -a.ny };
    const geo = curveBetween(a, b);
    draftPath.setAttribute('d', geo.d);
    draftPath.style.stroke = (opts && opts.valid === false) ? 'var(--danger)' : 'var(--accent)';
    draftDot.setAttribute('cx', b.x);
    draftDot.setAttribute('cy', b.y);
    draftDot.style.fill = (opts && opts.valid === false) ? 'var(--danger)' : 'var(--accent)';
    draftPath.style.display = '';
    draftDot.style.display = '';
  }

  function clearDraft() {
    if (!draftPath) return;
    draftPath.style.display = 'none';
    draftDot.style.display = 'none';
  }

  function setDropTarget(nodeId) {
    for (const [id, el] of nodeEls) {
      el.classList.toggle('drop-target', !!nodeId && id === nodeId);
    }
  }

  /* -------------------------------------------------------------- minimap */

  function drawMinimap() {
    if (!mmCtx || !minimap || minimap.classList.contains('hidden')) return;
    const flow = FD.store.currentFlow();
    const cw = minimap.clientWidth;
    const ch = minimap.clientHeight;
    if (!cw || !ch) return;

    const dpr = window.devicePixelRatio || 1;
    if (mmCanvas.width !== Math.round(cw * dpr) || mmCanvas.height !== Math.round(ch * dpr)) {
      mmCanvas.width = Math.round(cw * dpr);
      mmCanvas.height = Math.round(ch * dpr);
    }
    mmCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mmCtx.clearRect(0, 0, cw, ch);

    const pad = 8;
    const view = vp.visible();
    let x1 = view.x; let y1 = view.y; let x2 = view.x + view.w; let y2 = view.y + view.h;

    if (flow) {
      for (const n of flow.nodes) {
        x1 = Math.min(x1, n.x); y1 = Math.min(y1, n.y);
        x2 = Math.max(x2, n.x + n.w); y2 = Math.max(y2, n.y + n.h);
      }
    }

    const w = Math.max(x2 - x1, 1);
    const h = Math.max(y2 - y1, 1);
    const scale = Math.min((cw - pad * 2) / w, (ch - pad * 2) / h);
    const ox = (cw - w * scale) / 2 - x1 * scale;
    const oy = (ch - h * scale) / 2 - y1 * scale;

    const toMm = (wx, wy) => [wx * scale + ox, wy * scale + oy];

    const styles = getComputedStyle(document.documentElement);
    const accent = styles.getPropertyValue('--accent').trim() || '#6d8bff';
    const line = styles.getPropertyValue('--border-2').trim() || '#2e3648';

    if (flow) {
      mmCtx.strokeStyle = line;
      mmCtx.lineWidth = 1;
      const nodes = new Map(flow.nodes.map((n) => [n.id, n]));
      mmCtx.beginPath();
      for (const e of flow.edges) {
        const fromNode = nodes.get(e.from);
        const toNode = nodes.get(e.to);
        if (!fromNode || !toNode) continue;
        const start = anchor(fromNode, e.fromSide || 'right');
        const end = anchor(toNode, e.toSide || 'left');
        const p1 = toMm(start.x, start.y);
        const p2 = toMm(end.x, end.y);
        mmCtx.moveTo(p1[0], p1[1]);
        mmCtx.lineTo(p2[0], p2[1]);
      }
      mmCtx.stroke();

      const sel = FD.sel || { nodes: EMPTY };
      for (const n of flow.nodes) {
        const p = toMm(n.x, n.y);
        mmCtx.fillStyle = sel.nodes.has(n.id) ? accent : 'rgba(140,155,190,.55)';
        mmCtx.fillRect(p[0], p[1], Math.max(n.w * scale, 1.5), Math.max(n.h * scale, 1.5));
      }
    }

    const v1 = toMm(view.x, view.y);
    mmCtx.strokeStyle = accent;
    mmCtx.lineWidth = 1.4;
    mmCtx.strokeRect(v1[0], v1[1], view.w * scale, view.h * scale);

    mmViewport = mmViewport || {};
    mmViewport.scaleX = scale;
    mmViewport.scaleY = scale;
    mmViewport.offsetX = ox;
    mmViewport.offsetY = oy;
  }

  function minimapJump(clientX, clientY) {
    const rect = minimap.getBoundingClientRect();
    const { offsetX, offsetY, scaleX } = mmViewport || {};
    if (scaleX === undefined) return;
    const wx = (clientX - rect.left - offsetX) / scaleX;
    const wy = (clientY - rect.top - offsetY) / mmViewport.scaleY;
    vp.centerOn(wx, wy);
  }

  function initMinimap() {
    minimap = document.getElementById('minimap');
    mmCanvas = document.getElementById('mm-canvas');
    if (!minimap || !mmCanvas) return;
    mmCtx = mmCanvas.getContext('2d');
    let dragging = false;
    minimap.addEventListener('pointerdown', (e) => {
      dragging = true;
      minimap.setPointerCapture(e.pointerId);
      minimapJump(e.clientX, e.clientY);
    });
    minimap.addEventListener('pointermove', (e) => {
      if (dragging) minimapJump(e.clientX, e.clientY);
    });
    minimap.addEventListener('pointerup', (e) => {
      dragging = false;
      try { minimap.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
  }

  /* --------------------------------------------------------------- public */

  function init() {
    canvas = document.getElementById('canvas');
    nodeLayer = document.getElementById('node-g');
    edgeG = document.getElementById('edge-g');
    draftG = document.getElementById('draft-g');
    initMinimap();
  }

  function all() {
    if (applying) return;
    applying = true;
    try {
      renderNodes();
      renderEdges();
    } finally {
      applying = false;
    }
    drawMinimap();
  }

  function nodesOnly() {
    const flow = FD.store.currentFlow();
    if (!flow) return;
    for (const node of flow.nodes) {
      const el = nodeEls.get(node.id);
      if (el) syncNodeEl(el, node, flow);
    }
    updateEdgeGeometry();
    drawMinimap();
  }

  function setAnimated(on) {
    canvas.classList.toggle('animated', !!on);
  }

  function toggleMinimap(on) {
    if (!minimap) return;
    minimap.classList.toggle('hidden', !on);
    if (on) drawMinimap();
  }

  function minimapVisible() {
    return !!minimap && !minimap.classList.contains('hidden');
  }

  FD.render = {
    init,
    all,
    nodesOnly,
    renderNodes,
    renderEdges,
    renderSelection,
    updateEdgeGeometry,
    showDraft,
    clearDraft,
    anchor,
    curveBetween,
    setDropTarget,
    setAnimated,
    toggleMinimap,
    minimapVisible,
    drawMinimap,
    get canvas() { return canvas; },
    nodeEls,
    edgeEls
  };

  FD.viewport = vp;
})(window.FD = window.FD || {});
