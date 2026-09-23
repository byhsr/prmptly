import { useEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { motion } from "framer-motion"
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion"

// How far from the bottom-right corner the pointer must be for the bar to surface.
const CORNER_ZONE = 200

// Floating action bar shared by the quicks editor and the prompt builder: stays out of the
// way until the pointer reaches the bottom-right corner, or focus lands inside it. Focus
// counts so hover is never the only way in. Defaults to `fixed` on the viewport, so no
// amount of editor content can push it out of view; `contained` pins it to the nearest
// positioned ancestor instead, which lets it follow a pane (e.g. the builder's editor
// column) when a sibling column like the outline opens.
export function FloatingBar({ children, contained = false }: { children: ReactNode; contained?: boolean }) {
  const [nearCorner, setNearCorner] = useState(false)
  const [overBar, setOverBar] = useState(false)
  const [focused, setFocused] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)
  const reduced = usePrefersReducedMotion()

  const revealed = nearCorner || overBar || focused

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      // A contained bar sits at its pane's corner, not the viewport's, so the reveal zone
      // tracks the pane (offsetParent) — otherwise it would only appear when the pointer
      // reached the window corner while the bar itself is elsewhere. Fixed bars have no
      // offsetParent, so they fall back to the window.
      const pane = barRef.current?.offsetParent as HTMLElement | null
      const rect = pane?.getBoundingClientRect()
      const right = rect?.right ?? window.innerWidth
      const bottom = rect?.bottom ?? window.innerHeight
      const near = e.clientX >= right - CORNER_ZONE && e.clientY >= bottom - CORNER_ZONE
      setNearCorner((prev) => (prev === near ? prev : near))
    }
    const onLeave = () => setNearCorner(false)
    window.addEventListener("mousemove", onMove, { passive: true })
    document.addEventListener("mouseleave", onLeave)
    return () => {
      window.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseleave", onLeave)
    }
  }, [])

  return (
    <motion.div
      ref={barRef}
      initial={false}
      animate={
        revealed
          ? { opacity: 1, scale: 1, y: 0, rotate: 0 }
          : {
              opacity: 0,
              scale: reduced ? 1 : 0.9,
              y: reduced ? 0 : 28,
              rotate: reduced ? 0 : -12,
            }
      }
      transition={
        revealed
          ? { type: "spring", stiffness: 420, damping: 30 }
          : { duration: 0.14, ease: [0.2, 0, 0, 1] }
      }
      style={{ transformOrigin: "bottom right" }}
      className={`${contained ? "absolute" : "fixed"} bottom-6 right-6 z-[9999] flex items-center gap-1 rounded-xl border border-border bg-surface px-2 py-1.5 shadow-lg ${
        revealed ? "" : "pointer-events-none"
      }`}
      onMouseEnter={() => setOverBar(true)}
      onMouseLeave={() => setOverBar(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false)
      }}
    >
      {children}
    </motion.div>
  )
}

// A bar button. With `text` it renders a labelled button; without, a square icon button
// with a portalled tooltip (the bar lives inside scrolling ancestors, so an absolutely
// positioned tooltip would be clipped — fixed coords on <body> escape every clip context).
export function BarAction({
  label,
  onClick,
  active,
  primary,
  text,
  children,
}: {
  label: string
  onClick: () => void
  active?: boolean
  primary?: boolean
  text?: string
  children?: ReactNode
}) {
  const reduced = usePrefersReducedMotion()
  const [tip, setTip] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const showTip = () => {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setTip({ top: r.top - 8, left: r.right })
  }
  const hideTip = () => setTip(null)

  const tone = primary
    ? "bg-accent text-accent-foreground hover:opacity-90"
    : active
      ? "bg-accent/20 text-foreground"
      : "text-muted hover:text-foreground hover:bg-background"

  return (
    <>
      <motion.button
        ref={btnRef}
        type="button"
        onClick={onClick}
        aria-label={text ? undefined : label}
        aria-pressed={active}
        onMouseEnter={showTip}
        onMouseLeave={hideTip}
        onFocus={showTip}
        onBlur={hideTip}
        whileHover={reduced ? undefined : { scale: text ? 1.05 : 1.16 }}
        whileTap={reduced ? undefined : { scale: 0.88 }}
        transition={{ type: "spring", stiffness: 500, damping: 20 }}
        className={`focus-ring group relative inline-flex h-10 items-center justify-center rounded-lg transition-colors ${
          text ? "gap-1.5 border border-border px-3 font-mono text-[11px]" : "w-10"
        } ${tone}`}
      >
        {children}
        {text && <span>{text}</span>}
      </motion.button>
      {!text &&
        tip &&
        createPortal(
          <span
            aria-hidden="true"
            style={{
              position: "fixed",
              top: tip.top,
              left: tip.left,
              transform: "translate(-100%, -100%)",
              zIndex: 9999,
            }}
            className="pointer-events-none whitespace-nowrap rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[9px] text-muted"
          >
            {label}
          </span>,
          document.body
        )}
    </>
  )
}
