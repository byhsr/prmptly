import { Button } from "../ui/Button"
import { SnippetModal } from "./SnippetModal"
import { SnippetList } from "./SnippetList"
import { useLibraryStore } from "@/hooks/store/SidebarStore"

export const SnippetsPanel = () => {
  const { activeMode, setActiveMode, selectedSnippet } = useLibraryStore()
  const snippet = selectedSnippet()

  if (activeMode === "snippet" || snippet) {
    return (
      <SnippetModal
        isCreating={activeMode}
        snippet={snippet ?? undefined}
        onClose={() => { setActiveMode(null); useLibraryStore.getState().clearSelection() }}
      />
    )
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <span className="text-[11px] text-muted">snippets</span>
        <Button variant="ghost" size="sm" onClick={() => setActiveMode("snippet")}>
          new snippet
        </Button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <SnippetList />
      </div>
    </div>
  )
}
