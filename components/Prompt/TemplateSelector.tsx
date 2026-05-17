import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { templateService } from "@/lib/db/template"
import { Template } from "@/lib/db/template"


interface TemplateSelectorProps {
  value: string | null
  onChange: (template: Template) => void
}

export function TemplateSelector({ value, onChange }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    templateService.getAll().then(setTemplates)
  }, [])

  // Set input label to selected template name
  useEffect(() => {
    if (value) {
      const found = templates.find((t) => t.id === value)
      if (found) setQuery(found.name)
    }
  }, [value, templates])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
        // Reset query to selected template name
        const found = templates.find((t) => t.id === value)
        setQuery(found?.name || "")
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [value, templates])

  const filtered = templates.filter((t) =>
    t.name.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-2" ref={wrapperRef}>
      <label className="text-[10px] font-medium uppercase tracking-widest text-muted">
        Template
      </label>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Pick a template..."
          className="w-full py-2 focus:p-2 focus:bg-surface rounded-lg text-sm text-foreground placeholder:text-muted/40 outline-none transition-colors font-sans"
        />
        <AnimatePresence>
          {open && filtered.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute top-[calc(100%+8px)] left-0 right-0 z-20 bg-surface border border-border shadow-lg p-2 rounded-xl overflow-hidden"
            >
              {filtered.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    onChange(t)
                    setQuery(t.name)
                    setOpen(false)
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                    value === t.id
                      ? "text-accent"
                      : "text-foreground hover:bg-border/30"
                  }`}
                >
                  <span className="">{t.name}</span>
                  {/* {t.is_system && (
                    <span className="text-[10px] text-muted uppercase tracking-widest">
                      system
                    </span>
                  )} */}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}