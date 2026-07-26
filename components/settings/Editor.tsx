import { useSettingsStore } from "@/hooks/store/settingsStore"

export function Editor() {
  const { settings, updateSetting, updateModuleVariant } = useSettingsStore()

  const MODULE_KEYS = ["heading", "paragraph", "quote", "code", "list"] as const
  const VARIANT_OPTIONS: Record<string, string[]> = {
    heading: ["default", "underline", "boxed", "accent-bar"],
    paragraph: ["prose", "compact", "mono"],
    quote: ["default", "boxed", "sidebar"],
    code: ["default", "terminal"],
    list: ["default", "numbered-boxed"],
  }

  return (
    <div className="space-y-8 max-w-lg">
      {/* Autosave */}
      <section>
        <h3 className="text-sm font-medium mb-3">Autosave</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted w-20">Delay (ms)</span>
          <input
            type="range"
            min={500}
            max={10000}
            step={500}
            value={settings.autosaveDelay}
            onChange={(e) => updateSetting("autosaveDelay", parseInt(e.target.value))}
            className="flex-1 accent-accent"
          />
          <span className="w-12 text-xs font-mono text-right text-muted">{settings.autosaveDelay}ms</span>
        </div>
      </section>

      {/* Markdown Shortcuts */}
      <section>
        <h3 className="text-sm font-medium mb-3">Markdown Shortcuts</h3>
        <button
          onClick={() => updateSetting("markdownShortcuts", !settings.markdownShortcuts)}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            settings.markdownShortcuts
              ? "bg-accent/20 text-accent border border-accent/30"
              : "text-muted border border-border hover:border-foreground/20"
          }`}
        >
          {settings.markdownShortcuts ? "Enabled" : "Disabled"}
        </button>
        <p className="text-[11px] text-muted mt-1">{`# ## ### - 1. > ${"```"} []`}</p>
      </section>

      {/* Outline */}
      <section>
        <h3 className="text-sm font-medium mb-3">Outline Panel</h3>
        <button
          onClick={() => updateSetting("outlineEnabled", !settings.outlineEnabled)}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            settings.outlineEnabled
              ? "bg-accent/20 text-accent border border-accent/30"
              : "text-muted border border-border hover:border-foreground/20"
          }`}
        >
          {settings.outlineEnabled ? "Visible" : "Hidden"}
        </button>
      </section>

      {/* Module Variants */}
      <section>
        <h3 className="text-sm font-medium mb-3">Module Variants</h3>
        <div className="space-y-3">
          {MODULE_KEYS.map((module) => (
            <div key={module}>
              <span className="text-xs text-muted capitalize block mb-1">{module}</span>
              <div className="flex flex-wrap gap-1.5">
                {VARIANT_OPTIONS[module].map((variant) => (
                  <button
                    key={variant}
                    onClick={() => updateModuleVariant(module, variant as any)}
                    className={`px-2.5 py-1 rounded text-xs transition-colors ${
                      (settings.moduleVariants as any)[module] === variant
                        ? "bg-foreground/10 text-foreground border border-foreground/20"
                        : "text-muted border border-transparent hover:border-border"
                    }`}
                  >
                    {variant}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
