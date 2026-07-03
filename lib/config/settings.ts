// lib/config/themes.ts
export const THEMES = {
  dark: { label: "Dark", bg: "#141414", accent: "#c8f135" },
  light: { label: "Light", bg: "#ffffff", accent: "#c8f135" },
} as const

export type ThemeKey = keyof typeof THEMES
export const DEFAULT_THEME: ThemeKey = "dark"

export const FONTS = {
  ibmPlexMono: { label: "IBM Plex Mono", value: "'IBM Plex Mono', monospace" },
  shareTechMono: { label: "Share Tech Mono", value: "'Share Tech Mono', monospace" },
} as const

export type FontKey = keyof typeof FONTS
export const DEFAULT_FONT: FontKey = "ibmPlexMono"