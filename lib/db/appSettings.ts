// lib/db/appSettings.ts
import { getSetting, setSetting } from "./index"

export interface AppSettings {
  fonts: {
    heading: string
    body: string
    mono: string
  }
  moduleVariants: {
    heading: "default" | "underline" | "boxed" | "accent-bar"
    paragraph: "prose" | "compact" | "mono"
    quote: "default" | "boxed" | "sidebar"
    code: "default" | "terminal"
    list: "default" | "numbered-boxed"
  }
}

export const DEFAULT_SETTINGS: AppSettings = {
  fonts: { heading: "Inter", body: "Inter", mono: "JetBrains Mono" },
  moduleVariants: {
    heading: "default",
    paragraph: "prose",
    quote: "default",
    code: "default",
    list: "default",
  },
}

export async function loadAppSettings(): Promise<AppSettings> {
  const [fontsRaw, variantsRaw] = await Promise.all([
    getSetting("fonts"),
    getSetting("moduleVariants"),
  ])

  return {
    fonts: fontsRaw ? JSON.parse(fontsRaw) : DEFAULT_SETTINGS.fonts,
    moduleVariants: variantsRaw
      ? JSON.parse(variantsRaw)
      : DEFAULT_SETTINGS.moduleVariants,
  }
}

export async function saveAppSettings(
  partial: Partial<AppSettings>
): Promise<void> {
  if (partial.fonts) await setSetting("fonts", JSON.stringify(partial.fonts))
  if (partial.moduleVariants)
    await setSetting("moduleVariants", JSON.stringify(partial.moduleVariants))
}