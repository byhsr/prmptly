import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { CanvasNodeType } from "@/lib/types/canvas.types";
import type { CanvasNodeConfig } from "@/lib/types/canvas.types";

type CanvasNodeData = {
  type: CanvasNodeType;
  label: string;
  detail?: string;
  config?: CanvasNodeConfig;
};

const ACCENT = "var(--accent, #c8f135)";

export function CanvasNode({
  data,
  selected,
}: NodeProps<Node<CanvasNodeData>>) {
  return (
    <div
      style={{
        background: "var(--surface, #222)",
        border: `1px solid ${selected ? ACCENT : "var(--border, #2e2e2e)"}`,
        borderRadius: 0,
        minWidth: 180,
        fontFamily: "'Share Tech Mono', monospace",
        boxShadow: selected ? "0 0 0 1px var(--accent, #c8f135), 0 0 14px rgba(200,241,53,0.2)" : "none",
        transition: "box-shadow 0.15s ease, border-color 0.15s ease",
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: ACCENT, borderRadius: 0 }}
      />

      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.08em",
          color: ACCENT,
          padding: "4px 8px",
          borderBottom: "1px solid var(--border, #2e2e2e)",
        }}
      >
        {data.type.toUpperCase()}
      </div>

      <div
        style={{
          padding: "8px",
          color: "var(--foreground, #e8e8e8)",
          fontSize: 13,
        }}
      >
        {data.label}
      </div>

      {data.detail && (
        <div
          style={{
            padding: "0 8px 8px",
            color: "var(--muted, #8a8a8a)",
            fontSize: 11,
          }}
        >
          {data.detail.length > 100 ? data.detail.slice(0, 100) + "…" : data.detail}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: ACCENT, borderRadius: 0 }}
      />
    </div>
  );
}
