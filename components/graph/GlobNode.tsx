import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"

export type GlobNodeData = {
  label: string
  color: string
  size: number
  /** Vault-graph globs are wired by hand, so they carry grabbable rim handles. */
  connectable?: boolean
  /** Cap long labels with an ellipsis. Unset leaves the label to size itself. */
  labelMaxWidth?: number
}

// Anchoring handles for display-only graphs: one invisible point at the glob's centre
// so edges run glob-to-glob rather than rim-to-rim.
const CENTER_HANDLE = {
  position: "absolute" as const,
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  opacity: 0,
  width: 1,
  height: 1,
  minWidth: 0,
  minHeight: 0,
  border: "none",
  background: "transparent",
}

// Connector nubs for the vault graph. Kept invisible until the node is hovered so the
// glob stays clean, while the node body stays free for dragging.
const RIM_HANDLE = {
  width: 7,
  height: 7,
  minWidth: 0,
  minHeight: 0,
  background: "var(--accent, #c8f135)",
  border: "1px solid var(--background, #0a0a0a)",
}

export function GlobNode({ data, selected }: NodeProps<Node<GlobNodeData>>) {
  const connectable = !!data.connectable
  const capped = !!data.labelMaxWidth
  const handleStyle = connectable ? RIM_HANDLE : CENTER_HANDLE
  const handleClass = connectable ? "opacity-0 transition-opacity group-hover:opacity-100" : undefined

  return (
    <div className="group" style={{ position: "relative", width: data.size, height: data.size }}>
      <Handle type="target" position={Position.Left} style={handleStyle} className={handleClass} />

      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          background: data.color,
          boxShadow: selected ? "0 0 0 3px var(--foreground, #f0efed)" : "0 0 0 0 transparent",
          transition: "box-shadow 0.15s ease",
        }}
      />

      <Handle type="source" position={Position.Right} style={handleStyle} className={handleClass} />

      <span
        style={{
          position: "absolute",
          top: data.size + 6,
          left: "50%",
          transform: "translateX(-50%)",
          maxWidth: data.labelMaxWidth,
          overflow: capped ? "hidden" : undefined,
          textOverflow: capped ? "ellipsis" : undefined,
          whiteSpace: "nowrap",
          fontSize: 10,
          fontFamily: "'Share Tech Mono', monospace",
          color: "var(--muted, #8a8a8a)",
          pointerEvents: "none",
        }}
      >
        {data.label}
      </span>
    </div>
  )
}
