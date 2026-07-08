// hooks/store/SettingsStore.ts
import { create } from "zustand"
import {
  AppSettings,
  DEFAULT_SETTINGS,
  loadAppSettings,
  saveAppSettings,
} from "@/lib/db/appSettings"

interface SettingsState {
  settings: AppSettings
  loaded: boolean
  init: () => Promise<void>
  updateFonts: (fonts: Partial<AppSettings["fonts"]>) => Promise<void>
  updateModuleVariant: <K extends keyof AppSettings["moduleVariants"]>(
    module: K,
    variant: AppSettings["moduleVariants"][K]
  ) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  init: async () => {
    const settings = await loadAppSettings()
    set({ settings, loaded: true })
  },

  updateFonts: async (fonts) => {
    const next = { ...get().settings.fonts, ...fonts }
    set((s) => ({ settings: { ...s.settings, fonts: next } }))
    await saveAppSettings({ fonts: next })
  },

  updateModuleVariant: async (module, variant) => {
    const next = { ...get().settings.moduleVariants, [module]: variant }
    set((s) => ({ settings: { ...s.settings, moduleVariants: next } }))
    await saveAppSettings({ moduleVariants: next })
  },
}))