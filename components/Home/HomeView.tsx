import { useState, useCallback, useEffect } from "react"
import { JSONContent } from "@tiptap/core"
import { AnimatePresence, motion } from "framer-motion"
import { SmartEditor } from "../ui/SmartTextEditor"
import { useQuicksStore } from "@/hooks/store/quickStore"
import { nodeToPlain } from "@/lib/client/textEditorFuncs"
import { useNotifications } from "@/hooks/store/SidebarStore"
import { Tab } from "../core-components/Tabbar"
import { FileTab } from "../Prompt/fileTab"

const emptyDoc: JSONContent = { type: "doc", content: [{ type: "paragraph" }] }

// Quick actions — commented out for now, will use later
// const QUICK_ACTIONS = [
//   { label: "@p:cold-email", hint: "prompt" },
//   { label: "@p:system-prompt", hint: "prompt" },
//   { label: "/t:brief", hint: "template" },
//   { label: "/f:upload", hint: "file" },
// ]

type OutputTab = "plain" | "json" | "xml"

// ── HomeView ───────────────────────────────────────────────────────────────
export function HomeView() {
  const { sections, output, setSections, updateSection, updateSectionTitle, loadFromPaste, generate, reset } =
    useQuicksStore()

  const [hasContent, setHasContent] = useState(false)
  const [activeTab, setActiveTab] = useState<OutputTab>("plain")
  const [copied, setCopied] = useState(false)

  // ensure one empty section exists so there's always something to type into
  useEffect(() => {
    if (sections.length === 0) {
      setSections([{ id: crypto.randomUUID(), title: "", doc: emptyDoc }])
    }
  }, [sections.length, setSections])

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text/plain")
    if (text.includes("## ")) {
      e.preventDefault()
      loadFromPaste(text)
      setHasContent(true)
    }
  }

  const handleSectionChange = useCallback(
    (id: string) => (_plain: string, doc: JSONContent) => {
      updateSection(id, doc)
      setHasContent(true)
    },
    [updateSection]
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
    setHasContent(false)
  }

  const handleSave = async () => {
    const { createDocument } = await import("@/lib/db/document")
    const { useTabViewStore } = await import("@/hooks/store/TabStore")
    try {
      const doc = await createDocument({
        type: "quick",
        name: sections[0]?.title || "Untitled Quick",
        sections: sections.map((s) => ({
          id: s.id,
          title: s.title,
          order: sections.indexOf(s),
          value: nodeToPlain(s.doc),
          doc: s.doc,
        })),
        meta: {},
      })
      useNotifications.getState().notify("Quick saved")
      useTabViewStore.getState().addTab({ id: doc.id, label: doc.name, type: "prompt" })
    } catch (e) {
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
        [outputId, output.plain, output.json, output.xml, now, now]
      )
      useNotifications.getState().notify("Output saved")
    } catch (e) {
      useNotifications.getState().notify("Failed to save output", true)
    }
  }

  return (
    <div className="relative h-full w-full flex items-start justify-center pt-16 px-14">
      <div style={{ width: "100%" }}>
        <AnimatePresence mode="wait">
          {!output ? (
            <motion.div
              key="editor"
              onPaste={handlePaste}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: "spring", stiffness: 380, damping: 28, mass: 0.8 }}
            >
              {sections.map((section) => (
                <div key={section.id} style={{ marginBottom: 14 }}>
                  {section.title && (
                    <input
                      value={section.title}
                      onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                      placeholder="Section title"
                      style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: 11,
                        color: "var(--color-muted, #555)",
                        background: "transparent",
                        border: "none",
                        outline: "none",
                        marginBottom: 4,
                        letterSpacing: "0.02em",
                        width: "100%",
                      }}
                    />
                  )}
                  <SmartEditor
                    value={nodeToPlain(section.doc)}
                    onChange={handleSectionChange(section.id)}
                    placeholder={section.title || "Type your prompt… use @ to inject context"}
                    minHeight={28}
                  />
                </div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="output"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: "spring", stiffness: 380, damping: 28, mass: 0.8 }}
            >
              {/* Tabs */}
              <div style={{ display: "flex", marginBottom: 16, gap: 2 }}>
                {(["plain", "json", "xml"] as OutputTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      position: "relative",
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: 11,
                      padding: "5px 12px",
                      background: "transparent",
                      border: "none",
                      color: activeTab === tab ? "#c8f135" : "var(--color-muted, #555)",
                      cursor: "pointer",
                      transition: "color 0.15s",
                    }}
                  >
                    {tab}
                    {activeTab === tab && (
                      <motion.div
                        layoutId="tab-indicator"
                        style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1.5, background: "#c8f135", borderRadius: 2 }}
                        transition={{ type: "spring", stiffness: 500, damping: 36 }}
                      />
                    )}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.pre
                  key={activeTab}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.14 }}
                  style={{
                    margin: 0,
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 13,
                    color: "var(--color-foreground, #e8e8e8)",
                    lineHeight: 1.75,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {output[activeTab]}
                </motion.pre>
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating action bar — editor */}
      <AnimatePresence>
        {hasContent && !output && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 420, damping: 28, mass: 0.7 }}
            style={{
              position: "fixed",
              bottom: 28,
              right: 28,
              display: "flex",
              gap: 8,
              alignItems: "center",
              background: "var(--color-surface, #111)",
              border: "0.5px solid var(--color-border, #2a2a2a)",
              borderRadius: 12,
              padding: "6px 8px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.04) inset",
            }}
          >
            <motion.button
              onClick={handleSave}
              whileTap={{ scale: 0.88 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11,
                color: "var(--color-muted, #555)",
                background: "transparent",
                border: "0.5px solid var(--color-border, #2a2a2a)",
                borderRadius: 7,
                padding: "4px 12px",
                cursor: "pointer",
                letterSpacing: "0.02em",
              }}
            >
              save
            </motion.button>

            <motion.button
              onClick={handleGenerate}
              whileTap={{ scale: 0.88 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
              style={{
                width: 32, height: 32, borderRadius: 8,
                background: "#c8f135",
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 15, color: "#0a0a0a", flexShrink: 0,
              }}
            >
              ↗
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating action bar — output */}
      <AnimatePresence>
        {output && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 420, damping: 28, mass: 0.7 }}
            style={{
              position: "fixed",
              bottom: 28,
              right: 28,
              display: "flex",
              gap: 8,
              alignItems: "center",
              background: "var(--color-surface, #111)",
              border: "0.5px solid var(--color-border, #2a2a2a)",
              borderRadius: 12,
              padding: "6px 8px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.04) inset",
            }}
          >
            <motion.button
              onClick={handleCopy}
              whileTap={{ scale: 0.88 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11,
                color: copied ? "#c8f135" : "var(--color-muted, #555)",
                background: "transparent",
                border: "0.5px solid var(--color-border, #2a2a2a)",
                borderRadius: 7,
                padding: "4px 12px",
                cursor: "pointer",
                letterSpacing: "0.02em",
                transition: "color 0.18s",
              }}
            >
              {copied ? "copied ✓" : "copy"}
            </motion.button>

            <motion.button
              onClick={handleSaveOutput}
              whileTap={{ scale: 0.88 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11,
                color: "var(--color-muted, #555)",
                background: "transparent",
                border: "0.5px solid var(--color-border, #2a2a2a)",
                borderRadius: 7,
                padding: "4px 12px",
                cursor: "pointer",
                letterSpacing: "0.02em",
              }}
            >
              save
            </motion.button>

            <motion.button
              onClick={handleReset}
              whileTap={{ scale: 0.88 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
              style={{
                width: 32, height: 32, borderRadius: 8,
                background: "var(--color-border, #2a2a2a)",
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 15, color: "var(--color-muted, #555)", flexShrink: 0,
              }}
            >
              ↺
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
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