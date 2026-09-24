"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import type { Highlighter } from "shiki"
import { cn } from "@/lib/utils"
import { getHighlighter, HIGHLIGHT_THEME, SHIKI_CONTENT_CLASS } from "@/lib/editor/highlighter"
import { activeRawTextareaRef } from "@/lib/editor/activeEditors"

// Highlighting synchronously is what keeps the colour exactly under the caret, so Shiki's
// cost per keystroke is the limit. Measured warm, it runs ~2ms per 1k chars (1k ≈ 6ms,
// 10k ≈ 18ms), which is why the sync budget sits here. Past it the editor waits for a pause
// and shows plain text while you type — still fully editable, colour returns at rest.
const SYNC_HIGHLIGHT_CHARS = 10_000
const SETTLE_MS = 180

// Both layers carry this exact style. Any divergence in font metrics, padding or wrapping
// shows up as the caret drifting away from its own coloured text.
const SKIN: CSSProperties = {
  fontFamily: "var(--font-code, monospace)",
  fontSize: "0.875rem",
  lineHeight: 1.7,
  letterSpacing: "normal",
  tabSize: 2,
  padding: "0.5rem 0.75rem",
  whiteSpace: "pre-wrap",
  overflowWrap: "break-word",
  wordBreak: "normal",
}

function highlight(highlighter: Highlighter, value: string): string {
  try {
    // Shiki marks its <pre> focusable; the backdrop is decorative, so it must not be.
    return highlighter.codeToHtml(value, {
      lang: "markdown",
      theme: HIGHLIGHT_THEME,
      tabindex: false,
    })
  } catch {
    return ""
  }
}

interface RawMarkdownEditorProps {
  value: string
  onChange: (markdown: string) => void
  placeholder?: string
  minHeight?: number
}

export function RawMarkdownEditor({
  value,
  onChange,
  placeholder = "Write your prompt in markdown…",
  minHeight = 300,
}: RawMarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null)

  useEffect(() => {
    let live = true
    getHighlighter().then((h) => {
      if (live) setHighlighter(h)
    })
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    activeRawTextareaRef.current = textareaRef.current
    return () => {
      activeRawTextareaRef.current = null
    }
  }, [])

  // The textarea is the in-flow layer, so its height drives the wrapper and the backdrop
  // simply follows. Auto-growing means no internal scrollbar and nothing clipped.
  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.max(el.scrollHeight, minHeight)}px`
  }, [value, minHeight])

  // Computed during render, so the backdrop and the caret change in the same paint.
  const syncHtml = useMemo(() => {
    if (!highlighter || !value || value.length > SYNC_HIGHLIGHT_CHARS) return ""
    return highlight(highlighter, value)
  }, [highlighter, value])

  // Larger documents highlight only once typing pauses. `settled` is matched against `value`
  // so a stale backdrop is never drawn under newer text.
  const [settled, setSettled] = useState<{ value: string; html: string } | null>(null)

  useEffect(() => {
    if (!highlighter || !value || value.length <= SYNC_HIGHLIGHT_CHARS) {
      setSettled((prev) => (prev ? null : prev))
      return
    }

    const timer = setTimeout(
      () => setSettled({ value, html: highlight(highlighter, value) }),
      SETTLE_MS
    )
    return () => clearTimeout(timer)
  }, [highlighter, value])

  const html = syncHtml || (settled?.value === value ? settled.html : "")

  return (
    <div className="relative w-full">
      {html && (
        <pre
          aria-hidden="true"
          className={cn(SHIKI_CONTENT_CLASS, "pointer-events-none absolute inset-0 overflow-hidden")}
          style={SKIN}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}

      <textarea
        ref={textareaRef}
        data-raw-editor=""
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        className={cn(
          "relative block w-full resize-none overflow-hidden border-0 bg-transparent outline-none",
          "placeholder:text-muted/50",
          html ? "text-transparent caret-foreground" : "text-foreground"
        )}
        style={{ ...SKIN, minHeight }}
      />
    </div>
  )
}
