import { useSettingsStore } from "@/hooks/store/settingsStore"

const MODULE_KEYS = ["heading", "paragraph", "quote", "code", "list"] as const
const VARIANT_OPTIONS: Record<string, string[]> = {
  heading: ["default", "underline", "boxed", "accent-bar"],
  paragraph: ["prose", "compact", "mono"],
  quote: ["default", "boxed", "sidebar"],
  code: ["default", "terminal"],
  list: ["default", "numbered-boxed"],
}
const FONT_KEYS = ["heading", "body", "mono"] as const

export function Editor() {
  const { settings, updateFonts, updateModuleVariant } = useSettingsStore()
  const mv = settings.moduleVariants

  return (
    <div className="space-y-6">
      {/* Fonts */}
      <div>
        <label className="block mb-2 text-sm font-medium">Fonts</label>
        <div className="space-y-2">
          {FONT_KEYS.map((key) => (
            <div key={key} className="flex items-center gap-3">
              <span className="w-16 text-xs text-muted capitalize">{key}</span>
              <input
                value={(settings.fonts as any)[key]}
                onChange={(e) => updateFonts({ [key]: e.target.value })}
                className="flex-1 bg-transparent border border-border rounded px-2 py-1 text-xs font-mono outline-none focus:border-foreground/30"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Module Variants */}
      <div>
        <label className="block mb-2 text-sm font-medium">Module Variants</label>
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
                      (mv as any)[module] === variant
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
      </div>
    </div>
  )
}
