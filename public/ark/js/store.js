/* ==========================================================================
   store.js — document model, nested flows, history and persistence.

   Document shape
   --------------
   {
     version: 1,
     title: "Untitled",
     createdAt, updatedAt,
     rootId: "flow_x",
     flows: {
       "flow_x": {
         id, name,
         view: { x, y, k },                          // per-flow pan + zoom
         nodes: [{ id, name, x, y, w, h, color, notes, child }],
         edges: [{ id, from, to, label }]
       }
     }
   }

   `node.child` is the id of another entry in `flows` — that is the whole
   nesting mechanism. Double-clicking such a node navigates into it.
   ========================================================================== */
(function (FD) {
  'use strict';

  const VERSION = 1;
  const DOC_KEY = 'ark.doc.v1';
  const UI_KEY = 'ark.ui.v1';
  const LEGACY_KEYS = { 'ark.doc.v1': 'flow.designer.doc.v1', 'ark.ui.v1': 'flow.designer.ui.v1' };
  const MAX_HISTORY = 120;

  /** Carry anything saved under the app's previous name across. */
  function migrateLegacyKeys() {
    Object.keys(LEGACY_KEYS).forEach((key) => {
      try {
        if (localStorage.getItem(key)) return;
        const old = localStorage.getItem(LEGACY_KEYS[key]);
        if (old) localStorage.setItem(key, old);
      } catch (err) { /* storage may be unavailable */ }
    });
  }

  function readStored(key) {
    try { return localStorage.getItem(key); } catch (err) { return null; }
  }

  const COLORS = ['indigo', 'violet', 'sky', 'cyan', 'emerald', 'amber', 'rose', 'slate'];
  /** Ink for the text itself; the empty string means "follow the element". */
  const TEXT_COLORS = ['', 'slate', 'indigo', 'violet', 'sky', 'cyan', 'emerald', 'amber', 'rose'];
  const GRID = 24;

  /**
   * Every item on a canvas is an "element". The kind decides how it draws,
   * what it defaults to, and whether it can be wired to anything.
   * An element's text is written with the little markup in md.js.
   */
  const KINDS = {
    node: {
      label: 'Node', hint: '## Heading, then - points',
      w: 220, h: 84, minW: 150, minH: 60, maxW: 640, maxH: 560,
      text: '', color: 'slate', ports: true, subflow: true, grows: true
    },
    sticky: {
      label: 'Sticky', hint: 'Write anything',
      w: 190, h: 190, minW: 110, minH: 110, maxW: 640, maxH: 640,
      text: '', color: 'amber', ports: true, subflow: false
    },
    text: {
      label: 'Text', hint: '## Heading or plain words',
      w: 240, h: 52, minW: 80, minH: 32, maxW: 900, maxH: 600,
      text: '', color: 'slate', ports: false, subflow: false, grows: true
    },
    sticker: {
      label: 'Sticker', hint: 'An emoji',
      w: 96, h: 96, minW: 48, minH: 48, maxW: 420, maxH: 420,
      text: '⭐', color: 'amber', ports: false, subflow: false, centre: true
    },
    shape: {
      label: 'Shape', hint: 'A label',
      w: 170, h: 110, minW: 70, minH: 50, maxW: 900, maxH: 700,
      text: '', color: 'slate', ports: true, subflow: false, centre: true
    },
    group: {
      label: 'Group', hint: 'Name the frame',
      w: 440, h: 320, minW: 180, minH: 130, maxW: 4000, maxH: 3000,
      text: '', color: 'slate', ports: false, subflow: false, chrome: true,
      container: true
    },
    preview: {
      label: 'Preview', hint: 'Pulls in what is inside',
      w: 340, h: 260, minW: 200, minH: 140, maxW: 900, maxH: 900,
      text: '', color: 'slate', ports: true, subflow: true, output: true
    }
  };
  const SHAPES = ['rect', 'ellipse', 'diamond'];
  const SIDES = ['top', 'right', 'bottom', 'left'];
  const KIND_NAMES = Object.keys(KINDS);

  /** Statuses get a colour dot; anything else is simply neutral. */
  const STATUS_TONES = [
    [/^(done|complete|complete[d]?|ready|ok|shipped|green)$/i, 'done'],
    [/^(doing|wip|in ?progress|active|running)$/i, 'doing'],
    [/^(blocked|error|failed|stuck|red)$/i, 'blocked']
  ];

  const NODE_W = KINDS.node.w;
  const NODE_H = KINDS.node.h;
  const MIN_W = KINDS.node.minW;
  const MIN_H = KINDS.node.minH;
  const MAX_W = KINDS.node.maxW;
  const MAX_H = KINDS.node.maxH;

  function kindSpec(kind) { return KINDS[kind] || KINDS.node; }

  /* ------------------------------------------------------------- helpers */

  let seq = 0;
  function uid(prefix) {
    seq += 1;
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + seq.toString(36) +
      Math.random().toString(36).slice(2, 5);
  }

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

  function asString(v, fallback, max) {
    if (typeof v !== 'string') v = v == null ? '' : String(v);
    v = v.trim();
    if (max && v.length > max) v = v.slice(0, max);
    return v || fallback;
  }

  function asNumber(v, fallback) {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  }

  /** Like asString, but keeps whitespace — used while someone is typing. */
  function asText(v, max) {
    let out = typeof v === 'string' ? v : (v == null ? '' : String(v));
    if (max && out.length > max) out = out.slice(0, max);
    return out;
  }

  function pick(obj, keys) {
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null) return obj[k];
    }
    return undefined;
  }

  /* --------------------------------------------------------- event bus */

  const listeners = new Map();

  FD.bus = {
    on(evt, fn) {
      if (!listeners.has(evt)) listeners.set(evt, new Set());
      listeners.get(evt).add(fn);
      return () => FD.bus.off(evt, fn);
    },
    off(evt, fn) {
      const set = listeners.get(evt);
      if (set) set.delete(fn);
    },
    emit(evt, payload) {
      const set = listeners.get(evt);
      if (set) set.forEach((fn) => { try { fn(payload); } catch (err) { console.error(err); } });
      const any = listeners.get('*');
      if (any) any.forEach((fn) => { try { fn(evt, payload); } catch (err) { console.error(err); } });
    }
  };

  /* ------------------------------------------------------- doc factories */

  function makeFlow(id, name) {
    return {
      id: id || uid('flow'),
      name: name || 'Untitled canvas',
      view: { x: 0, y: 0, k: 1 },
      nodes: [],
      edges: []
    };
  }

  function makeNode(patch) {
    patch = patch || {};
    const kind = KINDS[patch.kind] ? patch.kind : 'node';
    const spec = kindSpec(kind);
    // one text field, written with the little markup in md.js
    const raw = patch.text !== undefined ? patch.text : (patch.name !== undefined ? patch.name : spec.text);
    const node = {
      id: patch.id || uid('n'),
      kind,
      name: asText(raw === undefined ? '' : raw, 4000),
      x: Math.round(asNumber(patch.x, 0)),
      y: Math.round(asNumber(patch.y, 0)),
      w: clamp(Math.round(asNumber(patch.w, spec.w)), spec.minW, spec.maxW),
      h: clamp(Math.round(asNumber(patch.h, spec.h)), spec.minH, spec.maxH),
      color: COLORS.indexOf(patch.color) >= 0 ? patch.color : spec.color,
      type: asString(patch.type, spec.type || '', 40),
      status: asString(patch.status, '', 40),
      child: null,
      parent: null
    };
    // a document saved before elements were one text field still reads
    if (patch.notes) node.name = joinText(node.name, asText(patch.notes, 4000));
    if (typeof patch.child === 'string' && patch.child) node.child = patch.child;
    if (typeof patch.parent === 'string' && patch.parent) node.parent = patch.parent;
    if (kind === 'shape') {
      node.shape = SHAPES.indexOf(patch.shape) >= 0 ? patch.shape : 'rect';
    }
    return node;
  }

  function joinText(head, tail) {
    const a = String(head == null ? '' : head).trim();
    const b = String(tail == null ? '' : tail).trim();
    if (!a) return b;
    if (!b) return a;
    return a + '\n' + b;
  }

  /** '' means "inherit", so the key is simply dropped. */
  function applyTextColor(node, value) {
    const key = TEXT_COLORS.indexOf(value) > 0 ? value : '';
    if (key) node.textColor = key;
    else delete node.textColor;
  }

  function isContainer(node) {
    return !!(node && kindSpec(node.kind).container);
  }

  function statusTone(status) {
    if (!status) return 'none';
    for (const [pattern, tone] of STATUS_TONES) {
      if (pattern.test(status.trim())) return tone;
    }
    return 'set';
  }

  function clampSize(node, w, h) {
    const spec = kindSpec(node.kind);
    node.w = clamp(Math.round(asNumber(w, node.w)), spec.minW, spec.maxW);
    node.h = clamp(Math.round(asNumber(h, node.h)), spec.minH, spec.maxH);
    return node;
  }

  function isConnectable(node) {
    return !!(node && kindSpec(node.kind).ports);
  }

  function makeDoc(title) {
    const rootId = uid('flow');
    return {
      version: VERSION,
      title: asString(title, 'Untitled', 120),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rootId,
      flows: { [rootId]: makeFlow(rootId, 'Main flow') }
    };
  }

  /* ------------------------------------------------------------ state */

  let doc = makeDoc();
  let currentFlowId = doc.rootId;
  const past = [];
  const future = [];
  let suspendDepth = 0;
  let suspendedSnapshot = null;
  let saveTimer = null;

  function flow(id) { return doc.flows[id] || null; }
  function currentFlow() { return doc.flows[currentFlowId] || doc.flows[doc.rootId] || null; }

  function nodeAt(id) {
    for (const f of Object.values(doc.flows)) {
      const n = f.nodes.find((x) => x.id === id);
      if (n) return { node: n, flow: f };
    }
    return null;
  }

  function nodesByIds(ids) {
    const found = [];
    const want = new Set(ids);
    for (const f of Object.values(doc.flows)) {
      for (const n of f.nodes) if (want.has(n.id)) found.push(n);
    }
    return found;
  }

  function parentOf(flowId) {
    for (const f of Object.values(doc.flows)) {
      for (const n of f.nodes) {
        if (n.child === flowId) return { flowId: f.id, nodeId: n.id, nodeName: n.name };
      }
    }
    return null;
  }

  function pathTo(flowId) {
    const chain = [];
    let id = flowId;
    let guard = 0;
    while (id && guard++ < 200) {
      const f = doc.flows[id];
      if (!f) break;
      chain.unshift({ flowId: id, name: f.name });
      const p = parentOf(id);
      if (!p) break;
      id = p.flowId;
    }
    return chain;
  }

  function breadcrumb() {
    return pathTo(currentFlowId).map((entry, i) => {
      const via = i > 0 ? parentOf(entry.flowId) : null;
      return {
        flowId: entry.flowId,
        name: entry.name,
        depth: i,
        viaNodeId: via ? via.nodeId : null
      };
    });
  }

  /* ------------------------------------------------------ element tree */

  function elementChildren(flowId, parentId) {
    const f = flow(flowId);
    if (!f) return [];
    const want = parentId || null;
    return f.nodes.filter((n) => (n.parent || null) === want);
  }

  function descendantElementIds(id) {
    const hit = nodeAt(id);
    if (!hit) return [];
    const out = [];
    const walk = (parentId) => {
      hit.flow.nodes.forEach((n) => {
        if (n.parent !== parentId) return;
        out.push(n.id);
        walk(n.id);
      });
    };
    walk(id);
    return out;
  }

  function elementDepth(node, f) {
    let depth = 0;
    let current = node;
    while (current && current.parent && depth < 80) {
      current = f.nodes.find((n) => n.id === current.parent);
      depth += 1;
    }
    return depth;
  }

  /**
   * A one-line label for an element's text — the heading if it has one, else
   * the first thing written.
   */
  function labelOf(node) {
    const text = String((node && node.name) || '');
    if (!text.trim()) return '';
    const head = FD.md && FD.md.heading(text);
    if (head) return head;
    const first = (FD.md ? FD.md.lines(text) : []).find((item) => item.text);
    return first ? first.text.slice(0, 64).trim() : '';
  }

  /** The canvas as a tree: groups hold elements, nodes may hold canvases. */
  function outlineTree(flowId) {
    const f = flow(flowId || currentFlowId);
    if (!f) return [];
    const build = (parentId) => f.nodes
      .filter((n) => (n.parent || null) === (parentId || null))
      .map((n) => {
        const child = n.child && flow(n.child) ? flow(n.child) : null;
        return {
          id: n.id,
          name: labelOf(n),
          kind: n.kind || 'node',
          flowId: f.id,
          children: isContainer(n) ? build(n.id) : [],
          childFlow: child ? { id: child.id, name: child.name, children: outlineTree(child.id) } : null
        };
      });
    return build(null);
  }

  function countTree(entries) {
    let groups = 0;
    let elements = 0;
    let canvases = 0;
    const walk = (list) => {
      list.forEach((entry) => {
        elements += 1;
        if (entry.kind === 'group') groups += 1;
        if (entry.children.length) walk(entry.children);
        if (entry.childFlow) {
          canvases += 1;
          walk(entry.childFlow.children);
        }
      });
    };
    walk(entries);
    return { groups, elements, canvases };
  }

  /* ----------------------------------------------------------- grouping */

  const GROUP_PAD = 24;
  const GROUP_HEAD = 36;

  function boundsOf(nodes) {
    const x1 = Math.min.apply(null, nodes.map((n) => n.x));
    const y1 = Math.min.apply(null, nodes.map((n) => n.y));
    const x2 = Math.max.apply(null, nodes.map((n) => n.x + n.w));
    const y2 = Math.max.apply(null, nodes.map((n) => n.y + n.h));
    return {
      x: Math.round(x1 - GROUP_PAD),
      y: Math.round(y1 - GROUP_PAD - GROUP_HEAD),
      w: Math.round(x2 - x1 + GROUP_PAD * 2),
      h: Math.round(y2 - y1 + GROUP_PAD * 2 + GROUP_HEAD)
    };
  }

  function groupSelection(ids, name) {
    const f = currentFlow();
    if (!f) return null;
    const picks = (Array.isArray(ids) ? ids : [ids])
      .map((id) => nodeAt(id))
      .filter((hit) => hit && hit.flow.id === f.id)
      .map((hit) => hit.node);
    if (!picks.length) return null;

    pushHistory();
    const box = boundsOf(picks);
    const parents = new Set(picks.map((n) => n.parent || null));
    const group = makeNode(Object.assign({ kind: 'group', name: name || 'Group' }, box));
    group.parent = parents.size === 1 ? [...parents][0] : null;
    f.nodes.push(group);
    picks.forEach((n) => { n.parent = group.id; });
    touch();
    return group;
  }

  function ungroup(ids) {
    const f = currentFlow();
    if (!f) return 0;
    const targets = (Array.isArray(ids) ? ids : [ids])
      .map((id) => nodeAt(id))
      .filter((hit) => hit && hit.flow.id === f.id && isContainer(hit.node));
    if (!targets.length) return 0;
    pushHistory();
    let freed = 0;
    targets.forEach(({ node }) => {
      f.nodes.forEach((n) => {
        if (n.parent === node.id) {
          n.parent = node.parent || null;
          freed += 1;
        }
      });
    });
    const drop = new Set(targets.map((t) => t.node.id));
    f.nodes = f.nodes.filter((n) => !drop.has(n.id));
    touch();
    return freed;
  }

  /** Move elements into a group (or out to the canvas when parentId is null). */
  function setParent(ids, parentId) {
    const f = currentFlow();
    if (!f) return 0;
    if (parentId) {
      const target = nodeAt(parentId);
      if (!target || target.flow.id !== f.id || !isContainer(target.node)) return 0;
    }
    let moved = 0;
    (Array.isArray(ids) ? ids : [ids]).forEach((id) => {
      if (id === parentId) return;
      const hit = nodeAt(id);
      if (!hit || hit.flow.id !== f.id) return;
      if (parentId && descendantElementIds(id).indexOf(parentId) >= 0) return;
      const next = parentId || null;
      if ((hit.node.parent || null) !== next) {
        hit.node.parent = next;
        moved += 1;
      }
    });
    return moved;
  }

  function reparent(ids, parentId) {
    const moved = setParent(ids, parentId);
    if (!moved) return 0;
    pushHistory();
    touch();
    return moved;
  }

  function fitGroupInFlow(f, group) {
    const kids = f.nodes.filter((n) => n.parent === group.id);
    if (!kids.length) return false;
    const box = boundsOf(kids);
    const spec = kindSpec('group');
    group.x = box.x;
    group.y = box.y;
    group.w = clamp(box.w, spec.minW, spec.maxW);
    group.h = clamp(box.h, spec.minH, spec.maxH);
    return true;
  }

  /** Shrink-wrap a group around whatever it holds. */
  function fitGroupToContents(groupId) {
    const hit = nodeAt(groupId);
    if (!hit || !isContainer(hit.node)) return false;
    return fitGroupInFlow(hit.flow, hit.node);
  }

  function fitAllGroupsInFlow(f) {
    if (!f) return 0;
    let n = 0;
    f.nodes.forEach((node) => {
      if (isContainer(node) && fitGroupInFlow(f, node)) n += 1;
    });
    return n;
  }

  function fitAllGroups(flowId) {
    return fitAllGroupsInFlow(flow(flowId || currentFlowId));
  }

  /** The innermost group whose rectangle contains this point. */
  function groupAt(flowId, x, y, excludeId) {
    const f = flow(flowId || currentFlowId);
    if (!f) return null;
    let best = null;
    let bestDepth = -1;
    f.nodes.forEach((node) => {
      if (!isContainer(node) || node.id === excludeId) return;
      if (x < node.x || x > node.x + node.w || y < node.y || y > node.y + node.h) return;
      const depth = elementDepth(node, f);
      if (depth > bestDepth) {
        best = node;
        bestDepth = depth;
      }
    });
    return best;
  }

  /** Adopt anything sitting on top of a newly drawn group. */
  function adoptContained(groupId) {
    const hit = nodeAt(groupId);
    if (!hit || !isContainer(hit.node)) return 0;
    const g = hit.node;
    let adopted = 0;
    hit.flow.nodes.forEach((node) => {
      if (node.id === g.id || node.parent) return;
      const cx = node.x + node.w / 2;
      const cy = node.y + node.h / 2;
      if (cx > g.x && cx < g.x + g.w && cy > g.y && cy < g.y + g.h) {
        node.parent = g.id;
        adopted += 1;
      }
    });
    return adopted;
  }

  function descendantFlowIds(flowId) {
    const out = [];
    const stack = [flowId];
    const seen = new Set();
    while (stack.length) {
      const id = stack.pop();
      if (seen.has(id)) continue;
      seen.add(id);
      const f = doc.flows[id];
      if (!f) continue;
      out.push(id);
      for (const n of f.nodes) if (n.child) stack.push(n.child);
    }
    return out;
  }

  function statsFor(flowId) {
    const f = doc.flows[flowId];
    if (!f) return { nodes: 0, edges: 0, subflows: 0, descendants: 0 };
    let subflows = 0;
    let descendants = 0;
    for (const n of f.nodes) {
      if (n.child && doc.flows[n.child]) {
        subflows += 1;
        descendants += descendantFlowIds(n.child).reduce((acc, id) => acc + doc.flows[id].nodes.length, 0);
      }
    }
    return { nodes: f.nodes.length, edges: f.edges.length, subflows, descendants };
  }

  /* ---------------------------------------------------------- history */

  function serialize() { return JSON.stringify(doc); }

  function trimHistory() {
    while (past.length > MAX_HISTORY) past.shift();
  }

  function pushHistory() {
    if (suspendDepth > 0) return;
    past.push(serialize());
    trimHistory();
    future.length = 0;
  }

  function beginBatch() {
    if (suspendDepth === 0) suspendedSnapshot = serialize();
    suspendDepth += 1;
  }

  function endBatch() {
    if (suspendDepth === 0) return false;
    suspendDepth -= 1;
    if (suspendDepth > 0) return false;
    const snap = suspendedSnapshot;
    suspendedSnapshot = null;
    if (snap && snap !== serialize()) {
      past.push(snap);
      trimHistory();
      future.length = 0;
      return true;
    }
    return false;
  }

  function restore(json) {
    doc = JSON.parse(json);
    doc.flows = doc.flows || {};
    if (!doc.flows[doc.rootId]) doc.rootId = Object.keys(doc.flows)[0];
    ensureCurrentFlow();
    FD.bus.emit('doc');
  }

  function undo() {
    if (!past.length) return false;
    future.push(serialize());
    restore(past.pop());
    return true;
  }

  function redo() {
    if (!future.length) return false;
    past.push(serialize());
    restore(future.pop());
    return true;
  }

  function ensureCurrentFlow() {
    if (!doc.flows[currentFlowId]) currentFlowId = doc.rootId;
  }

  function setCurrentFlow(id) {
    if (!doc.flows[id] || id === currentFlowId) return false;
    currentFlowId = id;
    FD.bus.emit('nav');
    return true;
  }

  /* -------------------------------------------------------- persistence */

  function readUI() {
    try {
      const raw = readStored(UI_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (err) { return {}; }
  }

  migrateLegacyKeys();
  let uiState = readUI();

  function writeUI(patch) {
    uiState = Object.assign({}, uiState, patch || {});
    try { localStorage.setItem(UI_KEY, JSON.stringify(uiState)); } catch (err) { /* ignore */ }
  }

  function persist(immediate) {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    const run = () => {
      saveTimer = null;
      try {
        doc.updatedAt = new Date().toISOString();
        localStorage.setItem(DOC_KEY, JSON.stringify(doc));
        FD.bus.emit('saved');
      } catch (err) {
        FD.bus.emit('save-error', err);
      }
    };
    if (immediate) run();
    else saveTimer = setTimeout(run, 320);
  }

  function load() {
    const raw = readStored(DOC_KEY);
    if (raw) {
      try {
        const parsed = normalizeDoc(JSON.parse(raw));
        doc = parsed;
      } catch (err) {
        console.warn('Stored flow could not be read, starting fresh.', err);
      }
    }
    ensureCurrentFlow();
    const wanted = uiState.currentFlowId;
    if (wanted && doc.flows[wanted]) currentFlowId = wanted;
    return doc;
  }

  /* --------------------------------------------------- import / normalize */

  function normalizeView(v) {
    if (!v || typeof v !== 'object') return { x: 0, y: 0, k: 1 };
    const k = clamp(asNumber(v.k, 1), 0.08, 4);
    return { x: asNumber(v.x, 0), y: asNumber(v.y, 0), k };
  }

  /**
   * Accepts several shapes so a flow can be hand-written (or agent-written):
   *   1. full document      { rootId, flows: {...} }  (flows may be an array)
   *   2. single flow        { name, nodes, edges }
   *   3. bare node list     { nodes: [...] }
   * A node may nest its own flow inline: { name, nodes, edges } on
   * `child`, `flow`, `subflow` or `children`.
   */
  function normalizeDoc(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('That does not look like a flow document.');
    }

    const sink = {};
    let rootId = null;

    if (raw.flows && typeof raw.flows === 'object') {
      const entries = Array.isArray(raw.flows)
        ? raw.flows.map((f) => [f && f.id, f])
        : Object.entries(raw.flows);
      for (const [key, value] of entries) {
        if (!value || typeof value !== 'object') continue;
        const id = asString(value.id, asString(key, uid('flow'), 80), 80);
        sink[id] = normalizeFlow(value, id, sink);
      }
      rootId = typeof raw.rootId === 'string' && sink[raw.rootId] ? raw.rootId : Object.keys(sink)[0];
    } else if (Array.isArray(raw.nodes) || Array.isArray(raw.steps)) {
      const id = asString(raw.id, 'flow_main', 80);
      if (Array.isArray(raw.steps) && !Array.isArray(raw.nodes)) raw.nodes = raw.steps;
      sink[id] = normalizeFlow(raw, id, sink);
      rootId = id;
    }

    if (!rootId) throw new Error('No flow found in that document.');

    const out = {
      version: VERSION,
      title: asString(pick(raw, ['title', 'name', 'label']), sink[rootId].name || 'Imported flow', 120),
      createdAt: asString(raw.createdAt, new Date().toISOString(), 40),
      updatedAt: new Date().toISOString(),
      rootId,
      flows: sink
    };

    // A flow referenced by a node but missing from the document becomes an
    // empty canvas rather than a dead end.
    for (const f of Object.values(out.flows)) {
      for (const n of f.nodes) {
        if (n.child && !out.flows[n.child]) n.child = null;
      }
    }

    for (const f of Object.values(out.flows)) {
      if (f.nodes.some((n) => n.needsLayout)) {
        autoLayoutFlow(f);
        f.nodes.forEach((n) => { delete n.needsLayout; });
      }
      if (f.nodes.some((n) => n.needsFit)) {
        fitAllGroupsInFlow(f);
        f.nodes.forEach((n) => { delete n.needsFit; });
      }
    }

    return out;
  }

  function normalizeFlow(src, id, sink) {
    const flow = makeFlow(id, asString(pick(src, ['name', 'title', 'label']), 'Untitled canvas', 120));
    flow.view = normalizeView(src.view);

    const rawNodes = Array.isArray(src.nodes) ? src.nodes : [];
    const seen = new Set();

    const addElement = (rawNode, parentId) => {
      if (!rawNode || typeof rawNode !== 'object') return;
      let nodeId = asString(rawNode.id, '', 80) || uid('n');
      if (seen.has(nodeId)) nodeId = uid('n');
      seen.add(nodeId);

      const hasPos = Number.isFinite(asNumber(rawNode.x, NaN)) && Number.isFinite(asNumber(rawNode.y, NaN));
      const kindRaw = pick(rawNode, ['kind', 'element']);
      const typeRaw = pick(rawNode, ['type']);
      // `type` used to be an alias for `kind`; keep that working when the word
      // is one we recognise, otherwise treat it as the node's own type label
      const typeIsKind = !kindRaw && typeof typeRaw === 'string' && !!KINDS[typeRaw.toLowerCase()];
      const kind = kindRaw || (typeIsKind ? typeRaw : undefined);
      const node = makeNode({
        id: nodeId,
        kind: typeof kind === 'string' ? kind.toLowerCase() : undefined,
        name: pick(rawNode, ['name', 'title', 'label', 'text', 'emoji', 'content']),
        x: asNumber(rawNode.x, 0),
        y: asNumber(rawNode.y, 0),
        w: rawNode.w != null ? rawNode.w : rawNode.width,
        h: rawNode.h != null ? rawNode.h : rawNode.height,
        shape: typeof rawNode.shape === 'string' ? rawNode.shape.toLowerCase() : undefined,
        color: typeof rawNode.color === 'string' ? rawNode.color.toLowerCase() : undefined,
        notes: pick(rawNode, ['notes', 'description', 'note', 'body', 'detail']),
        status: pick(rawNode, ['status', 'state']),
        parent: parentId || asString(rawNode.parent, '', 80) || undefined
      });
      if (!hasPos) node.needsLayout = true;
      if (kindSpec(node.kind).container && rawNode.w == null && rawNode.width == null) node.needsFit = true;
      flow.nodes.push(node);

      // a group may list what it holds
      if (kindSpec(node.kind).container) {
        const members = pick(rawNode, ['children', 'items', 'elements', 'members']);
        if (Array.isArray(members)) members.forEach((member) => addElement(member, node.id));
      }

      const childSrc = pick(rawNode, ['child', 'subflow', 'subFlow', 'flow']);
      const legacyChildren = kindSpec(node.kind).container ? undefined : rawNode.children;
      const canNest = kindSpec(node.kind).subflow;
      if (!canNest) return;

      if (typeof childSrc === 'string' && childSrc) {
        node.child = childSrc;
      } else if (childSrc && typeof childSrc === 'object' && !Array.isArray(childSrc)) {
        const childId = asString(childSrc.id, uid('flow'), 80);
        const childFlow = normalizeFlow(childSrc, childId, sink);
        if (!childFlow.name || childFlow.name === 'Untitled canvas') childFlow.name = node.name;
        sink[childId] = childFlow;
        node.child = childId;
      } else if (Array.isArray(childSrc) || Array.isArray(legacyChildren)) {
        const childId = uid('flow');
        const childFlow = normalizeFlow(
          { name: node.name, nodes: (Array.isArray(childSrc) ? childSrc : legacyChildren) },
          childId, sink
        );
        sink[childId] = childFlow;
        node.child = childId;
      }
    };

    rawNodes.forEach((rawNode) => addElement(rawNode, null));

    // drop parent pointers left dangling by the import
    const elementIds = new Set(flow.nodes.map((n) => n.id));
    flow.nodes.forEach((n) => {
      if (n.parent && !elementIds.has(n.parent)) n.parent = null;
    });

    // edges may name either the element, its first line, or its id
    const byName = new Map();
    flow.nodes.forEach((n) => {
      const keys = [n.name, labelOf(n), n.id];
      keys.forEach((key) => {
        const trimmed = String(key == null ? '' : key).trim();
        if (trimmed && !byName.has(trimmed)) byName.set(trimmed, n.id);
      });
    });
    const ids = new Set(flow.nodes.map((n) => n.id));

    const rawEdges = Array.isArray(src.edges) ? src.edges
      : Array.isArray(src.connections) ? src.connections
      : Array.isArray(src.links) ? src.links : [];

    const seenEdges = new Set();
    rawEdges.forEach((rawEdge) => {
      let from; let to; let label = ''; let edgeId = ''; let fromSide; let toSide;
      if (typeof rawEdge === 'string' || Array.isArray(rawEdge)) {
        const parts = Array.isArray(rawEdge) ? rawEdge : String(rawEdge).split(/\s*(?:->|=>|→)\s*/);
        from = parts[0]; to = parts[1];
        if (parts[2]) label = asString(parts[2], '', 80);
      } else if (rawEdge && typeof rawEdge === 'object') {
        from = pick(rawEdge, ['from', 'source', 'src', 'a']);
        to = pick(rawEdge, ['to', 'target', 'dst', 'b']);
        label = asString(pick(rawEdge, ['label', 'name', 'text']), '', 80);
        edgeId = asString(rawEdge.id, '', 80);
        fromSide = typeof rawEdge.fromSide === 'string' ? rawEdge.fromSide.toLowerCase() : undefined;
        toSide = typeof rawEdge.toSide === 'string' ? rawEdge.toSide.toLowerCase() : undefined;
      }
      from = byName.get(String(from == null ? '' : from).trim());
      to = byName.get(String(to == null ? '' : to).trim());
      if (!from || !to || from === to || !ids.has(from) || !ids.has(to)) return;
      const key = from + '>' + to;
      if (seenEdges.has(key)) return;
      seenEdges.add(key);
      flow.edges.push({
        id: edgeId || uid('e'),
        from,
        to,
        fromSide: SIDES.indexOf(fromSide) >= 0 ? fromSide : 'right',
        toSide: SIDES.indexOf(toSide) >= 0 ? toSide : 'left',
        label
      });
    });

    return flow;
  }

  /* ------------------------------------------------------------- layout */

  function autoLayoutFlow(f) {
    // groups are containers: lay out the top level, then shrink-wrap each
    // group around what it already holds
    const nodes = f.nodes.filter((n) => !n.parent);
    if (!nodes.length) return;
    const gapX = 92;
    const gapY = 34;
    const order = new Map(nodes.map((n, i) => [n.id, i]));
    const out = new Map(nodes.map((n) => [n.id, []]));
    const indeg = new Map(nodes.map((n) => [n.id, 0]));

    for (const e of f.edges) {
      if (!out.has(e.from) || !indeg.has(e.to)) continue;
      out.get(e.from).push(e.to);
      indeg.set(e.to, indeg.get(e.to) + 1);
    }

    const layer = new Map();
    const queue = nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id);
    queue.forEach((id) => layer.set(id, 0));
    const visited = new Set(queue);
    let head = 0;
    while (head < queue.length) {
      const id = queue[head++];
      for (const next of out.get(id)) {
        layer.set(next, Math.max(layer.get(next) || 0, (layer.get(id) || 0) + 1));
        indeg.set(next, indeg.get(next) - 1);
        if (indeg.get(next) <= 0 && !visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }

    let maxLayer = 0;
    layer.forEach((v) => { if (v > maxLayer) maxLayer = v; });
    for (const n of nodes) if (!layer.has(n.id)) layer.set(n.id, maxLayer + 1);

    const columns = new Map();
    for (const n of nodes) {
      const l = layer.get(n.id);
      if (!columns.has(l)) columns.set(l, []);
      columns.get(l).push(n);
    }

    const columnOrder = [...columns.keys()].sort((a, b) => a - b);
    const columnHeight = (col) => col.reduce((sum, n, i) => sum + n.h + (i ? gapY : 0), 0);
    const totalH = columnOrder.reduce((max, l) => Math.max(max, columnHeight(columns.get(l))), 0);

    let x = 0;
    columnOrder.forEach((l) => {
      const col = columns.get(l).sort((a, b) => order.get(a.id) - order.get(b.id));
      let y = (totalH - columnHeight(col)) / 2;
      let widest = 0;
      col.forEach((n) => {
        n.x = Math.round(x);
        n.y = Math.round(y);
        y += n.h + gapY;
        widest = Math.max(widest, n.w);
      });
      x += widest + gapX;
    });
  }

  function autoLayout(flowId) {
    const f = flow(flowId || currentFlowId);
    if (!f || f.nodes.length < 2) return false;
    pushHistory();
    autoLayoutFlow(f);
    fitAllGroups(f.id);
    touch();
    return true;
  }

  /* ---------------------------------------------------------- mutations */

  function touch() {
    doc.updatedAt = new Date().toISOString();
    FD.bus.emit('doc');
    persist(false);
  }

  function setTitle(title) {
    const next = asString(title, 'Untitled', 120);
    if (next === doc.title) return;
    pushHistory();
    doc.title = next;
    FD.bus.emit('title');
    persist(false);
  }

  function setView(flowId, view) {
    const f = flow(flowId);
    if (!f) return;
    f.view = normalizeView(view);
    FD.bus.emit('view', f.id);
    persist(false);
  }

  function addNode(patch) {
    const f = currentFlow();
    if (!f) return null;
    pushHistory();
    const node = makeNode(patch);
    if (patch && patch.snap) {
      node.x = Math.round(node.x / GRID) * GRID;
      node.y = Math.round(node.y / GRID) * GRID;
    }
    f.nodes.push(node);
    touch();
    return node;
  }

  function updateNode(id, patch, opts) {
    const hit = nodeAt(id);
    if (!hit) return null;
    if (!opts || !opts.silentHistory) pushHistory();
    const n = hit.node;
    if (patch.kind !== undefined && KINDS[patch.kind]) n.kind = patch.kind;
    if (patch.name !== undefined) {
      n.name = opts && opts.trim === false ? asText(patch.name, 4000) : asString(patch.name, '', 4000);
    }
    if (patch.type !== undefined) n.type = asString(patch.type, '', 40);
    if (patch.status !== undefined) n.status = asString(patch.status, '', 40);
    if (patch.color !== undefined && COLORS.indexOf(patch.color) >= 0) n.color = patch.color;
    if (patch.textColor !== undefined) applyTextColor(n, patch.textColor);
    if (patch.shape !== undefined && SHAPES.indexOf(patch.shape) >= 0) n.shape = patch.shape;
    if (patch.x !== undefined || patch.y !== undefined) {
      const nx = patch.x !== undefined ? Math.round(asNumber(patch.x, n.x)) : n.x;
      const ny = patch.y !== undefined ? Math.round(asNumber(patch.y, n.y)) : n.y;
      const dx = nx - n.x;
      const dy = ny - n.y;
      // a group carries everything inside it
      if ((dx || dy) && isContainer(n)) {
        descendantElementIds(n.id).forEach((id) => {
          const inside = nodeAt(id);
          if (inside) {
            inside.node.x += dx;
            inside.node.y += dy;
          }
        });
      }
      n.x = nx;
      n.y = ny;
    }
    if (patch.w !== undefined || patch.h !== undefined) clampSize(n, patch.w, patch.h);
    if (!opts || !opts.silent) touch();
    else FD.bus.emit('doc-lite');
    return n;
  }

  function updateNodes(patches, opts) {
    if (!opts || !opts.silentHistory) pushHistory();
    patches.forEach(({ id, patch }) => {
      const hit = nodeAt(id);
      if (!hit) return;
      const n = hit.node;
      if (patch.x !== undefined) n.x = Math.round(asNumber(patch.x, n.x));
      if (patch.y !== undefined) n.y = Math.round(asNumber(patch.y, n.y));
      if (patch.w !== undefined || patch.h !== undefined) clampSize(n, patch.w, patch.h);
      if (patch.color !== undefined && COLORS.indexOf(patch.color) >= 0) n.color = patch.color;
      if (patch.textColor !== undefined) applyTextColor(n, patch.textColor);
    });
    touch();
  }

  function removeNodes(ids, opts) {
    const list = Array.isArray(ids) ? ids.slice() : [ids];
    if (!list.length) return { nodes: 0, flows: 0 };
    pushHistory();
    const dropFlows = new Set();
    const want = new Set(list);
    // deleting a group takes everything nested inside it
    list.forEach((id) => {
      const hit = nodeAt(id);
      if (!hit) return;
      descendantElementIds(id).forEach((childId) => want.add(childId));
      if (hit.node.child) descendantFlowIds(hit.node.child).forEach((f) => dropFlows.add(f));
    });
    let removed = 0;
    for (const f of Object.values(doc.flows)) {
      const before = f.nodes.length;
      if (before === 0) continue;
      f.nodes = f.nodes.filter((n) => !want.has(n.id));
      removed += before - f.nodes.length;
      const live = new Set(f.nodes.map((n) => n.id));
      f.edges = f.edges.filter((e) => live.has(e.from) && live.has(e.to));
    }
    dropFlows.delete(doc.rootId);
    for (const id of dropFlows) delete doc.flows[id];
    for (const f of Object.values(doc.flows)) {
      for (const n of f.nodes) if (n.child && !doc.flows[n.child]) n.child = null;
    }
    ensureCurrentFlow();
    touch();
    if (!opts || !opts.keepNav) FD.bus.emit('nav');
    return { nodes: removed, flows: dropFlows.size };
  }

  function duplicateNodes(ids) {
    // copying a group copies what is inside it
    const want = new Set(ids);
    ids.forEach((id) => {
      descendantElementIds(id).forEach((childId) => want.add(childId));
    });
    const list = nodesByIds(Array.from(want));
    if (!list.length) return [];
    pushHistory();

    const mirrors = new Map();
    const origin = new Map();
    const created = [];

    const cloneFlowDeep = (sourceFlowId) => {
      const src = doc.flows[sourceFlowId];
      if (!src) return null;
      const copy = makeFlow(null, src.name);
      copy.view = { x: src.view.x, y: src.view.y, k: src.view.k };
      doc.flows[copy.id] = copy;
      const localMirrors = new Map();
      src.nodes.forEach((n) => {
        const mirror = JSON.parse(JSON.stringify(n));
        mirror.id = uid('n');
        mirror.x += 30;
        mirror.y += 30;
        mirror.child = n.child ? cloneFlowDeep(n.child) : null;
        localMirrors.set(n.id, mirror.id);
        copy.nodes.push(mirror);
      });
      src.edges.forEach((e) => {
        const from = localMirrors.get(e.from);
        const to = localMirrors.get(e.to);
        if (from && to) copy.edges.push(mirrorEdge(e, from, to));
      });
      return copy.id;
    };

    for (const node of list) {
      const home = nodeAt(node.id);
      if (!home) continue;
      const copy = JSON.parse(JSON.stringify(node));
      copy.id = uid('n');
      copy.x += 30;
      copy.y += 30;
      copy.child = node.child ? cloneFlowDeep(node.child) : null;
      copy.parent = null;
      home.flow.nodes.push(copy);
      mirrors.set(node.id, copy);
      origin.set(node.id, home.flow);
      created.push(copy.id);
    }

    // rewire the copies into a matching tree: a copy of something inside a
    // copied group belongs to the copy of that group
    list.forEach((node) => {
      const copy = mirrors.get(node.id);
      if (!copy) return;
      const parent = node.parent;
      if (!parent) return;
      if (mirrors.has(parent)) copy.parent = mirrors.get(parent).id;
      else if (want.has(parent)) copy.parent = null;
      else copy.parent = parent;
    });

    for (const f of new Set(origin.values())) {
      for (const e of f.edges.slice()) {
        if (!mirrors.has(e.from) || !mirrors.has(e.to)) continue;
        f.edges.push(mirrorEdge(e, mirrors.get(e.from).id, mirrors.get(e.to).id));
      }
    }

    touch();
    return created;
  }

  function addEdge(from, to, label, sides) {
    const f = currentFlow();
    if (!f || !from || !to || from === to) return null;
    const a = nodeAt(from);
    const b = nodeAt(to);
    if (!a || !b || a.flow.id !== f.id || b.flow.id !== f.id) return null;
    if (!isConnectable(a.node) || !isConnectable(b.node)) return null;
    const exists = f.edges.some((e) => e.from === from && e.to === to);
    if (exists) return null;
    pushHistory();
    const picks = sides || {};
    const edge = {
      id: uid('e'),
      from,
      to,
      fromSide: SIDES.indexOf(picks.fromSide) >= 0 ? picks.fromSide : 'right',
      toSide: SIDES.indexOf(picks.toSide) >= 0 ? picks.toSide : 'left',
      label: asString(label, '', 80)
    };
    f.edges.push(edge);
    touch();
    return edge;
  }

  /** An edge keeps the sides it was drawn from when it is copied. */
  function mirrorEdge(edge, from, to) {
    return {
      id: uid('e'),
      from,
      to,
      fromSide: SIDES.indexOf(edge.fromSide) >= 0 ? edge.fromSide : 'right',
      toSide: SIDES.indexOf(edge.toSide) >= 0 ? edge.toSide : 'left',
      label: edge.label
    };
  }

  function updateEdge(id, patch) {
    const f = currentFlow();
    if (!f) return null;
    const edge = f.edges.find((e) => e.id === id);
    if (!edge) return null;
    pushHistory();
    if (patch.label !== undefined) edge.label = asString(patch.label, '', 80);
    touch();
    return edge;
  }

  function removeEdges(ids) {
    const f = currentFlow();
    if (!f) return 0;
    const want = new Set(Array.isArray(ids) ? ids : [ids]);
    const before = f.edges.length;
    const gone = f.edges.filter((e) => want.has(e.id));
    if (!gone.length) return 0;
    pushHistory();
    f.edges = f.edges.filter((e) => !want.has(e.id));
    touch();
    return gone.length;
  }

  /* -------------------------------------------------------- sub-flows */

  function createSubFlow(nodeId, name) {
    const hit = nodeAt(nodeId);
    if (!hit || !kindSpec(hit.node.kind).subflow) return null;
    pushHistory();
    const child = makeFlow(null, asString(name, hit.node.name, 120));
    doc.flows[child.id] = child;
    hit.node.child = child.id;
    hit.node.name = child.name;
    touch();
    return child;
  }

  /**
   * A canvas that belongs to no node — a second base canvas beside the root,
   * rather than another level nested underneath one.
   */
  function createBaseFlow(name) {
    pushHistory();
    const flow = makeFlow(null, asString(name, 'New flow', 120));
    doc.flows[flow.id] = flow;
    currentFlowId = flow.id;
    touch();
    FD.bus.emit('nav');
    return flow;
  }

  function deleteFlow(flowId) {
    const flow = doc.flows[flowId];
    if (!flow || flowId === doc.rootId) return false;
    pushHistory();
    const parent = parentOf(flowId);
    if (parent) {
      const host = nodeAt(parent.nodeId);
      if (host) host.node.child = null;
    }
    descendantFlowIds(flowId).forEach((id) => {
      if (id !== doc.rootId) delete doc.flows[id];
    });
    ensureCurrentFlow();
    touch();
    FD.bus.emit('nav');
    return true;
  }

  function renameFlow(flowId, name, opts) {
    const f = flow(flowId);
    if (!f) return;
    const next = asString(name, 'Untitled canvas', 120);
    if (next === f.name) return;
    if (!opts || !opts.silentHistory) pushHistory();
    f.name = next;
    const parent = parentOf(flowId);
    if (parent) {
      const pn = nodeAt(parent.nodeId);
      if (pn) pn.node.name = next;
    }
    touch();
  }

  function detachFlow(nodeId) {
    const hit = nodeAt(nodeId);
    if (!hit || !hit.node.child) return 0;
    pushHistory();
    const ids = descendantFlowIds(hit.node.child);
    const removed = ids.filter((id) => id !== doc.rootId).length;
    delete doc.flows[hit.node.child];
    hit.node.child = null;
    touch();
    FD.bus.emit('nav');
    return removed;
  }

  function adoptFlow(nodeId, flowId) {
    const hit = nodeAt(nodeId);
    const src = flow(flowId);
    if (!hit || !src) return false;
    if (descendantFlowIds(flowId).indexOf(hit.flowId) >= 0 && hit.flowId === flowId) return false;
    pushHistory();
    hit.node.child = flowId;
    if (!src.name || src.name === 'Untitled canvas') src.name = hit.node.name;
    hit.node.name = src.name;
    touch();
    FD.bus.emit('nav');
    return true;
  }

  function createNodeWithFlow(name, position) {
    const flowName = asString(name, 'New flow', 120);
    const patch = {
      name: flowName,
      x: position ? position.x : 0,
      y: position ? position.y : 0
    };
    if (position && position.snap) patch.snap = true;
    const node = addNode(patch);
    if (!node) return null;
    const child = makeFlow(null, flowName);
    doc.flows[child.id] = child;
    node.child = child.id;
    touch();
    return { node, flow: child };
  }

  function unattachedFlows() {
    const reachable = new Set(descendantFlowIds(doc.rootId));
    return Object.values(doc.flows).filter((f) => !reachable.has(f.id));
  }

  /* ---------------------------------------------------------- documents */

  function exportDoc() {
    const copy = JSON.parse(serialize());
    copy.updatedAt = new Date().toISOString();
    return copy;
  }

  function exportFlowTree(flowId) {
    const root = flow(flowId || doc.rootId);
    if (!root) return null;
    const out = {
      version: VERSION,
      title: doc.title,
      root: root.name,
      flows: {}
    };
    descendantFlowIds(root.id).forEach((id) => {
      const f = doc.flows[id];
      out.flows[id] = {
        id: f.id,
        name: f.name,
        nodes: f.nodes.map((n) => Object.assign({}, n)),
        edges: f.edges.map((e) => Object.assign({}, e)),
        view: Object.assign({}, f.view)
      };
    });
    out.rootId = root.id;
    return out;
  }

  function replaceDoc(next) {
    const previous = doc;
    pushHistory();
    doc = next;
    doc.flows = doc.flows || {};
    if (!doc.flows[doc.rootId]) doc.rootId = Object.keys(doc.flows)[0];
    currentFlowId = doc.rootId;
    persist(true);
    FD.bus.emit('doc');
    FD.bus.emit('nav');
    return previous;
  }

  function reset(title) {
    pushHistory();
    doc = makeDoc(title);
    currentFlowId = doc.rootId;
    persist(true);
    FD.bus.emit('doc');
    FD.bus.emit('nav');
  }

  function isEmpty() {
    const flows = Object.values(doc.flows);
    return flows.length <= 1 && flows.every((f) => f.nodes.length === 0);
  }

  /* ------------------------------------------------------------- public */

  FD.store = {
    VERSION, COLORS, TEXT_COLORS, GRID, KINDS, SHAPES, SIDES, KIND_NAMES, kindSpec, isConnectable, statusTone, labelOf,
    NODE_W, NODE_H, MIN_W, MIN_H, MAX_W, MAX_H,
    DOC_KEY, UI_KEY,
    uid, clamp,

    get doc() { return doc; },
    get currentFlowId() { return currentFlowId; },

    load, persist, normalizeDoc,
    flow, currentFlow, nodeAt, nodesByIds, parentOf, pathTo, breadcrumb,
    descendantFlowIds, statsFor, unattachedFlows, ensureCurrentFlow,
    setCurrentFlow,

    isContainer, elementChildren, descendantElementIds, elementDepth,
    outlineTree, countTree, groupAt,
    groupSelection, ungroup, setParent, reparent, adoptContained,
    fitGroupToContents, fitAllGroups,

    setTitle, setView,
    addNode, updateNode, updateNodes, removeNodes, duplicateNodes,
    addEdge, updateEdge, removeEdges,
    createSubFlow, renameFlow, detachFlow, adoptFlow, createNodeWithFlow,
    createBaseFlow, deleteFlow,
    autoLayout, autoLayoutFlow,

    pushHistory, beginBatch, endBatch, undo, redo,
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,

    exportDoc, exportFlowTree, replaceDoc, reset, isEmpty,
    get uiState() { return uiState; },
    writeUI
  };
})(window.FD = window.FD || {});
