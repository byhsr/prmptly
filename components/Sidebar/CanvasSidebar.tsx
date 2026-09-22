import { useEffect, useState } from "react"
import { File, FilePlus, Check, X } from "lucide-react"
import { useCanvasStore } from "@/hooks/store/canvasStore"
import { ContextMenu } from "../ui/ContextMenu"
import { InlineInput } from "../ui/InlineInput"
import { Tooltip } from "@/components/ui/Tooltip"

type MenuTarget = { x: number; y: number; id: string; name: string }

export function CanvasSidebarPanel() {
  const canvases = useCanvasStore((s) => s.canvases)
  const selectedCanvasId = useCanvasStore((s) => s.selectedCanvasId)
  const selectCanvas = useCanvasStore((s) => s.selectCanvas)
  const load = useCanvasStore((s) => s.load)
  const createCanvas = useCanvasStore((s) => s.createCanvas)
  const renameCanvas = useCanvasStore((s) => s.renameCanvas)
  const deleteCanvas = useCanvasStore((s) => s.deleteCanvas)

  const [creating, setCreating] = useState(false)
  const [menu, setMenu] = useState<MenuTarget | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")

  useEffect(() => {
    load()
  }, [])

  const commitRename = async (id: string) => {
    const name = renameValue.trim()
    setRenamingId(null)
    if (!name) return
    await renameCanvas(id, name)
  }

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete canvas "${name}"? This cannot be undone.`)) return
    setMenu(null)
    await deleteCanvas(id)
  }

  return (
    <div className="flex flex-col h-full w-full">
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            {
              label: "Rename",
              onClick: () => {
                setRenameValue(menu.name)
                setRenamingId(menu.id)
                setMenu(null)
              },
            },
            { label: "Delete", onClick: () => handleDelete(menu.id, menu.name), danger: true },
          ]}
        />
      )}

      <div className="flex items-center justify-end gap-1 px-3 py-1.5 shrink-0">
        <Tooltip label="New Canvas">
          <button
            onClick={() => setCreating(true)}
            className="rounded p-0.5 transition-colors hover:bg-background"
            style={{ color: "var(--color-muted, #666)" }}
            aria-label="New canvas"
          >
            <FilePlus size={12} />
          </button>
        </Tooltip>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 flex flex-col gap-0.5">
        {creating && (
          <InlineInput
            depth={0}
            placeholder="canvas name"
            icon={<File size={11} className="shrink-0 opacity-40" />}
            onConfirm={async (name) => {
              setCreating(false)
              await createCanvas(name.trim() || "Untitled Canvas")
            }}
            onCancel={() => setCreating(false)}
          />
        )}

        {canvases.length === 0 && !creating && (
          <span style={{ fontSize: 11, color: "var(--color-muted, #555)", padding: "4px 8px" }}>
            No canvases yet
          </span>
        )}

        {canvases.map((canvas) => {
          const isRenaming = renamingId === canvas.id
          const isActive = selectedCanvasId === canvas.id

          return (
            <div
              key={canvas.id}
              onClick={() => {
                if (!isRenaming) selectCanvas(canvas.id)
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                setMenu({ x: e.clientX, y: e.clientY, id: canvas.id, name: canvas.name })
              }}
              className="flex items-center gap-1.5 rounded cursor-pointer select-none px-2 py-1 text-xs transition-colors"
              style={{
                fontSize: 12,
                paddingLeft: 8,
                color: isActive ? "var(--foreground)" : "var(--muted)",
                background: isActive ? "var(--surface)" : "transparent",
              }}
            >
              <File size={11} style={{ flexShrink: 0, opacity: 0.6 }} />
              {isRenaming ? (
                <div className="flex items-center gap-1 flex-1">
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(canvas.id)
                      if (e.key === "Escape") setRenamingId(null)
                    }}
                    onBlur={() => setRenamingId(null)}
                    className="flex-1 bg-background border border-border rounded px-1 py-0.5 text-xs outline-none"
                  />
                  <button onClick={() => commitRename(canvas.id)} className="text-accent shrink-0">
                    <Check size={10} />
                  </button>
                  <button onClick={() => setRenamingId(null)} className="text-muted shrink-0">
                    <X size={10} />
                  </button>
                </div>
              ) : (
                <span className="flex-1 min-w-0 truncate">{canvas.name}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
