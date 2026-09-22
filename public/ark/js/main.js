/* ==========================================================================
   main.js — boot, wiring and the small public surface other scripts use.
   ========================================================================== */
(function (FD) {
  'use strict';

  const store = () => FD.store;

  FD.app = {
    snap: false,
    ready: false,
    toast: (message, opts) => FD.ui.toast(message, opts),
    importText,
    exportJSON: () => FD.exporter.downloadJSON(),
    toJSON: () => store().exportDoc()
  };

  /* --------------------------------------------------------------- import */

  async function importText(text, opts) {
    const options = opts || {};
    let next;
    try {
      const raw = await FD.share.decodeAny(text);
      next = store().normalizeDoc(raw);
    } catch (err) {
      FD.ui.toast(err && err.message ? err.message : 'Could not read that flow.', { type: 'err', duration: 5200 });
      return false;
    }

    if (options.confirmReplace !== false && !store().isEmpty()) {
      const ok = await FD.ui.confirm({
        title: 'Replace the open flow?',
        message: '"' + store().doc.title + '" will be replaced by "' + next.title +
          '". Ctrl+Z brings the old one back.',
        confirmText: 'Replace',
        danger: true
      });
      if (!ok) return false;
    }

    store().replaceDoc(next);
    FD.sel.clear();
    FD.viewport.fit(120);
    FD.ui.toast('Opened "' + next.title + '".', {
      type: 'ok',
      action: { label: 'Undo', onClick: () => store().undo() }
    });
    return true;
  }

  /* ----------------------------------------------------------- navigation */

  function onNav() {
    const flow = store().currentFlow();
    FD.viewport.loadFromStore();
    if (flow && !flow.nodes.length) {
      const view = flow.view || { x: 0, y: 0, k: 1 };
      if (view.x === 0 && view.y === 0 && view.k === 1) {
        const size = FD.viewport.size();
        FD.viewport.set({ x: Math.round(size.w / 2), y: Math.round(size.h / 2), k: 1 });
      }
    }
    FD.render.all();
  }

  /* ----------------------------------------------------------------- boot */

  async function boot() {
    FD.render.init();
    FD.ui.init();
    FD.actions.init();

    store().load();

    FD.bus.on('doc', () => FD.render.all());
    FD.bus.on('doc-lite', () => FD.render.nodesOnly());
    FD.bus.on('nav', onNav);
    FD.bus.on('selection', () => FD.render.renderSelection());
    FD.bus.on('panels', () => FD.render.drawMinimap());
    FD.bus.on('title', () => FD.render.drawMinimap());

    FD.render.all();
    FD.viewport.loadFromStore();
    if (!store().currentFlow().nodes.length) {
      const size = FD.viewport.size();
      FD.viewport.set({ x: Math.round(size.w / 2), y: Math.round(size.h / 2), k: 1 });
    } else {
      FD.viewport.fit(120);
    }
    FD.ui.syncAll();
    FD.app.ready = true;

    await openSharedFlowIfPresent();

    if (FD.sel.nodes.size === 0 && FD.store.currentFlow().nodes.length) {
      FD.bus.emit('selection');
    }
  }

  async function openSharedFlowIfPresent() {
    const payload = FD.share.readHash();
    if (!payload) return;
    FD.share.clearHash();

    let raw;
    try {
      raw = await FD.share.decode(payload);
    } catch (err) {
      FD.ui.toast('That share link could not be read — it may be truncated.', { type: 'err', duration: 6000 });
      return;
    }

    if (store().isEmpty()) {
      await importText(raw, { confirmReplace: false });
      return;
    }

    const ok = await FD.ui.confirm({
      title: 'Open the shared flow?',
      message: 'This link contains "' + (raw.title || 'a flow') +
        '". Opening it replaces what is currently in this browser — Ctrl+Z brings your flow back.',
      confirmText: 'Open shared flow',
      danger: true
    });
    if (ok) await importText(raw, { confirmReplace: false });
  }

  /* -------------------------------------------------------------- offline */

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    // service workers need a real origin — file:// pages just skip this
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;

    // attach the manifest here rather than in the markup: a <link rel=manifest>
    // on a file:// page is a CORS failure and only adds noise to the console
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = 'manifest.webmanifest';
    document.head.appendChild(link);

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((err) => {
        console.warn('Offline support unavailable:', err.message);
      });
    });
  }

  // NOTE (prmptly): the offline service worker is intentionally not shipped in this
  // embedded copy (sw.js is absent), so the registration is disabled rather than firing
  // a 404 on every boot. Nothing inside the app depends on offline caching.
  // registerServiceWorker();

  window.addEventListener('beforeunload', () => {
    store().persist(true);
    store().writeUI({ currentFlowId: store().currentFlowId });
  });

  // A share link pasted into the address bar of an already-open tab only
  // changes the hash — no reload — so watch for it explicitly.
  window.addEventListener('hashchange', () => {
    if (FD.app.ready) openSharedFlowIfPresent();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.Ark = FD;
})(window.FD = window.FD || {});
