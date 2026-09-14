import { Handle, Position, NodeProps, Node } from "@xyflow/react"

export type SkillDotData = {
  label: string
  color: string
  size: number
}

// Both handles sit at the node centre so edges run dot-to-dot, Obsidian-style
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

export function SkillDotNode({ data, selected }: NodeProps<Node<SkillDotData>>) {
  return (
    <div style={{ position: "relative", width: data.size, height: data.size }}>
      <Handle type="target" position={Position.Left} style={CENTER_HANDLE} />

      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          background: data.color,
          boxShadow: selected
            ? "0 0 0 3px var(--foreground)"
            : "0 0 0 0 transparent",
          transition: "box-shadow 0.15s ease",
        }}
      />

      <Handle type="source" position={Position.Right} style={CENTER_HANDLE} />

      <span
        style={{
          position: "absolute",
          top: data.size + 6,
          left: "50%",
          transform: "translateX(-50%)",
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
