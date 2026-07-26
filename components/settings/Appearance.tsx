import { useSettingsStore } from "@/hooks/store/settingsStore"
import { THEMES, FONTS, type FontKey } from "@/lib/config/settings"

export function Appearance() {
  const { settings, updateFonts } = useSettingsStore()

  const handleTheme = async (key: string) => {
    const { writeConfig, readConfig } = await import("@/lib/fs/fs")
    const config = await readConfig()
    await writeConfig({ ...config, theme: key as any })
    document.documentElement.classList.toggle("dark", key !== "light")
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="block mb-2 text-sm">Theme</label>
        <div className="flex gap-2">
          {Object.entries(THEMES).map(([key, t]) => (
            <button
              key={key}
              onClick={() => handleTheme(key)}
              className={key === "dark" ? "border-lime-400" : "border-transparent"}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block mb-2 text-sm">Font</label>
        <div className="flex gap-2">
          {Object.entries(FONTS).map(([key, f]) => (
            <button
              key={key}
              onClick={() => updateFonts({ mono: key as FontKey })}
              className={settings.fonts.mono === key ? "border-lime-400" : "border-transparent"}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}