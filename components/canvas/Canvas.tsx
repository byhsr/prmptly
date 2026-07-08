import { useCallback, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Node,
  Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { CanvasNode } from "./CanvasNode";
import { CanvasFlow, CanvasNodeType , CanvasProps} from "@/lib/types/canvas.types";

const nodeTypes = { canvasNode: CanvasNode };

function toReactFlow(flow: CanvasFlow): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: flow.nodes.map((n) => ({
      id: n.id,
      type: "canvasNode",
      position: n.position,
      data: { type: n.type, label: n.label, detail: n.detail },
    })),
    edges: flow.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      style: { stroke: "#3a3a3a" },
      labelStyle: { fill: "#c8f135", fontFamily: "'Share Tech Mono', monospace", fontSize: 11 },
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



export function Canvas({ initialFlow, onChange }: CanvasProps) {
  const initial = toReactFlow(initialFlow);
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);

  const emitChange = useCallback(
    (n: Node[], e: Edge[]) => onChange(toCanvasFlow(n, e)),
    [onChange]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => {
        const next = addEdge(
          { ...connection, style: { stroke: "#3a3a3a" } },
          eds
        );
        emitChange(nodes, next);
        return next;
      });
    },
    [nodes, setEdges, emitChange]
  );

  function addNode(type: CanvasNodeType) {
    const id = crypto.randomUUID();
    const newNode: Node = {
      id,
      type: "canvasNode",
      position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 },
      data: { type, label: type === "agent" ? "New agent" : "New " + type },
    };
    const next = [...nodes, newNode];
    setNodes(next);
    emitChange(next, edges);
  }

  return (
    <div style={{ width: "100%", height: "100%", background: "#0a0a0a" }}>
      <div
        style={{
          position: "absolute",
          zIndex: 10,
          padding: 12,
          display: "flex",
          gap: 8,
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: 11,
        }}
      >
        {(["agent", "action", "condition", "note"] as CanvasNodeType[]).map((type) => (
          <button
            key={type}
            onClick={() => addNode(type)}
            style={{
              background: "#0d0d0d",
              border: "1px solid #2a2a2a",
              color: "#c8f135",
              borderRadius: 0,
              padding: "6px 10px",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            + {type}
          </button>
        ))}
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={(changes) => {
          onNodesChange(changes);
          emitChange(nodes, edges);
        }}
        onEdgesChange={(changes) => {
          onEdgesChange(changes);
          emitChange(nodes, edges);
        }}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background color="#1a1a1a" gap={20} />
        <Controls style={{ fill: "#c8f135" }} />
      </ReactFlow>
    </div>
  );
}