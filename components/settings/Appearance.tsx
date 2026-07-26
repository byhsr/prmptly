import { useSettingsStore } from "@/hooks/store/settingsStore"
import { THEMES, FONTS, type FontKey } from "@/lib/config/settings"

export function Appearance() {
  const { settings, updateFonts, updateHeadingSize } = useSettingsStore()

  const handleTheme = async (key: string) => {
    const { writeConfig, readConfig } = await import("@/lib/fs/fs")
    const config = await readConfig()
    await writeConfig({ ...config, theme: key as any })
    document.documentElement.classList.toggle("dark", key === "dark")
    document.documentElement.classList.toggle("light", key === "light")
    document.documentElement.dataset.theme = key === "cyberpunk" ? "cyberpunk" : ""
  }

  return (
    <div className="space-y-8 max-w-lg">
      {/* Theme */}
      <section>
        <h3 className="text-sm font-medium mb-3">Theme</h3>
        <div className="flex gap-3">
          {Object.entries(THEMES).map(([key, t]) => {
            const isActive = key === "dark" ? document.documentElement.classList.contains("dark") : 
                             key === "light" ? document.documentElement.classList.contains("light") :
                             document.documentElement.dataset.theme === key
            return (
            <button
              key={key}
              onClick={() => handleTheme(key)}
              className={`flex-1 rounded-lg px-4 py-3 text-xs font-medium transition-colors ${
                isActive ? "bg-foreground/10 text-foreground border border-border" : "border border-border/50 text-muted hover:border-border"
              }`}
            >
              <div className="flex flex-col items-center gap-1">
                <div className="w-6 h-6 rounded-full border border-foreground/20" style={{ background: t.bg }} />
                {t.label}
              </div>
            </button>
            )
          })}
        </div>
      </section>

      {/* Fonts */}
      <section>
        <h3 className="text-sm font-medium mb-3">Fonts</h3>
        {(["heading", "body", "mono"] as const).map((role) => (
          <div key={role} className="mb-3">
            <label className="text-xs text-muted capitalize block mb-1.5">{role}</label>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(FONTS).map(([key, f]) => (
                <button
                  key={key}
                  onClick={() => updateFonts({ [role]: key as FontKey })}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    (settings.fonts as any)[role] === key
                      ? "bg-foreground/10 text-foreground border border-foreground/20"
                      : "text-muted border border-transparent hover:border-border"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Heading Sizes */}
      <section>
        <h3 className="text-sm font-medium mb-3">Heading Sizes</h3>
        {(["h1", "h2", "h3"] as const).map((level) => {
          const label = level.toUpperCase()
          const current = (settings.headingSizes as any)[level] as number
          return (
            <div key={level} className="flex items-center gap-3 mb-2">
              <span className="w-8 text-xs font-mono text-muted">{label}</span>
              <input
                type="range"
                min={0.8}
                max={2.5}
                step={0.05}
                value={current}
                onChange={(e) => updateHeadingSize(level, parseFloat(e.target.value))}
                className="flex-1 accent-accent"
              />
              <span className="w-10 text-xs font-mono text-right text-muted">{current.toFixed(2)}rem</span>
            </div>
          )
        })}
      </section>
    </div>
  )
}
