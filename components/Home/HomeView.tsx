import { useState, useCallback, useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Search, ArrowUpRight, ListTree, Undo2, Check, X, Replace, CaseSensitive, WholeWord } from "lucide-react"
import { useQuicksStore } from "@/hooks/store/quickStore"
import { parseMarkdownSections } from "@/lib/editor/parseMarkdown"
import { useNotifications } from "@/hooks/store/SidebarStore"
import { useTabViewStore } from "@/hooks/store/TabStore"
import { Tab } from "../core-components/Tabbar"
import { FileTab } from "../Prompt/fileTab"
import { SmartEditor } from "../ui/SmartTextEditor"
import { OutlinePanel } from "../Prompt/OutlinePanel"

const homeEditorRef = { current: null as any }
type OutputTab = "plain" | "json" | "xml"

function SectionEditor({ section, onSave }: { section: { id: string; doc: string | any; title?: string }, onSave: (id: string, text: string) => void }) {
  const getContent = () => {
    if (typeof section.doc === "string") return section.doc.slice(0, 15000)
    return section.doc
  }

  return (
    <div className="py-2">
      {section.title && (
        <input
          value={section.title}
          onChange={(e) => useQuicksStore.getState().updateSectionTitle(section.id, e.target.value)}
          placeholder="Section title"
          className="w-full bg-transparent outline-none text-xs font-mono text-muted mb-2"
        />
      )}
      <SmartEditor
        initialContent={getContent()}
        onChange={(plain, _doc) => onSave(section.id, plain)}
        placeholder="Type here…"
        minHeight={60}
        onEditorReady={(e) => { homeEditorRef.current = e }}
      />
    </div>
  )
}

function flattenDoc(doc: string | any): string {
  if (typeof doc === "string") return doc
  if (!doc?.content) return ""
  return doc.content.map((n: any) => {
    if (n.content) return n.content.map((c: any) => c.text || "").join("")
    return n.text || ""
  }).filter(Boolean).join("\n")
}

export function HomeView() {
  const { sections, output, setSections, updateSection, generate, reset, hasContent } =
    useQuicksStore()
  const [activeTab, setActiveTab] = useState<OutputTab>("plain")
  const [copied, setCopied] = useState(false)
  const [showRectify, setShowRectify] = useState(false)
  const [showOutline, setShowOutline] = useState(false)
  const [rectifyKey, setRectifyKey] = useState(0)
  const [rectifyCase, setRectifyCase] = useState(false)
  const [rectifyWord, setRectifyWord] = useState(false)

  const allText = sections.map((s) => flattenDoc(s.doc)).join("\n")
  const sectionTitles = sections.map((s) => s.title || "").filter(Boolean)
  const charCount = allText.length
  const wordCount = allText ? allText.trim().split(/\s+/).length : 0
  const tokenEstimate = Math.round(charCount / 4)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); handleSave() }
      if ((e.metaKey || e.ctrlKey) && e.key === "r") { e.preventDefault(); setShowRectify((v) => !v) }
      if ((e.metaKey || e.ctrlKey) && e.key === "o") { e.preventDefault(); setShowOutline((v) => !v) }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [sections, output])

  useEffect(() => {
    if (sections.length === 0) {
      setSections([{ id: crypto.randomUUID(), title: "", doc: "" }])
    }
  }, [sections.length, setSections])

  const handlePaste = (e: React.ClipboardEvent) => {
    const nativeEvent = e.nativeEvent as ClipboardEvent
    const text = nativeEvent.clipboardData?.getData("text/plain") || ""
    e.stopPropagation()
    if (!text.includes("## ")) return
    e.preventDefault()
    const result = parseMarkdownSections(text)
    useQuicksStore.setState({ sections: result, output: null, hasContent: true })
  }

  const handleTextChange = useCallback((id: string, value: string) => {
    updateSection(id, value)
  }, [updateSection])

  const handleGenerate = () => { generate(); setActiveTab("plain") }
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
        [outputId, output.plain, output.json, output.xml, now, now]
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
                const { sections } = useQuicksStore.getState()
                const updated = sections.map((s) => {
                  if (typeof s.doc !== "string") return s
                  return { ...s, doc: s.doc.replace(regex, replace) }
                })
                useQuicksStore.setState({ sections: updated })
                setRectifyKey((k) => k + 1)
              }}
              className="rounded px-2 py-1 text-[10px] font-medium bg-foreground/10 text-foreground hover:bg-foreground/20 transition-colors"
            >Replace all</button>
            <button onClick={() => setShowRectify(false)} className="rounded p-1 text-muted hover:text-foreground transition-colors ml-auto"><X className="h-3 w-3" /></button>
          </div>
        )}
        {allText.length > 0 && !output && (
          <div className="flex items-center gap-3 px-6 py-1.5 text-[10px] font-mono text-muted shrink-0 ml-auto justify-end">
            <span>{charCount} chars</span><span>·</span><span>{wordCount} words</span><span>·</span><span>~{tokenEstimate} tokens</span>
          </div>
        )}
        <div className="flex-1 min-h-0">
          <AnimatePresence mode="wait">
          {!output ? (
            <motion.div
              key="editor"
              onPaste={handlePaste}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: "spring", stiffness: 380, damping: 28, mass: 0.8 }}
              className="h-full overflow-y-auto px-6 w-full"
            >
              {Array.isArray(sections) && sections.map((section, _i) => (
                <SectionEditor key={section.id + '-' + rectifyKey} section={section} onSave={handleTextChange} />
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="output"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: "spring", stiffness: 380, damping: 28, mass: 0.8 }}
              className="h-full overflow-y-auto px-6"
            >
              <div className="flex gap-2 mb-4 pt-4">
                {(["plain", "json", "xml"] as OutputTab[]).map((tab) => (
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

      <AnimatePresence>
        {hasContent && !output && (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            className="fixed bottom-6 right-6 flex gap-2 items-center bg-surface border border-border rounded-xl px-3 py-2 shadow-lg z-50"
          >
            <button onClick={handleSave} className="text-[11px] font-mono text-muted px-3 py-1 rounded-lg border border-border hover:text-foreground transition-colors">Save</button>
            {showOutline && (
              <div className="absolute bottom-12 right-0 w-56 max-h-72 border border-border rounded-lg bg-surface shadow-lg overflow-y-auto">
                <OutlinePanel doc={allText} sectionTitles={sectionTitles.length > 0 ? sectionTitles : undefined} />
              </div>
            )}
            <button onClick={() => setShowOutline((v) => !v)} className="text-[11px] font-mono text-muted px-2 py-1 rounded-lg hover:text-foreground transition-colors"><ListTree size={12} /></button>
            <button onClick={() => setShowRectify((v) => !v)} className="text-[11px] font-mono text-muted px-2 py-1 rounded-lg hover:text-foreground transition-colors"><Search size={12} /></button>
            <button onClick={handleGenerate} className="w-8 h-8 rounded-lg bg-accent text-accent-foreground flex items-center justify-center text-sm hover:opacity-90 transition-opacity"><ArrowUpRight size={14} /></button>
          </motion.div>
        )}
        {output && (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            className="fixed bottom-6 right-6 flex gap-2 items-center bg-surface border border-border rounded-xl px-3 py-2 shadow-lg z-50"
          >
            <button onClick={handleCopy} className="text-[11px] font-mono text-muted px-3 py-1 rounded-lg border border-border hover:text-foreground transition-colors">
              {copied ? <><Check size={11} className="inline" /> copied</> : "copy"}
            </button>
            <button onClick={handleSaveOutput} className="text-[11px] font-mono text-muted px-3 py-1 rounded-lg border border-border hover:text-foreground transition-colors">save</button>
            <button onClick={handleReset} className="w-8 h-8 rounded-lg bg-border text-muted flex items-center justify-center hover:text-foreground transition-colors"><Undo2 size={12} /></button>
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
