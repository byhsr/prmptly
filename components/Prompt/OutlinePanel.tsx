import { useMemo } from "react"
import type { JSONContent } from "@tiptap/react"

export interface OutlineSection {
  title: string
  doc?: JSONContent | string | null
  value?: string
}

interface OutlinePanelProps {
  doc?: string | null
  sections?: OutlineSection[]
}

interface OutlineEntry {
  id: string
  level: 1 | 2
  text: string
}

// Scans flat markdown text for `#` / `##` heading lines
function headingsFromString(text: string): { level: 1 | 2; text: string }[] {
  const out: { level: 1 | 2; text: string }[] = []
  for (const line of text.split("\n")) {
    const match = line.match(/^(#{1,2})\s+(.+)$/)
    if (!match) continue
    out.push({ level: match[1].length === 1 ? 1 : 2, text: match[2].trim() })
  }
  return out
}

// Walks a Tiptap JSONContent tree for heading nodes
function headingsFromDoc(doc: JSONContent): { level: 1 | 2; text: string }[] {
  const out: { level: 1 | 2; text: string }[] = []

  const walk = (node: JSONContent) => {
    if (node.type === "heading") {
      const level = Number(node.attrs?.level ?? 1)
      const text = (node.content ?? [])
        .map((child) => (typeof child.text === "string" ? child.text : ""))
        .join("")
        .trim()
      if (text) out.push({ level: level === 1 ? 1 : 2, text })
      return
    }
    if (Array.isArray(node.content)) node.content.forEach(walk)
  }

  walk(doc)
  return out
}

export function OutlinePanel({ doc, sections }: OutlinePanelProps) {
  const headings = useMemo<OutlineEntry[]>(() => {
    const entries: OutlineEntry[] = []
    let index = 0

    if (sections && sections.length > 0) {
      for (const section of sections) {
        if (section.title) {
          entries.push({ id: `s-${index++}`, level: 2, text: section.title })
        }
        if (section.doc && typeof section.doc !== "string") {
          for (const h of headingsFromDoc(section.doc)) {
            entries.push({ id: `h-${index++}`, level: h.level, text: h.text })
          }
        } else if (typeof section.value === "string" && section.value) {
          for (const h of headingsFromString(section.value)) {
            entries.push({ id: `h-${index++}`, level: h.level, text: h.text })
          }
        }
      }
      return entries
    }

    if (!doc || typeof doc !== "string") return []
    return headingsFromString(doc).map((h, i) => ({ id: `h-${i}`, level: h.level, text: h.text }))
  }, [doc, sections])

  return (
    <div className="flex flex-col h-full p-3 space-y-1">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted mb-2 px-1">Outline</span>
      <div className="flex-1 overflow-y-auto space-y-0.5 min-h-0">
        {headings.length === 0 ? (
          <p className="text-[11px] text-muted px-1">No headings yet — use # or ##</p>
        ) : (
          headings.map((h) => (
            <button
              key={h.id}
              onClick={() => {
                // Try to find the heading or section in the DOM
                const allEditors = document.querySelectorAll('[contenteditable]')
                for (const ed of allEditors) {
                  if (ed.textContent?.trim() === h.text) {
                    ed.scrollIntoView({ behavior: "smooth", block: "start" })
                    return
                  }
                }
                // Fallback: try smart editor heading elements
                const editorEl = document.querySelector(".smart-editor-content")
                if (editorEl) {
                  const lines = editorEl.querySelectorAll("h1, h2")
                  for (const el of lines) {
                    if (el.textContent?.includes(h.text)) {
                      el.scrollIntoView({ behavior: "smooth", block: "start" })
                      return
                    }
                  }
                }
                // Last fallback: scroll to the input showing the section title
                const inputs = document.querySelectorAll('input')
                for (const inp of inputs) {
                  if (inp.value === h.text) {
                    inp.scrollIntoView({ behavior: "smooth", block: "start" })
                    return
                  }
                }
              }}
              title={h.text}
              className="w-full text-left px-2 py-1.5 rounded text-xs font-mono text-muted hover:text-foreground hover:bg-background transition-colors truncate"
              style={{ paddingLeft: h.level === 2 ? 20 : 8 }}
            >
              {h.text}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
