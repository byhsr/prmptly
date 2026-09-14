import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "motion/react"
import { cn } from "@/lib/utils"

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
  panelWidth?: number
  size?: "sm" | "md"
}

export function Select({
  value,
  onChange,
  options,
  placeholder = "Select…",
  className,
  panelWidth = 208,
  size = "md",
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const selected = options.find((option) => option.value === value)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current?.contains(e.target as Node)) return
      if (panelRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open])

  const toggle = () => {
    if (open) {
      setOpen(false)
      return
    }
    setRect(wrapperRef.current?.getBoundingClientRect() ?? null)
    setOpen(true)
  }

  const sizeClasses = size === "sm" ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-[12px]"
  const left = rect ? Math.min(rect.left, window.innerWidth - panelWidth - 8) : 0

  return (
    <div ref={wrapperRef} className={cn("relative w-fit", className)}>
      <button
        type="button"
        onClick={toggle}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-xl bg-surface text-foreground hover:bg-border/30 transition-colors",
          sizeClasses
        )}
      >
        <span className={cn("truncate", selected ? "text-foreground" : "text-muted/40")}>
          {selected?.label || placeholder}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.15 }}
          className="shrink-0 text-[10px] leading-none text-muted"
        >
          ▾
        </motion.span>
      </button>

      {open && rect && createPortal(
        <AnimatePresence>
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            style={{ position: "fixed", top: rect.bottom + 6, left, width: panelWidth, zIndex: 9999 }}
            className="bg-surface border border-border shadow-lg rounded-xl overflow-hidden"
          >
            <div className="p-1.5 max-h-56 overflow-y-auto">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onChange(option.value)
                    setOpen(false)
                  }}
                  className={cn(
                    "w-full truncate rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    value === option.value ? "text-accent" : "text-foreground hover:bg-border/30"
                  )}
                >
                  {option.label}
                </button>
              ))}
              {options.length === 0 && (
                <p className="px-3 py-2 text-xs text-muted/50">No options</p>
              )}
            </div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}
