import { listDocuments } from "@/lib/db/document"
import { templateService } from "@/lib/db/template"
import { skillService } from "@/lib/db/skills"
import { libraryService } from "@/lib/db/library"
import { canvasService } from "@/services/service.canvas"
import { graphService } from "@/lib/db/graph"
import { forceLayout } from "@/lib/graph/force"
import type { GraphEdge, GraphEntity, GraphPoint } from "@/lib/types/graph"

export interface VaultGraphData {
  entities: GraphEntity[]
  /** only edges whose endpoints still exist */
  edges: GraphEdge[]
  positions: Map<string, GraphPoint>
}

// Nodes are derived from the live tables every time — nothing is duplicated into the
// graph tables. Only edges and positions are user state.
export async function buildVaultGraph(): Promise<VaultGraphData> {
  const [documents, templates, skills, snippets, allEdges, stored] = await Promise.all([
    listDocuments(),
    templateService.getAll(),
    skillService.getAll(),
    libraryService.getAll(),
    graphService.getEdges(),
    graphService.getPositions(),
  ])

  const entities: GraphEntity[] = [
    ...documents.map((doc) => ({
      nodeId: `${doc.type}:${doc.id}`,
      kind: doc.type,
      ref: doc.id,
      label: doc.name || "Untitled",
    })),
    ...templates.map((template) => ({
      nodeId: `template:${template.id}`,
      kind: "template" as const,
      ref: template.id,
      label: template.name,
    })),
    ...skills.map((skill) => ({
      nodeId: `skill:${skill.id}`,
      kind: "skill" as const,
      ref: skill.id,
      label: skill.name,
    })),
    // snippets are keyed by namespace+key, not by a row id
    ...snippets.map((snippet) => {
      const scope = snippet.scope ?? "__global__"
      return {
        nodeId: `snippet:${scope}:${snippet.key}`,
        kind: "snippet" as const,
        ref: `${scope}:${snippet.key}`,
        label: snippet.key,
      }
    }),
  ]

  const known = new Set(entities.map((e) => e.nodeId))
  const edges = allEdges.filter((e) => known.has(e.sourceId) && known.has(e.targetId))

  // Seed a sensible layout, then let saved positions win.
  const forced = forceLayout(
    entities.map((e) => ({ id: e.nodeId })),
    edges.map((e) => ({ source: e.sourceId, target: e.targetId }))
  )

  const positions = new Map<string, GraphPoint>()
  for (const entity of entities) {
    positions.set(entity.nodeId, stored[entity.nodeId] ?? forced.get(entity.nodeId) ?? { x: 0, y: 0 })
  }

  return { entities, edges, positions }
}
