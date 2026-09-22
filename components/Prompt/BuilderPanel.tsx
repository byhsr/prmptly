"use client"

import { useState, type ReactNode } from "react"
import { motion } from "framer-motion"
import { Check, Copy, Download } from "lucide-react"
import { usePromptStore } from "@/hooks/store/PromptStore"
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion"
import { useNotifications } from "@/hooks/store/SidebarStore"
import { exportMarkdownToFile } from "@/lib/exportMarkdown"
import { Tooltip } from "@/components/ui/Tooltip"
import { SmartEditor } from "../ui/SmartTextEditor"

// Global ref for RectifyBar — last focused editor
export const activeEditorRef = { current: null as any }

// Same control grammar as the quicks save bar / output copy button.
function BuilderAction({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  const reduced = usePrefersReducedMotion()
  return (
    <Tooltip label={label}>
      <motion.button
        type="button"
        onClick={onClick}
        disabled={disabled}
        whileHover={reduced ? undefined : { scale: 1.05 }}
        whileTap={reduced ? undefined : { scale: 0.88 }}
        transition={{ type: "spring", stiffness: 500, damping: 20 }}
        className="focus-ring inline-flex h-10 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 font-mono text-[11px] text-muted shadow-lg transition-colors hover:text-foreground hover:bg-background disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {children}
      </motion.button>
    </Tooltip>
  )
}

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
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 w-full">
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

      <div className="shrink-0 flex items-center justify-end gap-2 px-6 pb-6">
        <BuilderAction label="Copy markdown" onClick={handleCopy} disabled={!body}>
          {copied ? (
            <>
              <Check size={11} className="text-accent" aria-hidden="true" />
              copied
            </>
          ) : (
            <>
              <Copy size={11} aria-hidden="true" />
              copy
            </>
          )}
        </BuilderAction>

        <BuilderAction label="Export as .md" onClick={handleExport} disabled={!body}>
          <Download size={11} aria-hidden="true" />
          export .md
        </BuilderAction>
      </div>
    </div>
  )
}
