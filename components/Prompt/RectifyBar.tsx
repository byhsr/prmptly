import { useState, useCallback, useEffect, useRef } from "react"
import { Search, X, Replace, CaseSensitive, WholeWord } from "lucide-react"
import type { Editor } from "@tiptap/core"

interface RectifyBarProps {
  editor: Editor | null
  onClose: () => void
}

export function RectifyBar({ editor, onClose }: RectifyBarProps) {
  const [find, setFind] = useState("")
  const [replace, setReplace] = useState("")
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [matchCount, setMatchCount] = useState(0)
  const findRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    findRef.current?.focus()
  }, [])

  const countMatches = useCallback((text: string) => {
    if (!find) { setMatchCount(0); return }
    let flags = "g"
    if (!caseSensitive) flags += "i"
    try {
      const pattern = wholeWord ? `\\b${find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b` : find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const matches = text.match(new RegExp(pattern, flags))
      setMatchCount(matches ? matches.length : 0)
    } catch {
      setMatchCount(0)
    }
  }, [find, caseSensitive, wholeWord])

  // Update match count as user types
  useEffect(() => {
    if (!editor) return
    const text = editor.state.doc.textContent
    countMatches(text)
  }, [find, caseSensitive, wholeWord, editor, countMatches])

  const handleReplace = useCallback(() => {
    if (!editor || !find) return
    const { state, view } = editor
    const { schema } = state
    let flags = "g"
    if (!caseSensitive) flags += "i"

    let count = 0
    const escapedFind = find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const pattern = wholeWord ? `\\b${escapedFind}\\b` : escapedFind

    state.doc.descendants((node, pos) => {
      if (node.isText && node.text) {
        const regex = new RegExp(pattern, flags)
        let match
        while ((match = regex.exec(node.text)) !== null) {
          const from = pos + match.index
          const to = from + match[0].length
          const tr = state.tr.replaceWith(from, to, schema.text(replace))
          view.dispatch(tr)
          count++
        }
      }
    })

    setMatchCount(0)
  }, [editor, find, replace, caseSensitive, wholeWord])

  const handleReplaceAll = useCallback(() => {
    if (!editor || !find) return

    const { state, view } = editor
    let flags = "g"
    if (!caseSensitive) flags += "i"
    const escapedFind = find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const pattern = wholeWord ? `\\b${escapedFind}\\b` : escapedFind

    let tr = state.tr
    let count = 0

    state.doc.descendants((node, pos) => {
      if (node.isText && node.text) {
        const regex = new RegExp(pattern, flags)
        let match
        while ((match = regex.exec(node.text)) !== null) {
          const from = pos + match.index
          const to = from + match[0].length
          tr = tr.replaceWith(from, to, state.schema.text(replace))
          regex.lastIndex = match.index + 1
          count++
        }
      }
    })

    if (count > 0) {
      view.dispatch(tr)
    }
    setMatchCount(0)
  }, [editor, find, replace, caseSensitive, wholeWord])

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-surface border-b border-border text-xs font-mono">
      <Search className="h-3 w-3 text-muted shrink-0" />
      <input
        ref={findRef}
        value={find}
        onChange={(e) => setFind(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleReplace() }}
        placeholder="Find"
        className="w-28 bg-background border border-border rounded px-2 py-1 text-xs outline-none text-foreground placeholder:text-muted/50"
      />
      <span className="text-[10px] text-muted min-w-[2ch]">{matchCount > 0 ? matchCount : ""}</span>
      <Replace className="h-3 w-3 text-muted shrink-0" />
      <input
        value={replace}
        onChange={(e) => setReplace(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleReplaceAll() }}
        placeholder="Replace"
        className="w-28 bg-background border border-border rounded px-2 py-1 text-xs outline-none text-foreground placeholder:text-muted/50"
      />

      <div className="relative group">
        <button
          onClick={() => setCaseSensitive((v) => !v)}
          className={`rounded p-1 transition-colors ${caseSensitive ? "bg-accent/20 text-accent" : "text-muted hover:text-foreground"}`}
        >
          <CaseSensitive className="h-3 w-3" />
        </button>
        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] px-1.5 py-0.5 rounded bg-surface border border-border text-muted whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">Case sensitive</span>
      </div>
      <div className="relative group">
        <button
          onClick={() => setWholeWord((v) => !v)}
          className={`rounded p-1 transition-colors ${wholeWord ? "bg-accent/20 text-accent" : "text-muted hover:text-foreground"}`}
        >
          <WholeWord className="h-3 w-3" />
        </button>
        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] px-1.5 py-0.5 rounded bg-surface border border-border text-muted whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">Whole word</span>
      </div>

      <button
        onClick={handleReplaceAll}
        disabled={!find || matchCount === 0}
        className="rounded px-2 py-1 text-[10px] font-medium bg-foreground/10 text-foreground hover:bg-foreground/20 transition-colors disabled:opacity-30"
      >
        Replace all
      </button>

      <button
        onClick={onClose}
        className="rounded p-1 text-muted hover:text-foreground transition-colors ml-auto"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}
