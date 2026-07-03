import { CollectionTree } from "@/services/service.collections"
import { Tab } from "../core-components/Tabbar"
import {
  Home,
  FileText,
  Layout,
  BookOpen,
  FolderPlus,
  FilePlus,
  ChevronRight,
  Folder,
  FolderOpen,
  File,
} from "lucide-react"
import { PromptFile } from "../Prompt/PromptElements";
import { CollectionItem, InlineInput } from "./SidebarElements";

export type PendingCreate =
  | { type: "prompt"; parentCollectionId: string | null }
  | { type: "collection"; parentCollectionId: string | null }

type PromptSidebarPanelProps = {
  collectionsTree: CollectionTree | null
  activeTab: Tab | undefined
  selectedId: string | null
  setSelectedId: (id: string | null) => void
  expandedCollections: Set<string>
  onToggleExpand: (id: string) => void
  onOpenTab: (tab: Tab) => void
  pendingCreate: PendingCreate | null
  onStartCreate: (type: "prompt" | "collection") => void
  onConfirmCreate: (name: string) => void
  onCancelCreate: () => void
}

export const PromptSidebarPanel = ({
  collectionsTree,
  activeTab,
  selectedId,
  setSelectedId,
  expandedCollections,
  onToggleExpand,
  onOpenTab,
  pendingCreate,
  onStartCreate,
  onConfirmCreate,
  onCancelCreate,
}: PromptSidebarPanelProps) => (
  <div className="flex flex-col h-full w-full">
    {/* Header */}
    <div
      className="flex items-center justify-between px-3 py-2 shrink-0"
      style={{ borderBottom: "0.5px solid var(--color-border, #222)" }}
    >
      <div
        onClick={() => { onCancelCreate(); setSelectedId(null) }}
        style={{
          fontSize: 10,
          fontFamily: "'Syne', sans-serif",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--color-muted, #666)",
          cursor: "pointer",
        }}
      >
        Prompts
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onStartCreate("collection")}
          className="rounded p-0.5 transition-colors hover:bg-background"
          style={{ color: "var(--color-muted, #666)" }}
          title="New Collection"
        >
          <FolderPlus size={12} />
        </button>
        <button
          onClick={() => onStartCreate("prompt")}
          className="rounded p-0.5 transition-colors hover:bg-background"
          style={{ color: "var(--color-muted, #666)" }}
          title="New Prompt"
        >
          <FilePlus size={12} />
        </button>
      </div>
    </div>

    {/* Body */}
    <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
      {!collectionsTree && (
        <span style={{ fontSize: 11, color: "var(--color-muted, #555)", padding: "4px 8px" }}>
          Loading...
        </span>
      )}

      {collectionsTree && (
        <>
          {collectionsTree.rootPrompts.map((p) => (
            <PromptFile
              key={p.id}
              prompt={p}
              depth={0}
              isActive={activeTab?.id === p.id}
              isSelected={selectedId === p.id}
              onSelect={() => setSelectedId(p.id)}
              onOpenTab={onOpenTab}
            />
          ))}

          {pendingCreate?.parentCollectionId === null && (
            <InlineInput depth={0} onConfirm={onConfirmCreate} onCancel={onCancelCreate} />
          )}

          {collectionsTree.tree.map((node) => (
            <CollectionItem
              key={node.id}
              node={node}
              depth={0}
              activeTabId={activeTab?.id ?? null}
              selectedId={selectedId}
              expandedCollections={expandedCollections}
              onToggleExpand={onToggleExpand}
              onSelect={setSelectedId}
              onOpenTab={onOpenTab}
              pendingCreate={pendingCreate}
              onInlineConfirm={onConfirmCreate}
              onInlineCancel={onCancelCreate}
            />
          ))}
        </>
      )}
    </div>
  </div>
)