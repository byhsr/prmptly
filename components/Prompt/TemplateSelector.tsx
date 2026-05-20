import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { templateService } from "@/lib/db/template"
import { Template } from "@/lib/db/template"
import { createPortal } from "react-dom"


interface TemplateSelectorProps {
  value: string | null
  onChange: (template: Template | null) => void
}
export function TemplateSelector({ value, onChange }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    templateService.getAll().then(setTemplates)
  }, [])

  useEffect(() => {
    if (value) {
      const found = templates.find((t) => t.id === value)
      if (found) setQuery(found.name)
    } else {
      setQuery("")
    }
  }, [value, templates])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        wrapperRef.current && !wrapperRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
        setIsSearching(false)
        const found = templates.find((t) => t.id === value)
        setQuery(found?.name || "")
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [value, templates])

  const filtered = isSearching
    ? templates.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()))
    : templates

  const selectedTemplate = templates.find((t) => t.id === value)

  return (
    <div className="relative w-fit self-end flex items-center gap-1.5" ref={wrapperRef}>
      <AnimatePresence>
        {value && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.1 }}
            onClick={(e) => {
              e.stopPropagation()
              onChange(null)
              setQuery("")
            }}
            className="text-muted/50 hover:text-foreground transition-colors text-base leading-none"
          >
            ×
          </motion.button>
        )}
      </AnimatePresence>

      <button
        onClick={() => {
          if (open) {
            setOpen(false)
            setIsSearching(false)
            const found = templates.find((t) => t.id === value)
            setQuery(found?.name || "")
          } else {
            setRect(wrapperRef.current?.getBoundingClientRect() ?? null)
            setOpen(true)
            setIsSearching(false)
            setQuery("")
            setTimeout(() => inputRef.current?.focus(), 0)
          }
        }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface text-sm text-foreground hover:bg-border/30 transition-colors"
      >
        <span className={selectedTemplate ? "text-foreground" : "text-muted/40"}>
          {selectedTemplate?.name || "Pick a template..."}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.15 }}
          className="text-muted"
        >
          ▾
        </motion.span>
      </button>


      {open && rect && createPortal(
        <AnimatePresence>
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            style={{
              position: "fixed",
              top: rect.bottom + 6,
              right: window.innerWidth - rect.right,
              zIndex: 9999,
            }}
            className="bg-surface border border-border shadow-lg rounded-xl overflow-hidden w-52"
          >
            <div className="p-2 border-b border-border">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setIsSearching(true)
                }}
                placeholder="Search..."
                className="w-full px-2 py-1 text-sm bg-transparent text-foreground placeholder:text-muted/40 outline-none"
              />
            </div>

            <div className="p-1.5 max-h-56 overflow-y-auto">
              {filtered.map((t) => (
                <button
                  key={t.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    onChange(t)
                    setQuery(t.name)
                    setIsSearching(false)
                    setOpen(false)
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors text-left ${value === t.id
                    ? "text-accent"
                    : "text-foreground hover:bg-border/30"
                    }`}
                >
                  {t.name}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-xs text-muted/50 px-3 py-2">No templates found</p>
              )}
            </div>

          </motion.div>
        </AnimatePresence>,
        document.body
      )}

    </div>
  )
}