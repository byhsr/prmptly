"use client"

import { useState } from "react"
import { Check, Copy, Download } from "lucide-react"
import { usePromptStore } from "@/hooks/store/PromptStore"
import { useNotifications } from "@/hooks/store/SidebarStore"
import { useSettingsStore } from "@/hooks/store/settingsStore"
import { exportMarkdownToFile } from "@/lib/exportMarkdown"
import { buildOutput } from "@/lib/editor/outputs"
import { activeEditorRef } from "@/lib/editor/activeEditors"
import { OverflowMenu } from "@/components/ui/OverflowMenu"
import { FloatingBar, BarAction } from "@/components/ui/FloatingBar"
import { SmartEditor } from "../ui/SmartTextEditor"
import { RawMarkdownEditor } from "./RawMarkdownEditor"

export function BuilderPanel() {
  const body = usePromptStore((s) => s.body)
  const loadKey = usePromptStore((s) => s.loadKey)
  const loading = usePromptStore((s) => s.loading)
  const setBody = usePromptStore((s) => s.setBody)
  const editorMode = useSettingsStore((s) => s.settings.editorMode)
  const [copied, setCopied] = useState(false)

  // Copy and export run through `buildOutput` so `%% note %%` annotations — the author's
  // own — never leave the builder.
  const handleCopy = async () => {
    const markdown = buildOutput(body, "markdown")
    if (!markdown) return
    await navigator.clipboard.writeText(markdown)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // The prompt is markdown-first, but the target may want it as JSON or XML.
  const handleCopyFormat = async (format: "json" | "xml") => {
    if (!body) return
    await navigator.clipboard.writeText(buildOutput(body, format))
    useNotifications.getState().notify(`Copied as ${format.toUpperCase()}`)
  }

  const handleExport = async () => {
    if (!body) return
    const markdown = buildOutput(body, "markdown")
    if (!markdown) return
    try {
      const name = usePromptStore.getState().activeDocument?.name || "prompt"
      const exported = await exportMarkdownToFile(name, markdown)
      if (exported) useNotifications.getState().notify("Prompt exported")
    } catch {
      useNotifications.getState().notify("Failed to export prompt", true)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-xs text-muted">Loading...</span>
      </div>
    )
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-6 w-full">
        {editorMode === "raw" ? (
          <RawMarkdownEditor
            value={body}
            onChange={setBody}
            placeholder="Write your prompt in markdown — use ## for sections…"
            minHeight={300}
          />
        ) : (
          <SmartEditor
            key={loadKey}
            initialContent={body}
            contentType="markdown"
            onChange={(_plain, _doc, markdown) => setBody(markdown)}
            placeholder="Write your prompt in markdown — use ## for sections…"
            minHeight={300}
            onEditorReady={(e) => { activeEditorRef.current = e }}
          />
        )}
      </div>

      {/* Same floating bar as quicks, but anchored to this pane rather than the viewport so
          it stays on the editor's corner — opening the outline shrinks the column instead
          of stranding the bar over the outline. Positioned, so taller content can't push
          it out of view. */}
      {body.length > 0 && (
        <FloatingBar contained>
          <BarAction label="Copy markdown" text={copied ? "copied" : "copy"} onClick={handleCopy}>
            {copied ? <Check size={11} className="text-accent" aria-hidden="true" /> : <Copy size={11} aria-hidden="true" />}
          </BarAction>

          <BarAction label="Export as .md" text="export" onClick={handleExport}>
            <Download size={11} aria-hidden="true" />
          </BarAction>

          <OverflowMenu
            label="Copy as…"
            panelWidth={190}
            className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-background hover:text-foreground"
            items={[
              { label: "Copy as markdown", onClick: handleCopy },
              { label: "Copy as JSON", onClick: () => handleCopyFormat("json") },
              { label: "Copy as XML", onClick: () => handleCopyFormat("xml") },
            ]}
          />
        </FloatingBar>
      )}
    </div>
  )
}
