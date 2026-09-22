/* ==========================================================================
   export.js — take the flow out of the browser.

   • JSON      the whole document, for importing somewhere else
   • SVG/PNG   a picture of the canvas you are looking at
   • Agent     a prompt-shaped bundle (context + schema + JSON)
   ========================================================================== */
(function (FD) {
  'use strict';

  const store = () => FD.store;

  function cssVar(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  function escapeXml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function toRgb(hex) {
    const match = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!match) return null;
    const value = parseInt(match[1], 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  }

  /** Mix two hex colours — stands in for colour-mix() inside exported SVG. */
  function blend(a, b, amount) {
    const first = toRgb(a);
    const second = toRgb(b);
    if (!first || !second) return a;
    return '#' + [0, 1, 2].map((i) => {
      const mixed = Math.round(first[i] + (second[i] - first[i]) * amount);
      return mixed.toString(16).padStart(2, '0');
    }).join('');
  }

  function slug(text) {
    return String(text || 'flow')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'flow';
  }

  function stamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes());
  }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function downloadText(filename, text, mime) {
    downloadBlob(filename, new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' }));
  }

  /* --------------------------------------------------------------- JSON */

  function downloadJSON() {
    const doc = store().exportDoc();
    downloadText(slug(doc.title) + '-' + stamp() + '.json', JSON.stringify(doc, null, 2), 'application/json');
    FD.bus.emit('toast', { message: 'Downloaded ' + doc.title + '.json', type: 'ok' });
  }

  function downloadFlowTree() {
    const tree = store().exportFlowTree();
    if (!tree) return;
    downloadText(slug(tree.title) + '-' + slug(tree.root) + '.json', JSON.stringify(tree, null, 2), 'application/json');
  }

  /* ---------------------------------------------------------------- SVG */

  /** A one-line label for an element, whatever it holds. */
  function labelOf(node) {
    return FD.md.heading(node.name) || firstWords(node.name) || '(untitled)';
  }

  function firstWords(text) {
    const first = FD.md.lines(text).find((item) => item.text);
    return first ? first.text.slice(0, 48).trim() : '';
  }

  function wrapText(text, maxChars, maxLines) {
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let current = '';
    for (const word of words) {
      const candidate = current ? current + ' ' + word : word;
      if (candidate.length > maxChars && current) {
        lines.push(current);
        current = word;
        if (lines.length >= maxLines) break;
      } else {
        current = candidate;
      }
    }
    if (lines.length < maxLines && current) lines.push(current);
    return lines.slice(0, maxLines);
  }

  /**
   * Flatten an element's markup into laid-out rows, so an export draws exactly
   * the lines the canvas shows.
   */
  function mdRows(text, maxChars) {
    const rows = [];
    FD.md.lines(text).forEach((item) => {
      if (!item.text) {
        if (rows.length && rows[rows.length - 1].text !== '') rows.push({ text: '', heading: false });
        return;
      }
      const bullet = item.type === 'bullet' || item.type === 'number';
      const prefix = item.type === 'bullet' ? '•  '
        : item.type === 'number' ? item.marker + '  ' : '';
      const width = Math.max(8, maxChars - (bullet ? 3 : 0));
      wrapText(prefix + item.text, width, 8).forEach((line, index) => {
        rows.push({ text: index ? '   ' + line : line, heading: FD.md.isHeading(item.type) });
      });
    });
    while (rows.length && rows[rows.length - 1].text === '') rows.pop();
    return rows;
  }

  /** The same anchor + curve maths the canvas uses, so exports match. */
  function edgePathFor(a, b, fromSide, toSide) {
    const start = FD.render.anchor(a, fromSide || 'right');
    const end = FD.render.anchor(b, toSide || 'left');
    return FD.render.curveBetween(start, end);
  }

  function flowToSVG(flowId, opts) {
    const options = opts || {};
    const flow = store().flow(flowId || store().currentFlowId);
    if (!flow) return null;

    const pad = 70;
    const headerH = 84;
    const bounds = FD.viewport.contentBounds(flow) || { x: 0, y: 0, w: 600, h: 300 };
    const width = Math.max(bounds.w + pad * 2, 520);
    const height = Math.max(bounds.h + pad * 2, 300);
    const ox = pad - bounds.x;
    const oy = pad - bounds.y + headerH;

    const c = {
      bg: cssVar('--bg-canvas', '#0b0e15'),
      card: cssVar('--node-bg-plain', '#171c28'),
      border: cssVar('--node-border', '#2c3448'),
      text: cssVar('--node-text', '#eef2fb'),
      dim: cssVar('--node-dim', '#8d99b6'),
      faint: cssVar('--text-faint', '#67718c'),
      edge: cssVar('--edge', '#3d4763'),
      accent: cssVar('--accent', '#6d8bff')
    };

    const nodes = new Map(flow.nodes.map((n) => [n.id, n]));
    const chunks = [];

    chunks.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + Math.round(width) +
      '" height="' + Math.round(height) + '" viewBox="0 0 ' + Math.round(width) + ' ' + Math.round(height) +
      '" font-family="Inter, Segoe UI, Helvetica, Arial, sans-serif">');
    chunks.push('<defs>');
    chunks.push('<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0.6 L9 5 L0 9.4 z" fill="' + c.edge + '"/></marker>');
    for (const n of flow.nodes) {
      chunks.push('<clipPath id="clip-' + n.id + '"><rect x="' + n.x + '" y="' + n.y + '" width="' + n.w +
        '" height="' + n.h + '" rx="14"/></clipPath>');
    }
    chunks.push('</defs>');

    chunks.push('<rect width="100%" height="100%" fill="' + c.bg + '"/>');

    const crumbs = store().pathTo(flow.id).map((p) => p.name);
    const title = store().doc.title;
    chunks.push('<text x="' + pad + '" y="40" font-size="21" font-weight="650" fill="' + c.text + '">' +
      escapeXml(title) + '</text>');
    chunks.push('<text x="' + pad + '" y="63" font-size="12.5" fill="' + c.faint + '">' +
      escapeXml(crumbs.join('  ›  ')) + '   ·   ' + flow.nodes.length + ' nodes · ' +
      flow.edges.length + ' connections</text>');
    chunks.push('<line x1="' + pad + '" y1="' + (headerH - 12) + '" x2="' + (width - pad) + '" y2="' +
      (headerH - 12) + '" stroke="' + c.border + '" stroke-width="1"/>');

    chunks.push('<g transform="translate(' + ox + ' ' + oy + ')">');

    chunks.push('<g stroke="' + c.edge + '" stroke-width="1.75" fill="none" marker-end="url(#arrow)">');
    for (const e of flow.edges) {
      const a = nodes.get(e.from);
      const b = nodes.get(e.to);
      if (!a || !b) continue;
      chunks.push('<path d="' + edgePathFor(a, b, e.fromSide, e.toSide).d + '"/>');
    }
    chunks.push('</g>');

    chunks.push('<g font-size="10.5" font-weight="600" fill="' + c.dim + '" text-anchor="middle">');
    for (const e of flow.edges) {
      if (!e.label) continue;
      const a = nodes.get(e.from);
      const b = nodes.get(e.to);
      if (!a || !b) continue;
      const geo = edgePathFor(a, b, e.fromSide, e.toSide);
      chunks.push('<text x="' + geo.mid.x.toFixed(1) + '" y="' + geo.mid.y.toFixed(1) + '">' +
        escapeXml(e.label) + '</text>');
    }
    chunks.push('</g>');

    for (const n of flow.nodes) {
      const kind = n.kind || 'node';
      const accent = cssVar('--c-' + n.color, c.accent);
      const centreX = n.x + n.w / 2;
      const centreY = n.y + n.h / 2;
      chunks.push('<g>');

      if (kind === 'sticker') {
        chunks.push('<text x="' + centreX + '" y="' + centreY + '" font-size="' +
          Math.round(Math.min(n.w, n.h) * 0.6) + '" text-anchor="middle" dominant-baseline="central">' +
          escapeXml(n.name) + '</text>');
        chunks.push('</g>');
        continue;
      }

      if (kind === 'text') {
        const rows = mdRows(n.name, Math.max(8, Math.floor((n.w - 16) / 7.6)));
        chunks.push('<g font-size="15" font-weight="560" fill="' + accent + '">');
        rows.slice(0, 8).forEach((row, i) => {
          chunks.push('<text x="' + (n.x + 8) + '" y="' + (n.y + 24 + i * 20) + '"' +
            (row.heading ? ' font-weight="680">' : '>') + escapeXml(row.text) + '</text>');
        });
        chunks.push('</g></g>');
        continue;
      }

      if (kind === 'shape') {
        const shape = n.shape || 'rect';
        if (shape === 'ellipse') {
          chunks.push('<ellipse cx="' + centreX + '" cy="' + centreY + '" rx="' + (n.w / 2 - 1) +
            '" ry="' + (n.h / 2 - 1) + '" fill="' + c.card + '" stroke="' + c.border + '" stroke-width="1.2"/>');
        } else if (shape === 'diamond') {
          chunks.push('<polygon points="' + centreX + ',' + n.y + ' ' + (n.x + n.w) + ',' + centreY + ' ' +
            centreX + ',' + (n.y + n.h) + ' ' + n.x + ',' + centreY + '" fill="' + c.card +
            '" stroke="' + c.border + '" stroke-width="1.2"/>');
        } else {
          chunks.push('<rect x="' + n.x + '" y="' + n.y + '" width="' + n.w + '" height="' + n.h +
            '" rx="14" fill="' + c.card + '" stroke="' + c.border + '" stroke-width="1.2"/>');
        }
      } else {
        const fill = kind === 'sticky' ? blend(accent, c.card, 0.76) : c.card;
        const stroke = kind === 'sticky' ? blend(accent, c.card, 0.5) : c.border;
        chunks.push('<rect x="' + n.x + '" y="' + n.y + '" width="' + n.w + '" height="' + n.h +
          '" rx="' + (kind === 'sticky' ? 6 : 14) + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1"/>');
      }

      const textX = kind === 'shape' ? centreX : n.x + 18;
      const anchor = kind === 'shape' ? 'middle' : 'start';
      const wrapWidth = Math.max(18, Math.floor((n.w - 36) / 6.1));
      const rows = mdRows(n.name, wrapWidth);
      const firstY = kind === 'shape' ? centreY - (rows.length > 1 ? 14 : -5) : n.y + 26;
      // the first row is the element's own line, the rest is what it says
      const lead = rows.length ? rows[0] : { text: '', heading: false };
      chunks.push('<text x="' + textX + '" y="' + firstY + '" font-size="13" font-weight="' +
        (lead.heading ? 680 : 620) + '" text-anchor="' + anchor + '" fill="' + c.text + '">' +
        escapeXml(lead.text) + '</text>');

      if (n.child && store().flow(n.child)) {
        const count = store().flow(n.child).nodes.length;
        const badge = count + (count === 1 ? ' step' : ' steps');
        chunks.push('<text x="' + (n.x + n.w - 16) + '" y="' + (n.y + 26) +
          '" font-size="10" font-weight="700" text-anchor="end" fill="' + accent + '">▣ ' +
          escapeXml(String(badge)) + '</text>');
      }

      if (rows.length > 1) {
        chunks.push('<g font-size="11.5" fill="' + c.dim + '" text-anchor="' + anchor + '">');
        rows.slice(1, 7).forEach((row, i) => {
          const baseY = kind === 'shape' ? centreY + 6 + i * 15.5 : n.y + 48 + i * 15.5;
          chunks.push('<text x="' + textX + '" y="' + baseY +
            (row.heading ? '" font-weight="680">' : '">') +
            escapeXml(row.text) + '</text>');
        });
        chunks.push('</g>');
      }

      if (store().kindSpec(kind).ports) {
        const sides = ['top', 'right', 'bottom', 'left'];
        sides.forEach((side) => {
          const point = FD.render.anchor(n, side);
          chunks.push('<circle cx="' + point.x + '" cy="' + point.y + '" r="4" fill="' + c.bg +
            '" stroke="' + c.border + '" stroke-width="1.4"/>');
        });
      }
      chunks.push('</g>');
    }

    if (!flow.nodes.length) {
      chunks.push('<text x="' + (width / 2) + '" y="' + (height / 2) +
        '" font-size="14" text-anchor="middle" fill="' + c.faint + '">This canvas is empty</text>');
    }

    chunks.push('<text x="' + pad + '" y="' + (height - 22) + '" font-size="11" fill="' + c.faint +
      '">Exported from Ark · ' + new Date().toISOString().slice(0, 10) + '</text>');

    chunks.push('</g>');
    chunks.push('</svg>');
    return chunks.join('\n');
  }

  function downloadSVG() {
    const svg = flowToSVG();
    if (!svg) return;
    const flow = store().currentFlow();
    downloadText(slug(store().doc.title) + '-' + slug(flow.name) + '.svg', svg, 'image/svg+xml');
    FD.bus.emit('toast', { message: 'Exported SVG.', type: 'ok' });
  }

  function downloadPNG(scale) {
    const svg = flowToSVG();
    if (!svg) return;
    const factor = scale || 2;
    const doc = store().doc;
    const flow = store().currentFlow();
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * factor);
      canvas.height = Math.round(img.height * factor);
      const ctx = canvas.getContext('2d');
      ctx.scale(factor, factor);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((out) => {
        if (!out) {
          FD.bus.emit('toast', { message: 'PNG export failed.', type: 'err' });
          return;
        }
        downloadBlob(slug(doc.title) + '-' + slug(flow.name) + '.png', out);
        FD.bus.emit('toast', { message: 'Exported PNG.', type: 'ok' });
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      FD.bus.emit('toast', { message: 'Could not render the PNG.', type: 'err' });
    };
    img.src = url;
  }

  /* --------------------------------------------------------------- agent */

  /** The current canvas and everything nested below it, content only. */
  function semanticOutline(flowId) {
    const store = FD.store;
    const rootId = flowId || store.currentFlowId;
    const lines = [];
    const flowIds = store.descendantFlowIds(rootId);

    let elements = 0;
    let annotated = 0;
    flowIds.forEach((id) => {
      const flow = store.flow(id);
      if (!flow) return;
      elements += flow.nodes.length;
      flow.nodes.forEach((n) => { if (!FD.md.isEmpty(n.name)) annotated += 1; });
    });

    lines.push('# ' + store.doc.title);
    lines.push('');
    lines.push(flowIds.length + (flowIds.length === 1 ? ' canvas' : ' canvases') + ' · ' +
      elements + (elements === 1 ? ' element' : ' elements') +
      (annotated ? ' · ' + annotated + ' written' : ''));
    lines.push('');

    flowIds.forEach((id) => {
      const flow = store.flow(id);
      if (!flow) return;
      const path = store.pathTo(id).map((p) => p.name).join(' › ');

      lines.push('## ' + path);
      lines.push('');

      if (!flow.nodes.length) {
        lines.push('(empty)');
        lines.push('');
        return;
      }

      const byId = new Map(flow.nodes.map((n) => [n.id, n]));
      const outgoing = new Map();
      flow.edges.forEach((edge) => {
        if (!outgoing.has(edge.from)) outgoing.set(edge.from, []);
        outgoing.get(edge.from).push(edge);
      });

      const emit = (node, depth) => {
        const pad = '    '.repeat(depth);
        const group = store.kindSpec(node.kind).container;
        const head = FD.md.heading(node.name);
        const body = FD.md.lines(node.name)
          .filter((item) => !FD.md.isHeading(item.type) && item.text);
        lines.push(pad + '- ' + labelOf(node) +
          (node.child && store.flow(node.child) ? '  → opens its own canvas' : ''));
        body.forEach((item) => {
          const mark = item.type === 'bullet' ? '•  '
            : item.type === 'number' ? item.marker + '  ' : '';
          lines.push(pad + '    ' + mark + item.text);
        });
        (outgoing.get(node.id) || []).forEach((edge) => {
          const to = byId.get(edge.to);
          if (!to) return;
          lines.push(pad + '    → ' + labelOf(to) + (edge.label ? '  [' + edge.label + ']' : ''));
        });
        if (group) {
          flow.nodes.filter((n) => n.parent === node.id).forEach((kid) => emit(kid, depth + 1));
        }
      };

      flow.nodes.filter((n) => !n.parent).forEach((node) => emit(node, 0));

      lines.push('');
    });

    return lines.join('\n').trimEnd();
  }

  /** The same information, in a shape Ark can import again. */
  function semanticJSON(flowId) {
    const store = FD.store;
    const build = (id) => {
      const flow = store.flow(id);
      const out = { name: flow.name, nodes: [] };
      const byId = new Map(flow.nodes.map((n) => [n.id, n]));

      const describe = (node) => {
        const item = {};
        if (node.kind && node.kind !== 'node') item.kind = node.kind;
        if (node.shape) item.shape = node.shape;
        // the element's text, markers and all, so it imports back identically
        if (node.name) item.name = node.name;
        if (node.child && store.flow(node.child)) item.child = build(node.child);
        if (store.kindSpec(node.kind).container) {
          const members = flow.nodes.filter((n) => n.parent === node.id).map(describe);
          if (members.length) item.children = members;
        }
        return item;
      };

      flow.nodes.filter((n) => !n.parent).forEach((node) => out.nodes.push(describe(node)));

      const edges = [];
      flow.edges.forEach((edge) => {
        const from = byId.get(edge.from);
        const to = byId.get(edge.to);
        if (!from || !to) return;
        edges.push(edge.label
          ? [labelOf(from), labelOf(to), edge.label]
          : [labelOf(from), labelOf(to)]);
      });
      if (edges.length) out.edges = edges;
      return out;
    };

    const root = build(flowId || store.currentFlowId);
    const doc = { title: store.doc.title };
    if (root.nodes.length) doc.nodes = root.nodes;
    if (root.edges) doc.edges = root.edges;
    return doc;
  }

  function agentBundle() {
    return [
      semanticOutline(),
      '',
      '--- importable JSON (no coordinates) ---',
      '',
      '```json',
      JSON.stringify(semanticJSON(), null, 2),
      '```',
      ''
    ].join('\n');
  }

  function copyAgentBundle() {
    const text = agentBundle();
    return FD.share.copyText(text).then((ok) => {
      if (ok) FD.bus.emit('toast', { message: 'Copied a ready-to-use flow bundle for your agent.', type: 'ok' });
      else FD.bus.emit('toast', { message: 'Copy failed — select the text and copy it manually.', type: 'err' });
      return ok;
    });
  }

  FD.exporter = {
    downloadJSON,
    downloadFlowTree,
    downloadSVG,
    downloadPNG,
    downloadText,
    downloadBlob,
    flowToSVG,
    agentBundle,
    semanticOutline,
    semanticJSON,
    copyAgentBundle,
    slug,
    stamp
  };
})(window.FD = window.FD || {});
