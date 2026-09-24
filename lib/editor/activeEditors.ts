import type { Editor } from "@tiptap/core"

// Pointers to whichever editing surface is currently mounted, so actions that live outside
// the editor (find & replace, note insertion) can reach the live one without threading refs
// through every pane. Exactly one of these is non-null at a time — pretty and raw mode never
// render together.
export const activeEditorRef = { current: null as Editor | null }

export const activeRawTextareaRef = { current: null as HTMLTextAreaElement | null }
