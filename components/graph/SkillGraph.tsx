import { useEffect, useMemo, useState } from "react"
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  useNodesState,
  useReactFlow,
  type Node,
  type Edge,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { Workflow } from "lucide-react"
import { GlobNode, type GlobNodeData } from "./GlobNode"
import { useSkillStore } from "@/hooks/store/skillStore"
import { Skill, SkillGroupNode } from "@/lib/types/skill"
import { forceLayout } from "@/lib/graph/force"
import { hashColor } from "@/lib/graph/color"

const nodeTypes = { skill: GlobNode }
const EDGE_STYLE = { stroke: "var(--border, #3a3a3a)" }

function collectSkills(node: SkillGroupNode): Skill[] {
  return [...node.skills, ...node.children.flatMap(collectSkills)]
}

function findGroup(tree: SkillGroupNode[], id: string): SkillGroupNode | null {
  for (const node of tree) {
    if (node.id === id) return node
    const found = findGroup(node.children, id)
    if (found) return found
  }
  return null
}

// Links: skills sharing a group
function buildEdges(skills: Skill[]): Edge[] {
  const edges = new Map<string, Edge>()

  const addPair = (a: string, b: string) => {
    const key = a < b ? `${a}|${b}` : `${b}|${a}`
    if (edges.has(key)) return
    edges.set(key, { id: key, source: a, target: b, type: "straight", style: EDGE_STYLE })
  }

  const link = (buckets: Map<string, Skill[]>) => {
    for (const bucket of buckets.values()) {
      for (let i = 0; i < bucket.length; i++) {
        for (let j = i + 1; j < bucket.length; j++) {
          addPair(bucket[i].id, bucket[j].id)
        }
      }
    }
  }

  const byGroup = new Map<string, Skill[]>()

  for (const skill of skills) {
    if (skill.groupId) {
      byGroup.set(skill.groupId, [...(byGroup.get(skill.groupId) ?? []), skill])
    }
  }

  link(byGroup)

  return [...edges.values()]
}

function buildGraph(
  tree: SkillGroupNode[],
  allSkills: Skill[],
  scopeId: string | null
): { nodes: Node<GlobNodeData>[]; edges: Edge[]; signature: string } {
  const scoped = scopeId ? findGroup(tree, scopeId) : null
  const skills = scoped ? collectSkills(scoped) : allSkills

  const signature = `${scopeId ?? "global"}:${skills.map((s) => s.id).sort().join(",")}`

  if (skills.length === 0) return { nodes: [], edges: [], signature }

  const edges = buildEdges(skills)

  const degree = new Map<string, number>()
  for (const edge of edges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1)
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1)
  }

  const positions = forceLayout(
    skills.map((s) => ({ id: s.id })),
    edges.map((e) => ({ source: e.source, target: e.target }))
  )

  const nodes: Node<GlobNodeData>[] = skills.map((skill) => ({
    id: skill.id,
    type: "skill",
    position: positions.get(skill.id) ?? { x: 0, y: 0 },
    data: {
      label: skill.name,
      color: hashColor(skill.groupId),
      size: 14 + Math.min(degree.get(skill.id) ?? 0, 5) * 3,
    },
  }))

  return { nodes, edges, signature }
}

function SkillGraphInner() {
  const tree = useSkillStore((s) => s.tree)
  const skills = useSkillStore((s) => s.skills)
  const scopeId = useSkillStore((s) => s.graphScopeId)
  const selectSkill = useSkillStore((s) => s.selectSkill)
  const setLibraryTab = useSkillStore((s) => s.setLibraryTab)

  const computed = useMemo(() => buildGraph(tree, skills, scopeId), [tree, skills, scopeId])
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<GlobNodeData>>(computed.nodes)
  const [seeded, setSeeded] = useState(computed.signature)
  const { fitView } = useReactFlow()

  // Re-seed positions when the visible node set changes, then re-fit
  useEffect(() => {
    if (seeded === computed.signature) return
    setSeeded(computed.signature)
    setNodes(computed.nodes)
    setTimeout(() => fitView({ padding: 0.25, duration: 300 }), 0)
  }, [computed, seeded, setNodes, fitView])

  if (computed.nodes.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4 text-muted">
        <Workflow style={{ width: 24, height: 24 }} strokeWidth={1} />
        <span style={{ fontSize: 12 }}>nothing to graph yet</span>
      </div>
    )
  }

  return (
    <div style={{ width: "100%", height: "100%", background: "var(--background, #0a0a0a)" }}>
      <ReactFlow
        nodes={nodes}
        edges={computed.edges}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.2}
        proOptions={{ hideAttribution: true }}
        onNodeDoubleClick={(_, node) => {
          selectSkill(node.id)
          setLibraryTab("skills")
        }}
      >
        <Background color="var(--border, #1a1a1a)" gap={20} />
        <Controls style={{ fill: "var(--accent, #c8f135)" }} />
      </ReactFlow>
    </div>
  )
}

export function SkillGraph() {
  return (
    <ReactFlowProvider>
      <SkillGraphInner />
    </ReactFlowProvider>
  )
}
