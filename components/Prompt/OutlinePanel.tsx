import { useMemo } from "react"

interface OutlinePanelProps {
  doc?: string | null
  sectionTitles?: string[]
}

export function OutlinePanel({ doc, sectionTitles }: OutlinePanelProps) {
  const headings = useMemo(() => {
    const entries: { id: string; level: 1 | 2; text: string }[] = []
    let index = 0

    if (sectionTitles && sectionTitles.length > 0) {
      for (const title of sectionTitles) {
        if (title) {
          entries.push({ id: `s-${index}`, level: 2, text: title })
          index++
        }
      }
      return entries
    }

    if (!doc || typeof doc !== "string") return []

    for (const line of doc.split("\n")) {
      const m1 = line.match(/^# (.+)/)
      if (m1) { entries.push({ id: `h-${index}`, level: 1, text: m1[1].trim() }); index++; continue }
      const m2 = line.match(/^## (.+)/)
      if (m2) { entries.push({ id: `h-${index}`, level: 2, text: m2[1].trim() }); index++; continue }
    }

    return entries
  }, [doc, sectionTitles])

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
