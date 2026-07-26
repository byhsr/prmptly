// Scope documents panel — stubbed for future RAG
import { ChevronLeft } from "lucide-react"
import { useLibraryStore } from "@/hooks/store/SidebarStore"

export type Document = {
  id: string
  scope_name: string
  name: string
  created_at: string
}

export const ScopeDocumentsPanel = () => {
  const { selectedScopeId, selectScope } = useLibraryStore()

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center gap-2 p-6 shrink-0">
        <div className="flex text-[12px]">
          <button
            onClick={() => selectScope(null)}
            className="flex items-center gap-1.5 transition-opacity hover:opacity-60"
          >
            <ChevronLeft size={11} />
            <span>scopes</span>
          </button>
          <span style={{ color: "var(--color-text-secondary)", fontSize: 11 }}>/</span>
          <span>{selectedScopeId}</span>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center" style={{ color: "var(--color-text-secondary)" }}>
        <span style={{ fontSize: 12 }}>RAG scope documents — coming in cloud sync</span>
      </div>
    </div>
  )
}
