import { useState, useCallback, useEffect, useRef, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import { Search, ArrowUpRight, ListTree, Undo2, Check, X, Replace, CaseSensitive, WholeWord, Brain } from "lucide-react"
import { useQuicksStore } from "@/hooks/store/quickStore"
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion"
import { useNotifications } from "@/hooks/store/SidebarStore"
import { useTabViewStore } from "@/hooks/store/TabStore"
import { Tab } from "../core-components/Tabbar"
import { FileTab } from "../Prompt/fileTab"
import { SmartEditor } from "../ui/SmartTextEditor"
import { OutlinePanel } from "../Prompt/OutlinePanel"
import { AIAssistant } from "../ai/AIAssistant"

type OutputTab = "markdown" | "json" | "xml"

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
  const { body, output, setBody, generate, reset, loadKey } = useQuicksStore()
  const [activeTab, setActiveTab] = useState<OutputTab>("markdown")
  const [copied, setCopied] = useState(false)
  const [showRectify, setShowRectify] = useState(false)
  const [showOutline, setShowOutline] = useState(false)
  const [showAI, setShowAI] = useState(false)
  const [rectifyKey, setRectifyKey] = useState(0)
  const [rectifyCase, setRectifyCase] = useState(false)
  const [rectifyWord, setRectifyWord] = useState(false)

  const charCount = body.length
  const wordCount = body ? body.trim().split(/\s+/).length : 0
  const tokenEstimate = Math.round(charCount / 4)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); handleSave() }
      if ((e.metaKey || e.ctrlKey) && e.key === "r") { e.preventDefault(); setShowRectify((v) => !v) }
      if ((e.metaKey || e.ctrlKey) && e.key === "o") { e.preventDefault(); setShowOutline((v) => !v) }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [body, output])

  const handleBodyChange = useCallback((markdown: string) => {
    setBody(markdown)
  }, [setBody])

  const handleGenerate = () => { generate(); setActiveTab("markdown") }
  const handleCopy = () => {
    if (!output) return
    navigator.clipboard.writeText(output[activeTab])
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }
  const handleReset = () => { reset() }

  const handleSave = async () => {
    const id = await useQuicksStore.getState().save()
    if (id) {
      useNotifications.getState().notify("Quick saved")
      useTabViewStore.getState().addTab({ id, label: useQuicksStore.getState().name, type: "prompt" })
    } else {
      useNotifications.getState().notify("Failed to save quick", true)
    }
  }

  const handleSaveOutput = async () => {
    if (!output) return
    try {
      const { getDB } = await import("@/lib/db")
      const db = await getDB()
      const outputId = crypto.randomUUID()
      const now = new Date().toISOString()
      await db.execute(
        `INSERT INTO outputs (id, text, json, xml, meta_json, created_at, updated_at) VALUES (?, ?, ?, ?, '{}', ?, ?)`,
        [outputId, output.markdown, output.json, output.xml, now, now]
      )
      useNotifications.getState().notify("Output saved")
    } catch { useNotifications.getState().notify("Failed to save output", true) }
  }

  return (
    <div className="relative h-full w-full flex flex-col">
      <div className="w-full flex flex-col h-full min-h-0 relative">
        {showRectify && !output && (
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
        {charCount > 0 && !output && (
          <div className="flex items-center gap-3 px-6 py-1.5 text-[10px] font-mono text-muted shrink-0 ml-auto justify-end">
            <span>{charCount} chars</span><span>·</span><span>{wordCount} words</span><span>·</span><span>~{tokenEstimate} tokens</span>
          </div>
        )}
        <div className="flex-1 min-h-0">
          <AnimatePresence mode="wait">
          {!output ? (
            <motion.div
              key="editor"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: "spring", stiffness: 380, damping: 28, mass: 0.8 }}
              className="h-full overflow-y-auto overflow-x-hidden px-6 w-full"
            >
              <SmartEditor
                key={`${loadKey}-${rectifyKey}`}
                initialContent={body}
                contentType="markdown"
                onChange={(_plain, _doc, markdown) => handleBodyChange(markdown)}
                placeholder="Paste markdown, or start typing…"
                minHeight={60}
              />
            </motion.div>
          ) : (
            <motion.div
              key="output"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: "spring", stiffness: 380, damping: 28, mass: 0.8 }}
              className="h-full overflow-y-auto overflow-x-hidden px-6"
            >
              <div className="flex gap-2 mb-4 pt-4">
                {(["markdown", "json", "xml"] as OutputTab[]).map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`text-xs font-mono px-3 py-1 rounded transition-colors ${activeTab === tab ? "bg-foreground/10 text-foreground" : "text-muted hover:text-foreground"}`}
                  >{tab}</button>
                ))}
              </div>
              <pre className="pb-6 text-sm font-mono text-foreground leading-relaxed whitespace-pre-wrap break-words">
                {output ? output[activeTab] : ""}
              </pre>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </div>

      {body.length > 0 && !output && (
        <FloatingBar>
          <BarAction label="Save" text="Save" onClick={handleSave} />
          <BarAction label="Outline" active={showOutline} onClick={() => setShowOutline((v) => !v)}>
            <ListTree size={14} aria-hidden="true" />
          </BarAction>
          <BarAction label="Find and replace" active={showRectify} onClick={() => setShowRectify((v) => !v)}>
            <Search size={14} aria-hidden="true" />
          </BarAction>
          <BarAction label="AI assistant" active={showAI} onClick={() => setShowAI((v) => !v)}>
            <Brain size={14} aria-hidden="true" />
          </BarAction>
          <BarAction label="Generate output" primary onClick={handleGenerate}>
            <ArrowUpRight size={16} aria-hidden="true" />
          </BarAction>
          {showOutline && (
            <div className="absolute bottom-full right-0 mb-2 w-56 max-h-72 border border-border rounded-lg bg-surface shadow-lg overflow-y-auto overflow-x-hidden">
              <OutlinePanel doc={body} />
            </div>
          )}
        </FloatingBar>
      )}
      {output && (
        <FloatingBar>
          <BarAction label="Copy output" text={copied ? "copied" : "copy"} onClick={handleCopy}>
            {copied && <Check size={11} aria-hidden="true" />}
          </BarAction>
          <BarAction label="Save output" text="save" onClick={handleSaveOutput} />
          <BarAction label="Discard output" onClick={handleReset}>
            <Undo2 size={14} aria-hidden="true" />
          </BarAction>
        </FloatingBar>
      )}

      {showAI && (
        <AIAssistant
          onClose={() => setShowAI(false)}
          editorContent={body}
          documentTitle="Quick Editor"
          documentType="quick"
        />
      )}
    </div>
  )
}

export function PromptView({ tab }: { tab: Tab }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 flex items-center justify-center">
        <FileTab tab={tab} />
      </div>
    </div>
  )
}
