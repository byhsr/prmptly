// ark's document shape (see public/ark/FLOW_FORMAT.md). prmptly only round-trips it —
// ark owns the semantics, we own the file it lives in.

export interface CanvasFlowDoc {
  id: string
  name: string
  view?: { x: number; y: number; k: number }
  nodes: unknown[]
  edges: unknown[]
}

export interface CanvasDocument {
  version: number
  title: string
  rootId: string
  flows: Record<string, CanvasFlowDoc>
}

export function emptyCanvasDocument(title: string): CanvasDocument {
  return {
    version: 1,
    title,
    rootId: "flow_main",
    flows: {
      flow_main: { id: "flow_main", name: "Main flow", nodes: [], edges: [] },
    },
  }
}
