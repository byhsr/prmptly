"use client"

import { useState } from "react"
import { Check, Copy, Download } from "lucide-react"
import { usePromptStore } from "@/hooks/store/PromptStore"
import { useNotifications } from "@/hooks/store/SidebarStore"
import { exportMarkdownToFile } from "@/lib/exportMarkdown"
import { buildOutput } from "@/lib/editor/outputs"
import { OverflowMenu } from "@/components/ui/OverflowMenu"
import { FloatingBar, BarAction } from "@/components/ui/FloatingBar"
import { SmartEditor } from "../ui/SmartTextEditor"

// Global ref for RectifyBar — last focused editor
export const activeEditorRef = { current: null as any }

export function BuilderPanel() {
  const body = usePromptStore((s) => s.body)
  const loadKey = usePromptStore((s) => s.loadKey)
  const loading = usePromptStore((s) => s.loading)
  const setBody = usePromptStore((s) => s.setBody)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!body) return
    await navigator.clipboard.writeText(body)
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
    try {
      const name = usePromptStore.getState().activeDocument?.name || "prompt"
      const exported = await exportMarkdownToFile(name, body)
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
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-6 w-full">
        <SmartEditor
          key={loadKey}
          initialContent={body}
          contentType="markdown"
          onChange={(_plain, _doc, markdown) => setBody(markdown)}
          placeholder="Write your prompt in markdown — use ## for sections…"
          minHeight={300}
          onEditorReady={(e) => { activeEditorRef.current = e }}
        />
      </div>

      {/* Same floating bar as quicks — fixed-positioned, so a pasted prompt taller than
          the pane can never push it out of view. */}
      {body.length > 0 && (
        <FloatingBar>
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
