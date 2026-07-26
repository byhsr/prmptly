import { ContextMenu } from "../ui/ContextMenu"
import { documentNameOverrides } from "@/lib/state"
import { useState, useRef, useEffect } from "react"
import { File, Check, X } from "lucide-react"
import { Tab } from "../core-components/Tabbar"
import { DocumentRow } from "@/services/service.collections"

interface PromptItemProps {
  prompt: DocumentRow
  depth?: number
  isActive: boolean
  isSelected: boolean
  onSelect: () => void
  onOpenTab: (tab: Tab) => void
  onRefresh?: () => Promise<void>
}

export function PromptFile({ prompt, depth = 0, isActive, isSelected, onSelect, onOpenTab, onRefresh }: PromptItemProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(prompt.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const displayName = documentNameOverrides.get(prompt.id) ?? prompt.name

  const commitRename = async () => {
    const name = editName.trim()
    if (!name || name === prompt.name) { setEditing(false); return }
    documentNameOverrides.set(prompt.id, name)
    const { updateDocument } = await import("@/lib/db/document")
    await updateDocument(prompt.id, { name })
    const { useTabViewStore } = await import("@/hooks/store/TabStore")
    const ts = useTabViewStore.getState()
    useTabViewStore.setState({
      tabs: ts.tabs.map((t) => t.id === prompt.id ? { ...t, label: name } : t),
    })
    setEditing(false)
    setContextMenu(null)
    await onRefresh?.()
  }

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${prompt.name}"?`)) return
    const { useTabViewStore } = await import("@/hooks/store/TabStore")
    useTabViewStore.getState().closeTab(prompt.id)
    const { deleteDocument } = await import("@/lib/db/document")
    await deleteDocument(prompt.id)
    const { getDocumentDir } = await import("@/lib/fs/fsHelpers")
    const { deleteFolder } = await import("@/lib/fs/fs")
    try { await deleteFolder(await getDocumentDir(prompt.id)) } catch {}
    setContextMenu(null)
    await onRefresh?.()
  }

  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault()
        onSelect()
        setContextMenu({ x: e.clientX, y: e.clientY })
      }}
      onClick={() => {
        if (editing) return
        onSelect()
        onOpenTab({ id: prompt.id, label: prompt.name, type: "prompt" })
      }}
      className="flex items-center gap-1.5 rounded cursor-pointer select-none"
      style={{
        paddingLeft: 8 + depth * 12,
        paddingTop: 3,
        paddingBottom: 3,
        paddingRight: 6,
        fontSize: 12,
        color: isActive ? "var(--color-text, #eee)" : "var(--color-muted, #888)",
        background: (isSelected && contextMenu) ? "var(--color-selection, #1e1e1e)" : isActive ? "var(--color-active, #1a1a1a)" : "transparent",
        borderRadius: 4,
        transition: "background 0.1s",
      }}
    >
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            { label: "Rename", onClick: () => { setEditName(prompt.name); setEditing(true); setContextMenu(null) } },
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
            style={{ minWidth: 0, width: 0 }}
          />
          <button onClick={commitRename} className="text-accent shrink-0"><Check size={11} /></button>
          <button onClick={() => setEditing(false)} className="text-muted shrink-0"><X size={11} /></button>
        </div>
      ) : (
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: isActive ? 500 : 400 }}>
          {displayName}
        </span>
      )}
    </div>
  )
}
