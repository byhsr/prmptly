// ── Canvas Node Types ───────────────────────────────

export type CanvasNodeType =
  | "agent"       // e.g. "email agent"
  | "action"      // e.g. "read data"
  | "condition"   // e.g. "if X"
  | "note";       // freeform text, no logic

export interface CanvasNode {
  id: string;
  type: CanvasNodeType;
  label: string;              // "Read Data", "If unread > 5"
  detail?: string;             // optional longer text/instructions
  position: { x: number; y: number };
}


export interface CanvasProps {
  initialFlow: CanvasFlow;
  onChange: (flow: CanvasFlow) => void;
}


export interface CanvasEdge {
  id: string;
  source: string;              // node id
  target: string;              // node id
  label?: string;               // e.g. "true" / "false" / "else"
}

export interface CanvasFlow {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}