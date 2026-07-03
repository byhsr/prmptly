import { useEffect, useRef } from "react"
import { ChevronRight, Folder, FolderOpen } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Tab } from "../core-components/Tabbar"
import { PendingCreate } from "../core-components/sidebar"
import { CollectionNode} from "@/services/service.collections"
import { PromptFile } from "../Prompt/PromptElements"

interface InlineInputProps {
  depth?: number
  onConfirm: (name: string) => void
  onCancel: () => void
}


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
}


export function InlineInput({ depth = 0, onConfirm, onCancel }: InlineInputProps) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  return (
    <div style={{ paddingLeft: 8 + depth * 12 }}>
      <input
        ref={ref}
        placeholder="Name..."
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.repeat) {
            const val = ref.current?.value.trim()
            if (val) onConfirm(val)
            else onCancel()
          }
          if (e.key === "Escape") onCancel()
        }}
        style={{
          background: "transparent",
          border: "none",
          outline: "1px solid var(--color-accent, #444)",
          borderRadius: 4,
          color: "var(--color-text, #eee)",
          fontSize: 12,
          fontFamily: "inherit",
          padding: "1px 4px",
          width: "100%",
        }}
      />
    </div>
  )
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
}: CollectionItemProps) {
  const isExpanded = expandedCollections.has(node.id)
  const isSelected = selectedId === node.id

  return (
    <div>
      {/* Collection row */}
      <div
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
          color: isSelected ? "var(--color-text, #eee)" : "var(--color-muted, #777)",
          background: isSelected ? "var(--color-selection, #1e1e1e)" : "transparent",
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
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontWeight: 500,
          }}
        >
          {node.name}
        </span>
      </div>

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
              />
            ))}

            {/* Prompts in this collection */}
            {node.prompts.map((p) => (
              <PromptFile
                key={p.id}
                prompt={p}
                depth={depth + 1}
                isActive={activeTabId === p.id}
                isSelected={selectedId === p.id}
                onSelect={() => onSelect(p.id)}
                onOpenTab={onOpenTab}
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