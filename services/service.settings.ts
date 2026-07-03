import {getSetting, setSetting }from "@/lib/db/index"
import { DEFAULT_FONT, DEFAULT_THEME, FontKey, ThemeKey } from "@/lib/config/settings"


export const settingsService = {
  async getTheme(): Promise<ThemeKey> {
    return ((await getSetting("theme")) as ThemeKey) ?? DEFAULT_THEME
  },
  async setTheme(theme: ThemeKey) {
    await setSetting("theme", theme)
  },
  async getFont(): Promise<FontKey> {
    return ((await getSetting("font")) as FontKey) ?? DEFAULT_FONT
  },
  async setFont(font: FontKey) {
    await setSetting("font", font)
  },
}