import { useEffect, useRef, useState } from "react"
import { SquareAsterisk, Check, X } from "lucide-react"
import { libraryService } from "@/lib/db/library"
import { snippetId, useLibraryStore } from "@/hooks/store/SidebarStore"
import { Snippet } from "@/lib/types/library"
import { cn } from "@/lib/utils"
import { ContextMenu } from "../ui/ContextMenu"

export const SnippetList = () => {
  const { snippets, setSnippets, selectedSnippetId, selectSnippet } = useLibraryStore()

  useEffect(() => {
    libraryService.getAll().then(setSnippets)
  }, [])

  return (
    <div className="flex flex-col gap-0.5 p-2">
      {snippets.length === 0 && (
        <span style={{ fontSize: 11, color: "var(--color-muted)", padding: "4px 8px" }}>
          No snippets yet
        </span>
      )}
      {snippets.map((snippet) => {
        const id = snippetId(snippet)
        return (
          <SnippetRow
            key={id}
            snippet={snippet}
            isSelected={selectedSnippetId === id}
            onSelect={() => selectSnippet(id)}
          />
        )
      })}
    </div>
  )
}

const SnippetRow = ({
  snippet,
  isSelected,
  onSelect,
}: {
  snippet: Snippet
  isSelected: boolean
  onSelect: () => void
}) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(snippet.key)
  const [editValue, setEditValue] = useState(snippet.value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commitRename = async () => {
    const name = editName.trim()
    if (!name || name === snippet.key) { setEditing(false); return }
    await libraryService.update(snippet.scope, snippet.key, snippet.scope, name, editValue)
    useLibraryStore.getState().updateSnippet(snippetId(snippet), { key: name })
    setEditing(false)
    setContextMenu(null)
    libraryService.getAll().then((s) => useLibraryStore.getState().setSnippets(s))
  }

  const handleDelete = async () => {
    if (!window.confirm(`Delete snippet "${snippet.key}"?`)) return
    await libraryService.delete(snippet.scope ?? "__global__", snippet.key)
    useLibraryStore.getState().removeSnippet(snippetId(snippet))
    setContextMenu(null)
  }

  return (
    <button
      onClick={onSelect}
      onContextMenu={(e) => {
        e.preventDefault()
        onSelect()
        setContextMenu({ x: e.clientX, y: e.clientY })
      }}
      className={cn(
        "w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-left transition-colors duration-100 cursor-pointer",
        isSelected ? "bg-background text-primary" : "text-secondary hover:bg-background/60"
      )}
    >
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            { label: "Rename", onClick: () => { setEditName(snippet.key); setEditValue(snippet.value); setEditing(true); setContextMenu(null) } },
            { label: "Delete", onClick: handleDelete, danger: true },
          ]}
        />
      )}
      <SquareAsterisk
        size={11}
        className="shrink-0"
        style={{ color: isSelected ? "var(--color-accent)" : "var(--color-muted)" }}
      />
      <div className="flex flex-col min-w-0 flex-1">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setEditing(false) }}
              onBlur={() => setEditing(false)}
              className="flex-1 bg-background border border-border rounded px-1 py-0.5 text-[11px] font-mono outline-none"
            />
            <button onClick={commitRename} className="text-accent shrink-0"><Check size={10} /></button>
            <button onClick={() => setEditing(false)} className="text-muted shrink-0"><X size={10} /></button>
          </div>
        ) : (
          <span className="text-[11px] font-mono truncate">{snippet.key}</span>
        )}
      </div>
    </button>
  )
}
