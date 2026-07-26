// lib/config/settings.ts

export const THEMES = {
  dark: { label: "Dark", bg: "#141414", accent: "#c8f135" },
  light: { label: "Light", bg: "#ffffff", accent: "#c8f135" },
  cyberpunk: { label: "Cyberpunk", bg: "#0a0a1a", accent: "#ff00ff" },
} as const

export type ThemeKey = keyof typeof THEMES
export const DEFAULT_THEME: ThemeKey = "dark"

export type FontFamily =
  | "Inter"
  | "DotGothic16"
  | "Geist Sans"
  | "Geist Mono"
  | "IBM Plex Sans"
  | "IBM Plex Serif"

export const FONTS: Record<string, { label: string; family: string }> = {
  inter: { label: "Inter", family: "'Inter', sans-serif" },
  dotGothic16: { label: "DotGothic16", family: "'DotGothic16', monospace" },
  geistSans: { label: "Geist Sans", family: "'Geist Sans', sans-serif" },
  geistMono: { label: "Geist Mono", family: "'Geist Mono', monospace" },
  ibmPlexSans: { label: "IBM Plex Sans", family: "'IBM Plex Sans', sans-serif" },
  ibmPlexSerif: { label: "IBM Plex Serif", family: "'IBM Plex Serif', serif" },
}

export type FontKey = keyof typeof FONTS
export const DEFAULT_FONT: FontKey = "inter"

export interface ModuleVariants {
  heading: "default" | "underline" | "boxed" | "accent-bar"
  paragraph: "prose" | "compact" | "mono"
  quote: "default" | "boxed" | "sidebar"
  code: "default" | "terminal"
  list: "default" | "numbered-boxed"
}

export interface HeadingSizes {
  h1: number
  h2: number
  h3: number
}

export interface AppSettings {
  fonts: {
    heading: FontKey
    body: FontKey
    mono: FontKey
  }
  moduleVariants: ModuleVariants
  headingSizes: HeadingSizes
  autosaveDelay: number
  markdownShortcuts: boolean
  outlineEnabled: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  fonts: { heading: "inter", body: "inter", mono: "geistMono" },
  moduleVariants: {
    heading: "default",
    paragraph: "prose",
    quote: "default",
    code: "default",
    list: "default",
  },
  headingSizes: { h1: 1.5, h2: 1.25, h3: 1.1 },
  autosaveDelay: 2000,
  markdownShortcuts: true,
  outlineEnabled: true,
}
