import { useCallback, useState, useEffect, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Connection,
  type Node,
  type Edge,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { CanvasNode } from "./CanvasNode";
import { NodePalette } from "./NodePalette";
import { NodePropertiesPanel } from "./NodePropertiesPanel";
import {
  CanvasFlow,
  CanvasNodeType,
  CanvasNode as CanvasNodeDef,
  CanvasProps,
} from "@/lib/types/canvas.types";

const nodeTypes = { canvasNode: CanvasNode };

function toReactFlow(flow: CanvasFlow): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: flow.nodes.map((n) => ({
      id: n.id,
      type: "canvasNode",
      position: n.position,
      data: { type: n.type, label: n.label, detail: n.detail, config: n.config },
    })),
    edges: flow.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      style: { stroke: "var(--border, #3a3a3a)" },
      labelStyle: { fill: "var(--accent, #c8f135)", fontFamily: "'Share Tech Mono', monospace", fontSize: 11 },
    })),
  };
}

function toCanvasFlow(nodes: Node[], edges: Edge[]): CanvasFlow {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.data.type as CanvasNodeType,
      label: n.data.label as string,
      detail: n.data.detail as string | undefined,
      config: n.data.config as any,
      position: n.position,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label as string | undefined,
    })),
  };
}

function CanvasInner({ initialFlow, onChange }: CanvasProps) {
  const initial = toReactFlow(initialFlow);
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const [selectedNode, setSelectedNode] = useState<CanvasNodeDef | null>(null);
  const reactFlowInstance = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const emitChange = useCallback(
    (n: Node[], e: Edge[]) => onChange(toCanvasFlow(n, e)),
    [onChange]
  );

  // Sync internal state to parent (useEffect avoids stale closure in inline handlers)
  const initialDone = useRef(false);
  useEffect(() => {
    if (!initialDone.current) { initialDone.current = true; return; }
    emitChange(nodes, edges);
  }, [nodes, edges, emitChange]);

  // ── Connections ──
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          { ...connection, style: { stroke: "var(--border, #3a3a3a)" } },
          eds
        )
      );
    },
    [setEdges]
  );

  // ── Create a node at a given position ──
  const createNode = useCallback(
    (type: CanvasNodeType, x: number, y: number) => {
      const position = reactFlowInstance.screenToFlowPosition({ x, y });
      const id = crypto.randomUUID();
      const newNode: Node = {
        id,
        type: "canvasNode",
        position,
        data: { type, label: type === "agent" ? "New agent" : "New " + type, config: { type } },
      };
      setNodes((nds) => [...nds, newNode]);
      setSelectedNode(toCanvasNodeDef(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  // ── Drag & Drop via native DOM listeners on the wrapper ──
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const handleDragOver = (e: globalThis.DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = (e: globalThis.DragEvent) => {
      const type = e.dataTransfer?.getData("application/pr0mptly-node") as CanvasNodeType | undefined;
      if (!type) return;
      e.preventDefault();
      createNode(type, e.clientX, e.clientY);
    };

    el.addEventListener("dragover", handleDragOver);
    el.addEventListener("drop", handleDrop);
    return () => {
      el.removeEventListener("dragover", handleDragOver);
      el.removeEventListener("drop", handleDrop);
    };
  }, [createNode]);

  // ── Node click → select ──
  const onNodeClick = useCallback(
    (_e: React.MouseEvent, node: Node) => {
      setSelectedNode(toCanvasNodeDef(node));
    },
    []
  );

  // ── Empty canvas click → deselect ──
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // ── Node update from properties panel ──
  const handleNodeUpdate = useCallback(
    (updated: CanvasNodeDef) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === updated.id
            ? { ...n, data: { type: updated.type, label: updated.label, detail: updated.detail, config: updated.config } }
            : n
        )
      );
      setSelectedNode(updated);
    },
    [setNodes]
  );

  // ── Node delete from properties panel ──
  const handleNodeDelete = useCallback(
    (id: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setSelectedNode(null);
    },
    [setNodes]
  );

  // ── Drag start from palette ──
  const onPaletteDragStart = useCallback(
    (type: CanvasNodeType) => (e: globalThis.DragEvent) => {
      e.dataTransfer?.setData("application/pr0mptly-node", type);
      e.dataTransfer && (e.dataTransfer.effectAllowed = "move");
    },
    []
  );

  // ── Click to add from palette (fallback) ──
  const onPaletteClick = useCallback(
    (type: CanvasNodeType) => {
      createNode(type, window.innerWidth / 2, window.innerHeight / 3);
    },
    [createNode]
  );

  return (
    <div
      style={{ width: "100%", height: "100%", background: "var(--background, #0a0a0a)", position: "relative" }}
    >
      <NodePalette
        onDragStart={onPaletteDragStart}
        onClickAdd={onPaletteClick}
      />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background color="var(--border, #1a1a1a)" gap={20} />
        <Controls style={{ fill: "var(--accent, #c8f135)" }} />
      </ReactFlow>

      {selectedNode && (
        <NodePropertiesPanel
          node={selectedNode}
          onUpdate={handleNodeUpdate}
          onDelete={handleNodeDelete}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
}

function toCanvasNodeDef(n: Node): CanvasNodeDef {
  return {
    id: n.id,
    type: n.data.type as CanvasNodeType,
    label: n.data.label as string,
    detail: n.data.detail as string | undefined,
    config: n.data.config as any,
    position: n.position,
  };
}

export function Canvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
