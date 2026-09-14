// ── Canvas Node Types ───────────────────────────────

export type CanvasNodeType =
  | "agent"       // e.g. "email agent"
  | "action"      // e.g. "read data"
  | "condition"   // e.g. "if X"
  | "note";       // freeform text, no logic

// ── Type-specific configs ────────────────────────────

export type AgentConfig = { model?: string; systemPrompt?: string };
export type ActionConfig = { actionType?: string; params?: Record<string, string> };
export type ConditionConfig = {
  operator?: "equals" | "contains" | "gt" | "lt" | "exists";
  field?: string;
  value?: string;
};

export type CanvasNodeConfig =
  | ({ type: "agent" } & AgentConfig)
  | ({ type: "action" } & ActionConfig)
  | ({ type: "condition" } & ConditionConfig)
  | { type: "note"; content?: string };

export interface CanvasNode {
  id: string;
  type: CanvasNodeType;
  label: string;
  detail?: string;
  config?: CanvasNodeConfig;
  position: { x: number; y: number };
}

export const TYPE_LABELS: Record<CanvasNodeType, string> = {
  agent: "AGENT",
  action: "ACTION",
  condition: "CONDITION",
  note: "NOTE",
};

export const TYPE_ACCENTS: Record<CanvasNodeType, string> = {
  agent: "#c8f135",
  action: "#5fd0ff",
  condition: "#ff9d5f",
  note: "#7a7a7a",
};

export interface CanvasProps {
  initialFlow: CanvasFlow;
  onChange: (flow: CanvasFlow) => void;
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface CanvasFlow {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}
