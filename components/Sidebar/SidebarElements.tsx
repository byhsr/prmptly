import { useState } from "react"
import { Check, ChevronRight, Folder, FolderOpen, X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Tab } from "../core-components/Tabbar"
import { PendingCreate } from "./PromptSidebar"
import {
  CollectionNode,
  deleteCollectionDeep,
  renameCollection,
} from "@/services/service.collections"
import { PromptFile } from "../Prompt/PromptElements"
import { ContextMenu } from "../ui/ContextMenu"
import { InlineInput } from "../ui/InlineInput"
import { useTabViewStore } from "@/hooks/store/TabStore"

interface CollectionItemProps {
  node: CollectionNode
  depth?: number
  activeTabId: string | null
  selectedId: string | null
  expandedCollections: Set<string>
  onToggleExpand: (id: string) => void
  onSelect: (id: string) => void
  onOpenTab: (tab: Tab) => void
  // inline creation state passed down
  pendingCreate: PendingCreate | null
  onInlineConfirm: (name: string) => void
  onInlineCancel: () => void
  onRefreshTree?: () => Promise<void>
  // Drag a document in or out of a folder. null = move to the top level.
  onMoveDocument: (docId: string, collectionId: string | null) => void
  dropTarget: string | null
  setDropTarget: (id: string | null) => void
  // Start an inline create inside this folder from its context menu
  onStartCreateIn: (parentId: string, type: "prompt" | "collection") => void
}


export function CollectionItem({
  node,
  depth = 0,
  activeTabId,
  selectedId,
  expandedCollections,
  onToggleExpand,
  onSelect,
  onOpenTab,
  pendingCreate,
  onInlineConfirm,
  onInlineCancel,
  onRefreshTree,
  onMoveDocument,
  dropTarget,
  setDropTarget,
  onStartCreateIn,
}: CollectionItemProps) {
  const isExpanded = expandedCollections.has(node.id)
  const isSelected = selectedId === node.id
  const isDropTarget = dropTarget === node.id

  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(node.name)

  const commitRename = async () => {
    const name = editName.trim()
    setEditing(false)
    if (!name || name === node.name) return
    await renameCollection(node.id, name)
    await onRefreshTree?.()
  }

  // Matches the quicks sidebar: a folder takes everything nested under it with it.
  const handleDelete = async () => {
    setMenu(null)
    if (!window.confirm(`Delete folder "${node.name}" and everything in it?\n\nSubfolders and the prompts inside are deleted. This cannot be undone.`)) return

    const deleted = await deleteCollectionDeep(node.id, "prompt")
    for (const docId of deleted) {
      useTabViewStore.getState().closeTab(docId)
      try {
        const { getDocumentDir } = await import("@/lib/fs/fsHelpers")
        const { deleteFolder } = await import("@/lib/fs/fs")
        await deleteFolder(await getDocumentDir(docId))
      } catch {}
    }
    await onRefreshTree?.()
  }

  return (
    <div>
      {/* Collection row */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          // keep the event off the root drop zone so it doesn't claim the highlight
          e.stopPropagation()
          e.dataTransfer.dropEffect = "move"
          if (dropTarget !== node.id) setDropTarget(node.id)
        }}
        onDragLeave={() => setDropTarget(dropTarget === node.id ? null : dropTarget)}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDropTarget(null)
          const docId = e.dataTransfer.getData("text/plain")
          if (docId) onMoveDocument(docId, node.id)
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setMenu({ x: e.clientX, y: e.clientY })
        }}
        onClick={() => {
          onSelect(node.id)
          onToggleExpand(node.id)
        }}
        className="flex items-center gap-1.5 rounded cursor-pointer select-none"
        style={{
          paddingLeft: 8 + depth * 12,
          paddingTop: 3,
          paddingBottom: 3,
          paddingRight: 6,
          fontSize: 12,
          color: isSelected || isDropTarget ? "var(--color-text, #eee)" : "var(--color-muted, #777)",
          background: isSelected || isDropTarget ? "var(--color-selection, #1e1e1e)" : "transparent",
          borderRadius: 4,
          transition: "background 0.1s",
        }}
      >
        <ChevronRight
          size={10}
          style={{
            flexShrink: 0,
            transition: "transform 0.15s",
            transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
            opacity: 0.5,
          }}
        />
        {isExpanded ? (
          <FolderOpen size={11} style={{ flexShrink: 0, opacity: 0.7 }} />
        ) : (
          <Folder size={11} style={{ flexShrink: 0, opacity: 0.7 }} />
        )}
        {editing ? (
          <div className="flex items-center gap-1 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename()
                if (e.key === "Escape") setEditing(false)
              }}
              onBlur={() => setEditing(false)}
              className="flex-1 min-w-0 bg-background border border-border rounded px-1 py-0.5 text-[11px] font-mono outline-none"
            />
            <button onClick={commitRename} className="text-accent shrink-0"><Check size={10} /></button>
            <button onClick={() => setEditing(false)} className="text-muted shrink-0"><X size={10} /></button>
          </div>
        ) : (
          <span className="flex-1 min-w-0 truncate" style={{ fontWeight: 500 }}>
            {node.name}
          </span>
        )}
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { label: "New folder inside", onClick: () => onStartCreateIn(node.id, "collection") },
            { label: "New prompt inside", onClick: () => onStartCreateIn(node.id, "prompt") },
            { label: "Rename", onClick: () => { setEditName(node.name); setEditing(true); setMenu(null) } },
            { label: "Delete", onClick: handleDelete, danger: true },
          ]}
        />
      )}

      {/* Children (only when expanded) */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            {/* Nested collections */}
            {node.children.map((child) => (
              <CollectionItem
                key={child.id}
                node={child}
                depth={depth + 1}
                activeTabId={activeTabId}
                selectedId={selectedId}
                expandedCollections={expandedCollections}
                onToggleExpand={onToggleExpand}
                onSelect={onSelect}
                onOpenTab={onOpenTab}
                pendingCreate={pendingCreate}
                onInlineConfirm={onInlineConfirm}
                onInlineCancel={onInlineCancel}
                onRefreshTree={onRefreshTree}
                onMoveDocument={onMoveDocument}
                dropTarget={dropTarget}
                setDropTarget={setDropTarget}
                onStartCreateIn={onStartCreateIn}
              />
            ))}

            {/* Documents in this collection */}
            {node.documents.map((p) => (
              <PromptFile
                key={p.id}
                prompt={p}
                depth={depth + 1}
                isActive={activeTabId === p.id}
                isSelected={selectedId === p.id}
                onSelect={() => onSelect(p.id)}
                onOpenTab={onOpenTab}
                onRefresh={onRefreshTree}
              />
            ))}

            {/* Inline input inside this collection */}
            {pendingCreate && pendingCreate.parentCollectionId === node.id && (
              <InlineInput
                depth={depth + 1}
                onConfirm={onInlineConfirm}
                onCancel={onInlineCancel}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}