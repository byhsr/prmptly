import { useEffect, useState, useRef } from "react"
import { File, FilePlus, Check, X } from "lucide-react"
import { listDocuments } from "@/lib/db/document"
import type { Document } from "@/lib/types/Document"
import { ContextMenu } from "../ui/ContextMenu"
import { useTabViewStore } from "@/hooks/store/TabStore"
import { documentNameOverrides } from "@/lib/state"

function excerpt(doc: Document): string {
  if (doc.name && doc.name !== "Untitled Quick") return doc.name
  const first = doc.sections?.[0]
  if (first) {
    const text = typeof first.value === "string" ? first.value : ""
    return text.slice(0, 60).replace(/\n.*/, "") || "Untitled"
  }
  return "Untitled"
}

export function QuicksSidebarPanel() {
  const [quicks, setQuicks] = useState<Document[]>([])

  const refresh = async () => {
    const docs = await listDocuments({ type: "quick" })
    setQuicks(docs)
  }

  useEffect(() => {
    refresh()
    const handler = () => refresh()
    window.addEventListener("quick-saved", handler)
    return () => window.removeEventListener("quick-saved", handler)
  }, [])

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex items-center justify-end px-3 py-1.5 shrink-0">
        <div className="relative group">
          <button
            onClick={() => {}}
            className="rounded p-0.5 transition-colors hover:bg-background"
            style={{ color: "var(--color-muted, #666)" }}
          >
            <FilePlus size={12} />
          </button>
          <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] px-1.5 py-0.5 rounded bg-surface border border-border text-muted whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[999]">New Quick</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
        {quicks.length === 0 && (
          <span style={{ fontSize: 11, color: "var(--color-muted, #555)", padding: "4px 8px" }}>
            No quicks yet — paste markdown in Home
          </span>
        )}
        {quicks.map((q) => (
          <QuickRow key={q.id} doc={q} onRefresh={refresh} />
        ))}
      </div>
    </div>
  )
}

function QuickRow({ doc, onRefresh }: { doc: Document; onRefresh: () => void }) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(doc.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const displayName = documentNameOverrides.get(doc.id) ?? excerpt(doc)

  const commitRename = async () => {
    const name = editName.trim()
    if (!name) { setEditing(false); return }
    documentNameOverrides.set(doc.id, name)
    const { updateDocument } = await import("@/lib/db/document")
    await updateDocument(doc.id, { name })
    const ts = useTabViewStore.getState()
    useTabViewStore.setState({
      tabs: ts.tabs.map((t) => t.id === doc.id ? { ...t, label: name } : t),
    })
    setEditing(false)
    setContextMenu(null)
    onRefresh()
  }

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${displayName}"?`)) return
    useTabViewStore.getState().closeTab(doc.id)
    const { deleteDocument } = await import("@/lib/db/document")
    await deleteDocument(doc.id)
    setContextMenu(null)
    onRefresh()
  }

  const openQuick = async () => {
    const { useQuicksStore } = await import("@/hooks/store/quickStore")
    const full = await (await import("@/lib/db/document")).getDocument(doc.id)
    if (!full) return
    useQuicksStore.getState().loadEntry({
      id: full.id,
      name: full.name,
      sections: full.sections.map((s) => ({
        id: s.id,
        title: s.title,
        doc: s.doc ?? { type: "doc", content: [{ type: "paragraph" }] },
      })),
      output: null,
      createdAt: Date.now(),
    })
    useQuicksStore.setState({ savedDocId: full.id, hasContent: true })
    useTabViewStore.getState().setActiveView("home")
  }

  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault()
        setContextMenu({ x: e.clientX, y: e.clientY })
      }}
      onClick={() => { if (!editing) openQuick() }}
      className="flex items-center gap-1.5 rounded cursor-pointer select-none px-2 py-1 text-xs text-muted hover:text-foreground hover:bg-background transition-colors"
      style={{ fontSize: 12 }}
    >
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            { label: "Rename", onClick: () => { setEditName(doc.name); setEditing(true); setContextMenu(null) } },
            { label: "Delete", onClick: handleDelete, danger: true },
          ]}
        />
      )}
      <File size={11} style={{ flexShrink: 0, opacity: 0.6 }} />
      {editing ? (
        <div className="flex items-center gap-1 flex-1">
          <input
            ref={inputRef}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setEditing(false) }}
            onBlur={() => setEditing(false)}
            className="flex-1 bg-background border border-border rounded px-1 py-0.5 text-xs outline-none"
          />
          <button onClick={commitRename} className="text-accent shrink-0"><Check size={10} /></button>
          <button onClick={() => setEditing(false)} className="text-muted shrink-0"><X size={10} /></button>
        </div>
      ) : (
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {displayName}
        </span>
      )}
    </div>
  )
}
