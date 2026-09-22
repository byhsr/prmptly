import { getDB } from "."
import type { GraphEdge, GraphPoint } from "@/lib/types/graph"

interface NodeRow {
  node_id: string
  x: number
  y: number
}

interface EdgeRow {
  id: string
  source_id: string
  target_id: string
  label: string | null
  created_at: string
}

export const graphService = {
  async getPositions(): Promise<Record<string, GraphPoint>> {
    const db = getDB()
    const rows = await db.select<NodeRow[]>("SELECT node_id, x, y FROM graph_nodes")

    const positions: Record<string, GraphPoint> = {}
    for (const row of rows) positions[row.node_id] = { x: row.x, y: row.y }
    return positions
  },

  async savePosition(nodeId: string, x: number, y: number): Promise<void> {
    const db = getDB()
    await db.execute(
      `INSERT OR REPLACE INTO graph_nodes (node_id, x, y, updated_at) VALUES (?, ?, ?, ?)`,
      [nodeId, x, y, new Date().toISOString()]
    )
  },

  async getEdges(): Promise<GraphEdge[]> {
    const db = getDB()
    const rows = await db.select<EdgeRow[]>(
      "SELECT * FROM graph_edges ORDER BY created_at ASC"
    )
    return rows.map((row) => ({
      id: row.id,
      sourceId: row.source_id,
      targetId: row.target_id,
      label: row.label,
      createdAt: row.created_at,
    }))
  },

  async addEdge(sourceId: string, targetId: string, label: string | null = null): Promise<void> {
    if (!sourceId || !targetId || sourceId === targetId) return

    const db = getDB()
    // UNIQUE(source_id, target_id) makes re-connecting the same pair a no-op.
    await db.execute(
      `INSERT OR IGNORE INTO graph_edges (id, source_id, target_id, label, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), sourceId, targetId, label, new Date().toISOString()]
    )
  },

  async removeEdge(id: string): Promise<void> {
    const db = getDB()
    await db.execute("DELETE FROM graph_edges WHERE id = ?", [id])
  },
}
