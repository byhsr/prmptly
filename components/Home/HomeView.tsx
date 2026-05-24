import { FileTab } from "../promptly/fileTab"
import { Tab } from "../promptly/Tabbar"
import { useState, useCallback } from "react"
import { JSONContent } from "@tiptap/core"
import { AnimatePresence, motion } from "framer-motion"
import { SmartEditor } from "../ui/SmartTextEditor"
import { useQuicksStore } from "@/hooks/store/quickStore"


// ── Quick actions shown in idle state ──────────────────────────────────────
const QUICK_ACTIONS = [
  { label: "@p:cold-email", hint: "prompt" },
  { label: "@p:system-prompt", hint: "prompt" },
  { label: "/t:brief", hint: "template" },
  { label: "/f:upload", hint: "file" },
]

// ── Output tab type ────────────────────────────────────────────────────────
type OutputTab = "plain" | "json" | "xml"

// ── HomeView ───────────────────────────────────────────────────────────────
export function HomeView() {
  const { doc, output, name, setDoc, generate, reset } = useQuicksStore()

  const [hasContent, setHasContent] = useState(false)
  const [activeTab, setActiveTab] = useState<OutputTab>("plain")
  const [copied, setCopied] = useState(false)
  const [editorKey, setEditorKey] = useState(0)

  const handleChange = useCallback(
    (plain: string, json: JSONContent) => {
      setDoc(json)
      setHasContent(plain.trim().length > 0)
    },
    [setDoc]
  )

  const handleGenerate = () => {
    generate()
    setActiveTab("plain")
  }

  const handleCopy = () => {
    if (!output) return
    navigator.clipboard.writeText(output[activeTab])
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleReset = () => {
    reset()
    setEditorKey((k) => k + 1)
    setHasContent(false)
  }

  return (
   <div className="flex h-full flex-col relative overflow-hidden items-center justify-center px-4">



        {/* ── Heading — hides once user has typed ── */}
        <AnimatePresence>
          {!hasContent && !output && (
            <motion.div
              key="heading"
              className="text-center"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <p
                style={{
                  fontFamily: "'Syne', sans-serif",
                  fontSize: 22,
                  fontWeight: 700,
                  color: "var(--color-foreground, #fff)",
                  letterSpacing: "-0.5px",
                }}
              >
                What's on your mind?
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Editor bar — always present ── */}
       <div
      className="mt-auto"
      style={{ width: "100%", maxWidth: 640, margin: "0 auto", maxHeight: "60vh",}}
    >
        <AnimatePresence mode="wait">
          {!output ? (
            <motion.div
              key="editor"
              initial={{ opacity: 0, y: 16, scale: 0.97, rotateX: 4 }}
              animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
              exit={{ opacity: 0, y: -10, scale: 0.96, rotateX: -3 }}
              transition={{ type: "spring", stiffness: 380, damping: 28, mass: 0.8 }}
              className="border border-red-500"
              style={{
                perspective: 800,
                transformOrigin: "top center",
                background: "var(--color-surface, #111)",
                border: "0.5px solid var(--color-border, #2a2a2a)",
                borderRadius: 16,
                padding: "14px 16px",
                display: "flex",
                alignItems: "flex-end",
                gap: 12,
                boxShadow: "0 8px 32px rgba(0,0,0,0.28), 0 1px 0 rgba(255,255,255,0.04) inset",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }} className="bg-background border border-red-500 overflow-y-auto rounded-2xl">
                <SmartEditor
                  key={editorKey}
                  onChange={handleChange}
                  placeholder="Type your prompt… use @ to inject context"
                  minHeight={28}
                />
              </div>

              <motion.button
                onClick={handleGenerate}
                disabled={!hasContent}
                whileTap={hasContent ? { scale: 0.88 } : undefined}
                transition={{ type: "spring", stiffness: 500, damping: 20 }}
                style={{
                  width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                  background: hasContent ? "#c8f135" : "var(--color-border, #2a2a2a)",
                  border: "none",
                  cursor: hasContent ? "pointer" : "not-allowed",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 15,
                  color: hasContent ? "#0a0a0a" : "var(--color-muted, #555)",
                  transition: "background 0.18s, color 0.18s",
                }}
              >
                ↗
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="output"
              initial={{ opacity: 0, y: 20, scale: 0.95, rotateX: 6 }}
              animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 340, damping: 32, mass: 0.9 }}
              style={{
                perspective: 800,
                transformOrigin: "top center",
                background: "var(--color-surface, #111)",
                border: "0.5px solid var(--color-border, #2a2a2a)",
                borderRadius: 16,
                overflow: "hidden",
                boxShadow: "0 12px 40px rgba(0,0,0,0.32), 0 1px 0 rgba(255,255,255,0.04) inset",
              }}
            >
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px", borderBottom: "0.5px solid var(--color-border, #2a2a2a)" }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "var(--color-muted, #555)", maxWidth: 340, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {name}
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <motion.button onClick={handleCopy} whileTap={{ scale: 0.92 }} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: copied ? "#c8f135" : "var(--color-muted, #555)", background: "transparent", border: "0.5px solid var(--color-border, #2a2a2a)", borderRadius: 6, padding: "3px 9px", cursor: "pointer", transition: "color 0.18s" }}>
                    {copied ? "copied ✓" : "copy"}
                  </motion.button>
                  <motion.button onClick={handleReset} whileTap={{ scale: 0.92 }} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "var(--color-muted, #555)", background: "transparent", border: "0.5px solid var(--color-border, #2a2a2a)", borderRadius: 6, padding: "3px 9px", cursor: "pointer" }}>
                    new ↺
                  </motion.button>
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", borderBottom: "0.5px solid var(--color-border, #2a2a2a)", padding: "0 4px" }}>
                {(["plain", "json", "xml"] as OutputTab[]).map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)} style={{ position: "relative", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, padding: "7px 14px", background: "transparent", border: "none", color: activeTab === tab ? "#c8f135" : "var(--color-muted, #555)", cursor: "pointer", transition: "color 0.15s" }}>
                    {tab}
                    {activeTab === tab && (
                      <motion.div layoutId="tab-indicator" style={{ position: "absolute", bottom: -1, left: 0, right: 0, height: 1.5, background: "#c8f135", borderRadius: 2 }} transition={{ type: "spring", stiffness: 500, damping: 36 }} />
                    )}
                  </button>
                ))}
              </div>

              {/* Content */}
              <AnimatePresence mode="wait">
                <motion.pre key={activeTab} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.14 }}
                  style={{ margin: 0, padding: "14px 16px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "var(--color-foreground, #e8e8e8)", lineHeight: 1.75, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 340, overflowY: "auto" }}>
                  {output[activeTab]}
                </motion.pre>
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
