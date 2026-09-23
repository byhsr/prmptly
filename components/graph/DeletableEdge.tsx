import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react"
import { X } from "lucide-react"
import { Tooltip } from "@/components/ui/Tooltip"

// Edges gain a delete affordance at their midpoint once selected, so removing a link
// doesn't depend on knowing the keyboard shortcut.
export function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  selected,
  data,
}: EdgeProps) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const onDelete =
    typeof data?.onDelete === "function" ? (data.onDelete as (id: string) => void) : undefined

  return (
    <>
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />

      {selected && onDelete && (
        <EdgeLabelRenderer>
          <Tooltip label="Delete link" side="top">
            <button
              type="button"
              aria-label="Delete link"
              onClick={(event) => {
                event.stopPropagation()
                onDelete(id)
              }}
              style={{ left: labelX, top: labelY }}
              className="nodrag nopan pointer-events-auto absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-lg transition-colors hover:border-danger hover:text-foreground"
            >
              <X size={10} aria-hidden="true" />
            </button>
          </Tooltip>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
