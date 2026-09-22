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

  --glass: ${surface};
  --glass-panel: ${surface};
  --glass-raise: ${surface};
  --glass-edge: color-mix(in srgb, ${fg} 10%, transparent);
  --glass-edge-soft: color-mix(in srgb, ${fg} 6%, transparent);
  /* opaque bars mean the backdrop blur has nothing left to do */
  --glass-blur: 0px;
  --glass-blur-lg: 0px;

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

/* ------------------------------------------------------------------ compact chrome
   Ark's bars were built at a roomier scale than the app's: 30px icon buttons, 34px
   dock tools, 14px radii. Brought down to the app's scale (26px controls, 8-12px
   radii) so the canvas chrome reads at the same weight as the rest of the UI. */

:root {
  --topbar-h: 52px;
}

/* a little air above the floating bar so it doesn't sit flush against the app's tab strip */
.topbar { padding: 12px 10px 6px; gap: 8px; }

.tb-group { gap: 2px; padding: 3px; border-radius: 12px; }

.icon-btn { width: 26px; height: 26px; }
.icon-btn.sm { width: 22px; height: 22px; }

.btn { height: 26px; padding: 0 9px; font-size: 12px; }
.btn.sm { height: 23px; padding: 0 7px; font-size: 11.5px; }

.canvas-pill { height: 26px; padding: 0 9px 0 10px; font-size: 12px; }
.zoom-label { height: 26px; min-width: 46px; }

.tb-sep,
.dock-sep { height: 18px; margin: 0 3px; }

.dock-row { padding: 4px; border-radius: 12px; }
.dock-options { padding: 3px; border-radius: 10px; }
.dock-tool { width: 28px; height: 28px; border-radius: 8px; }
.shape-pick,
.emoji-pick { width: 30px; height: 30px; border-radius: 8px; }
.dock-restore { width: 32px; height: 32px; border-radius: 10px; }

.crumbs { padding: 4px 10px; }
.statusbar { padding: 4px 10px; gap: 10px; }
.status-controls { gap: 1px; margin-left: 8px; padding-left: 8px; }
.status-sep { margin: 0 4px; }

.minimap { width: 176px; height: 112px; }

/* ------------------------------------------------------------------ no light mode
   The theme belongs to the host app: ark's own toggle would fight the app's setting.
   Dropped from the ⋯ menu (the only item using the sun/moon icon, plus the divider that
   follows it) and from the settings panel, where the whole Theme row goes. */

#menu .ctx-item:has(use[href="#i-sun"]),
#menu .ctx-item:has(use[href="#i-moon"]),
#menu .ctx-item:has(use[href="#i-sun"]) + .ctx-sep,
#menu .ctx-item:has(use[href="#i-moon"]) + .ctx-sep {
  display: none;
}
#settings-panel .setting-row:has(#theme-light) {
  display: none;
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
