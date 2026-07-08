import { useSettingsStore } from "@/hooks/store/settingsStore"
import { THEMES, FONTS } from "@/lib/config/settings"


export function Appearance() {
  const { theme, font, setTheme, setFont } = useSettingsStore()

  return (
    <div className="space-y-6">
      <div>
        <label className="block mb-2 text-sm">Theme</label>
        <div className="flex gap-2">
          {Object.entries(THEMES).map(([key, t]) => (
            <button
              key={key}
              onClick={() => setTheme(key as any)}
              className={theme === key ? "border-lime-400" : "border-transparent"}
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
              onClick={() => setFont(key as any)}
              className={font === key ? "border-lime-400" : "border-transparent"}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}