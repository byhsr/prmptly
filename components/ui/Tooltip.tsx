import { cloneElement, useRef, useState, type ReactElement, type ReactNode } from "react"
import { createPortal } from "react-dom"

type Side = "top" | "bottom" | "left" | "right"

const GAP = 8

type TooltipProps = {
  label: ReactNode
  side?: Side
  children: ReactElement<any>
}

// Rendered into <body> with fixed coordinates on purpose. In place it gets clipped by
// any ancestor with `overflow-hidden` (the sidebar rail, the section panel), and no
// z-index can escape an ancestor's overflow clip — only leaving the tree can.
export function Tooltip({ label, side = "bottom", children }: TooltipProps) {
  const triggerRef = useRef<HTMLElement | null>(null)
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null)

  const show = () => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (side === "top") setAnchor({ top: r.top - GAP, left: r.left + r.width / 2 })
    else if (side === "left") setAnchor({ top: r.top + r.height / 2, left: r.left - GAP })
    else if (side === "right") setAnchor({ top: r.top + r.height / 2, left: r.right + GAP })
    else setAnchor({ top: r.bottom + GAP, left: r.left + r.width / 2 })
  }

  const hide = () => setAnchor(null)

  const transform =
    side === "top" ? "translate(-50%, -100%)"
      : side === "left" ? "translate(-100%, -50%)"
        : side === "right" ? "translate(0, -50%)"
          : "translate(-50%, 0)"

  const child = children
  const childProps: any = child.props ?? {}
  const childRef = childProps.ref

  return (
    <>
      {cloneElement(child, {
        ref: (node: HTMLElement | null) => {
          triggerRef.current = node
          if (typeof childRef === "function") childRef(node)
          else if (childRef) childRef.current = node
        },
        onMouseEnter: (e: React.MouseEvent) => { childProps.onMouseEnter?.(e); show() },
        onMouseLeave: (e: React.MouseEvent) => { childProps.onMouseLeave?.(e); hide() },
        onFocus: (e: React.FocusEvent) => { childProps.onFocus?.(e); show() },
        onBlur: (e: React.FocusEvent) => { childProps.onBlur?.(e); hide() },
      })}

      {anchor && createPortal(
        <span
          role="tooltip"
          className="pointer-events-none fixed z-[9999] rounded border border-border bg-surface px-1.5 py-0.5 text-[9px] whitespace-nowrap text-muted"
          style={{ top: anchor.top, left: anchor.left, transform }}
        >
          {label}
        </span>,
        document.body
      )}
    </>
  )
}
