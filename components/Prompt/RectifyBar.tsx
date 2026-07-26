import { useState, useCallback, useEffect, useRef, MutableRefObject } from "react"
import { Search, X, Replace, CaseSensitive, WholeWord } from "lucide-react"
import type { Editor } from "@tiptap/core"

interface RectifyBarProps {
  editorRef: MutableRefObject<Editor | null>
  onClose: () => void
  floating?: boolean
  clickOff?: boolean
}

export function RectifyBar({ editorRef: externalRef, onClose, floating = false, clickOff = false }: RectifyBarProps) {
  const [find, setFind] = useState("")
  const [replace, setReplace] = useState("")
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [matchCount, setMatchCount] = useState(0)
  const findRef = useRef<HTMLInputElement>(null)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    findRef.current?.focus()
  }, [])

  // click-off dismiss (skip first frame to avoid closing on open)
  useEffect(() => {
    if (!clickOff) return
    let skip = true
    const handler = (e: MouseEvent) => {
      if (skip) { skip = false; return }
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [onClose, clickOff])

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

  useEffect(() => {
    if (!externalRef.current) return
    const text = externalRef.current.state.doc.textContent
    countMatches(text)
  }, [find, caseSensitive, wholeWord, countMatches])

  const doReplaceAll = useCallback(() => {
    const e = externalRef.current
    if (!e || !find) return

    const { state, view } = e
    let flags = "g"
    if (!caseSensitive) flags += "i"
    const escapedFind = find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const pattern = wholeWord ? `\\b${escapedFind}\\b` : escapedFind

    let tr = state.tr
    let count = 0
    let searches: { from: number; to: number }[] = []

    state.doc.descendants((node, pos) => {
      if (node.isText && node.text) {
        const regex = new RegExp(pattern, flags)
        let match
        while ((match = regex.exec(node.text)) !== null) {
          searches.push({ from: pos + match.index, to: pos + match.index + match[0].length })
          regex.lastIndex = match.index + 1
          count++
        }
      }
    })

    // Apply in reverse order so positions stay valid
    searches.reverse().forEach(({ from, to }) => {
      tr = tr.replaceWith(from, to, state.schema.text(replace))
    })

    if (count > 0) {
      view.dispatch(tr)
    }
    setMatchCount(0)
  }, [find, replace, caseSensitive, wholeWord])

  return (
    <div ref={barRef} className={`flex items-center gap-2 px-3 py-1.5 bg-surface ${floating ? "absolute top-0 left-0 right-0 z-50 border-b border-border shadow-lg" : "border-b border-border"} text-xs font-mono`}>
      <Search className="h-3 w-3 text-muted shrink-0" />
      <input
        ref={findRef}
        value={find}
        onChange={(e) => setFind(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") doReplaceAll() }}
        placeholder="Find"
        className="w-24 bg-background border border-border rounded px-2 py-1 text-xs outline-none text-foreground placeholder:text-muted/50"
      />
      <span className="text-[10px] text-muted min-w-[2ch]">{matchCount > 0 ? matchCount : ""}</span>
      <Replace className="h-3 w-3 text-muted shrink-0" />
      <input
        value={replace}
        onChange={(e) => setReplace(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") doReplaceAll() }}
        placeholder="Replace"
        className="w-24 bg-background border border-border rounded px-2 py-1 text-xs outline-none text-foreground placeholder:text-muted/50"
      />

      <div className="relative group">
        <button onClick={() => setCaseSensitive((v) => !v)} className={`rounded p-1 transition-colors ${caseSensitive ? "bg-accent/20 text-accent" : "text-muted hover:text-foreground"}`}>
          <CaseSensitive className="h-3 w-3" />
        </button>
        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] px-1.5 py-0.5 rounded bg-surface border border-border text-muted whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[60]">Case sensitive</span>
      </div>
      <div className="relative group">
        <button onClick={() => setWholeWord((v) => !v)} className={`rounded p-1 transition-colors ${wholeWord ? "bg-accent/20 text-accent" : "text-muted hover:text-foreground"}`}>
          <WholeWord className="h-3 w-3" />
        </button>
        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] px-1.5 py-0.5 rounded bg-surface border border-border text-muted whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[60]">Whole word</span>
      </div>

      <button onClick={doReplaceAll} disabled={!find || matchCount === 0} className="rounded px-2 py-1 text-[10px] font-medium bg-foreground/10 text-foreground hover:bg-foreground/20 transition-colors disabled:opacity-30">
        Replace all
      </button>

      <button onClick={onClose} className="rounded p-1 text-muted hover:text-foreground transition-colors">
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}
