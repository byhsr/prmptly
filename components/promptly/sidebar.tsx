import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
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
import { Tab } from "./Tabbar"

import { CollectionTree, CollectionNode } from "@/services/service.collections"
import { PendingCreate } from "../Sidebar/PromptSidebar"
import { ViewType } from "@/lib/types/DashTypes"
import { LibrarySidebarPanel } from "../Sidebar/LibSidebar"
import { PromptSidebarPanel } from "../Sidebar/PromptSidebar"

interface SidebarProps {
  isOpen: boolean
  activeTab: Tab | undefined
  collectionsTree: CollectionTree | null
  selectedId: string | null
  activeView: ViewType
  setSelectedId: (id: string | null) => void
  expandedCollections: Set<string>
  setExpandedCollections: (s: Set<string>) => void
  onOpenTab: (tab: Tab) => void
  onCreatePrompt: (name: string, collectionId: string | null) => Promise<void>
  onCreateCollection: (name: string, parentId: string | null) => Promise<void>
  onRefreshTree: () => Promise<void>
  setActiveView: (view: ViewType) => void
}

interface RailButtonProps {
  icon: React.ElementType
  label: string
  isActive: boolean
  onClick: () => void
}




function RailButton({ icon: Icon, label, isActive, onClick }: RailButtonProps) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={"flex items-center justify-center rounded-lg  transition-colors"}
      style={{
        width: 32,
        height: 32,
        // border : isActive ? "1px solid var(--color-accent, #444)" : "1px solid transparent",
        color: isActive ? "var(--color-muted)" : "var(--color-muted, #555)",
        background: isActive ? "var(--color-surface)" : "transparent",
      }}
    >
      <Icon size={15} />
    </button>
  )
}

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

  // const activeSection = activeView === "home" ? null : activeView

  const panelOpen = isOpen && activeView !== null


  // this toggles Section in sidebar 
  function toggleSection(section: ViewType) {
    const newSection = activeView === section ? activeView : section
    setActiveView(newSection)
  }
  function toggleExpand(id: string) {
    const next = new Set(expandedCollections)
    next.has(id) ? next.delete(id) : next.add(id)
    setExpandedCollections(next)
  }

  // Given the currently selectedId, figure out which collection to create inside
  function resolveParentCollectionId(): string | null {
    if (!selectedId || !collectionsTree) return null

    // Is the selected a collection?
    const isCollection = (nodes: CollectionNode[]): boolean =>
      nodes.some((n) => n.id === selectedId || isCollection(n.children))

    const findCollection = (nodes: CollectionNode[]): boolean =>
      nodes.some((n) => n.id === selectedId)

    // Walk the tree to find if selectedId is a collection id
    const allCollectionIds = new Set<string>()
    const collectIds = (nodes: CollectionNode[]) => {
      nodes.forEach((n) => {
        allCollectionIds.add(n.id)
        collectIds(n.children)
      })
    }
    collectIds(collectionsTree.tree)

    if (allCollectionIds.has(selectedId)) {
      // selected is a collection → create inside it
      return selectedId
    }

    // selected is a prompt → find its parent collection
    const findPromptParent = (nodes: CollectionNode[]): string | null => {
      for (const node of nodes) {
        if (node.prompts.some((p) => p.id === selectedId)) return node.id
        const found = findPromptParent(node.children)
        if (found) return found
      }
      return null
    }

    return findPromptParent(collectionsTree.tree)
  }

  function startCreate(type: "prompt" | "collection") {
    const parentCollectionId = resolveParentCollectionId()

    // If creating inside a collection, expand it
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
      className="flex flex-col h-full w-full "
      style={{ borderRight: "1.5px solid var(--color-border, #222)" }}
    >
      {/* Icon rail left view selector  */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 52, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="flex min-w-full  items-center p-2 gap-2 overflow-hidden "
            style={{
              background: "var(--color-surface, #0d0d0d)",
              // borderRight: "0.5px solid var(--color-border, #222)",
            }}
          >
            {/* panel view bar */}
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

      {/* Section panel */}

      {panelOpen && (
        <div
          key={activeView}
          className="flex flex-col w-full h-full min-h-0 overflow-y-auto"
          style={{ background: "var(--color-surface, #0d0d0d)" }}
        >
          <div className="flex flex-col h-full w-full ">


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
              />
            )}

            {activeView === "prompt" && !collectionsTree && (
              <span style={{ fontSize: 11, color: "var(--color-muted, #555)", padding: "4px 8px" }}>
                Loading...
              </span>
            )}

            {/* Templates + Library — wire up when ready */}
            {activeView === "template" && (
              <span style={{ fontSize: 11, color: "var(--color-muted, #555)", padding: "4px 8px" }}>
                Templates coming soon
              </span>
            )}
            {activeView === "library" && <LibrarySidebarPanel />}

          </div>
        </div>

  )
}
 
    </div >
  )
}