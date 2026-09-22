// Ark ships its own complete theme — a near-black shell (#050505), a near-white accent and
// mono for all UI. Embedded next to prmptly it read as a different app, so the host re-skins
// it: ark's variables are re-declared from prmptly's live tokens, injected into the iframe
// after ark's own stylesheets. Ark's files stay untouched, and because the values are read
// from the DOM each time, theme and font changes in Settings carry straight through.

const SKIN_ID = "prmptly-skin"

function hostToken(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

// color-mix keeps derived tones (alphas, faint steps) tied to the host palette instead of
// hardcoding a second copy of it. WebView2 is evergreen Chromium, so it is safe here; each
// derived value is written twice so the plain declaration survives if it ever isn't.
function arkSkinCss(): string {
  const bg = hostToken("--background", "#191919")
  const fg = hostToken("--foreground", "#f0efed")
  const surface = hostToken("--surface", "#202020")
  const border = hostToken("--border", "#2a2a2a")
  const muted = hostToken("--muted", "#8a8a8a")
  const accent = hostToken("--accent", "#c8f135")
  const accentInk = hostToken("--accent-foreground", "#111111")
  const fontUi = hostToken("--font-body", "sans-serif")
  const fontCode = hostToken("--font-code", "monospace")

  return `
/* prmptly skin for ark — every value derives from the host theme */
:root,
:root[data-theme="dark"],
:root[data-theme="light"] {
  --font-ui: ${fontUi};
  --font-mono: ${fontCode};

  --bg: ${bg};
  --bg-canvas: ${bg};
  --bg-elev: ${surface};
  --surface: ${surface};

  /* ark's numbered surfaces/borders (chars, hovers, tracks) have no app equivalent,
     so derive them from the tokens the app does have */
  --surface-2: color-mix(in srgb, ${surface}, ${fg} 4%);
  --surface-3: color-mix(in srgb, ${surface}, ${fg} 8%);

  --border: ${border};
  --border-2: color-mix(in srgb, ${border}, ${fg} 10%);
  --border-strong: ${border};
  --border-strong: color-mix(in srgb, ${border}, ${fg} 22%);

  --text: ${fg};
  --text-dim: ${muted};
  --text-faint: ${muted};
  --text-faint: color-mix(in srgb, ${muted} 72%, ${bg});

  /* the app's accent, not ark's near-white */
  --accent: ${accent};
  --accent-ink: ${accentInk};
  --accent-2: ${fg};
  --accent-soft: color-mix(in srgb, ${accent} 14%, transparent);
  --accent-line: color-mix(in srgb, ${accent} 45%, transparent);
  --accent-fill: color-mix(in srgb, ${accent} 13%, transparent);
  --accent-fill-strong: color-mix(in srgb, ${accent} 22%, transparent);

  --edge: ${muted};
  --edge: color-mix(in srgb, ${muted} 60%, transparent);

  /* No dot grid and no top sheen — the app's panes are flat, and ark's canvas texture
     was reading as a different surface rather than the same one. */
  --grid-dot: transparent;
  --vignette: none;

  --glass: color-mix(in srgb, ${surface} 58%, transparent);
  --glass-panel: color-mix(in srgb, ${surface} 66%, transparent);
  --glass-raise: color-mix(in srgb, ${surface} 85%, transparent);
  --glass-edge: color-mix(in srgb, ${fg} 10%, transparent);
  --glass-edge-soft: color-mix(in srgb, ${fg} 6%, transparent);

  --node-bg: ${surface};
  --node-bg-plain: ${surface};
  --node-border: ${border};
  --node-text: ${fg};
  --node-dim: ${muted};

  /* Flat: no drop shadows on nodes or on the floating chrome (bars, panels, menus).
     Those carry their own border, which is enough separation on a dark surface. */
  --node-shadow: none;
  --node-shadow-hover: none;
  --shadow-panel: none;

  --group-fill: color-mix(in srgb, ${fg} 3.5%, transparent);
  --group-fill-selected: color-mix(in srgb, ${fg} 6%, transparent);
  --group-edge: color-mix(in srgb, ${fg} 18%, transparent);

  /* match the app's radius scale (--radius: 12px, xl: 16px) */
  --r-sm: 6px;
  --r-md: 8px;
  --r-lg: 12px;
  --r-xl: 16px;
}

/* Two shadows in ark are written out longhand instead of coming from a variable, so
   the vars above can't reach them — and both belong to a node or a floating chip. */
.node[data-kind="sticker"]:hover,
.node[data-kind="sticker"].selected {
  filter: none;
}
.node[data-kind="group"] .node-text {
  box-shadow: none;
}
`
}

// Ark's stylesheets live in <head>, so appending here puts the skin last in the cascade.
export function applyArkSkin(iframe: HTMLIFrameElement | null): void {
  const doc = iframe?.contentDocument
  if (!doc?.head) return

  let style = doc.getElementById(SKIN_ID) as HTMLStyleElement | null
  if (!style) {
    style = doc.createElement("style")
    style.id = SKIN_ID
    doc.head.appendChild(style)
  }
  style.textContent = arkSkinCss()
}
