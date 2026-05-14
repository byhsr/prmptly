import { useLibraryStore } from "@/hooks/store/SidebarStore"
import { useState, useEffect } from "react"
import { ChevronLeft, FileText, RefreshCw, Trash2 } from "lucide-react"
import { getDocumentsByScope, deleteDocument } from "@/lib/db/library"

export type Document = {
  id: string
  scope_name: string
  name: string
  created_at: string
}

export const ScopeDocumentsPanel = ({ refreshScopes }: { refreshScopes: () => void }) => {
  const { selectedScopeId, selectScope, setCreating, resetAddContext } = useLibraryStore()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!selectedScopeId) return
    setLoading(true)
    getDocumentsByScope(selectedScopeId)
      .then(setDocuments)
      .finally(() => setLoading(false))
  }, [selectedScopeId])

  return (
    <div className="w-full h-full flex flex-col">
      <div
        className="flex items-center gap-2 px-4 py-2.5 shrink-0"
        style={{ borderBottom: "0.5px solid var(--color-border)" }}
      >
        <button
          onClick={() => selectScope(null)}
          className="flex items-center gap-1.5 transition-opacity hover:opacity-60"
          style={{ color: "var(--color-text-secondary)", fontFamily: "'Syne', sans-serif", fontSize: 11 }}
        >
          <ChevronLeft size={11} />
          <span>scopes</span>
        </button>
        <span style={{ color: "var(--color-text-secondary)", fontSize: 11 }}>/</span>
        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "'Syne', sans-serif", color: "var(--color-text)" }}>
          {selectedScopeId}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
        {loading && (
          <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>loading...</span>
        )}

        {!loading && documents.length === 0 && (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2" style={{ color: "var(--color-text-secondary)" }}>
            <FileText size={20} strokeWidth={1} />
            <span style={{ fontSize: 12 }}>no documents in this scope</span>
          </div>
        )}

        {documents.map((doc) => (
          <DocumentRow
            key={doc.id}
            doc={doc}
            onDelete={async () => {
              await deleteDocument(doc.id)
              setDocuments(d => d.filter(x => x.id !== doc.id))
            }}
            onReupload={() => {
              resetAddContext()
              setCreating("context")
            }}
          />
        ))}
      </div>
    </div>
  )
}

const DocumentRow = ({
  doc,
  onDelete,
  onReupload,
}: {
  doc: Document
  onDelete: () => void
  onReupload: () => void
}) => {
  const [hovering, setHovering] = useState(false)

  return (
    <div
      className="flex items-center justify-between px-3 py-2.5 rounded-xl"
      style={{
        border: "0.5px solid var(--color-border)",
        background: "var(--color-surface)",
        fontFamily: "'IBM Plex Mono', monospace",
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <FileText size={12} style={{ color: "#c8f135", flexShrink: 0 }} />
        <span
          className="truncate"
          style={{ fontSize: 11, color: "var(--color-text)" }}
        >
          {doc.name}
        </span>
      </div>

      {/* Actions — show on hover */}
      <div
        className="flex items-center gap-1 shrink-0"
        style={{
          opacity: hovering ? 1 : 0,
          transition: "opacity 0.15s ease",
        }}
      >
        <IconButton title="Re-upload" onClick={onReupload}>
          <RefreshCw size={11} />
        </IconButton>
        <IconButton title="Delete" onClick={onDelete} danger>
          <Trash2 size={11} />
        </IconButton>
      </div>
    </div>
  )
}

const IconButton = ({
  children,
  onClick,
  title,
  danger = false,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  danger?: boolean
}) => (
  <button
    onClick={onClick}
    title={title}
    className="p-1 rounded transition-colors"
    style={{ color: danger ? "var(--color-error, #f87171)" : "var(--color-text-secondary)" }}
    onMouseEnter={e =>
      (e.currentTarget.style.color = danger ? "#f87171" : "var(--color-text)")
    }
    onMouseLeave={e =>
      (e.currentTarget.style.color = danger ? "var(--color-error, #f87171)" : "var(--color-text-secondary)")
    }
  >
    {children}
  </button>
)