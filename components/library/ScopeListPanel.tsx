import { useLibraryStore } from "@/hooks/store/SidebarStore"
import { Sparkle, Folder } from "lucide-react"
import { Scope } from "./AddContextPanel"
import { cn } from "@/lib/utils"

export const ScopeListPanel = () => {
  const { scopes, selectScope, selectedScopeId} = useLibraryStore()

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
      className={cn(
        "w-full flex items-center gap-2 px-2 py-1 rounded-md text-left transition-all duration-150",
        isActive
          ? "bg-surface border border-border"
          : "bg-transparent border border-transparent hover:bg-surface/50"
      )}
    >
      <Folder
        size={11}
        className="shrink-0 transition-colors duration-150"
        style={{ color: isActive ? "#c8f135" : "var(--color-muted)" }}
      />
      <span
        className="transition-all duration-150"
        style={{
          fontSize: 11,
          fontFamily: "'Syne', sans-serif",
          fontWeight: isActive ? 700 : 400,
          color: isActive ? "var(--color-foreground)" : "var(--color-muted)",
        }}
      >
        {scope.name}
      </span>
    </button>
  )
}