import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Home, FileText, Layout, BookOpen } from "lucide-react"
import { Tab } from "./Tabbar"
import { CollectionTree, CollectionNode } from "@/services/service.collections"
import {PromptSidebarPanel} from "../Sidebar/PromptSidebar"
import {QuicksSidebarPanel} from "../Sidebar/QuicksSidebar"
import {LibrarySidebarPanel} from "../Sidebar/LibSidebar"
import {TemplateSidebarPanel }from "../template/TemplateSidebar"
import {ViewType} from "@/lib/types/DashTypes"
import { PendingCreate } from "../Sidebar/PromptSidebar"

// ── Icon rail button ──────────────────────────────────────────────────────────
function RailButton({
  icon: Icon,
  label,
  isActive,
  onClick,
}: {
  icon: React.ElementType
  label: string
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center rounded-xl transition-all relative group"
      style={{
        width: 40,
        height: 40,
        background: isActive ? "var(--color-surface)" : "transparent",
        color: isActive ? "var(--color-foreground)" : "var(--color-muted, #666)",
        fontFamily: "'Syne', sans-serif",
      }}
    >
      <Icon size={15} strokeWidth={isActive ? 2 : 1.5} />
      <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] px-1.5 py-0.5 rounded bg-surface border border-border text-muted whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[999]">{label}</span>
    </button>
  )
}

// ── Sidebar props (single source of truth) ────────────────────────────────────
interface SidebarProps {
  isOpen: boolean
  activeTab: Tab | undefined
  onOpenTab: (tab: Tab) => void
  collectionsTree: CollectionTree | null
  selectedId: string | null
  setSelectedId: (id: string | null) => void
  expandedCollections: Set<string>
  setExpandedCollections: React.Dispatch<React.SetStateAction<Set<string>>>
  onCreatePrompt: (name: string, collectionId: string | null) => Promise<void>
  onCreateCollection: (name: string, parentId: string | null) => Promise<void>
  onRefreshTree?: () => Promise<void>
  activeView: ViewType
  setActiveView: (v: ViewType) => void
}

// ── Main Sidebar ────────────────────────────────────────────────────────────
export function Sidebar({
  isOpen,
  activeTab,
  collectionsTree,
  selectedId,
  setSelectedId,
  expandedCollections,
  setExpandedCollections,
  onOpenTab,
  onCreatePrompt,
  onCreateCollection,
  onRefreshTree,
  setActiveView,
  activeView
}: SidebarProps) {

  const [pendingCreate, setPendingCreate] = useState<PendingCreate | null>(null)
  const panelOpen = isOpen && activeView !== null

  function toggleSection(section: ViewType) {
    const newSection = activeView === section ? activeView : section
    setActiveView(newSection)
  }

  function toggleExpand(id: string) {
    const next = new Set(expandedCollections)
    next.has(id) ? next.delete(id) : next.add(id)
    setExpandedCollections(next)
  }

  function resolveParentCollectionId(): string | null {
    if (!selectedId || !collectionsTree) return null

    const allCollectionIds = new Set<string>()
    const collectIds = (nodes: CollectionNode[]) => {
      nodes.forEach((n) => {
        allCollectionIds.add(n.id)
        collectIds(n.children)
      })
    }
    collectIds(collectionsTree.tree)

    if (allCollectionIds.has(selectedId)) {
      return selectedId
    }

    const findPromptParent = (nodes: CollectionNode[]): string | null => {
      for (const node of nodes) {
        if (node.documents.some((p) => p.id === selectedId)) return node.id
        const found = findPromptParent(node.children)
        if (found) return found
      }
      return null
    }

    return findPromptParent(collectionsTree.tree)
  }

  function startCreate(type: "prompt" | "collection") {
    const parentCollectionId = resolveParentCollectionId()

    if (parentCollectionId) {
      setExpandedCollections(new Set([...expandedCollections, parentCollectionId]))
    }

    setPendingCreate({ type, parentCollectionId })
  }

  let creatingRef = { current: false }

  async function confirmCreate(name: string) {
    if (creatingRef.current) return
    creatingRef.current = true
    try {
      if (!pendingCreate) return
      const { type, parentCollectionId } = pendingCreate
      setPendingCreate(null)

      if (type === "prompt") {
        await onCreatePrompt(name, parentCollectionId)
      } else {
        await onCreateCollection(name, parentCollectionId)
      }
    } catch (err) {
    } finally {
      creatingRef.current = false
    }
  }

  function cancelCreate() {
    setPendingCreate(null)
  }

  return (
    <div
      className="flex flex-col h-full w-full relative"
      style={{ borderRight: "1.5px solid var(--color-border, #222)" }}
    >
      {/* Icon rail left view selector */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 52, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="flex min-w-full items-center p-2 gap-2 overflow-hidden"
            style={{ background: "var(--color-surface, #0d0d0d)" }}
          >
            <motion.div className="flex gap-2 rounded-lg px-4 items-center p-2 bg-background w-full">
              <RailButton
                icon={Home}
                label="Home"
                isActive={activeView === "home"}
                onClick={() => toggleSection("home")}
              />
              <RailButton
                icon={FileText}
                label="Prompts"
                isActive={activeView === "prompt"}
                onClick={() => toggleSection("prompt")}
              />
              <RailButton
                icon={Layout}
                label="Templates"
                isActive={activeView === "template"}
                onClick={() => toggleSection("template")}
              />
              <RailButton
                icon={BookOpen}
                label="Library"
                isActive={activeView === "library"}
                onClick={() => toggleSection("library")}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Section panel — settings is a modal now, no case needed here */}
      {panelOpen && (
        <div
          key={activeView}
          className="flex flex-col w-full h-full min-h-0 overflow-y-auto"
          style={{ background: "var(--color-surface, #0d0d0d)" }}
        >
          <div className="flex flex-col h-full w-full">

            {activeView === "home" && <QuicksSidebarPanel />}

            {activeView === "prompt" && (
              <PromptSidebarPanel
                collectionsTree={collectionsTree}
                activeTab={activeTab}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                expandedCollections={expandedCollections}
                onToggleExpand={toggleExpand}
                onOpenTab={onOpenTab}
                pendingCreate={pendingCreate}
                onStartCreate={startCreate}
                onConfirmCreate={confirmCreate}
                onCancelCreate={cancelCreate}
                onRefreshTree={onRefreshTree}
              />
            )}

            {activeView === "prompt" && !collectionsTree && (
              <span style={{ fontSize: 11, color: "var(--color-muted, #555)", padding: "4px 8px" }}>
                Loading...
              </span>
            )}

            {activeView === "template" && <TemplateSidebarPanel />}
            {activeView === "library" && <LibrarySidebarPanel />}
          </div>
        </div>
      )}
    </div>
  )
}