import { useLibraryStore } from "@/hooks/store/SidebarStore"
import { Sparkle, Folder, ChevronRight } from "lucide-react"
import { Scope } from "./AddContextPanel"

export const ScopeListPanel = () => {
  const { scopes, selectScope, setCreating, resetAddContext } = useLibraryStore()

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
          onClick={() => selectScope(scope.name)}
        />
      ))}
    </div>
  )
}

const ScopeCard = ({ scope, onClick }: { scope: Scope; onClick: () => void }) => {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors text-left"
      style={{
        border: "0.5px solid var(--color-border)",
        background: "var(--color-surface)",
        fontFamily: "'Syne', sans-serif",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "var(--color-background)")}
      onMouseLeave={e => (e.currentTarget.style.background = "var(--color-surface)")}
    >
      <div className="flex items-center gap-2.5">
        <Folder size={13} style={{ color: "#c8f135", flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text)" }}>
          {scope.name}
        </span>
      </div>
      <ChevronRight size={12} style={{ color: "var(--color-text-secondary)" }} />
    </button>
  )
}