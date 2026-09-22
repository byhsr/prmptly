/* ==========================================================================
   ui.js — chrome: toolbar, breadcrumbs, flow tree, menus, dialogs.
   ========================================================================== */
(function (FD) {
  'use strict';

  const store = () => FD.store;
  const vp = () => FD.viewport;
  const act = () => FD.actions;

  const $ = (id) => document.getElementById(id);

  let modalStack = [];
  const treeCollapsed = new Set();

  function h(tag, cls, html) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html != null) node.innerHTML = html;
    return node;
  }

  function icon(name, cls) {
    return '<svg class="icon' + (cls ? ' ' + cls : '') + '"><use href="#' + name + '"/></svg>';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  /* --------------------------------------------------------------- toasts */

  function toast(message, opts) {
    const options = opts || {};
    const wrap = $('toasts');
    if (!wrap) return null;

    const node = h('div', 'toast' + (options.type ? ' ' + options.type : ''));
    const name = options.type === 'err' ? 'i-help' : options.type === 'ok' ? 'i-check' : 'i-sparkle';
    node.innerHTML = icon(name) + '<span class="t-text">' + escapeHtml(message) + '</span>';
    if (options.action) {
      const button = h('button', 't-action', escapeHtml(options.action.label));
      button.addEventListener('click', () => {
        options.action.onClick();
        dismiss();
      });
      node.appendChild(button);
    }

    let timer = null;
    function dismiss() {
      if (timer) clearTimeout(timer);
      node.classList.add('out');
      setTimeout(() => node.remove(), 240);
    }
    wrap.appendChild(node);
    while (wrap.children.length > 3) wrap.firstChild.remove();
    timer = setTimeout(dismiss, options.duration || (options.action ? 6000 : 2600));
    return node;
  }

  /* --------------------------------------------------------------- modals */

  function modalOpen() { return modalStack.length > 0; }

  function openModal(config) {
    const scrim = h('div', 'modal-scrim');
    const box = h('div', 'modal' + (config.size === 'narrow' ? ' narrow' : ''));

    const head = h('div', 'modal-head',
      (config.icon ? icon(config.icon) : '') + '<h3>' + escapeHtml(config.title) + '</h3>');
    const closeBtn = h('button', 'icon-btn sm', icon('i-x'));
    closeBtn.title = 'Close';
    head.appendChild(closeBtn);

    const body = h('div', 'modal-body');
    if (typeof config.body === 'string') body.innerHTML = config.body;
    else if (config.body) body.appendChild(config.body);

    const foot = h('div', 'modal-foot');
    box.appendChild(head);
    box.appendChild(body);
    if (config.actions && config.actions.length) box.appendChild(foot);
    scrim.appendChild(box);
    $('modals').appendChild(scrim);

    const entry = { scrim, box, close };
    modalStack.push(entry);

    function close(result) {
      const index = modalStack.indexOf(entry);
      if (index >= 0) modalStack.splice(index, 1);
      scrim.remove();
      if (config.onClose) config.onClose(result);
    }

    const api = { body, foot, box, close };

    (config.actions || []).forEach((action) => {
      const button = h('button', 'btn ' + (action.kind || 'ghost'),
        (action.icon ? icon(action.icon) : '') + '<span>' + escapeHtml(action.label) + '</span>');
      if (action.kind === 'primary') button.classList.add('primary');
      button.addEventListener('click', () => {
        const keep = action.onClick ? action.onClick(api) : undefined;
        if (keep === false) return;
        if (action.close !== false) close(action.value);
      });
      foot.appendChild(button);
    });

    closeBtn.addEventListener('click', () => close());
    scrim.addEventListener('pointerdown', (e) => {
      if (e.target === scrim && !config.sticky) close();
    });

    setTimeout(() => {
      const focusTarget = body.querySelector('[data-autofocus]') || body.querySelector('input, textarea');
      if (focusTarget) {
        focusTarget.focus();
        if (focusTarget.select) focusTarget.select();
      }
    }, 30);

    return Object.assign(api, { entry });
  }

  function confirmDialog(config) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => { if (!settled) { settled = true; resolve(value); } };
      openModal({
        title: config.title,
        icon: config.icon || 'i-help',
        size: 'narrow',
        body: '<p>' + escapeHtml(config.message) + '</p>',
        onClose: () => finish(false),
        actions: [
          { label: config.cancelText || 'Cancel', kind: 'ghost', onClick: () => finish(false) },
          {
            label: config.confirmText || 'Confirm',
            kind: config.danger ? 'danger' : 'primary',
            onClick: () => { finish(true); }
          }
        ]
      });
    });
  }

  function promptDialog(config) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => { if (!settled) { settled = true; resolve(value); } };

      const wrap = h('div', 'section');
      if (config.message) wrap.appendChild(h('p', 'muted', escapeHtml(config.message)));
      const field = h('div', 'field');
      field.appendChild(h('label', null, escapeHtml(config.label || 'Name')));
      const input = document.createElement('input');
      input.type = 'text';
      input.value = config.value == null ? '' : config.value;
      input.placeholder = config.placeholder || '';
      input.dataset.autofocus = '1';
      input.spellcheck = false;
      field.appendChild(input);
      wrap.appendChild(field);

      const api = openModal({
        title: config.title,
        icon: config.icon || 'i-pencil',
        size: 'narrow',
        body: wrap,
        onClose: () => finish(null),
        actions: [
          { label: 'Cancel', kind: 'ghost', onClick: () => finish(null) },
          {
            label: config.confirmText || 'Save',
            kind: 'primary',
            onClick: () => { finish(input.value.trim() === '' ? null : input.value.trim()); }
          }
        ]
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const value = input.value.trim();
          finish(value === '' ? null : value);
          api.close();
        }
      });
    });
  }

  /* ----------------------------------------------------------- context menu */

  let menuEl = null;

  function showMenu(x, y, items) {
    closeMenu();
    const menu = $('menu');
    menu.innerHTML = '';
    let hasEnabled = false;

    items.forEach((item) => {
      if (item === 'sep' || item.type === 'sep') {
        menu.appendChild(h('div', 'ctx-sep'));
        return;
      }
      if (item.type === 'swatches') {
        const row = h('div', 'ctx-swatches');
        const label = h('span', 'ctx-swatches-label');
        label.textContent = item.label || 'Colour';
        row.appendChild(label);
        const grid = h('div', 'ctx-swatches-grid');
        (item.colors || []).forEach((key) => {
          const swatch = h('button', 'swatch');
          swatch.type = 'button';
          swatch.dataset.color = key;
          swatch.title = key;
          swatch.setAttribute('aria-label', key);
          swatch.style.background = 'var(--c-' + key + ')';
          if (key === item.value) swatch.classList.add('on');
          swatch.addEventListener('click', () => {
            closeMenu();
            item.action(key);
          });
          grid.appendChild(swatch);
        });
        row.appendChild(grid);
        menu.appendChild(row);
        hasEnabled = true;
        return;
      }
      const button = h('button', 'ctx-item' + (item.danger ? ' danger' : ''));
      button.innerHTML = icon(item.icon || 'i-node') + '<span>' + escapeHtml(item.label) + '</span>' +
        (item.kbd ? '<span class="k">' + escapeHtml(item.kbd) + '</span>' : '');
      if (item.disabled) {
        button.disabled = true;
        button.style.opacity = '.4';
        button.style.cursor = 'default';
      } else {
        hasEnabled = true;
        button.addEventListener('click', () => {
          closeMenu();
          item.action();
        });
      }
      menu.appendChild(button);
    });

    if (!hasEnabled) return;
    menu.hidden = false;
    menuEl = menu;

    const rect = menu.getBoundingClientRect();
    const left = Math.min(x, window.innerWidth - rect.width - 8);
    const top = Math.min(y, window.innerHeight - rect.height - 8);
    menu.style.left = Math.max(8, left) + 'px';
    menu.style.top = Math.max(8, top) + 'px';

    setTimeout(() => {
      document.addEventListener('pointerdown', onMenuOutside, true);
      window.addEventListener('blur', closeMenu);
      window.addEventListener('resize', closeMenu);
    }, 0);
  }

  function onMenuOutside(e) {
    if (menuEl && !menuEl.contains(e.target)) closeMenu();
  }

  function closeMenu() {
    const menu = $('menu');
    if (!menu) return;
    menu.hidden = true;
    menu.innerHTML = '';
    menuEl = null;
    document.removeEventListener('pointerdown', onMenuOutside, true);
    window.removeEventListener('blur', closeMenu);
    window.removeEventListener('resize', closeMenu);
  }

  /* ------------------------------------------------------------ breadcrumbs */

  function renderCrumbs() {
    const wrap = $('crumbs');
    if (!wrap) return;
    const chain = store().breadcrumb();
    wrap.innerHTML = '';
    // at the top level there is nowhere to go, so the bar gets out of the way
    wrap.classList.toggle('empty', chain.length < 2);
    if (chain.length < 2) return;

    // one small control, then a plain trail — as quiet as the status bar
    const up = h('button', 'crumb-up', icon('i-chevron-up') + '<span>Up</span>');
    up.title = 'Go up one level (Alt+←)';
    up.addEventListener('click', () => act().goUp());
    wrap.appendChild(up);

    chain.forEach((crumb, index) => {
      if (index > 0) wrap.appendChild(h('span', 'crumb-sep', '›'));
      const isLast = index === chain.length - 1;
      const button = h('button', 'crumb' + (isLast ? ' current' : ''), escapeHtml(crumb.name));
      button.title = isLast ? 'You are here' : 'Go to ' + crumb.name;
      if (!isLast) button.addEventListener('click', () => act().goToFlow(crumb.flowId));
      wrap.appendChild(button);
    });
  }

  /* -------------------------------------------------------------- flow tree */

  /* -------------------------------------------------------------- outline */

  const TREE_ICON = {
    node: 'i-node',
    sticky: 'i-sticky',
    text: 'i-text',
    sticker: 'i-sticker',
    shape: 'i-shape-rect',
    group: 'i-group'
  };

  function renderTree() {
    const wrap = $('tree');
    if (!wrap) return;
    wrap.innerHTML = '';

    const current = store().currentFlowId;
    const storey = store();
    const collapsed = treeCollapsed;

    function row(config) {
      const button = h('button', 'tree-item' + (config.active ? ' active' : '') +
        (config.kind ? ' kind-' + config.kind : ''));
      button.style.paddingLeft = (7 + config.depth * 14) + 'px';
      if (config.toggle) {
        const caret = h('span', 'tree-caret' + (config.open ? ' open' : ''), icon('i-chevron-right'));
        caret.addEventListener('click', (e) => {
          e.stopPropagation();
          config.toggle();
        });
        button.appendChild(caret);
      } else {
        button.appendChild(h('span', 'tree-caret spacer'));
      }
      button.appendChild(h('span', 'tree-icon', icon(config.icon || 'i-node')));
      button.appendChild(h('span', 't-label', escapeHtml(config.label)));
      if (config.badge) button.appendChild(h('span', 't-count', escapeHtml(config.badge)));
      button.title = config.title || config.label;
      button.addEventListener('click', config.onClick);
      if (config.onContext) {
        button.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          config.onContext(e.clientX, e.clientY);
        });
      }
      return button;
    }

    // the document, with the canvas you are standing in on top
    const docRow = h('div', 'tree-item tree-root');
    docRow.style.paddingLeft = '7px';
    docRow.innerHTML = '<span class="tree-icon">' + icon('i-flow') + '</span>' +
      '<span class="t-label">' + escapeHtml(storey.doc.title) + '</span>' +
      '<span class="t-count">' + Object.keys(storey.doc.flows).length + '</span>';
    wrap.appendChild(docRow);

    const walk = (entries, depth) => {
      entries.forEach((entry) => {
        const isGroup = storey.kindSpec(entry.kind).container;
        const key = entry.id;
        const open = !collapsed.has(key);
        const hasChildren = entry.children.length > 0 || !!entry.childFlow;
        const here = entry.flowId === current;
        const count = entry.children.length + (entry.childFlow ? 1 : 0);

        wrap.appendChild(row({
          label: entry.name,
          icon: TREE_ICON[entry.kind] || 'i-node',
          kind: entry.kind,
          depth,
          active: false,
          badge: count ? String(count) : '',
          title: entry.name + ' — ' + storey.kindSpec(entry.kind).label,
          toggle: (isGroup || entry.childFlow) && hasChildren
            ? () => {
              if (collapsed.has(key)) collapsed.delete(key);
              else collapsed.add(key);
              renderTree();
            }
            : null,
          open,
          onClick: () => selectEntry(entry.id),
          onContext: (x, y) => showElementMenu(x, y, entry)
        }));

        if (!open) return;
        if (isGroup) walk(entry.children, depth + 1);
        if (entry.childFlow) {
          wrap.appendChild(row({
            label: entry.childFlow.name,
            icon: 'i-layers',
            kind: 'canvas',
            depth: depth + 1,
            active: entry.childFlow.id === current,
            badge: String(entry.childFlow.children.length) || '',
            title: 'Canvas "' + entry.childFlow.name + '"',
            onClick: () => act().goToFlow(entry.childFlow.id),
            onContext: (x, y) => showCanvasMenu(x, y, entry.childFlow.id)
          }));
          walk(entry.childFlow.children, depth + 2);
        }
      });
    };

    walk(storey.outlineTree(current), 0);

    const orphans = storey.unattachedFlows();
    if (orphans.length) {
      wrap.appendChild(h('div', 'tree-group', 'Base canvases'));
      orphans.forEach((flow) => {
        const button = h('button', 'tree-item kind-canvas' + (flow.id === current ? ' active' : ''),
          '<span class="tree-caret spacer"></span>' + icon('i-layers') +
          '<span class="t-label">' + escapeHtml(flow.name) + '</span>' +
          '<span class="t-count">' + flow.nodes.length + '</span>');
        button.title = 'Base canvas "' + flow.name + '"';
        button.addEventListener('click', () => act().goToFlow(flow.id));
        button.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          showCanvasMenu(e.clientX, e.clientY, flow.id);
        });
        wrap.appendChild(button);
      });
    }
  }

  function selectEntry(id) {
    const hit = store().nodeAt(id);
    if (!hit) return;
    if (hit.flow.id !== store().currentFlowId) store().setCurrentFlow(hit.flow.id);
    FD.sel.replace([id]);
    FD.viewport.centerOn(hit.node.x + hit.node.w / 2, hit.node.y + hit.node.h / 2);
  }

  /* --------------------------------------------------- canvases: new / delete */

  async function newCanvas(insideNodeId) {
    const host = insideNodeId ? store().nodeAt(insideNodeId) : null;
    const name = await promptDialog({
      title: 'New canvas',
      message: host
        ? '"' + (store().labelOf(host.node) || 'This element') +
          '" will open this canvas when you double-click it.'
        : 'This drops a node on the canvas you are on and opens a new canvas inside it.',
      label: 'Canvas name',
      value: 'New canvas',
      confirmText: 'Create'
    });
    if (name === null) return null;

    let nodeId;
    if (host) {
      if (host.node.child && store().flow(host.node.child)) {
        toast('That element already opens a canvas.', { type: 'err' });
        return null;
      }
      const child = store().createSubFlow(host.node.id, name);
      if (!child) return null;
      FD.sel.replace([host.node.id]);
      act().enterFlow(child.id);
      return child;
    }

    const made = store().createNodeWithFlow(name, FD.viewport.spawnPosition());
    if (!made) return null;
    nodeId = made.node.id;
    FD.sel.replace([nodeId]);
    act().enterFlow(made.flow.id);
    return made.flow;
  }

  async function newBaseFlow() {
    const name = await promptDialog({
      title: 'New base canvas',
      message: 'A canvas that belongs to no node — a second top-level canvas beside the main one.',
      label: 'Canvas name',
      value: 'New flow',
      confirmText: 'Create'
    });
    if (name === null) return null;
    const flow = store().createBaseFlow(name);
    FD.sel.clear();
    FD.viewport.set({
      x: Math.round(FD.viewport.size().w / 2),
      y: Math.round(FD.viewport.size().h / 2),
      k: 1
    });
    toast('Created the base canvas "' + flow.name + '".', { type: 'ok' });
    return flow;
  }

  async function deleteCanvas(flowId) {
    const flow = store().flow(flowId);
    if (!flow) return false;
    if (flowId === store().doc.rootId) {
      toast('The main canvas cannot be deleted.', { type: 'err' });
      return false;
    }
    const parent = store().parentOf(flowId);
    const nested = store().descendantFlowIds(flowId).length;
    const ok = await confirmDialog({
      title: 'Delete the canvas "' + flow.name + '"?',
      message: parent
        ? (nested > 1
          ? 'This canvas and ' + (nested - 1) + ' nested canvas(es) inside it are removed. ' +
            'The node that opened it stays on the parent canvas.'
          : 'The canvas and everything on it is removed. The node that opened it stays on the parent canvas.')
        : 'This base canvas and everything on it is removed.',
      confirmText: 'Delete canvas',
      danger: true
    });
    if (!ok) return false;

    if (parent) {
      const nodeId = parent.nodeId;
      store().detachFlow(nodeId);
      store().setCurrentFlow(parent.flowId);
      FD.sel.replace([nodeId]);
    } else {
      const home = store().doc.rootId;
      store().deleteFlow(flowId);
      store().setCurrentFlow(home);
    }
    toast('Deleted the canvas "' + flow.name + '".', {
      type: 'ok',
      action: { label: 'Undo', onClick: () => store().undo() }
    });
    return true;
  }

  function showCanvasMenu(x, y, flowId) {
    const flow = store().flow(flowId);
    if (!flow) return;
    const parent = store().parentOf(flowId);
    showMenu(x, y, [
      { label: 'Open this canvas', icon: 'i-external', action: () => act().goToFlow(flowId) },
      { label: 'Rename canvas', icon: 'i-pencil', action: async () => {
        const name = await promptDialog({ title: 'Rename canvas', label: 'Canvas name', value: flow.name });
        if (name !== null) store().renameFlow(flowId, name);
      } },
      'sep',
      { label: 'Delete this canvas', icon: 'i-trash', danger: true,
        disabled: flowId === store().doc.rootId,
        action: () => deleteCanvas(flowId) }
    ]);
  }

  function showElementMenu(x, y, entry) {
    const hit = store().nodeAt(entry.id);
    if (!hit) return;
    const node = hit.node;
    const spec = store().kindSpec(node.kind);
    const hasCanvas = !!(node.child && store().flow(node.child));

    const items = [
      { label: 'Write on it', icon: 'i-pencil', kbd: 'F2', action: () => {
        if (hit.flow.id !== store().currentFlowId) store().setCurrentFlow(hit.flow.id);
        FD.sel.replace([node.id]);
        focusName();
      } }
    ];

    if (spec.container) {
      items.push({ label: 'Ungroup, keep contents', icon: 'i-x', action: () => {
        const freed = store().ungroup([node.id]);
        if (freed) toast('Ungrouped ' + freed + (freed === 1 ? ' item.' : ' items.'));
      } });
    }

    items.push('sep');
    items.push({
      label: hasCanvas ? 'Open its canvas' : 'New canvas inside',
      icon: 'i-layers',
      action: () => {
        if (hasCanvas) act().goToFlow(node.child);
        else newCanvas(node.id);
      }
    });

    if (hasCanvas) {
      items.push({
        label: 'Delete its canvas',
        icon: 'i-trash',
        danger: true,
        action: () => deleteCanvas(node.child)
      });
      items.push({
        label: 'Unlink its canvas',
        icon: 'i-x',
        action: () => {
          const name = store().flow(node.child).name;
          store().detachFlow(node.id);
          toast('Unlinked "' + name + '".', { action: { label: 'Undo', onClick: () => store().undo() } });
        }
      });
    }

    items.push('sep');
    items.push({
      label: 'Delete', icon: 'i-trash', danger: true, action: () => {
        store().removeNodes([node.id]);
        FD.sel.clear();
        toast('Deleted "' + (store().labelOf(node) || 'element') + '".', {
          type: 'ok',
          action: { label: 'Undo', onClick: () => store().undo() }
        });
      }
    });

    showMenu(x, y, items);
  }

  /* ------------------------------------------------------------- alignment */

  function alignNodes(mode) {
    const items = Array.from(FD.sel.nodes).map((id) => store().nodeAt(id)).filter(Boolean);
    if (items.length < 2) return;

    const minX = Math.min.apply(null, items.map((i) => i.node.x));
    const maxX = Math.max.apply(null, items.map((i) => i.node.x + i.node.w));
    const minY = Math.min.apply(null, items.map((i) => i.node.y));
    const maxY = Math.max.apply(null, items.map((i) => i.node.y + i.node.h));

    store().beginBatch();

    if (mode === 'dist-h' || mode === 'dist-v') {
      const horizontal = mode === 'dist-h';
      const sorted = items.slice().sort((a, b) => horizontal
        ? (a.node.x + a.node.w / 2) - (b.node.x + b.node.w / 2)
        : (a.node.y + a.node.h / 2) - (b.node.y + b.node.h / 2));
      const first = sorted[0].node;
      const last = sorted[sorted.length - 1].node;
      const start = horizontal ? first.x + first.w / 2 : first.y + first.h / 2;
      const end = horizontal ? last.x + last.w / 2 : last.y + last.h / 2;
      const gap = (end - start) / (sorted.length - 1 || 1);
      sorted.forEach((item, index) => {
        const centre = start + gap * index;
        const patch = horizontal
          ? { x: Math.round(centre - item.node.w / 2) }
          : { y: Math.round(centre - item.node.h / 2) };
        store().updateNode(item.node.id, patch, { silent: true, silentHistory: true });
      });
    } else {
      items.forEach((item) => {
        const patch = {};
        if (mode === 'left') patch.x = minX;
        if (mode === 'right') patch.x = maxX - item.node.w;
        if (mode === 'center-h') patch.x = Math.round((minX + maxX) / 2 - item.node.w / 2);
        if (mode === 'top') patch.y = minY;
        if (mode === 'bottom') patch.y = maxY - item.node.h;
        if (mode === 'center-v') patch.y = Math.round((minY + maxY) / 2 - item.node.h / 2);
        store().updateNode(item.node.id, patch, { silent: true, silentHistory: true });
      });
    }

    store().endBatch();
    store().persist(false);
    FD.bus.emit('doc');
  }

  /* ---------------------------------------------------------------- status */

  function renderStatus() {
    const left = $('status-left');
    const right = $('status-right');
    if (!left || !right) return;
    const flow = store().currentFlow();
    if (!flow) return;
    const stats = store().statsFor(flow.id);
    const chain = store().pathTo(flow.id).map((p) => p.name).join(' / ');
    const sel = FD.sel;

    left.textContent = store().doc.title + '  ·  ' + stats.nodes + ' elements  ·  ' +
      stats.edges + ' connections' +
      (stats.descendants ? '  ·  ' + stats.descendants + ' nested' : '');
    right.textContent = (sel.nodes.size ? sel.nodes.size + ' selected  ·  ' : '') +
      Math.round(vp().k * 100) + '%  ·  grid ' + store().GRID;
  }

  function renderToolbar() {
    const undo = $('btn-undo');
    const redo = $('btn-redo');
    if (undo) undo.disabled = !store().canUndo();
    if (redo) redo.disabled = !store().canRedo();

    const zoom = $('status-zoom');
    if (zoom) zoom.textContent = Math.round(vp().k * 100) + '%';

    const flow = store().currentFlow();
    const name = $('canvas-name');
    if (name && flow) name.textContent = flow.name;

    const outlineOn = !$('sidebar').classList.contains('collapsed');
    $('btn-outline').classList.toggle('is-on', outlineOn);
    const mapOn = FD.render.minimapVisible();
    $('status-map').classList.toggle('on', mapOn);
    $('status-map').setAttribute('aria-pressed', mapOn ? 'true' : 'false');
  }

  function syncAll() {
    renderCrumbs();
    renderTree();
    renderStatus();
    renderToolbar();
  }

  function syncLight() {
    renderStatus();
    renderToolbar();
  }

  /** Put the caret in the selected element's header. */
  function focusName() {
    const first = FD.sel.nodes.size === 1 ? FD.sel.first() : null;
    if (!first) return;
    if (FD.actions.beginInlineEdit) FD.actions.beginInlineEdit(first.node.id, null, 'name');
  }

  /* --------------------------------------------------------------- panels */

  function toggleSidebar(force) {
    const sidebar = $('sidebar');
    const collapsed = force === undefined ? !sidebar.classList.contains('collapsed') : !force;
    sidebar.classList.toggle('collapsed', collapsed);
    store().writeUI({ sidebarCollapsed: collapsed });
    renderToolbar();
    FD.bus.emit('panels');
    return !collapsed;
  }

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    store().writeUI({ theme });
    const dark = theme === 'dark';
    const button = $('btn-theme');
    if (button) button.innerHTML = icon(dark ? 'i-sun' : 'i-moon');
    const darkBtn = $('theme-dark');
    if (darkBtn) {
      darkBtn.classList.toggle('on', dark);
      $('theme-light').classList.toggle('on', !dark);
    }
    FD.render.drawMinimap();
  }

  /* ----------------------------------------------------------- dialogs */

  function openImport() {
    const wrap = h('div', 'section');
    wrap.appendChild(h('p', 'muted',
      'Paste an Ark share link, a JSON document, or drop a .json file. ' +
      'Importing replaces what is currently open — the previous flow is backed up so Undo can bring it back.'));

    const area = document.createElement('textarea');
    area.placeholder = '{ "title": "My flow", "nodes": [ ... ], "edges": [ ... ] }\n\n…or https://…#f=…';
    area.dataset.autofocus = '1';
    wrap.appendChild(area);

    const drop = h('div', 'drop', 'Drop a .json file here, or click to choose');
    const file = document.createElement('input');
    file.type = 'file';
    file.accept = '.json,application/json';
    file.style.display = 'none';
    const fileRow = h('div', 'file-row');
    const fileName = h('span', 'muted', 'No file chosen');
    fileRow.appendChild(fileName);

    drop.addEventListener('click', () => file.click());
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('over');
      const dropped = e.dataTransfer.files && e.dataTransfer.files[0];
      if (dropped) readFile(dropped);
    });
    file.addEventListener('change', () => {
      if (file.files && file.files[0]) readFile(file.files[0]);
    });

    function readFile(f) {
      fileName.textContent = f.name;
      const reader = new FileReader();
      reader.onload = () => { area.value = String(reader.result); };
      reader.readAsText(f);
    }

    wrap.appendChild(drop);
    wrap.appendChild(file);
    wrap.appendChild(fileRow);

    const api = openModal({
      title: 'Import a flow',
      icon: 'i-upload',
      body: wrap,
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: 'Import',
          kind: 'primary',
          icon: 'i-upload',
          close: false,
          onClick: async () => {
            const text = area.value.trim();
            if (!text) {
              toast('Paste something first.', { type: 'err' });
              return false;
            }
            const ok = await FD.app.importText(text, { confirmReplace: true });
            if (ok) api.close();
            return false;
          }
        }
      ]
    });
  }

  async function openShare() {
    const wrap = h('div', 'section');
    wrap.appendChild(h('p', 'muted', 'This link carries the whole flow inside it — no server, no account. ' +
      'Anyone (or any agent) opening it gets the same canvas, including every nested one.'));

    const row = h('div', 'share-row');
    const input = document.createElement('input');
    input.type = 'text';
    input.readOnly = true;
    input.value = 'Building link…';
    input.dataset.autofocus = '1';
    const copyBtn = h('button', 'btn primary', icon('i-copy') + '<span>Copy</span>');
    row.appendChild(input);
    row.appendChild(copyBtn);
    wrap.appendChild(row);

    const meta = h('p', 'muted', '');
    wrap.appendChild(meta);

    const grid = h('div', 'copy-grid');

    const copyJson = h('button', 'btn ghost', icon('i-code') + '<span>Copy JSON</span>');
    copyJson.addEventListener('click', async () => {
      const ok = await FD.share.copyText(JSON.stringify(store().exportDoc(), null, 2));
      toast(ok ? 'Copied the flow JSON.' : 'Copy failed.', { type: ok ? 'ok' : 'err' });
    });

    const copyAgent = h('button', 'btn ghost', icon('i-sparkle') + '<span>Copy for an agent</span>');
    copyAgent.addEventListener('click', () => FD.exporter.copyAgentBundle());

    const saveJson = h('button', 'btn ghost', icon('i-download') + '<span>Download .json</span>');
    saveJson.addEventListener('click', () => FD.exporter.downloadJSON());

    const openNew = h('button', 'btn ghost', icon('i-external') + '<span>Test the link</span>');
    openNew.addEventListener('click', () => {
      if (input.value.indexOf('http') !== 0) return;
      window.open(input.value, '_blank', 'noopener');
    });

    grid.appendChild(copyJson);
    grid.appendChild(copyAgent);
    grid.appendChild(saveJson);
    grid.appendChild(openNew);
    wrap.appendChild(grid);

    let link = '';
    copyBtn.addEventListener('click', async () => {
      const ok = await FD.share.copyText(link);
      toast(ok ? 'Share link copied.' : 'Copy failed — select the field and copy manually.', { type: ok ? 'ok' : 'err' });
    });

    openModal({ title: 'Share this flow', icon: 'i-share', body: wrap });

    try {
      link = await FD.share.buildLink(store().exportDoc());
      input.value = link;
      const bytes = await FD.share.payloadSize(store().exportDoc());
      meta.textContent = bytes.toLocaleString() + ' characters of link' +
        (FD.share.hasCompression() ? ' (compressed)' : ' (this browser cannot compress, link is longer)') +
        '. Long links are fine in chat, email and files.';
    } catch (err) {
      input.value = '';
      meta.textContent = 'Could not build a link: ' + err.message;
    }
  }

  function openHelp() {
    const rows = [
      ['Tools', null],
      ['Select and move', ['V']],
      ['Flow node', ['N']],
      ['Sticky note', ['S']],
      ['Text label', ['T']],
      ['Shape', ['R']],
      ['Sticker', ['E']],
      ['Group frame', ['G']],
      ['Preview node', ['P']],
      ['Point tool back at select', ['Esc']],
      ['Show / hide the toolbar', ['.']],
      ['Show / hide the overview map', ['M']],
      ['Canvas', null],
      ['Open a node\'s own canvas', ['Double-click', 'Enter']],
      ['Edit text on a sticky or label', ['Double-click']],
      ['Go up one level', ['Alt ←']],
      ['Connect two things', ['Drag from a port']],
      ['Pan', ['Drag background', 'Space+drag', 'Wheel']],
      ['Zoom', ['Ctrl + wheel', 'Ctrl ±']],
      ['Fit everything on screen', ['F']],
      ['Reset zoom to 100%', ['Ctrl 0']],
      ['Box select', ['Shift + drag']],
      ['Select all', ['Ctrl A']],
      ['Nudge selection', ['Arrow keys', 'Shift = 20px']],
      ['Editing', null],
      ['Rename selected', ['F2']],
      ['Group the selection', ['Ctrl G']],
      ['Ungroup, keeping contents', ['Ctrl ⇧ G']],
      ['Duplicate', ['Ctrl D']],
      ['Copy / paste', ['Ctrl C', 'Ctrl V']],
      ['Delete selection', ['Del']],
      ['Undo / redo', ['Ctrl Z', 'Ctrl ⇧ Z']],
      ['Tidy up layout', ['Ctrl L']],
      ['Export JSON', ['Ctrl S']],
      ['Panels', null],
      ['Toggle flows panel', ['Ctrl B']],
      ['Write on the selection', ['F2', 'or just type']],
      ['Write in the body', ['click the body']],
      ['Rename document', ['Click the title']]
    ];

    const body = h('div', 'shortcut-grid');
    rows.forEach(([label, keys]) => {
      if (!keys) {
        body.appendChild(h('div', 'shortcut-group', escapeHtml(label)));
        return;
      }
      body.appendChild(h('div', 'label', escapeHtml(label)));
      const keyWrap = h('div', 'keys');
      keys.forEach((k) => keyWrap.appendChild(h('kbd', null, escapeHtml(k))));
      body.appendChild(keyWrap);
    });

    openModal({ title: 'Keyboard shortcuts', icon: 'i-help', body });
  }

  /* --------------------------------------------------------------- buttons */

  function bindToolbar() {
    $('btn-undo').addEventListener('click', () => store().undo());
    $('btn-redo').addEventListener('click', () => store().redo());
    $('status-zoom-in').addEventListener('click', () => vp().setZoom(vp().k * 1.2));
    $('status-zoom-out').addEventListener('click', () => vp().setZoom(vp().k / 1.2));
    $('status-zoom').addEventListener('click', () => vp().setZoom(1));
    $('status-fit').addEventListener('click', () => vp().fit());
    $('status-map').addEventListener('click', () => toggleMinimap());
    $('btn-outline').addEventListener('click', () => toggleSidebar());
    $('btn-close-outline').addEventListener('click', () => toggleSidebar(false));
    $('btn-new-flow').addEventListener('click', () => newCanvas());
    $('btn-more').addEventListener('click', () => openMoreMenu($('btn-more')));
    $('btn-settings').addEventListener('click', () => toggleSettings());
    $('btn-settings-close').addEventListener('click', () => toggleSettings(false));
    $('theme-dark').addEventListener('click', () => { setTheme('dark'); toggleSettings(true); });
    $('theme-light').addEventListener('click', () => { setTheme('light'); toggleSettings(true); });
    $('canvas-menu').addEventListener('click', () => openCanvasActions($('canvas-menu')));

    const snap = $('opt-snap');
    const anim = $('opt-anim');
    const mapOpt = $('opt-map');
    snap.addEventListener('change', () => {
      FD.app.snap = snap.checked;
      store().writeUI({ snap: snap.checked });
    });
    anim.addEventListener('change', () => {
      FD.render.setAnimated(anim.checked);
      store().writeUI({ animated: anim.checked });
    });
    mapOpt.addEventListener('change', () => toggleMinimap(mapOpt.checked));
  }

  /* --------------------------------------------------------- canvas menu */

  function openCanvasActions(anchor) {
    const rect = anchor.getBoundingClientRect();
    const flow = store().currentFlow();
    const parent = store().parentOf(store().currentFlowId);
    const selected = store().nodesByIds(Array.from(FD.sel.nodes));
    const one = selected.length === 1 ? selected[0] : null;
    const canNest = one && store().kindSpec(one.kind).subflow && !one.child;

    showMenu(rect.left, rect.bottom + 8, [
      { label: 'New canvas inside this one…', icon: 'i-plus', action: () => newCanvas() },
      { label: 'New base canvas…', icon: 'i-layers', action: () => newBaseFlow() },
      {
        label: canNest
          ? 'New canvas inside "' + (store().labelOf(one) || 'the selection') + '"'
          : 'New canvas inside the selection',
        icon: 'i-node',
        disabled: !canNest,
        action: () => newCanvas(one.id)
      },
      'sep',
      { label: 'Rename this canvas…', icon: 'i-pencil', action: async () => {
        const name = await promptDialog({ title: 'Rename canvas', label: 'Canvas name', value: flow.name });
        if (name !== null) store().renameFlow(flow.id, name);
      } },
      'sep',
      { label: 'Open the outline', icon: 'i-panel', kbd: 'Ctrl B', action: () => toggleSidebar(true) },
      {
        label: parent ? 'Delete this canvas' : 'Delete this base canvas',
        icon: 'i-trash',
        danger: true,
        disabled: flow.id === store().doc.rootId,
        action: () => deleteCanvas(flow.id)
      }
    ]);
  }

  /* ------------------------------------------------------------- ⋯ menu */

  function openMoreMenu(anchor) {
    const rect = anchor.getBoundingClientRect();
    const dark = document.documentElement.dataset.theme === 'dark';
    showMenu(Math.min(rect.left - 130, window.innerWidth - 252), rect.bottom + 8, [
      { label: 'Share this flow…', icon: 'i-share', action: () => openShare() },
      { label: 'Copy JSON', icon: 'i-code', action: async () => {
        const ok = await FD.share.copyText(JSON.stringify(store().exportDoc(), null, 2));
        toast(ok ? 'Copied the flow JSON.' : 'Copy failed.', { type: ok ? 'ok' : 'err' });
      } },
      { label: 'Copy for an agent', icon: 'i-sparkle', action: () => FD.exporter.copyAgentBundle() },
      'sep',
      { label: 'Rename workspace…', icon: 'i-pencil', action: async () => {
        const name = await promptDialog({
          title: 'Workspace name',
          message: 'The workspace name is what exports are called and what the browser tab shows.',
          label: 'Name',
          value: store().doc.title
        });
        if (name !== null) store().setTitle(name);
      } },
      'sep',
      { label: dark ? 'Light mode' : 'Dark mode', icon: dark ? 'i-sun' : 'i-moon',
        action: () => setTheme(dark ? 'light' : 'dark') },
      'sep',
      { label: 'Import…', icon: 'i-upload', action: () => openImport() },
      { label: 'Export JSON', icon: 'i-file', kbd: 'Ctrl S', action: () => FD.exporter.downloadJSON() },
      { label: 'Export PNG image', icon: 'i-image', action: () => FD.exporter.downloadPNG() },
      { label: 'Export SVG image', icon: 'i-image', action: () => FD.exporter.downloadSVG() },
      'sep',
      { label: 'Tidy up layout', icon: 'i-layout', kbd: 'Ctrl L', action: () => {
        if (store().autoLayout()) toast('Tidied up the layout.');
      } },
      { label: 'Show the toolbar', icon: 'i-dock', kbd: '.', action: () => toggleDock(true) },
      { label: 'Overview map', icon: 'i-minimap', kbd: 'M', action: () => toggleMinimap() },
      { label: 'Keyboard shortcuts', icon: 'i-help', kbd: '?', action: () => openHelp() }
    ]);
  }

  /* ------------------------------------------------------ settings panel */

  function toggleSettings(show) {
    const panel = $('settings-panel');
    const open = panel.hidden;
    const next = show === undefined ? open : !!show;
    panel.hidden = !next;
    const button = $('btn-settings');
    button.classList.toggle('on', next);
    button.setAttribute('aria-pressed', next ? 'true' : 'false');
    if (next) {
      const dark = document.documentElement.dataset.theme === 'dark';
      $('theme-dark').classList.toggle('on', dark);
      $('theme-light').classList.toggle('on', !dark);
      $('opt-map').checked = FD.render.minimapVisible();
    }
    return next;
  }

  /* ------------------------------------------------------------------ dock */

  const EMOJIS = [
    '⭐', '✅', '❌', '⚠️', '🔥', '💡', '🎯', '🚀',
    '🐛', '📌', '❤️', '👍', '👎', '🙌', '🎉', '⏰',
    '📈', '🧠', '🛠️', '💬', '📎', '🔒', '💰', '🧪',
    '🟢', '🟡', '🔴', '🔵', '⚡', '✨', '🧩', '📝'
  ];

  const SHAPE_CHOICES = [
    ['rect', 'i-shape-rect', 'Rectangle'],
    ['ellipse', 'i-shape-ellipse', 'Ellipse'],
    ['diamond', 'i-shape-diamond', 'Diamond']
  ];

  function toggleDock(show) {
    const dock = $('dock');
    const visible = show === undefined ? dock.classList.contains('hidden') : !!show;
    dock.classList.toggle('hidden', !visible);
    $('dock-restore').hidden = visible;
    store().writeUI({ dockHidden: !visible });
    return visible;
  }

  function toggleMinimap(show) {
    const on = show === undefined ? !FD.render.minimapVisible() : !!show;
    FD.render.toggleMinimap(on);
    const button = $('status-map');
    if (button) {
      button.classList.toggle('on', on);
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    const opt = $('opt-map');
    if (opt) opt.checked = on;
    store().writeUI({ minimap: on });
    return on;
  }

  function bindDock() {
    document.querySelectorAll('.dock-tool[data-tool]').forEach((button) => {
      button.addEventListener('click', () => {
        const name = button.dataset.tool;
        if (name === 'shape' && FD.actions.tool.active === 'shape') {
          const index = SHAPE_CHOICES.findIndex(([shape]) => shape === FD.actions.tool.shape);
          const next = SHAPE_CHOICES[(index + 1) % SHAPE_CHOICES.length][0];
          act().setTool('shape', { shape: next });
          return;
        }
        act().setTool(name);
      });
    });
    $('dock-hide').addEventListener('click', () => toggleDock(false));
    $('dock-restore').addEventListener('click', () => toggleDock(true));
    renderDock(FD.actions.tool);
  }

  function renderDock(state) {
    const tool = state || FD.actions.tool;
    document.querySelectorAll('.dock-tool[data-tool]').forEach((button) => {
      button.classList.toggle('active', button.dataset.tool === tool.active);
    });
    renderDockOptions(tool);
  }

  function renderDockOptions(tool) {
    const box = $('dock-options');
    if (!box) return;
    box.innerHTML = '';

    if (tool.active === 'shape') {
      box.hidden = false;
      SHAPE_CHOICES.forEach(([shape, iconName, label]) => {
        const button = h('button', 'shape-pick' + (tool.shape === shape ? ' active' : ''), icon(iconName));
        button.title = label;
        button.setAttribute('aria-label', label);
        button.addEventListener('click', () => act().setTool('shape', { shape }));
        box.appendChild(button);
      });
      return;
    }

    if (tool.active === 'sticker') {
      box.hidden = false;
      EMOJIS.forEach((emoji) => {
        const button = h('button', 'emoji-pick' + (tool.emoji === emoji ? ' active' : ''), escapeHtml(emoji));
        button.title = 'Sticker ' + emoji;
        button.addEventListener('click', () => act().setTool('sticker', { emoji }));
        box.appendChild(button);
      });
      return;
    }

    box.hidden = true;
  }

  function handleShortcut(e) {
    if (modalOpen()) {
      if (e.key === 'Escape') {
        const top = modalStack[modalStack.length - 1];
        if (top) top.close();
      }
      return true;
    }
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === '?') {
      e.preventDefault();
      openHelp();
      return true;
    }
    if (e.key === '.' && !mod) {
      e.preventDefault();
      toggleDock();
      return true;
    }
    if (e.key.toLowerCase() === 'm' && !mod && !e.altKey) {
      e.preventDefault();
      toggleMinimap();
      return true;
    }
    if (mod && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      toggleSidebar();
      return true;
    }
    if (mod && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      focusName();
      return true;
    }
    if (mod && e.shiftKey && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      openMoreMenu($('btn-more'));
      return true;
    }
    if (e.key === 'Escape' && !$('menu').hidden) {
      closeMenu();
      return true;
    }
    return false;
  }

  /* ----------------------------------------------------------------- init */

  function init() {
    bindToolbar();
    bindDock();

    const ui = store().uiState || {};
    setTheme(ui.theme === 'light' ? 'light' : 'dark');
    // the outline is an overlay now: hidden unless you asked for it
    toggleSidebar(ui.sidebarCollapsed !== false ? false : true);
    if (ui.dockHidden) toggleDock(false);
    toggleMinimap(ui.minimap === true);
    const snap = $('opt-snap');
    const anim = $('opt-anim');
    snap.checked = !!ui.snap;
    anim.checked = ui.animated !== false;
    FD.app.snap = snap.checked;
    FD.render.setAnimated(anim.checked);

    FD.bus.on('doc', syncAll);
    FD.bus.on('nav', syncAll);
    FD.bus.on('title', renderToolbar);
    FD.bus.on('tool', renderDock);
    FD.bus.on('selection', renderStatus);
    FD.bus.on('viewport', syncLight);
    FD.bus.on('doc-lite', () => {
      renderStatus();
      syncLight();
    });
    FD.bus.on('toast', (payload) => toast(payload.message, payload));
    FD.bus.on('save-error', () => {
      toast('Could not save to this browser — storage may be full.', { type: 'err', duration: 5000 });
    });

    window.addEventListener('resize', () => {
      FD.render.drawMinimap();
      renderStatus();
    });
  }

  FD.ui = {
    init,
    syncAll,
    toast,
    modal: openModal,
    confirm: confirmDialog,
    prompt: promptDialog,
    showMenu,
    closeMenu,
    modalOpen,
    openShare,
    openImport,
    openHelp,
    focusName,
    toggleSidebar,
    alignNodes,
    toggleSettings,
    setTheme,
    handleShortcut
  };
})(window.FD = window.FD || {});
