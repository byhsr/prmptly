import { createHighlighter, type Highlighter } from "shiki"
import { cn } from "@/lib/utils"

export type HighlightLang = "markdown" | "json" | "xml"

export const HIGHLIGHT_THEME = "vesper"

// Shiki's top-level `codeToHtml` builds a fresh highlighter per call, which is far too
// expensive for an editor backdrop that re-renders on keystrokes. One instance is created
// lazily and shared by every surface; once it resolves, `Highlighter.codeToHtml` is
// synchronous, so the raw editor can highlight during render with no flicker.
let pending: Promise<Highlighter> | null = null

export function getHighlighter(): Promise<Highlighter> {
  pending ??= createHighlighter({
    themes: [HIGHLIGHT_THEME],
    langs: ["markdown", "json", "xml"],
  })
  return pending
}

// Shiki emits its own <pre>/<code> chrome; these variants strip it back to bare text so the
// theme supplies only the colour and the surface stays transparent.
export const SHIKI_CONTENT_CLASS =
  "[&_pre]:!bg-transparent [&_pre]:!p-0 [&_pre]:!m-0 [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_code]:whitespace-pre-wrap [&_code]:break-words"

/** Ready-to-use class string for a read-only highlighted block. */
export const SHIKI_BLOCK_CLASS = cn(
  "text-sm font-mono leading-relaxed",
  SHIKI_CONTENT_CLASS
)
