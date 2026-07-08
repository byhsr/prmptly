// lib/editor/createCommentFromSelection.ts
import type { Editor } from "@tiptap/core"
import { createComment } from "@/services/comments"

export async function createCommentFromSelection(
  editor: Editor,
  documentId: string,
  sectionId: string,
  body: string
) {
  const { from, to } = editor.state.selection
  if (from === to) return null // require a selection

  const quotedText = editor.state.doc.textBetween(from, to, " ")

  const comment = await createComment({
    documentId,
    sectionId,
    anchorFrom: from,
    anchorTo: to,
    quotedText,
    body,
  })

  editor.chain().setMeta("addToHistory", false).setComment(comment.id).run()
  return comment
}