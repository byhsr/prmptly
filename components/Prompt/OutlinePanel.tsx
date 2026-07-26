import { useMemo } from "react"
import type { JSONContent } from "@tiptap/react"

interface HeadingEntry {
  id: string
  level: 1 | 2
  text: string
}

function extractHeadingsFromDoc(doc: JSONContent | null | string): HeadingEntry[] {
  if (!doc || typeof doc === "string") return []
  const entries: HeadingEntry[] = []
  let index = 0

  function walk(node: JSONContent) {
    if (node.type === "heading" && (node.attrs?.level === 1 || node.attrs?.level === 2)) {
      const text = node.content?.map((c: JSONContent) => c.text ?? "").join("") || ""
      entries.push({ id: `h-${index}`, level: node.attrs.level, text })
      index++
    }
    if (node.content) {
      for (const child of node.content) walk(child)
    }
  }

  walk(doc)
  return entries
}

interface OutlinePanelProps {
  doc: JSONContent | string | null
}

export function OutlinePanel({ doc }: OutlinePanelProps) {
  const headings = useMemo(() => extractHeadingsFromDoc(doc), [doc])

  const handleClick = (id: string) => {
    const el = document.querySelector(`[data-heading-id="${id}"]`)
    el?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  if (headings.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <span className="text-[11px] text-muted">No headings yet — use # or ##</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full p-3 space-y-1">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted mb-2 px-1">Outline</span>
      <div className="flex-1 overflow-y-auto space-y-0.5">
        {headings.map((h) => (
          <button
            key={h.id}
            onClick={() => handleClick(h.id)}
            title={h.text}
            className="w-full text-left px-2 py-1.5 rounded text-xs font-mono text-muted hover:text-foreground hover:bg-background transition-colors truncate"
            style={{ paddingLeft: h.level === 2 ? 20 : 8 }}
          >
            {h.text}
          </button>
        ))}
      </div>
    </div>
  )
}
