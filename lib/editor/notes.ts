// Inline author notes — `%% note %%`.
//
// Markdown comments (`<!-- -->`) are not usable here: the rich-text pass escapes them to
// `&lt;!--`, and `[//]: # (…)` is dropped outright, so both silently corrupt a note on a
// pretty<->raw switch. `%%` survives a full parse/serialize round-trip byte-for-byte, block
// and inline, and is the convention Obsidian uses for the same job.
//
// Notes live in the body like any other text, so they travel with the document and stay
// editable in raw mode. Every compiled output strips them — see `lib/editor/outputs.ts`.

export interface NoteRef {
  /** note body without the `%%` delimiters */
  text: string
  /** index of the opening `%%` in the source */
  from: number
  /** index just past the closing `%%` */
  to: number
}

export const NOTE_LABEL = "note"

// Line-scoped on purpose. A `[\s\S]` pattern would let one stray `%%` swallow the rest of
// the document the moment the user mistypes one.
const NOTE_SPAN = /%%([^\n]*?)%%/g
const BLOCK_NOTE_LINE = /^[ \t]*%%.*?%%[ \t]*$/gm

export function extractNotes(markdown: string): NoteRef[] {
  const notes: NoteRef[] = []
  const re = new RegExp(NOTE_SPAN.source, "g")
  let match: RegExpExecArray | null

  while ((match = re.exec(markdown)) !== null) {
    notes.push({
      text: match[1].trim(),
      from: match.index,
      to: match.index + match[0].length,
    })
  }

  return notes
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

export function noteSnippet(label: string = NOTE_LABEL): string {
  return `%% ${label} %%`
}

/** Selection to place after inserting `noteSnippet()` at `start`, so the label is pre-selected. */
export function noteCaretRange(start: number, label: string = NOTE_LABEL): { from: number; to: number } {
  const open = "%% ".length
  return { from: start + open, to: start + open + label.length }
}

export function insertNote(
  text: string,
  from: number,
  to: number,
  label: string = NOTE_LABEL
): { text: string; caret: { from: number; to: number } } {
  return {
    text: text.slice(0, from) + noteSnippet(label) + text.slice(to),
    caret: noteCaretRange(from, label),
  }
}
