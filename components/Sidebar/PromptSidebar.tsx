import { useState } from "react"
import { CollectionTree } from "@/services/service.collections"
import { updateDocument } from "@/lib/db/document"
import { Tab } from "../core-components/Tabbar"
import {
  File,
  FilePlus,
  Folder,
  FolderPlus,
} from "lucide-react"
import { PromptFile } from "../Prompt/PromptElements";
import { CollectionItem } from "./SidebarElements";
import { InlineInput } from "../ui/InlineInput";

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
  onStartCreateIn: (parentId: string, type: "prompt" | "collection") => void
  onConfirmCreate: (name: string) => void
  onCancelCreate: () => void
  onRefreshTree?: () => Promise<void>
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
  onStartCreateIn,
  onConfirmCreate,
  onCancelCreate,
  onRefreshTree,
}: PromptSidebarPanelProps) => {
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  // Dropping a document onto a folder files it there; anywhere else returns it to the top.
  const moveDocument = async (docId: string, collectionId: string | null) => {
    await updateDocument(docId, { collectionId })
    await onRefreshTree?.()
  }

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex items-center justify-end px-3 py-1.5 gap-1 shrink-0">
        <div className="relative group">
          <button
            onClick={() => onStartCreate("collection")}
            className="rounded p-0.5 transition-colors hover:bg-background"
            style={{ color: "var(--color-muted, #666)" }}
          >
            <FolderPlus size={12} />
          </button>
          <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] px-1.5 py-0.5 rounded bg-surface border border-border text-muted whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[999]">New Collection</span>
        </div>
        <div className="relative group">
          <button
            onClick={() => onStartCreate("prompt")}
            className="rounded p-0.5 transition-colors hover:bg-background"
            style={{ color: "var(--color-muted, #666)" }}
          >
            <FilePlus size={12} />
          </button>
          <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] px-1.5 py-0.5 rounded bg-surface border border-border text-muted whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[999]">New Prompt</span>
        </div>
      </div>
      {/* Body — also the drop zone for dragging a document out of a folder */}
      <div
        className={`flex-1 overflow-y-auto overflow-x-hidden p-2 flex flex-col gap-0.5 ${dropTarget === "root" ? "bg-foreground/5" : ""}`}
        onDragOver={(e) => {
          e.preventDefault()
          if (dropTarget !== "root") setDropTarget("root")
        }}
        onDragLeave={() => setDropTarget(dropTarget === "root" ? null : dropTarget)}
        onDrop={(e) => {
          e.preventDefault()
          setDropTarget(null)
          const docId = e.dataTransfer.getData("text/plain")
          if (docId) moveDocument(docId, null)
        }}
      >
        {!collectionsTree && (
          <span style={{ fontSize: 11, color: "var(--color-muted, #555)", padding: "4px 8px" }}>
            Loading...
          </span>
        )}

        {collectionsTree && (
          <>
            {collectionsTree.rootDocuments.map((p) => (
              <PromptFile
                key={p.id}
                prompt={p}
                depth={0}
                isActive={activeTab?.id === p.id}
                isSelected={selectedId === p.id}
                onSelect={() => setSelectedId(p.id)}
                onOpenTab={onOpenTab}
                onRefresh={onRefreshTree}
              />
            ))}

            {pendingCreate?.parentCollectionId === null && (
              <InlineInput
                depth={0}
                placeholder={pendingCreate.type === "collection" ? "folder name" : "prompt name"}
                icon={pendingCreate.type === "collection"
                  ? <Folder size={11} className="shrink-0 opacity-40" />
                  : <File size={11} className="shrink-0 opacity-40" />}
                onConfirm={onConfirmCreate}
                onCancel={onCancelCreate}
              />
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
                onRefreshTree={onRefreshTree}
                onMoveDocument={moveDocument}
                dropTarget={dropTarget}
                setDropTarget={setDropTarget}
                onStartCreateIn={onStartCreateIn}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
