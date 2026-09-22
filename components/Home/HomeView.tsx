import { useState, useCallback, useEffect, useRef, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { motion } from "framer-motion"
import { Search, ListTree, Check, Copy, X, Replace, CaseSensitive, WholeWord, Download } from "lucide-react"
import { useQuicksStore } from "@/hooks/store/quickStore"
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion"
import { useNotifications } from "@/hooks/store/SidebarStore"
import { buildOutput } from "@/lib/editor/outputs"
import { exportMarkdownToFile } from "@/lib/exportMarkdown"
import { OverflowMenu } from "@/components/ui/OverflowMenu"
import { Tab } from "../core-components/Tabbar"
import { FileTab } from "../Prompt/fileTab"
import { SmartEditor } from "../ui/SmartTextEditor"
import { OutlinePanel } from "../Prompt/OutlinePanel"
import { HomeMenu } from "./HomeMenu"

// How far from the bottom-right corner the pointer must be for the bar to surface.
const CORNER_ZONE = 200

// Floating bar that stays out of the way until the pointer reaches the bottom-right
// corner, or focus lands inside it. Focus counts so hover is never the only way in.
function FloatingBar({ children }: { children: ReactNode }) {
  const [nearCorner, setNearCorner] = useState(false)
  const [overBar, setOverBar] = useState(false)
  const [focused, setFocused] = useState(false)
  const reduced = usePrefersReducedMotion()

  const revealed = nearCorner || overBar || focused

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const near = e.clientX >= window.innerWidth - CORNER_ZONE && e.clientY >= window.innerHeight - CORNER_ZONE
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
      className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-1 rounded-xl border border-border bg-surface px-2 py-1.5 shadow-lg ${
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

function BarAction({
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

  // The bar sits inside the Workspaces scroll container, so an absolutely positioned
  // tooltip gets clipped by that ancestor. Portalling it to <body> with fixed coords
  // takes it out of every clipping context.
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

export function HomeView() {
  const { body, setBody, loadKey, hasContent, close } = useQuicksStore()
  const [copiedBody, setCopiedBody] = useState(false)
  const [showRectify, setShowRectify] = useState(false)
  const [showOutline, setShowOutline] = useState(false)
  const [rectifyKey, setRectifyKey] = useState(0)
  const [rectifyCase, setRectifyCase] = useState(false)
  const [rectifyWord, setRectifyWord] = useState(false)

  const charCount = body.length
  const wordCount = body ? body.trim().split(/\s+/).length : 0
  const tokenEstimate = Math.round(charCount / 4)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "r") { e.preventDefault(); setShowRectify((v) => !v) }
      if ((e.metaKey || e.ctrlKey) && e.key === "o") { e.preventDefault(); setShowOutline((v) => !v) }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  const handleBodyChange = useCallback((markdown: string) => {
    setBody(markdown)
  }, [setBody])

  // Copy the markdown straight out of the editor — no need to generate first.
  const handleCopyBody = async () => {
    if (!body) return
    await navigator.clipboard.writeText(body)
    setCopiedBody(true)
    setTimeout(() => setCopiedBody(false), 1500)
  }

  const handleCopyBodyFormat = async (format: "json" | "xml") => {
    if (!body) return
    await navigator.clipboard.writeText(buildOutput(body, format))
    useNotifications.getState().notify(`Copied as ${format.toUpperCase()}`)
  }

  const handleExport = async () => {
    if (!body) return
    try {
      const name = useQuicksStore.getState().name || "quick"
      const exported = await exportMarkdownToFile(name, body)
      if (exported) useNotifications.getState().notify("Quick exported")
    } catch {
      useNotifications.getState().notify("Failed to export quick", true)
    }
  }

  if (!hasContent) return <HomeMenu />

  return (
    <div className="relative h-full w-full flex flex-col">
      <div className="w-full flex flex-col h-full min-h-0 relative">
        {showRectify && (
          <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 text-xs font-mono bg-surface border-b border-border">
            <Search className="h-3 w-3 text-muted shrink-0" />
            <input id="rectify-find" placeholder="Find"
              className="w-24 bg-background border border-border rounded px-2 py-1 text-xs outline-none text-foreground placeholder:text-muted/50"
            />
            <Replace className="h-3 w-3 text-muted shrink-0" />
            <input id="rectify-replace" placeholder="Replace"
              className="w-24 bg-background border border-border rounded px-2 py-1 text-xs outline-none text-foreground placeholder:text-muted/50"
            />
            <button
              onClick={() => setRectifyCase((v) => !v)}
              className={`rounded p-1 transition-colors ${rectifyCase ? "bg-accent/20 text-accent" : "text-muted hover:text-foreground"}`}
            ><CaseSensitive className="h-3 w-3" /></button>
            <button
              onClick={() => setRectifyWord((v) => !v)}
              className={`rounded p-1 transition-colors ${rectifyWord ? "bg-accent/20 text-accent" : "text-muted hover:text-foreground"}`}
            ><WholeWord className="h-3 w-3" /></button>
            <button
              onClick={() => {
                const find = (document.getElementById("rectify-find") as HTMLInputElement)?.value || ""
                const replace = (document.getElementById("rectify-replace") as HTMLInputElement)?.value || ""
                if (!find) return
                let flags = "g"
                if (!rectifyCase) flags += "i"
                const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
                const pattern = rectifyWord ? `\\b${escaped}\\b` : escaped
                const regex = new RegExp(pattern, flags)
                const store = useQuicksStore.getState()
                store.setBody(store.body.replace(regex, replace))
                setRectifyKey((k) => k + 1)
              }}
              className="rounded px-2 py-1 text-[10px] font-medium bg-foreground/10 text-foreground hover:bg-foreground/20 transition-colors"
            >Replace all</button>
            <button onClick={() => setShowRectify(false)} className="rounded p-1 text-muted hover:text-foreground transition-colors ml-auto"><X className="h-3 w-3" /></button>
          </div>
        )}
        <div className="flex items-center justify-between px-6 py-1.5 shrink-0">
          <button
            onClick={close}
            className="text-[10px] font-mono text-muted hover:text-foreground transition-colors"
          >
            ← quicks
          </button>
          {charCount > 0 && (
            <div className="flex items-center gap-3 text-[10px] font-mono text-muted">
              <span>{charCount} chars</span><span>·</span><span>{wordCount} words</span><span>·</span><span>~{tokenEstimate} tokens</span>
            </div>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 w-full">
          <SmartEditor
            key={`${loadKey}-${rectifyKey}`}
            initialContent={body}
            contentType="markdown"
            onChange={(_plain, _doc, markdown) => handleBodyChange(markdown)}
            placeholder="Paste markdown, or start typing…"
            minHeight={60}
          />
        </div>
      </div>

      {body.length > 0 && (
        <FloatingBar>
          <BarAction label="Copy markdown" text={copiedBody ? "copied" : "copy"} onClick={handleCopyBody}>
            {copiedBody ? <Check size={11} aria-hidden="true" /> : <Copy size={11} aria-hidden="true" />}
          </BarAction>
          <BarAction label="Export as .md" text="export" onClick={handleExport}>
            <Download size={11} aria-hidden="true" />
          </BarAction>
          <BarAction label="Outline" active={showOutline} onClick={() => setShowOutline((v) => !v)}>
            <ListTree size={14} aria-hidden="true" />
          </BarAction>
          <BarAction label="Find and replace" active={showRectify} onClick={() => setShowRectify((v) => !v)}>
            <Search size={14} aria-hidden="true" />
          </BarAction>
          <OverflowMenu
            label="Copy as…"
            panelWidth={190}
            className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-background hover:text-foreground"
            items={[
              { label: "Copy as markdown", onClick: handleCopyBody },
              { label: "Copy as JSON", onClick: () => handleCopyBodyFormat("json") },
              { label: "Copy as XML", onClick: () => handleCopyBodyFormat("xml") },
            ]}
          />
          {showOutline && (
            <div className="absolute bottom-full right-0 mb-2 w-56 max-h-72 border border-border rounded-lg bg-surface shadow-lg overflow-y-auto overflow-x-hidden">
              <OutlinePanel doc={body} />
            </div>
          )}
        </FloatingBar>
      )}
    </div>
  )
}

export function PromptView({ tab }: { tab: Tab }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 min-h-0">
        <FileTab tab={tab} />
      </div>
    </div>
  )
}
