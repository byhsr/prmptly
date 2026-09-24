// Inline author comments — `%% note %%`, optionally colored `%%{amber} note %%`.
//
// Markdown comments (`<!-- -->`) are not usable here: the rich-text pass escapes them to
// `&lt;!--`, and `[//]: # (…)` is dropped outright, so both silently corrupt a note on a
// pretty<->raw switch. `%%` survives a full parse/serialize round-trip byte-for-byte, block
// and inline, and is the convention Obsidian uses for the same job.
//
// The color rides inside the token (`%%{key} … %%`) rather than in a sidecar, so markdown
// stays the single source of truth and the color travels with the document. An unknown or
// absent key means the neutral default.
//
// Notes live in the body like any other text, so they travel with the document and stay
// editable in raw mode. Every compiled output strips them — see `lib/editor/outputs.ts`.

export const NOTE_COLORS = [
  { key: "amber", label: "Amber", swatch: "#e0b25f" },
  { key: "rose", label: "Rose", swatch: "#e07a8a" },
  { key: "green", label: "Green", swatch: "#7ec98a" },
  { key: "blue", label: "Blue", swatch: "#6faee0" },
  { key: "violet", label: "Violet", swatch: "#b18ae0" },
] as const

export type NoteColorKey = (typeof NOTE_COLORS)[number]["key"]

const COLOR_KEYS = new Set<string>(NOTE_COLORS.map((c) => c.key))

export function isNoteColor(value: string | null | undefined): value is NoteColorKey {
  return !!value && COLOR_KEYS.has(value)
}

export interface NoteRef {
  /** note body without the `%%` delimiters or the color key */
  text: string
  /** palette key, or null for the neutral default */
  color: NoteColorKey | null
  /** index of the opening `%%` in the source */
  from: number
  /** index just past the closing `%%` */
  to: number
}

/** A note located by `findNoteAt`, in absolute source offsets. */
export interface NoteHit extends NoteRef {}

export const NOTE_LABEL = "note"

// Line-scoped on purpose. A `[\s\S]` pattern would let one stray `%%` swallow the rest of
// the document the moment the user mistypes one. Group 1 is the optional color key, group 2
// the inner text (deliberately untrimmed so offsets stay exact).
const NOTE_SPAN = /%%(?:\{(\w+)\})?([^\n]*?)%%/g
const BLOCK_NOTE_LINE = /^[ \t]*%%.*?%%[ \t]*$/gm

/** Shared token source so the editor decoration stays in step with the parser. */
export const NOTE_SPAN_SOURCE = NOTE_SPAN.source

/** Length of the opening marker for a match's color key, including the `%%`. */
export function noteOpenLength(color: string | undefined): number {
  return 2 + (color ? color.length + 2 : 0)
}

function colorOf(raw: string | undefined): NoteColorKey | null {
  return isNoteColor(raw) ? raw : null
}

/** The opening marker for a note, with or without a color key. */
function noteOpen(color?: NoteColorKey | null): string {
  return isNoteColor(color) ? `%%{${color}}` : "%%"
}

export function extractNotes(markdown: string): NoteRef[] {
  const notes: NoteRef[] = []
  const re = new RegExp(NOTE_SPAN.source, "g")
  let match: RegExpExecArray | null

  while ((match = re.exec(markdown)) !== null) {
    notes.push({
      text: match[2].trim(),
      color: colorOf(match[1]),
      from: match.index,
      to: match.index + match[0].length,
    })
  }

  return notes
}

/**
 * Locates the note whose span contains `offset`, scanning only the line that holds it
 * (notes never span lines). Offsets are absolute. Used to recolor/remove from a caret.
 */
export function findNoteAt(source: string, offset: number): NoteHit | null {
  const clamped = Math.max(0, Math.min(offset, source.length))
  const lineStart = source.lastIndexOf("\n", Math.max(0, clamped - 1)) + 1
  const nextBreak = source.indexOf("\n", clamped)
  const lineEnd = nextBreak === -1 ? source.length : nextBreak
  const local = clamped - lineStart

  const re = new RegExp(NOTE_SPAN.source, "g")
  let match: RegExpExecArray | null
  while ((match = re.exec(source.slice(lineStart, lineEnd))) !== null) {
    const from = match.index
    const to = match.index + match[0].length
    if (local >= from && local < to) {
      return {
        text: match[2].trim(),
        color: colorOf(match[1]),
        from: lineStart + from,
        to: lineStart + to,
      }
    }
  }

  return null
}

/**
 * Removes notes and the blank lines they leave behind. Deliberately conservative: no
 * `.trim()` of the surrounding content, so nothing but the note itself moves.
 */
export function stripNotes(markdown: string): string {
  const stripped = markdown
    .replace(BLOCK_NOTE_LINE, "")
    .replace(NOTE_SPAN, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")

  // A body that held nothing but notes leaves only line breaks behind.
  return stripped.trim() ? stripped : ""
}

export function noteSnippet(label: string = NOTE_LABEL, color?: NoteColorKey | null): string {
  return `${noteOpen(color)} ${label} %%`
}

/** Wraps existing text (e.g. a selection) in a note token. */
export function noteWrap(text: string, color?: NoteColorKey | null): string {
  return `${noteOpen(color)} ${text} %%`
}

/** Selection to place after inserting a note at `start`, so the label is pre-selected. */
export function noteCaretRange(
  start: number,
  label: string = NOTE_LABEL,
  color?: NoteColorKey | null
): { from: number; to: number } {
  const open = noteOpen(color).length + 1 // + the separating space
  return { from: start + open, to: start + open + label.length }
}

export function insertNote(
  text: string,
  from: number,
  to: number,
  label: string = NOTE_LABEL,
  color?: NoteColorKey | null
): { text: string; caret: { from: number; to: number } } {
  return {
    text: text.slice(0, from) + noteSnippet(label, color) + text.slice(to),
    caret: noteCaretRange(from, label, color),
  }
}
