import { useEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "motion/react"
import { MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip } from "@/components/ui/Tooltip"

export interface OverflowMenuItem {
  label: string
  onClick: () => void
  icon?: ReactNode
  danger?: boolean
}

interface OverflowMenuProps {
  items: OverflowMenuItem[]
  /** tooltip + aria-label for the trigger */
  label?: string
  /** trigger button classes — each surface passes its own control grammar */
  className?: string
  panelWidth?: number
  disabled?: boolean
  children?: ReactNode
}

// Kebab action menu. Portal-rendered and viewport-clamped like Select, but for actions
// rather than picking a value. Opens upward when the trigger sits low on screen.
export function OverflowMenu({
  items,
  label = "More",
  className,
  panelWidth = 180,
  disabled,
  children,
}: OverflowMenuProps) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return
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
    if (disabled) return
    if (open) {
      setOpen(false)
      return
    }
    setRect(triggerRef.current?.getBoundingClientRect() ?? null)
    setOpen(true)
  }

  const openUp = rect ? rect.top > window.innerHeight * 0.6 : false
  const left = rect
    ? Math.max(8, Math.min(rect.right - panelWidth, window.innerWidth - panelWidth - 8))
    : 0

  return (
    <>
      <Tooltip label={label}>
        <button
          ref={triggerRef}
          type="button"
          onClick={toggle}
          disabled={disabled}
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={open}
          className={className}
        >
          {children ?? <MoreHorizontal size={14} aria-hidden="true" />}
        </button>
      </Tooltip>

      {open && rect &&
        createPortal(
          <AnimatePresence>
            <motion.div
              ref={panelRef}
              role="menu"
              initial={{ opacity: 0, y: openUp ? 4 : -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: openUp ? 4 : -4 }}
              transition={{ duration: 0.12 }}
              style={{
                position: "fixed",
                left,
                width: panelWidth,
                zIndex: 9999,
                ...(openUp
                  ? { bottom: window.innerHeight - rect.top + 6 }
                  : { top: rect.bottom + 6 }),
              }}
              className="overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
            >
              <div className="p-1.5">
                {items.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpen(false)
                      item.onClick()
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      item.danger
                        ? "text-red-400 hover:bg-red-500/10"
                        : "text-foreground hover:bg-border/30"
                    )}
                  >
                    {item.icon}
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>,
          document.body
        )}
    </>
  )
}
