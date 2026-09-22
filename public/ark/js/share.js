/* ==========================================================================
   share.js — turn a flow document into a link (and back again).

   The document is JSON, UTF-8 encoded, deflate-raw compressed when the
   browser supports CompressionStream, then base64url encoded into the URL
   hash as `#f=<payload>`. Links stay readable by anyone with the file open,
   work from `file://`, and never touch a server.
   ========================================================================== */
(function (FD) {
  'use strict';

  const HASH_KEY = 'f';

  function hasCompression() {
    return typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
  }

  function bytesToBase64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  function base64ToBytes(b64) {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }

  const toUrlSafe = (b64) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  function fromUrlSafe(value) {
    let s = value.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return s;
  }

  async function compress(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function decompress(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  /** Encode any JSON-serialisable value into a compact url-safe payload. */
  async function encode(value) {
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    if (hasCompression()) {
      try {
        return 'z' + toUrlSafe(bytesToBase64(await compress(bytes)));
      } catch (err) {
        console.warn('Compression unavailable, falling back to plain encoding.', err);
      }
    }
    return 'u' + toUrlSafe(bytesToBase64(bytes));
  }

  /** Decode a payload produced by `encode`. */
  async function decode(payload) {
    const tag = payload.charAt(0);
    const body = fromUrlSafe(payload.slice(1));
    let bytes = base64ToBytes(body);
    if (tag === 'z') bytes = await decompress(bytes);
    else if (tag !== 'u') bytes = base64ToBytes(fromUrlSafe(payload));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function baseUrl() {
    const loc = window.location;
    const clean = loc.origin && loc.origin !== 'null'
      ? loc.origin + loc.pathname
      : loc.href.split('#')[0].split('?')[0];
    return clean;
  }

  /** Build a complete shareable URL for a document. */
  async function buildLink(value) {
    const payload = await encode(value);
    return baseUrl() + '#' + HASH_KEY + '=' + payload;
  }

  function readHash() {
    const hash = window.location.hash || '';
    if (hash.length < 3) return null;
    const raw = hash.slice(1);
    if (raw.indexOf(HASH_KEY + '=') === 0) return raw.slice(HASH_KEY.length + 1);
    const params = new URLSearchParams(raw);
    return params.get(HASH_KEY);
  }

  function clearHash() {
    const loc = window.location;
    if (!loc.hash) return;
    try {
      history.replaceState(null, '', loc.pathname + loc.search);
    } catch (err) {
      loc.hash = '';
    }
  }

  /**
   * Pull a document out of anything the user might paste: a full share URL,
   * a bare payload, a JSON string or an already-parsed object.
   */
  async function decodeAny(input) {
    if (input && typeof input === 'object') return input;
    let text = String(input == null ? '' : input).trim();
    if (!text) throw new Error('Nothing to import.');

    const hashIndex = text.indexOf('#' + HASH_KEY + '=');
    if (hashIndex >= 0) text = text.slice(hashIndex + HASH_KEY.length + 2);
    else if (/^https?:\/\//i.test(text)) {
      const query = text.indexOf('?' + HASH_KEY + '=');
      text = query >= 0 ? text.slice(query + HASH_KEY.length + 2) : '';
      if (!text) throw new Error('That link does not contain a flow.');
    }

    text = decodeURIComponent(text.trim());

    if (text.charAt(0) === '{' || text.charAt(0) === '[') {
      return JSON.parse(text);
    }
    if (/^[zu]/.test(text)) {
      return await decode(text);
    }
    // Last resort: maybe it is base64 of JSON without a tag.
    try {
      return JSON.parse(new TextDecoder().decode(base64ToBytes(fromUrlSafe(text))));
    } catch (err) {
      throw new Error('Could not read that flow. Expected JSON or an Ark share link.');
    }
  }

  /** Byte size of the encoded payload, for the share dialog. */
  async function payloadSize(value) {
    const payload = await encode(value);
    return payload.length;
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) { /* fall through to the legacy path */ }
    }
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.top = '-1000px';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(area);
      return ok;
    } catch (err) {
      return false;
    }
  }

  FD.share = {
    HASH_KEY, encode, decode, decodeAny, buildLink, readHash, clearHash,
    copyText, payloadSize, hasCompression, baseUrl
  };
})(window.FD = window.FD || {});
