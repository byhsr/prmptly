import { useEffect, useState } from "react"
import { File, FilePlus, FolderPlus, Check, X, ChevronRight, Folder, FolderOpen } from "lucide-react"
import { listDocuments, getDocument, updateDocument, deleteDocument } from "@/lib/db/document"
import type { Document } from "@/lib/types/Document"
import { ContextMenu } from "../ui/ContextMenu"
import { useTabViewStore } from "@/hooks/store/TabStore"
import { documentNameOverrides } from "@/lib/state"
import { useQuicksStore } from "@/hooks/store/quickStore"
import {
  createCollection,
  deleteCollection,
  getCollectionsTree,
  renameCollection,
  type CollectionNode,
} from "@/services/service.collections"

function excerpt(doc: Document): string {
  if (doc.name && doc.name !== "Untitled Quick") return doc.name
  const first = doc.sections?.[0]
  if (first) {
    const text = typeof first.value === "string" ? first.value : ""
    return text.slice(0, 60).replace(/\n.*/, "") || "Untitled"
  }
  return "Untitled"
}

type MenuTarget = { x: number; y: number; kind: "quick" | "folder"; id: string; name: string }

export function QuicksSidebarPanel() {
  const [docs, setDocs] = useState<Document[]>([])
  const [folders, setFolders] = useState<CollectionNode[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [menu, setMenu] = useState<MenuTarget | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  // undefined = not creating, null = creating at the root
  const [creatingIn, setCreatingIn] = useState<string | null | undefined>(undefined)
  const [newFolderName, setNewFolderName] = useState("")
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  const refresh = async () => {
    const [documents, collected] = await Promise.all([
      listDocuments({ type: "quick" }),
      getCollectionsTree("quick"),
    ])
    setDocs(documents)
    setFolders(collected.tree)
  }

  useEffect(() => {
    refresh()
    const handler = () => refresh()
    window.addEventListener("quick-saved", handler)
    return () => window.removeEventListener("quick-saved", handler)
  }, [])

  const byFolder = new Map<string | null, Document[]>()
  for (const d of docs) {
    const key = d.collectionId ?? null
    if (!byFolder.has(key)) byFolder.set(key, [])
    byFolder.get(key)!.push(d)
  }

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const move = async (docId: string, folderId: string | null) => {
    await updateDocument(docId, { collectionId: folderId })
    await refresh()
  }

  const openQuick = async (id: string) => {
    const full = await getDocument(id)
    if (!full) return
    useQuicksStore.getState().loadEntry({
      id: full.id,
      name: full.name,
      body: full.sections?.[0]?.value ?? "",
      output: null,
      createdAt: Date.now(),
    })
    useTabViewStore.getState().setActiveView("home")
  }

  const commitQuickRename = async (id: string) => {
    const name = renameValue.trim()
    setRenamingId(null)
    if (!name) return
    documentNameOverrides.set(id, name)
    await updateDocument(id, { name })
    const ts = useTabViewStore.getState()
    useTabViewStore.setState({ tabs: ts.tabs.map((t) => (t.id === id ? { ...t, label: name } : t)) })
    await refresh()
  }

  const commitFolderRename = async (id: string) => {
    const name = renameValue.trim()
    setRenamingId(null)
    if (!name) return
    await renameCollection(id, name)
    await refresh()
  }

  const handleDeleteQuick = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"?`)) return
    setMenu(null)
    useTabViewStore.getState().closeTab(id)
    await deleteDocument(id)
    await refresh()
  }

  const handleDeleteFolder = async (id: string, name: string) => {
    if (!window.confirm(`Delete folder "${name}"? Quicks inside move back to the top level.`)) return
    setMenu(null)
    await deleteCollection(id)
    await refresh()
  }

  const confirmCreateFolder = async (parentId: string | null) => {
    const name = newFolderName.trim()
    setCreatingIn(undefined)
    setNewFolderName("")
    if (!name) return
    const { id } = await createCollection(name, parentId, "quick")
    setExpanded((prev) => {
      const next = new Set(prev)
      if (parentId) next.add(parentId)
      next.add(id)
      return next
    })
    await refresh()
  }

  const newFolderInput = (depth: number) => (
    <div className="flex items-center gap-1 px-2 py-1" style={{ paddingLeft: 8 + depth * 12 }}>
      <Folder size={11} className="shrink-0 opacity-40" />
      <input
        autoFocus
        value={newFolderName}
        onChange={(e) => setNewFolderName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") confirmCreateFolder(creatingIn ?? null)
          if (e.key === "Escape") { setCreatingIn(undefined); setNewFolderName("") }
        }}
        onBlur={() => { setCreatingIn(undefined); setNewFolderName("") }}
        placeholder="Folder name"
        className="flex-1 bg-background border border-border rounded px-1 py-0.5 text-xs outline-none"
      />
    </div>
  )

  const renderQuick = (doc: Document, depth: number) => {
    const displayName = documentNameOverrides.get(doc.id) ?? excerpt(doc)
    const isRenaming = renamingId === doc.id

    return (
      <div
        key={doc.id}
        draggable={!isRenaming}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", doc.id)
          e.dataTransfer.effectAllowed = "move"
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          setMenu({ x: e.clientX, y: e.clientY, kind: "quick", id: doc.id, name: doc.name })
        }}
        onClick={() => { if (!isRenaming) openQuick(doc.id) }}
        className="flex items-center gap-1.5 rounded cursor-pointer select-none px-2 py-1 text-xs text-muted hover:text-foreground hover:bg-background transition-colors"
        style={{ fontSize: 12, paddingLeft: 8 + depth * 12 }}
      >
        <File size={11} style={{ flexShrink: 0, opacity: 0.6 }} />
        {isRenaming ? (
          <div className="flex items-center gap-1 flex-1">
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitQuickRename(doc.id)
                if (e.key === "Escape") setRenamingId(null)
              }}
              onBlur={() => setRenamingId(null)}
              className="flex-1 bg-background border border-border rounded px-1 py-0.5 text-xs outline-none"
            />
            <button onClick={() => commitQuickRename(doc.id)} className="text-accent shrink-0"><Check size={10} /></button>
            <button onClick={() => setRenamingId(null)} className="text-muted shrink-0"><X size={10} /></button>
          </div>
        ) : (
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</span>
        )}
      </div>
    )
  }

  const renderFolder = (node: CollectionNode, depth: number) => {
    const isOpen = expanded.has(node.id)
    const isRenaming = renamingId === node.id
    const isDropTarget = dropTarget === node.id

    return (
      <div key={node.id}>
        <div
          onDragOver={(e) => {
            e.preventDefault()
            // keep the event off the root drop zone so it doesn't claim the highlight
            e.stopPropagation()
            e.dataTransfer.dropEffect = "move"
            if (dropTarget !== node.id) setDropTarget(node.id)
          }}
          onDragLeave={() => setDropTarget((t) => (t === node.id ? null : t))}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setDropTarget(null)
            const id = e.dataTransfer.getData("text/plain")
            if (id) move(id, node.id)
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            setMenu({ x: e.clientX, y: e.clientY, kind: "folder", id: node.id, name: node.name })
          }}
          onClick={() => { if (!isRenaming) toggle(node.id) }}
          className={`flex items-center gap-1.5 rounded cursor-pointer select-none px-2 py-1 text-xs transition-colors ${
            isDropTarget ? "bg-accent/20 text-foreground" : "text-muted hover:text-foreground hover:bg-background"
          }`}
          style={{ fontSize: 12, paddingLeft: 8 + depth * 12 }}
        >
          <ChevronRight size={11} className={`shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} />
          {isOpen ? <FolderOpen size={11} className="shrink-0 opacity-70" /> : <Folder size={11} className="shrink-0 opacity-70" />}
          {isRenaming ? (
            <div className="flex items-center gap-1 flex-1">
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitFolderRename(node.id)
                  if (e.key === "Escape") setRenamingId(null)
                }}
                onBlur={() => setRenamingId(null)}
                className="flex-1 bg-background border border-border rounded px-1 py-0.5 text-xs outline-none"
              />
              <button onClick={() => commitFolderRename(node.id)} className="text-accent shrink-0"><Check size={10} /></button>
              <button onClick={() => setRenamingId(null)} className="text-muted shrink-0"><X size={10} /></button>
            </div>
          ) : (
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.name}</span>
          )}
        </div>
        {isOpen && (
          <div>
            {node.children.map((child) => renderFolder(child, depth + 1))}
            {(byFolder.get(node.id) ?? []).map((d) => renderQuick(d, depth + 1))}
            {creatingIn === node.id && newFolderInput(depth + 1)}
          </div>
        )}
      </div>
    )
  }

  const rootDocs = byFolder.get(null) ?? []

  return (
    <div className="flex flex-col h-full w-full">
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={
            menu.kind === "folder"
              ? [
                  { label: "New folder inside", onClick: () => { setCreatingIn(menu.id); setExpanded((p) => new Set(p).add(menu.id)); setMenu(null) } },
                  { label: "Rename", onClick: () => { setRenameValue(menu.name); setRenamingId(menu.id); setMenu(null) } },
                  { label: "Delete", onClick: () => handleDeleteFolder(menu.id, menu.name), danger: true },
                ]
              : [
                  { label: "Rename", onClick: () => { setRenameValue(menu.name); setRenamingId(menu.id); setMenu(null) } },
                  { label: "Delete", onClick: () => handleDeleteQuick(menu.id, menu.name), danger: true },
                ]
          }
        />
      )}

      <div className="flex items-center justify-end gap-1 px-3 py-1.5 shrink-0">
        <div className="relative group">
          <button
            onClick={() => { setCreatingIn(null); setNewFolderName("") }}
            className="rounded p-0.5 transition-colors hover:bg-background"
            style={{ color: "var(--color-muted, #666)" }}
            aria-label="New folder"
          >
            <FolderPlus size={12} />
          </button>
          <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] px-1.5 py-0.5 rounded bg-surface border border-border text-muted whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[999]">New Folder</span>
        </div>
        <div className="relative group">
          <button
            onClick={() => {
              useQuicksStore.getState().reset()
              useQuicksStore.setState({ name: "Untitled Quick", hasContent: true })
              useTabViewStore.getState().setActiveView("home")
            }}
            className="rounded p-0.5 transition-colors hover:bg-background"
            style={{ color: "var(--color-muted, #666)" }}
            aria-label="New quick"
          >
            <FilePlus size={12} />
          </button>
          <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] px-1.5 py-0.5 rounded bg-surface border border-border text-muted whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[999]">New Quick</span>
        </div>
      </div>

      <div
        className={`flex-1 overflow-y-auto p-2 flex flex-col gap-0.5 ${dropTarget === "root" ? "bg-accent/5" : ""}`}
        onDragOver={(e) => {
          e.preventDefault()
          if (dropTarget !== "root") setDropTarget("root")
        }}
        onDragLeave={() => setDropTarget((t) => (t === "root" ? null : t))}
        onDrop={(e) => {
          e.preventDefault()
          setDropTarget(null)
          const id = e.dataTransfer.getData("text/plain")
          if (id) move(id, null)
        }}
      >
        {docs.length === 0 && folders.length === 0 && (
          <span style={{ fontSize: 11, color: "var(--color-muted, #555)", padding: "4px 8px" }}>
            No quicks yet — paste markdown in Home
          </span>
        )}

        {folders.map((node) => renderFolder(node, 0))}
        {rootDocs.map((d) => renderQuick(d, 0))}
        {creatingIn === null && newFolderInput(0)}
      </div>
    </div>
  )
}
