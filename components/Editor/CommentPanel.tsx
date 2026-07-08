// components/editor/CommentsPanel.tsx
"use client"

import { useEffect, useState } from "react"
import {
  listComments,
  resolveComment,
  deleteComment,
  
} from "@/services/comments"
import {CommentRecord} from "@/lib/types/CommentTypes"

export function CommentsPanel({
  documentId,
  sectionId,
  activeCommentId,
  onSelect,
}: {
  documentId: string
  sectionId: string
  activeCommentId: string | null
  onSelect: (commentId: string) => void
}) {
  const [comments, setComments] = useState<CommentRecord[]>([])

  useEffect(() => {
    listComments({ documentId, sectionId }).then(setComments)
  }, [documentId, sectionId])

  const handleResolve = async (id: string) => {
    await resolveComment(id)
    setComments((c) => c.map((x) => (x.id === id ? { ...x, resolved: true } : x)))
  }

  const handleDelete = async (id: string) => {
    await deleteComment(id)
    setComments((c) => c.filter((x) => x.id !== id))
  }

  if (!comments.length) {
    return <div className="p-4 text-xs text-muted">No comments yet</div>
  }

  return (
    <div className="flex flex-col divide-y">
      {comments.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className={`flex flex-col gap-1 p-3 text-left text-sm transition-colors ${
            activeCommentId === c.id ? "bg-accent/10" : ""
          } ${c.resolved ? "opacity-50" : ""}`}
        >
          <span className="line-clamp-1 text-xs text-muted">"{c.quotedText}"</span>
          <span>{c.body}</span>
          <div className="flex gap-3 text-xs text-muted">
            {!c.resolved && (
              <span
                onClick={(e) => {
                  e.stopPropagation()
                  handleResolve(c.id)
                }}
              >
                Resolve
              </span>
            )}
            <span
              onClick={(e) => {
                e.stopPropagation()
                handleDelete(c.id)
              }}
            >
              Delete
            </span>
          </div>
        </button>
      ))}
    </div>
  )
}