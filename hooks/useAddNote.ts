import { useCallback } from "react"
import { activeEditorRef, activeRawTextareaRef } from "@/lib/editor/activeEditors"
import { noteCaretRange, noteSnippet } from "@/lib/editor/notes"

/**
 * Drops a `%% note %%` at the caret of whichever editor is live and leaves the label
 * selected so it can be typed over immediately. Falls back to appending when neither editor
 * is mounted (the navigator panel can be open on its own).
 */
export function useAddNote(body: string, setBody: (next: string) => void) {
  return useCallback(() => {
    const textarea = activeRawTextareaRef.current
    if (textarea) {
      const start = textarea.selectionStart
      const next =
        textarea.value.slice(0, start) +
        noteSnippet() +
        textarea.value.slice(textarea.selectionEnd)
      setBody(next)

      const caret = noteCaretRange(start)
      requestAnimationFrame(() => {
        textarea.focus()
        textarea.setSelectionRange(caret.from, caret.to)
      })
      return
    }

    // The ref outlives the editor: switching to raw mode unmounts Tiptap without clearing
    // it, so a destroyed instance must be ignored rather than read from.
    const editor = activeEditorRef.current
    if (editor && !editor.isDestroyed) {
      const at = editor.state.selection.to
      editor.chain().focus().insertContent(noteSnippet()).run()
      editor.chain().setTextSelection(noteCaretRange(at)).run()
      return
    }

    const separator = body && !body.endsWith("\n") ? "\n\n" : ""
    setBody(`${body}${separator}${noteSnippet()}\n`)
  }, [body, setBody])
}
