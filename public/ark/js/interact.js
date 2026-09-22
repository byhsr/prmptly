/* ==========================================================================
   interact.js — pointer gestures, selection and keyboard shortcuts.
   ========================================================================== */
(function (FD) {
  'use strict';

  const vp = () => FD.viewport;
  const ui = () => FD.ui;

  let canvas = null;
  let nodeLayer = null;
  let marqueeEl = null;
  let previewEl = null;

  const pointers = new Map();
  let gesture = null;
  let spaceDown = false;
  let lastPointer = null;

  /* ---------------------------------------------------------------- tools */

  const tools = {
    active: 'select',
    shape: 'rect',
    emoji: '⭐'
  };

  function setTool(name, opts) {
    const next = (name !== 'select' && !FD.store.KINDS[name]) ? 'select' : name;
    const options = opts || {};
    if (options.shape) tools.shape = options.shape;
    if (options.emoji) tools.emoji = options.emoji;
    const changed = tools.active !== next || !!(options.shape || options.emoji);
    tools.active = next;
    if (canvas) canvas.classList.toggle('placing', next !== 'select');
    if (changed) FD.bus.emit('tool', toolState());
    return next;
  }

  function toolState() {
    return { active: tools.active, shape: tools.shape, emoji: tools.emoji };
  }

  function defaultNameFor(kind) {
    if (kind === 'sticker') return tools.emoji;
    if (kind === 'sticky') return '';
    return FD.store.kindSpec(kind).text;
  }

  function createRect(g) {
    const spec = FD.store.kindSpec(tools.active);
    const s = g.start;
    const c = g.current;
    const dx = Math.abs(c.x - s.x);
    const dy = Math.abs(c.y - s.y);
    if (dx > 12 && dy > 12) {
      return {
        x: Math.round(Math.min(s.x, c.x)),
        y: Math.round(Math.min(s.y, c.y)),
        w: Math.max(dx, spec.minW),
        h: Math.max(dy, spec.minH)
      };
    }
    return {
      x: Math.round(s.x - spec.w / 2),
      y: Math.round(s.y - spec.h / 2),
      w: spec.w,
      h: spec.h
    };
  }

  function updateCreatePreview() {
    const rect = createRect(gesture);
    const at = vp().toScreen(rect.x, rect.y);
    previewEl.style.left = at.x + 'px';
    previewEl.style.top = at.y + 'px';
    previewEl.style.width = rect.w * vp().k + 'px';
    previewEl.style.height = rect.h * vp().k + 'px';
    previewEl.dataset.kind = tools.active;
  }

  function beginCreate(e) {
    const start = vp().toWorldFromClient(e.clientX, e.clientY);
    gesture = { type: 'create', start, current: start };
    previewEl.hidden = false;
    previewEl.dataset.kind = tools.active;
    updateCreatePreview();
  }

  function commitCreate(g) {
    const kind = tools.active;
    const rect = createRect(g);
    const patch = {
      kind,
      x: rect.x,
      y: rect.y,
      w: rect.w,
      h: rect.h,
      name: defaultNameFor(kind),
      color: FD.store.kindSpec(kind).color
    };
    if (kind === 'shape') patch.shape = tools.shape;
    if (FD.app && FD.app.snap) {
      patch.x = Math.round(patch.x / FD.store.GRID) * FD.store.GRID;
      patch.y = Math.round(patch.y / FD.store.GRID) * FD.store.GRID;
    }
    const node = FD.store.addNode(patch);
    if (!node) return null;
    // a frame drawn over things picks them up
    if (kind === 'group') FD.store.adoptContained(node.id);
    sel.replace([node.id]);
    const dragged = Math.abs(g.current.x - g.start.x) > 12;
    if (kind !== 'sticker' && !dragged) beginInlineEdit(node.id);
    return node;
  }

  /* -------------------------------------------------------- inline writing */

  let inlineEdit = null;

  /**
   * Kinds whose text is meant to run over several lines. Everything else
   * commits on Enter and reaches for Shift+Enter when it needs a break.
   */
  function wrapsText(kind) {
    return kind === 'text' || kind === 'sticky' || kind === 'node';
  }

  function fieldEl(el) {
    return el.querySelector('.node-text');
  }

  function hitKindOf(nodeId) {
    const hit = FD.store.nodeAt(nodeId);
    return hit ? hit.node.kind : 'node';
  }

  function onInlineInput() {
    if (!inlineEdit) return;
    FD.store.updateNode(inlineEdit.id, { name: inlineEdit.target.textContent },
      { silent: true, silentHistory: true, trim: false });
  }

  function onInlineKey(e) {
    if (!inlineEdit) return;
    // the canvas shortcuts must not see any of this
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      endInlineEdit(true);
      return;
    }
    // a single-line element commits on Enter; anything that wraps takes a newline
    if (e.key === 'Enter' && !wrapsText(hitKindOf(inlineEdit.id)) && !e.shiftKey) {
      e.preventDefault();
      endInlineEdit(false);
    }
  }

  /**
   * Type straight onto the element. One text field, written where it sits —
   * `## ` makes a heading, `- ` makes a point. No dialog, no side panel.
   */
  function beginInlineEdit(nodeId, seed) {
    const hit = FD.store.nodeAt(nodeId);
    const el = FD.render.nodeEls.get(nodeId);
    if (!hit || !el) return false;
    if (inlineEdit && inlineEdit.id === nodeId) return true;
    if (inlineEdit) endInlineEdit(false);

    const target = fieldEl(el);
    if (!target) return false;

    inlineEdit = { id: nodeId, el, target, original: hit.node.name };
    el.classList.add('editing');
    el.dataset.editing = '1';
    FD.store.beginBatch();

    target.setAttribute('contenteditable', 'plaintext-only');
    target.spellcheck = false;
    target.addEventListener('input', onInlineInput);
    target.addEventListener('keydown', onInlineKey);
    target.addEventListener('blur', () => endInlineEdit(false), { once: true });

    // show the raw text while writing, the rendered markup while not
    target.textContent = String(hit.node.name == null ? '' : hit.node.name);
    if (seed != null && seed !== '') {
      target.textContent = seed;
      onInlineInput();
    }
    target.focus();

    const range = document.createRange();
    range.selectNodeContents(target);
    if (seed == null) range.collapse(false);
    else range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }

  function endInlineEdit(cancel) {
    if (!inlineEdit) return false;
    const edit = inlineEdit;
    inlineEdit = null;

    edit.target.removeEventListener('input', onInlineInput);
    edit.target.removeEventListener('keydown', onInlineKey);
    edit.target.removeAttribute('contenteditable');
    edit.el.classList.remove('editing');
    delete edit.el.dataset.editing;

    const raw = String(edit.target.textContent == null ? '' : edit.target.textContent);
    const value = cancel ? edit.original : raw.replace(/[ \t]+$/gm, '').trim();

    FD.store.updateNode(edit.id, { name: value }, { silentHistory: true });
    if (FD.store.endBatch()) FD.bus.emit('doc');
    else FD.store.persist(false);
    FD.render.nodesOnly();
    sel.changed();
    return true;
  }

  function isEditing() { return !!inlineEdit; }

  /* ----------------------------------------------------------- selection */

  const sel = {
    nodes: new Set(),
    edge: null,

    replace(ids) {
      this.nodes = new Set(ids || []);
      this.edge = null;
      this.changed();
    },
    add(ids) {
      (ids || []).forEach((id) => this.nodes.add(id));
      this.changed();
    },
    toggle(id) {
      if (this.nodes.has(id)) this.nodes.delete(id);
      else {
        this.nodes.add(id);
        this.edge = null;
      }
      this.changed();
    },
    selectEdge(id) {
      this.nodes.clear();
      this.edge = id;
      this.changed();
    },
    clear() {
      if (!this.nodes.size && !this.edge) return;
      this.nodes.clear();
      this.edge = null;
      this.changed();
    },
    all() {
      const flow = FD.store.currentFlow();
      this.nodes = new Set(flow ? flow.nodes.map((n) => n.id) : []);
      this.edge = null;
      this.changed();
    },
    first() {
      const id = this.nodes.values().next().value;
      return id ? FD.store.nodeAt(id) : null;
    },
    changed() {
      FD.bus.emit('selection');
    }
  };

  /* ------------------------------------------------------------ gestures */

  function beginPan(e) {
    gesture = { type: 'pan', startX: e.clientX, startY: e.clientY, ox: vp().x, oy: vp().y, moved: false };
    canvas.classList.add('panning');
    canvas.classList.remove('pan-ready');
  }

  function beginMarquee(e) {
    const start = vp().toWorldFromClient(e.clientX, e.clientY);
    gesture = { type: 'marquee', start, additive: e.shiftKey, base: new Set(sel.nodes) };
    marqueeEl.hidden = false;
  }

  function beginNodeDrag(e, nodeEl) {
    const id = nodeEl.dataset.id;
    if (e.shiftKey) sel.toggle(id);
    else if (!sel.nodes.has(id)) sel.replace([id]);
    if (!sel.nodes.has(id)) return;

    FD.store.beginBatch();
    const ids = Array.from(sel.nodes);
    // something inside a selected group already travels with it
    const carries = new Set();
    ids.forEach((nid) => {
      const hit = FD.store.nodeAt(nid);
      if (hit && FD.store.isContainer(hit.node)) {
        FD.store.descendantElementIds(nid).forEach((childId) => carries.add(childId));
      }
    });
    const origins = ids
      .filter((nid) => !carries.has(nid))
      .map((nid) => {
        const hit = FD.store.nodeAt(nid);
        return hit ? { id: nid, x: hit.node.x, y: hit.node.y } : null;
      })
      .filter(Boolean);

    gesture = {
      type: 'drag',
      start: vp().toWorldFromClient(e.clientX, e.clientY),
      origins,
      top: ids.filter((nid) => !carries.has(nid)),
      groupTarget: null,
      moved: false
    };
    canvas.classList.add('dragging');
  }

  function beginResize(e, nodeEl) {
    const hit = FD.store.nodeAt(nodeEl.dataset.id);
    if (!hit) return;
    sel.replace([hit.node.id]);
    FD.store.beginBatch();
    gesture = {
      type: 'resize',
      id: hit.node.id,
      start: vp().toWorldFromClient(e.clientX, e.clientY),
      w: hit.node.w,
      h: hit.node.h,
      moved: false
    };
  }

  /** The side of a node that faces a given point — where a link should land. */
  function sideFacing(node, x, y) {
    const dx = x - (node.x + node.w / 2);
    const dy = y - (node.y + node.h / 2);
    if (Math.abs(dx) / Math.max(node.w, 1) > Math.abs(dy) / Math.max(node.h, 1)) {
      return dx > 0 ? 'right' : 'left';
    }
    return dy > 0 ? 'bottom' : 'top';
  }

  function beginConnect(e, portEl) {
    const nodeEl = portEl.closest('.node');
    const hit = FD.store.nodeAt(nodeEl.dataset.id);
    if (!hit) return;
    const side = FD.store.SIDES.indexOf(portEl.dataset.side) >= 0 ? portEl.dataset.side : 'right';
    gesture = {
      type: 'connect',
      fromId: hit.node.id,
      side,
      moved: false
    };
    portEl.classList.add('armed');
    canvas.classList.add('connecting');
    const world = vp().toWorldFromClient(e.clientX, e.clientY);
    FD.render.showDraft(hit.node, world, { side });
  }

  function updatePinch() {
    const pts = Array.from(pointers.values());
    if (pts.length < 2) return;
    const [a, b] = pts;
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (!gesture || gesture.type !== 'pinch') {
      gesture = { type: 'pinch', startDist: dist, startK: vp().k, anchor: mid };
      return;
    }
    const factor = dist / gesture.startDist;
    const target = gesture.startK * factor;
    vp().zoomAt(target / vp().k, gesture.anchor.x, gesture.anchor.y);
  }

  function onPointerDown(e) {
    if (e.button === 2) return;
    if (FD.ui && FD.ui.closeMenu) FD.ui.closeMenu();

    // clicking into the element you are writing on just moves the caret
    if (e.target && e.target.isContentEditable) return;
    if (inlineEdit) endInlineEdit(false);

    lastPointer = { x: e.clientX, y: e.clientY };
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 2 && !gesture) {
      updatePinch();
      return;
    }
    if (gesture) return;

    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }

    const hit = hitTest(e.clientX, e.clientY);
    const edgeEl = hit.edge;
    const portEl = hit.port;
    const resizeEl = hit.resize;
    const nodeEl = hit.node;

    // A creation tool is armed: empty space starts a new element, but clicking
    // something that already exists selects it and drops back to the pointer.
    if (tools.active !== 'select' && e.button === 0 && !spaceDown && !nodeEl && !edgeEl) {
      beginCreate(e);
      return;
    }
    if (tools.active !== 'select' && (nodeEl || edgeEl)) setTool('select');

    if (e.button === 1 || spaceDown) { beginPan(e); return; }
    if (edgeEl) { sel.selectEdge(edgeEl.dataset.id); return; }
    if (portEl) { beginConnect(e, portEl); return; }
    if (resizeEl && nodeEl) { beginResize(e, nodeEl); return; }
    if (nodeEl) { beginNodeDrag(e, nodeEl); return; }
    if (e.shiftKey) { beginMarquee(e); return; }
    beginPan(e);
  }

  function onPointerMove(e) {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    lastPointer = { x: e.clientX, y: e.clientY };

    if (gesture && gesture.type === 'pinch') { updatePinch(); return; }
    if (!gesture) return;

    if (gesture.type === 'create') {
      gesture.current = vp().toWorldFromClient(e.clientX, e.clientY);
      updateCreatePreview();
      return;
    }

    if (gesture.type === 'pan') {
      const dx = e.clientX - gesture.startX;
      const dy = e.clientY - gesture.startY;
      if (Math.abs(dx) + Math.abs(dy) > 2) gesture.moved = true;
      vp().set({ x: gesture.ox + dx, y: gesture.oy + dy }, { persist: false });
      return;
    }

    if (gesture.type === 'marquee') {
      const current = vp().toWorldFromClient(e.clientX, e.clientY);
      const rect = {
        x: Math.min(gesture.start.x, current.x),
        y: Math.min(gesture.start.y, current.y),
        w: Math.abs(current.x - gesture.start.x),
        h: Math.abs(current.y - gesture.start.y)
      };
      const a = vp().toScreen(rect.x, rect.y);
      marqueeEl.style.left = a.x + 'px';
      marqueeEl.style.top = a.y + 'px';
      marqueeEl.style.width = rect.w * vp().k + 'px';
      marqueeEl.style.height = rect.h * vp().k + 'px';
      applyMarquee(rect, gesture);
      return;
    }

    if (gesture.type === 'drag') {
      const current = vp().toWorldFromClient(e.clientX, e.clientY);
      let dx = current.x - gesture.start.x;
      let dy = current.y - gesture.start.y;
      if (Math.abs(dx) > 0.4 || Math.abs(dy) > 0.4) gesture.moved = true;
      const snap = FD.app && FD.app.snap;
      gesture.origins.forEach((origin) => {
        let x = origin.x + dx;
        let y = origin.y + dy;
        if (snap) {
          x = Math.round(x / FD.store.GRID) * FD.store.GRID;
          y = Math.round(y / FD.store.GRID) * FD.store.GRID;
        }
        FD.store.updateNode(origin.id, { x: Math.round(x), y: Math.round(y) }, { silent: true, silentHistory: true });
      });
      const under = FD.store.groupAt(null, current.x, current.y);
      const target = under && gesture.top.indexOf(under.id) < 0 &&
        !gesture.top.some((tid) => FD.store.descendantElementIds(tid).indexOf(under.id) >= 0)
        ? under.id : null;
      gesture.groupTarget = target;
      FD.render.setDropTarget(target);
      FD.render.nodesOnly();
      return;
    }

    if (gesture.type === 'resize') {
      const current = vp().toWorldFromClient(e.clientX, e.clientY);
      const w = gesture.w + (current.x - gesture.start.x);
      const h = gesture.h + (current.y - gesture.start.y);
      gesture.moved = true;
      FD.store.updateNode(gesture.id, { w, h }, { silent: true, silentHistory: true });
      FD.render.nodesOnly();
      return;
    }

    if (gesture.type === 'connect') {
      const hit = FD.store.nodeAt(gesture.fromId);
      if (!hit) return;
      const world = vp().toWorldFromClient(e.clientX, e.clientY);
      const under = nodeUnder(e.clientX, e.clientY);
      const candidate = under && under !== gesture.fromId ? FD.store.nodeAt(under) : null;
      FD.render.setDropTarget(candidate ? under : null);
      // the far end snaps to whichever side is facing the cursor
      const landSide = candidate ? sideFacing(candidate.node, world.x, world.y) : gesture.side;
      FD.render.showDraft(hit.node, world, {
        side: gesture.side,
        valid: candidate ? !duplicateEdge(gesture, candidate.node.id) : true
      });
      gesture.landSide = landSide;
    }
  }

  function duplicateEdge(gesture, targetId) {
    const flow = FD.store.currentFlow();
    if (!flow) return false;
    return flow.edges.some((e) => e.from === gesture.fromId && e.to === targetId);
  }

  function applyMarquee(rect, g) {
    const flow = FD.store.currentFlow();
    if (!flow) return;
    const hits = flow.nodes.filter((n) => !(n.x > rect.x + rect.w || n.x + n.w < rect.x ||
      n.y > rect.y + rect.h || n.y + n.h < rect.y)).map((n) => n.id);
    const next = new Set(g.additive ? g.base : []);
    hits.forEach((id) => next.add(id));
    sel.nodes = next;
    sel.edge = null;
    FD.bus.emit('selection');
  }

  function hitTest(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    const closest = (selector) => (el && el.closest ? el.closest(selector) : null);
    return {
      el,
      node: closest('.node'),
      port: closest('.port'),
      resize: closest('.node-resize'),
      edge: closest('.edge')
    };
  }

  function nodeUnder(clientX, clientY) {
    const target = hitTest(clientX, clientY).node;
    return target ? target.dataset.id : null;
  }

  function edgeUnder(clientX, clientY) {
    const target = hitTest(clientX, clientY).edge;
    return target ? target.dataset.id : null;
  }

  function onPointerUp(e) {
    pointers.delete(e.pointerId);
    if (!gesture) return;
    const g = gesture;
    gesture = null;

    try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    canvas.classList.remove('panning', 'dragging', 'connecting');
    marqueeEl.hidden = true;
    previewEl.hidden = true;
    FD.render.setDropTarget(null);
    FD.render.clearDraft();

    nodeLayer.querySelectorAll('.port.armed').forEach((p) => p.classList.remove('armed'));

    if (g.type === 'create') {
      const node = commitCreate(g);
      if (node && FD.ui) {
        FD.ui.toast(FD.store.kindSpec(node.kind).label + ' added.', { duration: 1500 });
      }
      return;
    }

    if (g.type === 'pan') {
      const moved = g.moved;
      if (!moved) sel.clear();
      canvas.classList.toggle('pan-ready', spaceDown);
      FD.store.persist(false);
      return;
    }

    if (g.type === 'marquee') {
      if (!g.additive && !g.moved) sel.clear();
      return;
    }

    if (g.type === 'connect') {
      const targetId = nodeUnder(e.clientX, e.clientY);
      if (targetId && targetId !== g.fromId) {
        const world = vp().toWorldFromClient(e.clientX, e.clientY);
        const target = FD.store.nodeAt(targetId);
        const edge = FD.store.addEdge(g.fromId, targetId, '', {
          fromSide: g.side,
          toSide: target ? sideFacing(target.node, world.x, world.y) : 'left'
        });
        if (edge) sel.selectEdge(edge.id);
        else if (FD.ui) FD.ui.toast('Those two are already connected.', { type: 'info' });
      }
      return;
    }

    if (g.type === 'drag' || g.type === 'resize') {
      if (g.type === 'drag' && g.moved && g.groupTarget !== undefined) {
        const moved = FD.store.setParent(g.top, g.groupTarget);
        if (moved) {
          FD.store.persist(false);
          FD.bus.emit('doc');
          return;
        }
      }
      gestureCommit(g.moved);
    }
  }

  function gestureCommit(changed) {
    const recorded = FD.store.endBatch();
    if (recorded || changed) {
      FD.store.persist(false);
      FD.bus.emit('doc');
    }
  }

  /* -------------------------------------------------------- double click */

  // Hit-test by coordinate: while a pointer gesture is active the canvas holds
  // pointer capture, which retargets the compatibility mouse events (and so
  // `e.target` would be the canvas rather than the node under the cursor).
  function onDoubleClick(e) {
    if (tools.active !== 'select') return;

    const nodeId = nodeUnder(e.clientX, e.clientY);
    if (nodeId) {
      const hit = FD.store.nodeAt(nodeId);
      if (!hit) return;
      const hasCanvas = !!(hit.node.child && FD.store.flow(hit.node.child));
      // a node with a canvas keeps double-click as "step inside"; anywhere else
      // a double-click puts the caret in the element's own text
      if (hasCanvas) openNode(nodeId);
      else beginInlineEdit(nodeId);
      return;
    }
    const edgeId = edgeUnder(e.clientX, e.clientY);
    if (edgeId) {
      editEdgeLabel(edgeId);
      return;
    }
    const flow = FD.store.currentFlow();
    if (!flow) return;
    const world = vp().toWorldFromClient(e.clientX, e.clientY);
    addNodeAt(world, { kind: 'node', select: true, editName: true });
  }

  async function editEdgeLabel(edgeId) {
    const flow = FD.store.currentFlow();
    const edge = flow && flow.edges.find((x) => x.id === edgeId);
    if (!edge) return;
    const label = await ui().prompt({
      title: 'Connection label',
      label: 'Label',
      value: edge.label || '',
      placeholder: 'e.g. approved',
      confirmText: 'Save'
    });
    if (label === null) return;
    FD.store.updateEdge(edgeId, { label });
  }

  /* ------------------------------------------------------------- actions */

  function addNodeAt(world, opts) {
    const options = opts || {};
    const kind = FD.store.KINDS[options.kind] ? options.kind : 'node';
    const spec = FD.store.kindSpec(kind);
    const patch = {
      kind,
      name: options.name !== undefined ? options.name : defaultNameFor(kind),
      color: options.color || spec.color,
      x: Math.round(world.x - spec.w / 2),
      y: Math.round(world.y - spec.h / 2),
      snap: FD.app && FD.app.snap
    };
    if (kind === 'shape') patch.shape = options.shape || tools.shape;

    const node = FD.store.addNode(patch);
    if (!node) return null;
    if (kind === 'group') FD.store.adoptContained(node.id);
    sel.replace([node.id]);
    if (options.editName) beginInlineEdit(node.id);
    if (FD.ui) FD.ui.toast(spec.label + ' added.', { duration: 1600 });
    return node;
  }

  function addNodeCentred() {
    const kind = tools.active === 'select' ? 'node' : tools.active;
    return addNodeAt(vp().spawnPosition(), { kind, shape: tools.shape, editName: true });
  }

  async function openNode(nodeId) {
    const hit = FD.store.nodeAt(nodeId);
    if (!hit) return;
    if (!FD.store.kindSpec(hit.node.kind).subflow) return;
    const node = hit.node;
    const flowId = hit.flow.id;

    if (flowId !== FD.store.currentFlowId) {
      FD.store.setCurrentFlow(flowId);
      sel.replace([nodeId]);
    }

    if (!node.child || !FD.store.flow(node.child)) {
      const name = await ui().prompt({
        title: 'Open a new canvas',
        message: '"' + node.name + '" will hold its own flow. Name it, then step inside.',
        label: 'Flow name',
        value: node.name,
        confirmText: 'Open canvas'
      });
      if (name === null) return;
      const child = FD.store.createSubFlow(nodeId, name);
      if (!child) return;
      if (ui()) ui().toast('Created sub-flow "' + child.name + '".', { type: 'ok' });
    }

    enterFlow(FD.store.nodeAt(nodeId).node.child, nodeId);
  }

  function enterFlow(flowId) {
    const flow = FD.store.flow(flowId);
    if (!flow) return;
    sel.clear();
    FD.store.setCurrentFlow(flowId);
    if (ui()) ui().toast('Inside "' + flow.name + '" — Alt+Left goes back up.', { duration: 2600 });
  }

  function goUp() {
    const parent = FD.store.parentOf(FD.store.currentFlowId);
    if (!parent) {
      if (ui()) ui().toast('This is the top-level flow.', { duration: 1800 });
      return false;
    }
    const hit = FD.store.nodeAt(parent.nodeId);
    FD.store.setCurrentFlow(parent.flowId);
    sel.replace([parent.nodeId]);
    if (hit) vp().centerOn(hit.node.x + hit.node.w / 2, hit.node.y + hit.node.h / 2);
    return true;
  }

  function goToFlow(flowId) {
    if (!FD.store.flow(flowId)) return;
    const via = FD.store.parentOf(flowId);
    FD.store.setCurrentFlow(flowId);
    sel.replace(via ? [via.nodeId] : []);
  }

  async function deleteSelection() {
    const ids = Array.from(sel.nodes);
    const edgeId = sel.edge;

    if (edgeId) {
      FD.store.removeEdges(edgeId);
      sel.edge = null;
      sel.changed();
      if (!ids.length) return;
    }
    if (!ids.length) return;

    let nested = 0;
    ids.forEach((id) => {
      const hit = FD.store.nodeAt(id);
      if (hit && hit.node.child) nested += FD.store.descendantFlowIds(hit.node.child).length;
    });

    if (nested > 0) {
      const ok = await ui().confirm({
        title: 'Delete ' + ids.length + (ids.length === 1 ? ' node' : ' nodes') + '?',
        message: 'This also deletes ' + nested + (nested === 1 ? ' nested flow' : ' nested flows') +
          ' stored inside ' + (ids.length === 1 ? 'this node' : 'these nodes') + '.',
        confirmText: 'Delete everything',
        danger: true
      });
      if (!ok) return;
    }

    const result = FD.store.removeNodes(ids);
    sel.clear();
    if (ui()) ui().toast('Deleted ' + result.nodes + (result.nodes === 1 ? ' node' : ' nodes') +
      (result.flows ? ' and ' + result.flows + ' sub-flow' + (result.flows === 1 ? '' : 's') : '') + '.', {
      type: 'ok',
      action: { label: 'Undo', onClick: () => { FD.store.undo(); } }
    });
  }

  function nudge(dx, dy) {
    if (!sel.nodes.size) return;
    FD.store.beginBatch();
    sel.nodes.forEach((id) => {
      const hit = FD.store.nodeAt(id);
      if (hit) FD.store.updateNode(id, { x: hit.node.x + dx, y: hit.node.y + dy },
        { silent: true, silentHistory: true });
    });
    FD.store.endBatch();
    FD.render.nodesOnly();
    FD.store.persist(false);
  }

  /* --------------------------------------------------------------- events */

  function isTyping(e) {
    const t = e.target;
    if (!t || !t.tagName) return false;
    const tag = t.tagName.toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
  }

  function onKeyDown(e) {
    const mod = e.ctrlKey || e.metaKey;

    if (e.code === 'Space' && !isTyping(e) && !spaceDown) {
      spaceDown = true;
      if (!gesture) canvas.classList.add('pan-ready');
      e.preventDefault();
      return;
    }

    if (isTyping(e)) {
      if (e.key === 'Escape') e.target.blur();
      return;
    }

    if (FD.ui && FD.ui.handleShortcut && FD.ui.handleShortcut(e)) return;

    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) FD.store.redo(); else FD.store.undo();
      return;
    }
    if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      FD.store.redo();
      return;
    }
    if (mod && e.key.toLowerCase() === 'g') {
      e.preventDefault();
      const ids = Array.from(sel.nodes);
      if (e.shiftKey) {
        const freed = FD.store.ungroup(ids);
        if (freed) {
          sel.clear();
          if (ui()) ui().toast('Ungrouped ' + freed + (freed === 1 ? ' item.' : ' items.'));
        }
      } else if (ids.length) {
        const group = FD.store.groupSelection(ids, 'Group');
        if (group) {
          sel.replace([group.id]);
          if (ui()) ui().focusName();
        }
      }
      return;
    }
    if (mod && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      sel.all();
      return;
    }
    if (mod && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      const created = FD.store.duplicateNodes(Array.from(sel.nodes));
      if (created.length) {
        sel.replace(created);
        if (ui()) ui().toast('Duplicated ' + created.length + (created.length === 1 ? ' node' : ' nodes') + '.');
      }
      return;
    }
    if (mod && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      if (FD.store.autoLayout()) if (ui()) ui().toast('Tidied up the layout.');
      return;
    }
    if (mod && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (FD.exporter) FD.exporter.downloadJSON();
      return;
    }
    if (mod && (e.key === '0')) {
      e.preventDefault();
      vp().setZoom(1);
      return;
    }
    if (mod && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      vp().zoomAt(1.2, vp().rect().left + vp().rect().width / 2, vp().rect().top + vp().rect().height / 2);
      return;
    }
    if (mod && e.key === '-') {
      e.preventDefault();
      const r = vp().rect();
      vp().zoomAt(1 / 1.2, r.left + r.width / 2, r.top + r.height / 2);
      return;
    }
    if (mod) return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      deleteSelection();
      return;
    }
    if (e.key === 'Escape') {
      if (gesture) return;
      if (tools.active !== 'select') {
        setTool('select');
        return;
      }
      sel.clear();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const first = sel.first();
      if (first) openNode(first.node.id);
      return;
    }
    if (e.key === 'F2') {
      e.preventDefault();
      const first = sel.first();
      if (first) beginInlineEdit(first.node.id);
      return;
    }
    if (e.key === '!' || (e.shiftKey && e.key === '1')) {
      e.preventDefault();
      vp().fit();
      return;
    }
    if (e.key.toLowerCase() === 'f') {
      e.preventDefault();
      vp().fit();
      return;
    }
    // typing with one element selected writes on it, rather than firing a
    // single-letter tool shortcut
    if (sel.nodes.size === 1 && e.key.length === 1 && !mod && !e.altKey) {
      const only = sel.first();
      if (only) {
        e.preventDefault();
        beginInlineEdit(only.node.id, e.key);
        return;
      }
    }

    if (e.key.toLowerCase() === 'n') {
      e.preventDefault();
      setTool('node');
      return;
    }
    const toolKeys = { v: 'select', s: 'sticky', t: 'text', e: 'sticker', r: 'shape', g: 'group', p: 'preview' };
    const toolKey = toolKeys[e.key.toLowerCase()];
    if (toolKey && !e.altKey) {
      e.preventDefault();
      setTool(toolKey);
      return;
    }
    if (e.altKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      goUp();
      return;
    }
    if (e.key.toLowerCase() === 'z' && sel.nodes.size === 1) {
      const first = sel.first();
      vp().centerOn(first.node.x + first.node.w / 2, first.node.y + first.node.h / 2);
      return;
    }
    if (e.key.indexOf('Arrow') === 0) {
      e.preventDefault();
      const step = e.shiftKey ? 20 : 1;
      if (e.key === 'ArrowLeft') nudge(-step, 0);
      else if (e.key === 'ArrowRight') nudge(step, 0);
      else if (e.key === 'ArrowUp') nudge(0, -step);
      else if (e.key === 'ArrowDown') nudge(0, step);
      return;
    }
  }

  function onKeyUp(e) {
    if (e.code === 'Space') {
      spaceDown = false;
      canvas.classList.remove('pan-ready');
    }
  }

  /** A wheel delta arrives in pixels, lines or pages depending on the device. */
  function wheelPixels(e) {
    if (e.deltaMode === 1) return e.deltaY * 16;
    if (e.deltaMode === 2) return e.deltaY * 400;
    return e.deltaY;
  }

  // A mouse wheel fires one big notch, a trackpad dozens of tiny ones. Damping
  // the step and capping it means both land on roughly the same zoom, and a
  // fast flick cannot throw the view across the canvas.
  const ZOOM_PER_PIXEL = 0.0016;
  const ZOOM_STEP_CAP = 90;

  function onWheel(e) {
    if (e.target.closest && e.target.closest('.minimap, .sidebar, .modal')) return;
    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      const step = Math.max(-ZOOM_STEP_CAP, Math.min(ZOOM_STEP_CAP, wheelPixels(e)));
      vp().zoomAt(Math.exp(-step * ZOOM_PER_PIXEL), e.clientX, e.clientY);
      return;
    }

    const unit = e.deltaMode === 1 ? 18 : e.deltaMode === 2 ? 320 : 1;
    if (e.shiftKey && !e.deltaX) {
      vp().panBy(-e.deltaY * unit, 0);
      return;
    }
    vp().panBy(-e.deltaX * unit, -e.deltaY * unit);
  }

  function onContextMenu(e) {
    e.preventDefault();
    const hit = hitTest(e.clientX, e.clientY);
    const nodeEl = hit.node;
    const edgeEl = hit.edge;
    const world = vp().toWorldFromClient(e.clientX, e.clientY);

    if (nodeEl) {
      const id = nodeEl.dataset.id;
      if (!sel.nodes.has(id)) sel.replace([id]);
      openNodeMenu(e.clientX, e.clientY, id);
    } else if (edgeEl) {
      const id = edgeEl.dataset.id;
      sel.selectEdge(id);
      openEdgeMenu(e.clientX, e.clientY, id);
    } else {
      openCanvasMenu(e.clientX, e.clientY, world);
    }
  }

  function openNodeMenu(x, y, id) {
    const hit = FD.store.nodeAt(id);
    if (!hit) return;
    const node = hit.node;
    const spec = FD.store.kindSpec(node.kind);
    const hasChild = !!(node.child && FD.store.flow(node.child));
    const many = sel.nodes.size > 1;

    /** Every selected element, or just the one that was right-clicked. */
    const targets = () => {
      const picked = Array.from(sel.nodes).filter((n) => FD.store.nodeAt(n));
      return picked.length ? picked : [id];
    };
    const paint = (targetIds, patch) =>
      FD.store.updateNodes(targetIds.map((n) => ({ id: n, patch })));

    const items = [
      { label: 'Write', icon: 'i-pencil', kbd: 'F2', action: () => beginInlineEdit(id) },
      'sep',
      { label: 'Duplicate', icon: 'i-duplicate', kbd: 'Ctrl D', action: () => {
        const created = FD.store.duplicateNodes(Array.from(sel.nodes));
        if (created.length) sel.replace(created);
      } },
      'sep',
      {
        type: 'swatches',
        label: 'Fill',
        value: node.color,
        colors: FD.store.COLORS,
        action: (color) => paint(targets(), { color })
      },
      {
        type: 'swatches',
        label: 'Text colour',
        value: node.textColor || '',
        colors: FD.store.TEXT_COLORS,
        action: (textColor) => paint(targets(), { textColor: textColor === (node.textColor || '') ? '' : textColor })
      }
    ];

    if (spec.subflow) {
      items.push('sep');
      items.push({
        label: hasChild ? 'Open sub-flow' : 'Open a new canvas',
        icon: 'i-layers', kbd: 'Enter', action: () => openNode(id)
      });
      items.push({
        label: 'Add sub-flow', icon: 'i-plus', disabled: hasChild, action: async () => {
          const name = await ui().prompt({ title: 'Add sub-flow', label: 'Flow name', value: node.name + ' detail' });
          if (name === null) return;
          FD.store.createSubFlow(id, name);
        }
      });
      items.push({
        label: 'Remove sub-flow', icon: 'i-x', disabled: !hasChild, danger: true, action: async () => {
          const count = FD.store.descendantFlowIds(node.child).length;
          const ok = await ui().confirm({
            title: 'Remove sub-flow?',
            message: '"' + (FD.store.flow(node.child) || {}).name + '" and ' + (count - 1) +
              ' nested flow(s) will be deleted. The node itself stays.',
            confirmText: 'Remove',
            danger: true
          });
          if (ok) FD.store.detachFlow(id);
        }
      });
    }

    items.push('sep');
    items.push({
      label: many ? 'Delete ' + sel.nodes.size + ' nodes' : 'Delete',
      icon: 'i-trash', danger: true, kbd: 'Del', action: () => deleteSelection()
    });

    ui().showMenu(x, y, items);
  }

  function openEdgeMenu(x, y, id) {
    const flow = FD.store.currentFlow();
    const edge = flow && flow.edges.find((e) => e.id === id);
    if (!edge) return;
    const from = FD.store.nodeAt(edge.from);
    const to = FD.store.nodeAt(edge.to);
    ui().showMenu(x, y, [
      { label: 'Rename connection', icon: 'i-pencil', action: () => editEdgeLabel(id) },
      { label: (from ? from.node.name : '?') + ' → ' + (to ? to.node.name : '?'), icon: 'i-node', disabled: true, action: () => {} },
      'sep',
      { label: 'Delete connection', icon: 'i-trash', danger: true, kbd: 'Del', action: () => {
        FD.store.removeEdges(id);
        sel.edge = null;
        sel.changed();
      } }
    ]);
  }

  function openCanvasMenu(x, y, world) {
    const hasSelection = sel.nodes.size > 0;
    ui().showMenu(x, y, [
      { label: 'Add node here', icon: 'i-plus', kbd: 'N', action: () => addNodeAt(world, { select: true, editName: true }) },
      { label: 'Add node with its own canvas', icon: 'i-layers', action: async () => {
        const name = await ui().prompt({ title: 'Name the node', label: 'Node name', value: 'New flow' });
        if (name === null) return;
        const { NODE_W, NODE_H } = FD.store;
        const made = FD.store.createNodeWithFlow(name, {
          x: Math.round(world.x - NODE_W / 2),
          y: Math.round(world.y - NODE_H / 2),
          snap: FD.app && FD.app.snap
        });
        if (made) sel.replace([made.node.id]);
      } },
      'sep',
      { label: 'Select all', icon: 'i-check', kbd: 'Ctrl A', action: () => sel.all() },
      { label: 'Group', icon: 'i-group', kbd: 'Ctrl G', disabled: sel.nodes.size < 2, action: () => {
        const group = FD.store.groupSelection(Array.from(sel.nodes), 'Group');
        if (group) {
          sel.replace([group.id]);
          ui().focusName();
        }
      } },
      { label: 'Align left', icon: 'i-align-left', disabled: sel.nodes.size < 2, action: () => ui().alignNodes('left') },
      { label: 'Align top', icon: 'i-align-top', disabled: sel.nodes.size < 2, action: () => ui().alignNodes('top') },
      { label: 'Distribute horizontally', icon: 'i-dist-h', disabled: sel.nodes.size < 3, action: () => ui().alignNodes('dist-h') },
      { label: 'Distribute vertically', icon: 'i-dist-v', disabled: sel.nodes.size < 3, action: () => ui().alignNodes('dist-v') },
      'sep',
      { label: 'Tidy up layout', icon: 'i-layout', kbd: 'Ctrl L', action: () => FD.store.autoLayout() },
      { label: 'Fit to view', icon: 'i-fit', kbd: 'F', action: () => vp().fit() },
      'sep',
      { label: 'Duplicate selection', icon: 'i-duplicate', kbd: 'Ctrl D', disabled: !hasSelection, action: () => {
        const created = FD.store.duplicateNodes(Array.from(sel.nodes));
        if (created.length) sel.replace(created);
      } }
    ]);
  }

  /* ------------------------------------------------------------ clipboard */

  function onCopy(e) {
    if (isTyping(e)) return;
    if (!sel.nodes.size) return;
    const flow = FD.store.currentFlow();
    if (!flow) return;
    const payload = {
      flow: { name: flow.name, view: flow.view, nodes: [], edges: [] }
    };
    const ids = new Set(sel.nodes);
    payload.flow.nodes = flow.nodes.filter((n) => ids.has(n.id)).map((n) => JSON.parse(JSON.stringify(n)));
    payload.flow.edges = flow.edges.filter((e) => ids.has(e.from) && ids.has(e.to));
    e.clipboardData.setData('application/json', JSON.stringify(payload));
    e.clipboardData.setData('text/plain', JSON.stringify(payload, null, 2));
    e.preventDefault();
    if (ui()) ui().toast('Copied ' + ids.size + (ids.size === 1 ? ' node' : ' nodes') + ' as JSON.', { duration: 2000 });
  }

  async function onPaste(e) {
    if (isTyping(e)) return;
    const text = e.clipboardData && e.clipboardData.getData('application/json');
    if (!text) return;
    let parsed;
    try { parsed = JSON.parse(text); } catch (err) { return; }
    if (!parsed || !parsed.flow || !Array.isArray(parsed.flow.nodes)) return;
    e.preventDefault();
    pasteNodes(parsed.flow);
  }

  function pasteNodes(sourceFlow) {
    const flow = FD.store.currentFlow();
    if (!flow) return;
    FD.store.beginBatch();
    const idMap = new Map();
    const centre = vp().centerPosition();
    const baseX = centre.x - FD.store.NODE_W / 2;
    const baseY = centre.y - FD.store.NODE_H / 2;
    const minX = Math.min.apply(null, sourceFlow.nodes.map((n) => n.x));
    const minY = Math.min.apply(null, sourceFlow.nodes.map((n) => n.y));

    sourceFlow.nodes.forEach((raw) => {
      const node = FD.store.addNode({
        kind: raw.kind,
        name: raw.name,
        shape: raw.shape,
        color: raw.color,
        textColor: raw.textColor,
        x: Math.round(baseX + (raw.x - minX)),
        y: Math.round(baseY + (raw.y - minY)),
        w: raw.w,
        h: raw.h
      });
      if (node) idMap.set(raw.id, node.id);
    });

    (sourceFlow.edges || []).forEach((e) => {
      const from = idMap.get(e.from);
      const to = idMap.get(e.to);
      if (from && to) {
        FD.store.addEdge(from, to, e.label, { fromSide: e.fromSide, toSide: e.toSide });
      }
    });

    FD.store.endBatch();
    FD.bus.emit('doc');
    sel.replace(Array.from(idMap.values()));
    if (ui()) ui().toast('Pasted ' + idMap.size + (idMap.size === 1 ? ' node' : ' nodes') + '.');
  }

  /* ------------------------------------------------------------- file drop */

  function initFileDrop() {
    const wrap = document.getElementById('canvas-wrap');
    if (!wrap) return;
    wrap.addEventListener('dragover', (e) => {
      if (!e.dataTransfer || Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') < 0) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });
    wrap.addEventListener('drop', (e) => {
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) return;
      e.preventDefault();
      const reader = new FileReader();
      reader.onload = () => {
        if (FD.app && FD.app.importText) FD.app.importText(String(reader.result));
      };
      reader.readAsText(file);
    });
  }

  /* ----------------------------------------------------------------- init */

  function init() {
    canvas = document.getElementById('canvas');
    nodeLayer = document.getElementById('node-g');
    marqueeEl = document.getElementById('marquee');
    previewEl = document.getElementById('create-preview');

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('dblclick', onDoubleClick);
    canvas.addEventListener('contextmenu', onContextMenu);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('dragstart', (e) => e.preventDefault());

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', () => { spaceDown = false; canvas.classList.remove('pan-ready'); });

    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);

    initFileDrop();
  }

  FD.sel = sel;

  FD.actions = {
    init,
    setTool,
    addNodeAt,
    addNodeCentred,
    openNode,
    enterFlow,
    goUp,
    goToFlow,
    deleteSelection,
    pasteNodes,
    beginInlineEdit,
    endInlineEdit,
    openNodeMenu,
    isEditing,
    get tool() { return toolState(); },
    get lastPointer() { return lastPointer; }
  };
})(window.FD = window.FD || {});
