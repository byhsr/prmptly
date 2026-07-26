import { useMemo } from "react"

interface HeadingEntry {
  id: string
  level: 1 | 2
  text: string
}

function extractHeadingsFromText(text: string): HeadingEntry[] {
  const headings: HeadingEntry[] = []
  const lines = text.split("\n")
  let index = 0

  for (const line of lines) {
    const m1 = line.match(/^# (.+)/)
    if (m1) {
      headings.push({ id: `h-${index}`, level: 1, text: m1[1].trim() })
      index++
      continue
    }
    const m2 = line.match(/^## (.+)/)
    if (m2) {
      headings.push({ id: `h-${index}`, level: 2, text: m2[1].trim() })
      index++
      continue
    }
  }

  return headings
}

interface OutlinePanelProps {
  text: string
}

export function OutlinePanel({ text }: OutlinePanelProps) {
  const headings = useMemo(() => extractHeadingsFromText(text), [text])

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
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted mb-2 px-1">
        Outline
      </span>
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
