import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"

export interface ContextMenuSwatch {
  key: string
  label: string
  swatch: string
}

export interface ContextMenuItem {
  label: string
  onClick?: () => void
  danger?: boolean
  icon?: ReactNode
  /** When set, renders a color-swatch row instead of a plain action row. */
  colors?: readonly ContextMenuSwatch[]
  onPick?: (key: string) => void
  /** Key of the currently-active swatch, ringed for emphasis. */
  active?: string | null
}

interface ContextMenuProps {
  x: number
  y: number
  onClose: () => void
  items: ContextMenuItem[]
}

// Right-click menu in the app's dropdown grammar: portal-rendered, viewport-clamped,
// dismissed on mousedown-outside or Escape. Items may be plain actions or a swatch row
// (used by the editor's comment menu).
export const ContextMenu = ({ x, y, onClose, items }: ContextMenuProps) => {
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y })

  // Clamp into the viewport once the panel has a measured size.
  useLayoutEffect(() => {
    const el = panelRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const left = Math.max(8, Math.min(x, window.innerWidth - rect.width - 8))
    const top = Math.max(8, Math.min(y, window.innerHeight - rect.height - 8))
    setPos((prev) => (prev.left === left && prev.top === top ? prev : { left, top }))
  }, [x, y])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("mousedown", onDown)
    window.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      window.removeEventListener("keydown", onKey)
    }
  }, [onClose])

  return createPortal(
    <motion.div
      ref={panelRef}
      role="menu"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.1 }}
      onContextMenu={(e) => e.preventDefault()}
      style={{ position: "fixed", left: pos.left, top: pos.top, transformOrigin: "top left", zIndex: 9999 }}
      className="min-w-[168px] overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
    >
      <div className="p-1.5">
        {items.map((item) => {
          if (item.colors?.length) {
            return (
              <div key={item.label} className="px-1.5 pb-1.5 pt-1">
                <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-muted">
                  {item.label}
                </span>
                <div className="flex items-center gap-1.5">
                  {item.colors.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      aria-label={c.label}
                      onClick={() => {
                        item.onPick?.(c.key)
                        onClose()
                      }}
                      style={{ backgroundColor: c.swatch }}
                      className={cn(
                        "h-5 w-5 rounded-full border transition-transform hover:scale-110",
                        item.active === c.key ? "border-foreground ring-1 ring-foreground/40" : "border-transparent"
                      )}
                    />
                  ))}
                </div>
              </div>
            )
          }

          return (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                item.onClick?.()
                onClose()
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
                item.danger ? "text-red-400 hover:bg-red-500/10" : "text-foreground hover:bg-border/30"
              )}
            >
              {item.icon}
              <span className="truncate">{item.label}</span>
            </button>
          )
        })}
      </div>
    </motion.div>,
    document.body
  )
}
