import { useState } from "react"
import { File } from "lucide-react"
import { Tab } from "../core-components/Tabbar"
import { DocumentRow } from "@/services/service.collections"
import { ContextMenu } from "../ui/ContextMenu"

interface PromptItemProps {
  prompt: DocumentRow
  depth?: number
  isActive: boolean
  isSelected: boolean
  onSelect: () => void // pu
  onOpenTab: (tab: Tab) => void
}

export function PromptFile({ prompt, depth = 0, isActive, isSelected, onSelect, onOpenTab }: PromptItemProps) {
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    prompt: any
  } | null>(null)


  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault()
        onSelect()
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          prompt
        })
      }}
      onClick={() => {
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
        color: isActive
          ? "var(--color-text, #eee)"
          : "var(--color-muted, #888)",
        background: (isSelected && contextMenu)
          ? "var(--color-selection, #1e1e1e)"
          : isActive
            ? "var(--color-active, #1a1a1a)"
            : "transparent",
        borderRadius: 4,
        transition: "background 0.1s",
      }}
    >
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          // handleRename(contextMenu.prompt)
          // handleDelete(contextMenu.prompt.id)
          items={[
            { label: "Rename", onClick: () => {} },
            { label: "Delete", onClick: () => {}, danger: true },
          ]}
        />
      )}
      <File size={11} style={{ flexShrink: 0, opacity: 0.6 }} />
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontWeight: isActive ? 500 : 400,
        }}
      >
        {prompt.name}
      </span>
    </div>
  )
}