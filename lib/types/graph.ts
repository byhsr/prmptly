// The vault graph: entities are always derived from the live tables, so a node id is
// "<kind>:<id>" — prefixed so ids can't collide across tables.

export type GraphEntityKind = "quick" | "prompt" | "template" | "skill" | "snippet" | "canvas"

export interface GraphEntity {
  nodeId: string
  kind: GraphEntityKind
  /** the underlying row's id (for snippets, the "<scope>:<key>" pair) */
  ref: string
  label: string
}

export interface GraphEdge {
  id: string
  sourceId: string
  targetId: string
  label: string | null
  createdAt: string
}

export interface GraphPoint {
  x: number
  y: number
}
