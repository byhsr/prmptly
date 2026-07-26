import { SquareAsterisk } from "lucide-react"
import { SnippetModal } from "./SnippetModal"
import { Button } from "../ui/Button"
import { TabButton } from "../ui/TabButton"
import { useLibraryStore } from "@/hooks/store/SidebarStore"

export type LibraryTab = "snippet"

export const LibraryView = () => {
  const { setActiveMode } = useLibraryStore()

  return (
    <div className="w-full h-full flex flex-col text-sm">
      <div className="flex bg-surface px-4 items-end justify-between">
        <div className="flex gap-0">
          <TabButton isActive={true} onClick={() => {}} className="flex items-center justify-center gap-2 px-4">
            <SquareAsterisk style={{ width: 13, height: 13, flexShrink: 0 }} />
            <span>Snippet</span>
          </TabButton>
        </div>
        <div className="flex gap-4 text-[12px] p-2 px-6">
          <Button variant="ghost" onClick={() => setActiveMode("snippet")}>
            new snippet
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <SnippetsPanel />
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

