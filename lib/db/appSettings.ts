// lib/db/appSettings.ts
import { getSetting, setSetting } from "./index"
import { DEFAULT_SETTINGS } from "../config/settings"
import type { AppSettings } from "../config/settings"

export type { AppSettings, FontKey, ThemeKey, HeadingSizes, ModuleVariants } from "../config/settings"
export { DEFAULT_SETTINGS } from "../config/settings"

export async function loadAppSettings(): Promise<AppSettings> {
  const [fontsRaw, variantsRaw, sizesRaw, delayRaw, mdRaw, outlineRaw] = await Promise.all([
    getSetting("fonts"),
    getSetting("moduleVariants"),
    getSetting("headingSizes"),
    getSetting("autosaveDelay"),
    getSetting("markdownShortcuts"),
    getSetting("outlineEnabled"),
  ])

  return {
    fonts: fontsRaw ? JSON.parse(fontsRaw) : DEFAULT_SETTINGS.fonts,
    moduleVariants: variantsRaw ? JSON.parse(variantsRaw) : DEFAULT_SETTINGS.moduleVariants,
    headingSizes: sizesRaw ? JSON.parse(sizesRaw) : DEFAULT_SETTINGS.headingSizes,
    autosaveDelay: delayRaw ? JSON.parse(delayRaw) : DEFAULT_SETTINGS.autosaveDelay,
    markdownShortcuts: mdRaw ? JSON.parse(mdRaw) : DEFAULT_SETTINGS.markdownShortcuts,
    outlineEnabled: outlineRaw ? JSON.parse(outlineRaw) : DEFAULT_SETTINGS.outlineEnabled,
  }
}

export async function saveAppSettings(partial: Partial<AppSettings>): Promise<void> {
  const entries = Object.entries(partial) as [keyof AppSettings, unknown][]
  for (const [key, value] of entries) {
    await setSetting(key, JSON.stringify(value))
  }
}
