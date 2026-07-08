// components/editor/CommentGutter.tsx
"use client"

import { useEffect, useState } from "react"
import type { Editor } from "@tiptap/core"

interface GutterMarker {
  commentId: string
  top: number
}

export function CommentGutter({
  editor,
  containerRef,
  activeCommentId,
  onSelect,
}: {
  editor: Editor
  containerRef: React.RefObject<HTMLDivElement>
  activeCommentId: string | null
  onSelect: (commentId: string) => void
}) {
  const [markers, setMarkers] = useState<GutterMarker[]>([])

  useEffect(() => {
    if (!editor) return

    const computeMarkers = () => {
      const seen = new Set<string>()
      const next: GutterMarker[] = []
      const containerTop = containerRef.current?.getBoundingClientRect().top ?? 0

      editor.state.doc.descendants((node, pos) => {
        const mark = node.marks.find((m) => m.type.name === "comment")
        if (mark && !seen.has(mark.attrs.commentId)) {
          seen.add(mark.attrs.commentId)
          const coords = editor.view.coordsAtPos(pos)
          next.push({ commentId: mark.attrs.commentId, top: coords.top - containerTop })
        }
      })

      setMarkers(next)
    }

    computeMarkers()
    editor.on("update", computeMarkers)
    editor.on("selectionUpdate", computeMarkers)
    window.addEventListener("resize", computeMarkers)

    return () => {
      editor.off("update", computeMarkers)
      editor.off("selectionUpdate", computeMarkers)
      window.removeEventListener("resize", computeMarkers)
    }
  }, [editor, containerRef])

  return (
    <div className="pointer-events-none absolute left-0 top-0 h-full w-6">
      {markers.map((m) => (
        <button
          key={m.commentId}
          onClick={() => onSelect(m.commentId)}
          style={{ top: m.top }}
          className={`pointer-events-auto absolute left-1 h-2 w-2 rounded-full transition-transform ${
            activeCommentId === m.commentId
              ? "scale-150 bg-accent"
              : "bg-muted-foreground/50 hover:bg-muted-foreground"
          }`}
        />
      ))}
    </div>
  )
}