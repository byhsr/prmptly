import { useState, useCallback, useEffect } from "react"
import { Search, ListTree, Check, Code, Copy, X, Replace, CaseSensitive, WholeWord, Download, Pilcrow } from "lucide-react"
import { useQuicksStore } from "@/hooks/store/quickStore"
import { useNotifications } from "@/hooks/store/SidebarStore"
import { useSettingsStore } from "@/hooks/store/settingsStore"
import { buildOutput } from "@/lib/editor/outputs"
import { activeEditorRef } from "@/lib/editor/activeEditors"
import { exportMarkdownToFile } from "@/lib/exportMarkdown"
import { OverflowMenu } from "@/components/ui/OverflowMenu"
import { FloatingBar, BarAction } from "@/components/ui/FloatingBar"
import { Tab } from "../core-components/Tabbar"
import { FileTab } from "../Prompt/fileTab"
import { SmartEditor } from "../ui/SmartTextEditor"
import { RawMarkdownEditor } from "../Prompt/RawMarkdownEditor"
import { OutlinePanel } from "../Prompt/OutlinePanel"
import { HomeMenu } from "./HomeMenu"

export function HomeView() {
  const { body, setBody, loadKey, hasContent, close } = useQuicksStore()
  const [copiedBody, setCopiedBody] = useState(false)
  const [showRectify, setShowRectify] = useState(false)
  const [showOutline, setShowOutline] = useState(false)
  const [rectifyKey, setRectifyKey] = useState(0)
  const [rectifyCase, setRectifyCase] = useState(false)
  const [rectifyWord, setRectifyWord] = useState(false)
  const editorMode = useSettingsStore((s) => s.settings.editorMode)
  const updateSetting = useSettingsStore((s) => s.updateSetting)

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
  // Routed through `buildOutput` so `%% note %%` annotations stay behind.
  const handleCopyBody = async () => {
    const markdown = buildOutput(body, "markdown")
    if (!markdown) return
    await navigator.clipboard.writeText(markdown)
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
    const markdown = buildOutput(body, "markdown")
    if (!markdown) return
    try {
      const name = useQuicksStore.getState().name || "quick"
      const exported = await exportMarkdownToFile(name, markdown)
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
          {editorMode === "raw" ? (
            <RawMarkdownEditor
              value={body}
              onChange={handleBodyChange}
              placeholder="Paste markdown, or start typing…"
              minHeight={60}
            />
          ) : (
            <SmartEditor
              key={`${loadKey}-${rectifyKey}`}
              initialContent={body}
              contentType="markdown"
              onChange={(_plain, _doc, markdown) => handleBodyChange(markdown)}
              placeholder="Paste markdown, or start typing…"
              minHeight={60}
              onEditorReady={(e) => { activeEditorRef.current = e }}
            />
          )}
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
          <BarAction
            label={editorMode === "raw" ? "Pretty markdown" : "Raw markdown"}
            active={editorMode === "raw"}
            onClick={() => updateSetting("editorMode", editorMode === "raw" ? "pretty" : "raw")}
          >
            {editorMode === "raw" ? <Pilcrow size={14} aria-hidden="true" /> : <Code size={14} aria-hidden="true" />}
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
