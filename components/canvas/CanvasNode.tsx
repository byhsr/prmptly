import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { CanvasNodeType } from "@/lib/types/canvas.types";

type CanvasNodeData = {
  type: CanvasNodeType;
  label: string;
  detail?: string;
};

const TYPE_STYLES: Record<CanvasNodeType, { label: string; accent: string }> = {
  agent: { label: "AGENT", accent: "#c8f135" },
  action: { label: "ACTION", accent: "#5fd0ff" },
  condition: { label: "CONDITION", accent: "#ff9d5f" },
  note: { label: "NOTE", accent: "#7a7a7a" },
};

export function CanvasNode({
  data,
  selected,
}: NodeProps<Node<CanvasNodeData>>) {
  const style = TYPE_STYLES[data.type];

  return (
    <div
      style={{
        background: "#0d0d0d",
        border: `1px solid ${selected ? style.accent : "#2a2a2a"}`,
        borderRadius: 0,
        minWidth: 180,
        fontFamily: "'Share Tech Mono', monospace",
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: style.accent, borderRadius: 0 }}
      />

      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.08em",
          color: style.accent,
          padding: "4px 8px",
          borderBottom: "1px solid #2a2a2a",
        }}
      >
        {style.label}
      </div>

      <div
        style={{
          padding: "8px",
          color: "#e8e8e8",
          fontSize: 13,
        }}
      >
        {data.label}
      </div>

      {data.detail && (
        <div
          style={{
            padding: "0 8px 8px",
            color: "#8a8a8a",
            fontSize: 11,
          }}
        >
          {data.detail}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: style.accent, borderRadius: 0 }}
      />
    </div>
  );
}