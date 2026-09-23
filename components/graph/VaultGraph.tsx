import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { Share2 } from "lucide-react"
import { GlobNode, type GlobNodeData } from "./GlobNode"
import { DeletableEdge } from "./DeletableEdge"
import { buildVaultGraph } from "@/lib/graph/buildVaultGraph"
import { graphService } from "@/lib/db/graph"
import { hashColor } from "@/lib/graph/color"
import type { GraphEdge, GraphEntity } from "@/lib/types/graph"
import { useTabViewStore } from "@/hooks/store/TabStore"
import { useQuicksStore } from "@/hooks/store/quickStore"
import { useSkillStore } from "@/hooks/store/skillStore"
import { useTemplateStore } from "@/hooks/store/templateStore"
import { useCanvasStore } from "@/hooks/store/canvasStore"
import { getDocument } from "@/lib/db/document"

const nodeTypes = { entity: GlobNode }
const edgeTypes = { deletable: DeletableEdge }
const EDGE_STYLE = { stroke: "var(--border, #3a3a3a)" }

function toFlowEdge(edge: GraphEdge, onDelete: (id: string) => void): Edge {
  return {
    id: edge.id,
    source: edge.sourceId,
    target: edge.targetId,
    type: "deletable",
    data: { onDelete },
    style: EDGE_STYLE,
  }
}

function VaultGraphInner({ onClose }: { onClose: () => void }) {
  const [entities, setEntities] = useState<GraphEntity[]>([])
  const [loading, setLoading] = useState(true)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<GlobNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const entityByNodeId = useRef(new Map<string, GraphEntity>())
  const { getNodes } = useReactFlow()

  // Drops the link locally and in the DB. Used by the selected-edge delete button; the
  // keyboard path goes through ReactFlow's own `onEdgesDelete`.
  const handleDeleteEdge = useCallback(
    (id: string) => {
      setEdges((current) => current.filter((edge) => edge.id !== id))
      graphService.removeEdge(id).catch(() => {})
    },
    [setEdges]
  )

  // Nodes are derived from the vault's own tables, so only links are user state. Swallow
  // node removals rather than letting the delete keys drop a node until the next reload.
  const handleNodesChange = useCallback(
    (changes: NodeChange<Node<GlobNodeData>>[]) => {
      onNodesChange(changes.filter((change) => change.type !== "remove"))
    },
    [onNodesChange]
  )

  const load = useCallback(async () => {
    const data = await buildVaultGraph()
    entityByNodeId.current = new Map(data.entities.map((e) => [e.nodeId, e]))

    // Degree drives glob size, the way the library graph sizes its dots.
    const degree = new Map<string, number>()
    for (const edge of data.edges) {
      degree.set(edge.sourceId, (degree.get(edge.sourceId) ?? 0) + 1)
      degree.set(edge.targetId, (degree.get(edge.targetId) ?? 0) + 1)
    }

    setEntities(data.entities)
    setNodes(
      data.entities.map((entity) => ({
        id: entity.nodeId,
        type: "entity",
        position: data.positions.get(entity.nodeId) ?? { x: 0, y: 0 },
        data: {
          label: entity.label,
          color: hashColor(entity.kind),
          size: 16 + Math.min(degree.get(entity.nodeId) ?? 0, 6) * 3,
          connectable: true,
          labelMaxWidth: 200,
        },
      }))
    )
    setEdges(data.edges.map((edge) => toFlowEdge(edge, handleDeleteEdge)))
    setLoading(false)
  }, [setNodes, setEdges, handleDeleteEdge])

  // Only edges are re-read after a connect/delete — positions may be mid-drag and
  // aren't persisted until the drag stops.
  const refreshEdges = useCallback(async () => {
    const known = new Set(getNodes().map((n) => n.id))
    const stored = await graphService.getEdges()
    setEdges(
      stored
        .filter((e) => known.has(e.sourceId) && known.has(e.targetId))
        .map((edge) => toFlowEdge(edge, handleDeleteEdge))
    )
  }, [getNodes, setEdges, handleDeleteEdge])

  useEffect(() => {
    load()
  }, [load])

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return
      await graphService.addEdge(connection.source, connection.target)
      await refreshEdges()
    },
    [refreshEdges]
  )

  const onEdgesDelete = useCallback((deleted: Edge[]) => {
    for (const edge of deleted) graphService.removeEdge(edge.id).catch(() => {})
  }, [])

  const openEntity = useCallback(
    async (entity: GraphEntity) => {
      const tabView = useTabViewStore.getState()

      if (entity.kind === "quick" || entity.kind === "prompt") {
        if (entity.kind === "quick") {
          const full = await getDocument(entity.ref)
          if (!full) return
          useQuicksStore.getState().loadEntry({
            id: full.id,
            name: full.name,
            body: full.sections?.[0]?.value ?? "",
            output: null,
            createdAt: Date.now(),
          })
          tabView.setActiveView("home")
        } else {
          tabView.addTab({ id: entity.ref, label: entity.label, type: "prompt" })
          tabView.setActiveView("prompt")
        }
        onClose()
        return
      }

      const skillStore = useSkillStore.getState()
      const templateStore = useTemplateStore.getState()
      if (entity.kind === "canvas") {
        useCanvasStore.getState().selectCanvas(entity.ref)
        tabView.setActiveView("canvas")
        onClose()
        return
      }
      if (entity.kind === "template") {
        await templateStore.selectTemplate(entity.ref)
        skillStore.setLibraryTab("templates")
      } else if (entity.kind === "skill") {
        skillStore.selectSkill(entity.ref)
        skillStore.setLibraryTab("skills")
      } else {
        skillStore.setLibraryTab("snippets")
      }
      tabView.setActiveView("library")
      onClose()
    },
    [onClose]
  )

  const counts = useMemo(() => {
    const byKind = new Map<string, number>()
    for (const entity of entities) byKind.set(entity.kind, (byKind.get(entity.kind) ?? 0) + 1)
    return [...byKind.entries()]
  }, [entities])

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <span className="text-xs text-muted">loading the graph…</span>
      </div>
    )
  }

  if (entities.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4 text-muted">
        <Share2 style={{ width: 24, height: 24 }} strokeWidth={1} />
        <span style={{ fontSize: 12 }}>nothing to graph yet — make a quick, prompt or skill first</span>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full" style={{ background: "var(--background, #0a0a0a)" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgesDelete={onEdgesDelete}
        onNodeDragStop={(_, node) =>
          graphService.savePosition(node.id, node.position.x, node.position.y).catch(() => {})
        }
        onNodeDoubleClick={(_, node) => {
          const entity = entityByNodeId.current.get(node.id)
          if (entity) openEntity(entity)
        }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        deleteKeyCode={["Delete", "Backspace"]}
        fitView
        minZoom={0.15}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--border, #1a1a1a)" gap={20} />
        <Controls style={{ fill: "var(--accent, #c8f135)" }} />
      </ReactFlow>

      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] text-muted">
          {entities.length} nodes · {edges.length} links
        </span>
        {counts.map(([kind, count]) => (
          <span
            key={kind}
            className="flex items-center gap-1.5 rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[9px] text-muted"
          >
            <span
              style={{ width: 7, height: 7, borderRadius: "50%", background: hashColor(kind) }}
              aria-hidden="true"
            />
            {kind} {count}
          </span>
        ))}
      </div>
    </div>
  )
}

export function VaultGraph({ onClose }: { onClose: () => void }) {
  return (
    <ReactFlowProvider>
      <VaultGraphInner onClose={onClose} />
    </ReactFlowProvider>
  )
}
