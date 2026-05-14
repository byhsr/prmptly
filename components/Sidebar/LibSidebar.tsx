// components/sidebar/LibrarySidebarPanel.tsx
import { useEffect } from "react"
import { SquareAsterisk, Plus, Sparkle } from "lucide-react"
import { snippetId, useLibraryStore } from "@/hooks/store/SidebarStore"
import { Snippet } from "@/lib/types/library"
import { cn } from "@/lib/utils"
import { getSnippets } from "@/lib/db/library"
import { useState } from "react"
import { ContextMenu } from "../ui/ContextMenu"
import { LibraryTab } from "../library/LibraryView"
import { ScopeListPanel } from "../library/ScopeListPanel"

const TabIcon: Record<LibraryTab, React.ReactNode> = {
  snippet: <div className="flex gap-2 text-muted items-center p-1 justify-center h-full"><SquareAsterisk size={12} />Snippet</div>,
  context: <div className="flex gap-2 text-muted items-center p-1 justify-center h-full"><Sparkle size={12} className="text-muted" /> Context</div>,
}

export const LibrarySidebarPanel = () => {
  const { snippets, setSnippets, selectedSnippetId, selectSnippet, setCreating } = useLibraryStore()
  const [activeTab, setActiveTab] = useState<"snippet" | "context">("snippet")
  const {scopes} = useLibraryStore()
  useEffect(() => {
    getSnippets().then(setSnippets)
  }, [])

  return (
    <div className="flex flex-col h-full w-full ">
      {/* Header */}
      {/* <div
        className="flex items-center justify-between px-3 py-2 shrink-0"
      >
        {activeTab === "snippet" && (
          <button
            onClick={() => setCreating(activeTab)}
            className="rounded p-0.5 transition-colors hover:bg-background"
            style={{ color: "var(--color-muted)" }}
            title="New Snippet"
          >
            <Plus size={12} />
          </button>
        )}
      </div> */}

      {/* Tabs */}
      <div
        className="flex shrink-0 p-2 px-4 gap-2 justify-end"
      >
        {(["snippet", "context"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn("flex-1 rounded-lg", activeTab === tab ? "border border-border " : "")}
            style={{
              fontSize: 10,
              color: activeTab === tab ? "var(--color-foreground)" : "var(--color-muted)",
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            {TabIcon[tab]}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
        {activeTab === "snippet" && (
          <>
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
          </>
        )}

        {activeTab === "context" && (
          <>
            {scopes.length === 0 && (
              <span style={{ fontSize: 11, color: "var(--color-muted)", padding: "4px 8px" }}>
                No context yet
              </span>
            )}
            <ScopeListPanel />
          </>
        )}
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
        {snippet.scope ? (
          <>
            <span style={{ color: "var(--color-muted)" }}>{snippet.scope}:</span>
            {snippet.key}
          </>
        ) : (
          snippet.key
        )}
      </span>
      {/* <span className="text-[10px] truncate" style={{ color: "var(--color-muted)" }}>
        {snippet.value.slice(0, 40)}{snippet.value.length > 40 ? "…" : ""}
      </span> */}
    </div>
  </button>
}