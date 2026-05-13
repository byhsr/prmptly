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


export type LibraryTab = "snippet" | "context"

export const LibraryView = () => {
  const [activeTab, setActiveTab] = useState<LibraryTab>("snippet")

  const { setCreating, resetAddContext, } = useLibraryStore()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "n") {
        e.preventDefault()
        activeTab === "snippet" ? setCreating("snippet") : setCreating("context")
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

        <div className="flex  gap-0">
          {(["snippet", "context"] as LibraryTab[]).map((tab) => {
            const isActive = activeTab === tab
            const Icon = tab === "snippet" ? SquareAsterisk : Sparkle
            return (
              <TabButton
                key={tab}
                isActive={isActive}
                onClick={() => setActiveTab(tab)}
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


        <div className="flex  gap-4 text-[12px] p-2 px-6" >
          <Button variant="ghost" onClick={() => {
            if (activeTab === "context") {
              setCreating("context")
              resetAddContext()
              // any context-specific setup if needed
            } else {
              setCreating(activeTab)
            }
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
  const { isCreating, setCreating, selectedSnippet } = useLibraryStore()
  const snippet = selectedSnippet()

  if (isCreating === "snippet" || snippet) {
    return (
      <SnippetModal
        isCreating={isCreating}
        snippet={snippet ?? undefined}
        onClose={() => { setCreating(null); useLibraryStore.getState().clearSelection() }}
        onSave={() => { setCreating(null) }}
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

// const LocalRagPanel = () => {
//   const [hasModel, setHasModel] = useState<boolean | null>(null)
//   const { isCreating, setCreating, selectedSnippet } = useLibraryStore()

//   useEffect(() => {
//     readConfig().then(config => setHasModel(!!config?.has_model))
//   }, [])

//   if (isCreating === "context") return <AddContextPanel
//     scopes={DUMMY_SCOPES}         // fetch from DB via plugin-sql
//     onBack={() => setCreating(null)}
//     />
//   if (hasModel === null) return null
//   if (!hasModel) return <div className="w-full h-full flex justify-center "><ContextSetupGate /></div>

//   return (
//     <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-4" style={{ color: "var(--color-text-secondary)" }}>
//       <div><Sparkle className="w-5 h-5 " /></div>
//       <span style={{ fontSize: 12 }}>no context files yet</span>
//     </div>
//   )
// }

const LocalRagPanel = () => {
  const [hasModel, setHasModel] = useState<boolean | null>(null)
  const { isCreating, setCreating, selectedScopeId, scopes, setScopes } = useLibraryStore()

  useEffect(() => {
    readConfig().then(config => setHasModel(!!config?.has_model))
  }, [])

  useEffect(() => {
    // getScopes().then(setScopes) — wire up when DB fn is ready
  }, [])

  if (isCreating === "context") return (
    <AddContextPanel
      scopes={scopes}
      onBack={() => setCreating(null)}
    />
  )

  if (hasModel === null) return null
  if (!hasModel) return (
    <div className="w-full h-full flex justify-center">
      <ContextSetupGate />
    </div>
  )

  if (selectedScopeId !== null) return <ScopeDocumentsPanel />

  return <ScopeListPanel />
}