import { SquareAsterisk, Sparkle } from "lucide-react"
import { useState, useEffect } from "react"
import { SnippetModal } from "./SnippetModal"
import { Button } from "../ui/button"
import { cn } from "@/lib/utils"
import { TabButton } from "../ui/TabButton"
import ContextSetupGate from "./EnableContext"
import { readConfig } from "@/lib/fs/fs"
import { useLibraryStore } from "@/hooks/store/SidebarStore"
import { AddContextPanel } from "./AddContextPanel"
import { Scope } from "./AddContextPanel"
import { ScopeDocumentsPanel } from "./ScopeDocumentsPanel"
import { ScopeListPanel } from "./ScopeListPanel"
import { getScopes } from "@/lib/db/library"


export type LibraryTab = "snippet" | "context"

export const LibraryView = () => {
  const { setActiveMode, resetAddContext, activeMode } = useLibraryStore()

  const activeTab: LibraryTab = activeMode ?? "snippet"

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "n") {
        e.preventDefault()
        activeTab === "snippet" ? setActiveMode("snippet") : setActiveMode("context")
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [activeTab])

  const buttonLabel = activeTab === "snippet" ? "new snippet" : "new context"

  return (
    <div className="w-full h-full flex flex-col text-sm">

      {/* Folder tab nav */}
      <div className="flex bg-surface px-4 items-end justify-between">
        <div className="flex gap-0">
          {(["snippet", "context"] as LibraryTab[]).map((tab) => {
            const isActive = activeTab === tab
            const Icon = tab === "snippet" ? SquareAsterisk : Sparkle
            return (
              <TabButton
                key={tab}
                isActive={isActive}
                onClick={() => setActiveMode(tab)}
                className={cn("flex items-center justify-center", isActive ? "gap-2 px-4" : "gap-0 px-2")}
              >
                <Icon style={{ width: 13, height: 13, flexShrink: 0 }} />
                <span style={{
                  maxWidth: isActive ? 80 : 0,
                  opacity: isActive ? 1 : 0,
                  overflow: "hidden",
                  marginLeft: isActive ? 4 : 0,
                  transition: "max-width 0.15s ease, opacity 0.15s ease",
                }}>
                  {tab === "snippet" ? "Snippet" : "Context"}
                </span>
              </TabButton>
            )
          })}
        </div>

        <div className="flex gap-4 text-[12px] p-2 px-6">
          <Button variant="ghost" onClick={() => {
            if (activeTab === "context") resetAddContext()
            setActiveMode(activeTab)
          }}>
            {buttonLabel}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "snippet" && <SnippetsPanel />}
        {activeTab === "context" && <LocalRagPanel />}
      </div>

    </div>
  )
}

const SnippetsPanel = () => {
  const { activeMode, setActiveMode, selectedSnippet } = useLibraryStore()
  const snippet = selectedSnippet()
  
  if (activeMode=== "snippet" || snippet) {
    return (
      <SnippetModal
        isCreating={activeMode}
        snippet={snippet ?? undefined}
        onClose={() => { setActiveMode(null); useLibraryStore.getState().clearSelection() }}
        onSave={() => { setActiveMode(null) }}
      />
    )
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4" style={{ color: "var(--color-text-secondary)" }}>
      <SquareAsterisk style={{ width: 24, height: 24 }} strokeWidth={1} />
      <span style={{ fontSize: 12 }}>no snippets yet</span>
    </div>
  )
}

const DUMMY_SCOPES:Scope[] = []

const LocalRagPanel = () => {
  const [hasModel, setHasModel] = useState<boolean | null>(null)
  const { activeMode, setActiveMode, selectedScopeId, scopes, setScopes } = useLibraryStore()
  
  const refreshScopes = () => getScopes().then(setScopes)

  useEffect(() => {
    readConfig().then(config => setHasModel(!!config?.has_model))
    refreshScopes()
  }, [])

  if (hasModel === null) return null
  if (selectedScopeId !== null) return <ScopeDocumentsPanel refreshScopes={refreshScopes} />
  if (activeMode === "context" && hasModel) return (
    <AddContextPanel 
      scopes={scopes} 
      onBack={() => { setActiveMode(null); refreshScopes() }} 
    />
  )
  if (!hasModel) return (
    <div className="w-full h-full flex justify-center">
      <ContextSetupGate />
    </div>
  )

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2" style={{ color: "var(--color-text-secondary)" }}>
      <Sparkle style={{ width: 24, height: 24 }} strokeWidth={1} />
      <span style={{ fontSize: 12 }}>no context files yet</span>
    </div>
  )
}