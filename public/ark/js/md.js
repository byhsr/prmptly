/* ==========================================================================
   md.js — the tiny bit of markup element text is written in.

   Element text is plain writing. A few leading marks give it shape:
     ## heading        - bullet            > quote
     ### subheading    1. numbered         --- rule
   Everything else is a paragraph. Inline **bold**, *italic* and `code` work.
   ========================================================================== */
(function (FD) {
  'use strict';

  const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ESCAPES[c]);
  }

  function inline(text) {
    return escapeHtml(text)
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^A-Za-z0-9*])\*([^*\n]+)\*(?![A-Za-z0-9*])/g, '$1<em>$2</em>')
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
  }

  /**
   * Split text into typed lines. Every consumer — the canvas, the outline, the
   * SVG and text exporters — reads the same parse, so what you write is what
   * you get.
   */
  function lines(text) {
    const out = [];
    String(text == null ? '' : text).split(/\r?\n/).forEach((raw) => {
      const line = raw.replace(/\s+$/, '');
      if (!line.trim()) {
        out.push({ type: 'blank', text: '' });
        return;
      }
      let match = /^(#{1,3})\s+(.*)$/.exec(line);
      if (match) {
        out.push({ type: 'h' + match[1].length, text: match[2].trim() });
        return;
      }
      match = /^[-*+]\s+(.*)$/.exec(line);
      if (match) {
        out.push({ type: 'bullet', text: match[1].trim() });
        return;
      }
      match = /^(\d+)[.)]\s+(.*)$/.exec(line);
      if (match) {
        out.push({ type: 'number', text: match[2].trim(), marker: match[1] + '.' });
        return;
      }
      match = /^>\s?(.*)$/.exec(line);
      if (match) {
        out.push({ type: 'quote', text: match[1].trim() });
        return;
      }
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
        out.push({ type: 'rule', text: '' });
        return;
      }
      out.push({ type: 'p', text: line });
    });
    return out;
  }

  function isHeading(type) { return type === 'h1' || type === 'h2' || type === 'h3'; }

  function html(text) {
    const parsed = lines(text);
    let out = '';
    let list = null;

    const closeList = () => {
      if (list) {
        out += '</' + list + '>';
        list = null;
      }
    };

    parsed.forEach((item) => {
      if (item.type === 'bullet' || item.type === 'number') {
        const tag = item.type === 'bullet' ? 'ul' : 'ol';
        if (list !== tag) {
          closeList();
          out += '<' + tag + '>';
          list = tag;
        }
        out += '<li>' + inline(item.text) + '</li>';
        return;
      }
      closeList();
      if (item.type === 'blank') return;
      if (item.type === 'rule') { out += '<hr>'; return; }
      if (isHeading(item.type)) {
        out += '<div class="md-h md-' + item.type + '">' + inline(item.text) + '</div>';
        return;
      }
      out += '<div class="md-' + item.type + '">' + inline(item.text) + '</div>';
    });

    closeList();
    return out;
  }

  /** The same parse as plain lines — for the exporters and the outline. */
  function plain(text) {
    return lines(text).map((item) => {
      if (item.type === 'bullet') return '• ' + item.text;
      if (item.type === 'number') return item.marker + ' ' + item.text;
      if (item.type === 'blank' || item.type === 'rule') return '';
      return item.text;
    });
  }

  /** Just the headings — used for labels and for the agent bundle. */
  function heading(text) {
    const found = lines(text).find((item) => isHeading(item.type));
    return found ? found.text : '';
  }

  function isEmpty(text) {
    return !String(text == null ? '' : text).trim();
  }

  FD.md = { lines, html, plain, heading, isEmpty, inline, escapeHtml, isHeading };
})(window.FD = window.FD || {});
