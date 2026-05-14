import { useLibraryStore } from "@/hooks/store/SidebarStore"
import { Sparkle, Folder, ChevronRight } from "lucide-react"
import { Scope } from "./AddContextPanel"

export const ScopeListPanel = () => {
  const { scopes, selectScope, setCreating, resetAddContext, selectedScopeId} = useLibraryStore()

  if (scopes.length === 0) return (
    <div
      className="w-full h-full flex flex-col items-center justify-center gap-2 p-4"
      style={{ color: "var(--color-text-secondary)" }}
    >
      <Sparkle style={{ width: 24, height: 24 }} strokeWidth={1} />
      <span style={{ fontSize: 12 }}>no context files yet</span>
    </div>
  )

  return (
    <div className="w-full h-full flex flex-col p-4 gap-2">
      {scopes.map((scope) => (
        <ScopeCard
          key={scope.name}
          scope={scope}
          isActive={selectedScopeId === scope.name}
          onClick={() => selectScope(scope.name)}
        />
      ))}
    </div>
  )
}

const ScopeCard = ({ scope, onClick, isActive }: { scope: Scope; onClick: () => void; isActive: boolean }) => {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-2 py-1 rounded-md transition-colors text-left"
      style={{ background: isActive ? "var(--color-surface)" : "transparent" }}
    >
      <Folder
        size={11}
        style={{ color: isActive ? "#c8f135" : "var(--color-muted)", flexShrink: 0 }}
      />
      <span style={{
        fontSize: 11,
        fontFamily: "'Syne', sans-serif",
        fontWeight: isActive ? 700 : 400,
        color: isActive ? "var(--color-foreground)" : "var(--color-muted)",
      }}>
        {scope.name}
      </span>
    </button>
  )
}