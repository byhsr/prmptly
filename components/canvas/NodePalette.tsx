import { useRef } from "react";
import { CanvasNodeType, TYPE_LABELS } from "@/lib/types/canvas.types";

interface NodePaletteProps {
  onDragStart: (type: CanvasNodeType) => (e: globalThis.DragEvent) => void;
  onClickAdd: (type: CanvasNodeType) => void;
}

const NODE_TYPES: CanvasNodeType[] = ["agent", "action", "condition", "note"];

export function NodePalette({ onDragStart, onClickAdd }: NodePaletteProps) {
  // Track whether a drag actually started to suppress click on dragover
  const dragStarted = useRef(false);

  return (
    <div
      style={{
        position: "absolute",
        zIndex: 10,
        padding: 8,
        display: "flex",
        gap: 4,
      }}
    >
      {NODE_TYPES.map((type) => (
        <div key={type} className="relative group">
          <div
            draggable
            onDragStart={(e) => {
              dragStarted.current = true;
              // Pass the native event
              onDragStart(type)(e.nativeEvent);
            }}
            onDragEnd={() => {
              dragStarted.current = false;
            }}
            onPointerDown={() => {
              dragStarted.current = false;
            }}
            onClick={(e) => {
              if (dragStarted.current) return;
              e.stopPropagation();
              onClickAdd(type);
            }}
            style={{
              background: "var(--surface, #222)",
              border: "1px solid var(--border, #2e2e2e)",
              color: "var(--accent, #c8f135)",
              borderRadius: 0,
              padding: "5px 10px",
              cursor: "grab",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontSize: 10,
              fontFamily: "'Share Tech Mono', monospace",
              userSelect: "none",
            }}
            className="hover:opacity-80 transition-opacity active:cursor-grabbing"
          >
            + {TYPE_LABELS[type]}
          </div>
          <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] px-1.5 py-0.5 rounded bg-surface border border-border text-muted whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[999]">
            Click or drag to canvas
          </span>
        </div>
      ))}
    </div>
  );
}
