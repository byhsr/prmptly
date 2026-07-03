import { create } from "zustand"
import { settingsService } from "@/services/service.settings"
import { DEFAULT_FONT, DEFAULT_THEME, FontKey, ThemeKey } from "@/lib/config/settings"
interface SettingsState {
  theme: ThemeKey
  font: FontKey
  hydrated: boolean

  hydrate: () => Promise<void>
  setTheme: (theme: ThemeKey) => Promise<void>
  setFont: (font: FontKey) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: DEFAULT_THEME,
  font: DEFAULT_FONT,
  hydrated: false,

  hydrate: async () => {
    const [theme, font] = await Promise.all([
      settingsService.getTheme(),
      settingsService.getFont(),
    ])
    set({ theme, font, hydrated: true })
  },

  setTheme: async (theme) => {
    set({ theme }) // optimistic
    await settingsService.setTheme(theme)
  },

  setFont: async (font) => {
    set({ font })
    await settingsService.setFont(font)
  },
}))