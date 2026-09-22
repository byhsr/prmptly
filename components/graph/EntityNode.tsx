import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"
import type { GraphEntityKind } from "@/lib/types/graph"

export type EntityNodeData = {
  kind: GraphEntityKind
  label: string
}

// One accent for every kind — the kind is read from the header label, not a colour.
const HANDLE = {
  width: 7,
  height: 7,
  background: "var(--accent, #c8f135)",
  border: "1px solid var(--background, #0a0a0a)",
}

export function EntityNode({ data, selected }: NodeProps<Node<EntityNodeData>>) {
  return (
    <div
      style={{
        minWidth: 150,
        background: "var(--surface, #222)",
        border: `1px solid ${selected ? "var(--accent, #c8f135)" : "var(--border, #2e2e2e)"}`,
        borderRadius: 8,
        fontFamily: "'Share Tech Mono', monospace",
        boxShadow: selected ? "0 0 0 1px var(--accent, #c8f135), 0 0 14px rgba(200,241,53,0.18)" : "none",
        transition: "box-shadow 0.15s ease, border-color 0.15s ease",
      }}
    >
      <Handle type="target" position={Position.Left} style={HANDLE} />

      <div
        style={{
          fontSize: 9,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--accent, #c8f135)",
          padding: "4px 8px",
          borderBottom: "1px solid var(--border, #2e2e2e)",
        }}
      >
        {data.kind}
      </div>

      <div
        style={{
          padding: "7px 8px",
          fontSize: 12,
          color: "var(--foreground, #e8e8e8)",
          maxWidth: 200,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {data.label}
      </div>

      <Handle type="source" position={Position.Right} style={HANDLE} />
    </div>
  )
}
