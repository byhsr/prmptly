import { useEffect, useMemo, useRef } from "react"
import { MessageSquarePlus } from "lucide-react"
import type { JSONContent } from "@tiptap/react"
import { extractNotes, type NoteRef } from "@/lib/editor/notes"

export interface OutlineSection {
  title: string
  doc?: JSONContent | string | null
  value?: string
}

interface OutlinePanelProps {
  doc?: string | null
  sections?: OutlineSection[]
  /** Inserts a new `%% note %%`; omitted where there is no body to write to. */
  onAddNote?: () => void
}

interface OutlineEntry {
  id: string
  level: 1 | 2
  text: string
}

const FLASH_MS = 1000
const FLASH_DELAY_MS = 160
const FADE_MS = 220
const ACCENT_FALLBACK = "200, 241, 53"

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

// Locates the rendered heading (or section-title input) matching an outline entry
function findHeadingElement(text: string): HTMLElement | null {
  for (const editorEl of Array.from(document.querySelectorAll<HTMLElement>(".smart-editor-content"))) {
    for (const el of Array.from(editorEl.querySelectorAll<HTMLElement>("h1, h2, h3"))) {
      const content = el.textContent?.trim() ?? ""
      if (content && (content === text || content.includes(text))) return el
    }
  }

  for (const inp of Array.from(document.querySelectorAll<HTMLInputElement>("input"))) {
    if (inp.value === text) return inp
  }

  return null
}

// In pretty mode a note is ordinary text, so it is found by the block that contains it.
function findNoteElement(text: string): HTMLElement | null {
  for (const editorEl of Array.from(document.querySelectorAll<HTMLElement>(".smart-editor-content"))) {
    for (const el of Array.from(
      editorEl.querySelectorAll<HTMLElement>("p, li, blockquote, td, th, h1, h2, h3")
    )) {
      const content = el.textContent ?? ""
      if (content.includes("%%") && content.includes(text)) return el
    }
  }
  return null
}

// Resolves the theme accent to rgba() without relying on color-mix()
function accentTint(el: HTMLElement, alpha: number): string {
  const raw = getComputedStyle(el).getPropertyValue("--accent").trim()
  const hex = raw.match(/^#([0-9a-f]{6})$/i)
  if (hex) {
    const n = parseInt(hex[1], 16)
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
  }
  return `rgba(${ACCENT_FALLBACK}, ${alpha})`
}

function clearHighlight(el: HTMLElement) {
  el.style.removeProperty("background-color")
  el.style.removeProperty("box-shadow")
  el.style.removeProperty("border-radius")
  el.style.removeProperty("transition")
}

export function OutlinePanel({ doc, sections, onAddNote }: OutlinePanelProps) {
  const flashRef = useRef<{ el: HTMLElement | null; timers: ReturnType<typeof setTimeout>[] }>({
    el: null,
    timers: [],
  })

  const clearFlash = () => {
    flashRef.current.timers.forEach(clearTimeout)
    flashRef.current.timers = []
    if (flashRef.current.el) clearHighlight(flashRef.current.el)
    flashRef.current.el = null
  }

  useEffect(() => () => clearFlash(), [])

  const flash = (target: HTMLElement) => {
    clearFlash()
    target.scrollIntoView({ behavior: "smooth", block: "start" })

    const state = flashRef.current
    state.el = target
    state.timers.push(
      // light up once the smooth scroll has settled, so it is actually seen
      setTimeout(() => {
        target.style.transition = `background-color ${FADE_MS}ms ease-out, box-shadow ${FADE_MS}ms ease-out`
        target.style.borderRadius = "6px"
        target.style.backgroundColor = accentTint(target, 0.4)
        target.style.boxShadow = `0 0 0 4px ${accentTint(target, 0.26)}`
      }, FLASH_DELAY_MS),
      setTimeout(() => {
        target.style.backgroundColor = accentTint(target, 0)
        target.style.boxShadow = `0 0 0 4px ${accentTint(target, 0)}`
      }, FLASH_DELAY_MS + FLASH_MS),
      setTimeout(() => clearHighlight(target), FLASH_DELAY_MS + FLASH_MS + FADE_MS)
    )
  }

  const goTo = (entry: OutlineEntry) => {
    const target = findHeadingElement(entry.text)
    if (target) flash(target)
  }

  // Raw mode is a textarea, so the note can be selected outright — jump *and* ready to edit.
  // Pretty mode only has the note as text, so it scrolls and flashes instead.
  const revealNote = (note: NoteRef) => {
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea[data-raw-editor]")
    if (textarea) {
      textarea.focus()
      textarea.setSelectionRange(note.from, note.to)
      return
    }

    const target = findNoteElement(note.text)
    if (target) flash(target)
  }

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

  const notes = useMemo<NoteRef[]>(
    () => (typeof doc === "string" && doc ? extractNotes(doc) : []),
    [doc]
  )

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
              onClick={() => goTo(h)}
              title={h.text}
              className="w-full text-left px-2 py-1.5 rounded text-xs font-mono text-muted hover:text-foreground hover:bg-background transition-colors truncate"
              style={{ paddingLeft: h.level === 2 ? 20 : 8 }}
            >
              {h.text}
            </button>
          ))
        )}
      </div>

      <div className="shrink-0 border-t border-border pt-2">
        <div className="flex items-center justify-between mb-1 pl-1 pr-0.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted">Notes</span>
          {onAddNote && (
            <button
              type="button"
              onClick={onAddNote}
              aria-label="Add note"
              className="rounded p-1 text-muted transition-colors hover:bg-background hover:text-foreground"
            >
              <MessageSquarePlus className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </div>

        {notes.length === 0 ? (
          <p className="text-[11px] text-muted px-1">No notes yet — use the note button</p>
        ) : (
          <div className="max-h-40 overflow-y-auto overflow-x-hidden space-y-0.5">
            {notes.map((note, i) => (
              <button
                key={`${note.from}-${i}`}
                onClick={() => revealNote(note)}
                title={note.text}
                className="w-full text-left px-2 py-1.5 rounded text-[11px] italic text-muted hover:text-foreground hover:bg-background transition-colors truncate"
              >
                {note.text || "empty note"}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
