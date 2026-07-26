// components/sidebar/LibrarySidebarPanel.tsx
import { useEffect } from "react"
import { SquareAsterisk } from "lucide-react"
import { snippetId, useLibraryStore } from "@/hooks/store/SidebarStore"
import { Snippet } from "@/lib/types/library"
import { cn } from "@/lib/utils"
import { libraryService } from "@/lib/db/library"
import { useState } from "react"
import { ContextMenu } from "../ui/ContextMenu"

export const LibrarySidebarPanel = () => {
  const { snippets, setSnippets, selectedSnippetId, selectSnippet } = useLibraryStore()

  useEffect(() => {
    libraryService.getAll().then(setSnippets)
  }, [])

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
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

  return <button
    onClick={onSelect}
    onContextMenu={(e) => {
      e.preventDefault()
      onSelect()
      setContextMenu({ x: e.clientX, y: e.clientY })
    }}
    className={cn(
      "w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-left transition-colors duration-100 cursor-pointer",
      isSelected
        ? "bg-background text-primary"
        : "text-secondary hover:bg-background/60"
    )}
  >
    {contextMenu && <ContextMenu
      x={contextMenu.x}
      y={contextMenu.y}
      onClose={() => setContextMenu(null)}
      items={[
        { label: "Rename", onClick: () => { } },
        { label: "Delete", onClick: () => { }, danger: true },
      ]} />}
    <SquareAsterisk
      size={11}
      className="shrink-0"
      style={{ color: isSelected ? "var(--color-accent)" : "var(--color-muted)" }}
    />
    <div className="flex flex-col min-w-0">
      <span className="text-[11px] font-mono truncate">
        {snippet.key}
      </span>
    </div>
  </button>
}
