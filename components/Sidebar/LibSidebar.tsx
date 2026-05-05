// components/sidebar/LibrarySidebarPanel.tsx
import { useEffect } from "react"
import { SquareAsterisk, Plus } from "lucide-react"
import { useLibraryStore } from "@/hooks/store/SidebarStore"
import { Snippet } from "@/lib/types/library"
import { cn } from "@/lib/utils"

export const LibrarySidebarPanel = () => {
  const { snippets, setSnippets, selectedSnippetId, selectSnippet, isCreating, setCreating } = useLibraryStore()

  useEffect(() => {
    // TODO: fetch from DB via tauri invoke
    // invoke("get_snippets").then(setSnippets)
  }, [])

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 shrink-0"
        style={{ borderBottom: "0.5px solid var(--color-border)" }}
      >
        <span
          style={{
            fontSize: 10,
            fontFamily: "'Syne', sans-serif",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--color-muted)",
          }}
        >
          Library
        </span>

        <button
          onClick={() => setCreating(true)}
          className="rounded p-0.5 transition-colors hover:bg-background"
          style={{ color: "var(--color-muted)" }}
          title="New Snippet"
        >
          <Plus size={12} />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
        {snippets.length === 0 && (
          <span style={{ fontSize: 11, color: "var(--color-muted)", padding: "4px 8px" }}>
            No snippets yet
          </span>
        )}

        {snippets.map((snippet) => (
          <SnippetRow
            key={snippet.id}
            snippet={snippet}
            isSelected={selectedSnippetId === snippet.id}
            onSelect={() => selectSnippet(snippet.id)}
          />
        ))}
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
}) => (
  <button
    onClick={onSelect}
    className={cn(
      "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors duration-100 cursor-pointer",
      isSelected
        ? "bg-background text-primary"
        : "text-secondary hover:bg-background/60"
    )}
  >
    <SquareAsterisk
      size={11}
      className="shrink-0"
      style={{ color: isSelected ? "var(--color-accent)" : "var(--color-muted)" }}
    />
    <div className="flex flex-col min-w-0">
      <span className="text-[11px] font-mono truncate">
        {snippet.scope ? (
          <>
            <span style={{ color: "var(--color-muted)" }}>{snippet.scope}:</span>
            {snippet.key}
          </>
        ) : (
          snippet.key
        )}
      </span>
      <span className="text-[10px] truncate" style={{ color: "var(--color-muted)" }}>
        {snippet.value.slice(0, 40)}{snippet.value.length > 40 ? "…" : ""}
      </span>
    </div>
  </button>
)