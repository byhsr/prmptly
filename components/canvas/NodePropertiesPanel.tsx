import { useState, useEffect } from "react";
import { X, Trash2 } from "lucide-react";
import {
  CanvasNode,
  TYPE_LABELS,
  TYPE_ACCENTS,
  AgentConfig,
  ActionConfig,
  ConditionConfig,
} from "@/lib/types/canvas.types";

interface NodePropertiesPanelProps {
  node: CanvasNode;
  onUpdate: (updated: CanvasNode) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function NodePropertiesPanel({
  node,
  onUpdate,
  onDelete,
  onClose,
}: NodePropertiesPanelProps) {
  const [label, setLabel] = useState(node.label);
  const [detail, setDetail] = useState(node.detail || "");

  // Synced config fields for each type
  const [agentConfig, setAgentConfig] = useState<AgentConfig>(
    node.config?.type === "agent"
      ? { model: node.config.model, systemPrompt: node.config.systemPrompt }
      : {}
  );
  const [actionConfig, setActionConfig] = useState<ActionConfig>(
    node.config?.type === "action"
      ? { actionType: node.config.actionType, params: node.config.params }
      : {}
  );
  const [conditionConfig, setConditionConfig] = useState<ConditionConfig>(
    node.config?.type === "condition"
      ? {
          operator: node.config.operator,
          field: node.config.field,
          value: node.config.value,
        }
      : {}
  );

  // Sync when selected node changes
  useEffect(() => {
    setLabel(node.label);
    setDetail(node.detail || "");
    if (node.config?.type === "agent")
      setAgentConfig({ model: node.config.model, systemPrompt: node.config.systemPrompt });
    if (node.config?.type === "action")
      setActionConfig({ actionType: node.config.actionType, params: node.config.params });
    if (node.config?.type === "condition")
      setConditionConfig({
        operator: node.config.operator,
        field: node.config.field,
        value: node.config.value,
      });
  }, [node.id]);

  const accent = TYPE_ACCENTS[node.type];

  const models = ["claude-sonnet-4", "gpt-4o", "gemini-2.0", "deepseek-v3"];
  const conditionOperators = [
    { value: "equals", label: "Equals" },
    { value: "contains", label: "Contains" },
    { value: "gt", label: "Greater than" },
    { value: "lt", label: "Less than" },
    { value: "exists", label: "Exists" },
  ];

  return (
    <div
      style={{
        position: "absolute",
        right: 0,
        top: 0,
        bottom: 0,
        width: 240,
        background: "var(--surface, #222)",
        borderLeft: "1px solid var(--border, #2e2e2e)",
        zIndex: 20,
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Share Tech Mono', monospace",
      }}
      className="shadow-lg"
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 10px",
          borderBottom: "1px solid var(--border, #2e2e2e)",
        }}
      >
        <span style={{ fontSize: 10, letterSpacing: "0.08em", color: accent, fontWeight: 600 }}>
          {TYPE_LABELS[node.type]}
        </span>
        <button
          onClick={onClose}
          className="rounded p-1 text-muted hover:text-foreground hover:bg-background transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "10px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {/* Label */}
        <div>
          <label style={{ fontSize: 9, color: "var(--muted, #8a8a8a)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Label
          </label>
          <input
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              onUpdate({ ...node, label: e.target.value, config: node.config });
            }}
            style={{
              width: "100%",
              marginTop: 4,
              background: "var(--background, #181818)",
              border: "1px solid var(--border, #2e2e2e)",
              borderRadius: 0,
              padding: "5px 8px",
              color: "var(--foreground, #e8e8e8)",
              fontSize: 11,
              outline: "none",
              fontFamily: "'Share Tech Mono', monospace",
            }}
          />
        </div>

        {/* Description */}
        <div>
          <label style={{ fontSize: 9, color: "var(--muted, #8a8a8a)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Description
          </label>
          <textarea
            value={detail}
            onChange={(e) => {
              setDetail(e.target.value);
              onUpdate({ ...node, detail: e.target.value, config: node.config });
            }}
            rows={3}
            style={{
              width: "100%",
              marginTop: 4,
              background: "var(--background, #181818)",
              border: "1px solid var(--border, #2e2e2e)",
              borderRadius: 0,
              padding: "5px 8px",
              color: "var(--foreground, #e8e8e8)",
              fontSize: 10,
              outline: "none",
              resize: "vertical",
              fontFamily: "'Share Tech Mono', monospace",
            }}
          />
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "var(--border, #2e2e2e)" }} />

        {/* Type-specific config */}
        {node.type === "agent" && (
          <>
            <div>
              <label style={{ fontSize: 9, color: "var(--muted, #8a8a8a)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Model
              </label>
              <select
                value={agentConfig.model || ""}
                onChange={(e) => {
                  const next = { ...agentConfig, model: e.target.value || undefined };
                  setAgentConfig(next);
                  onUpdate({ ...node, config: { type: "agent" as const, ...next } });
                }}
                style={{
                  width: "100%",
                  marginTop: 4,
                  background: "var(--background, #181818)",
                  border: "1px solid var(--border, #2e2e2e)",
                  borderRadius: 0,
                  padding: "5px 8px",
                  color: "var(--foreground, #e8e8e8)",
                  fontSize: 10,
                  outline: "none",
                  fontFamily: "'Share Tech Mono', monospace",
                }}
              >
                <option value="">— None —</option>
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 9, color: "var(--muted, #8a8a8a)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                System Prompt
              </label>
              <textarea
                value={agentConfig.systemPrompt || ""}
                onChange={(e) => {
                  const next = { ...agentConfig, systemPrompt: e.target.value || undefined };
                  setAgentConfig(next);
                  onUpdate({ ...node, config: { type: "agent" as const, ...next } });
                }}
                rows={4}
                placeholder="You are an assistant that..."
                style={{
                  width: "100%",
                  marginTop: 4,
                  background: "var(--background, #181818)",
                  border: "1px solid var(--border, #2e2e2e)",
                  borderRadius: 0,
                  padding: "5px 8px",
                  color: "var(--foreground, #e8e8e8)",
                  fontSize: 10,
                  outline: "none",
                  resize: "vertical",
                  fontFamily: "'Share Tech Mono', monospace",
                }}
              />
            </div>
          </>
        )}

        {node.type === "action" && (
          <>
            <div>
              <label style={{ fontSize: 9, color: "var(--muted, #8a8a8a)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Action Type
              </label>
              <input
                value={actionConfig.actionType || ""}
                onChange={(e) => {
                  const next = { ...actionConfig, actionType: e.target.value || undefined };
                  setActionConfig(next);
                  onUpdate({ ...node, config: { type: "action" as const, ...next } });
                }}
                placeholder="e.g. read_file, call_api"
                style={{
                  width: "100%",
                  marginTop: 4,
                  background: "var(--background, #181818)",
                  border: "1px solid var(--border, #2e2e2e)",
                  borderRadius: 0,
                  padding: "5px 8px",
                  color: "var(--foreground, #e8e8e8)",
                  fontSize: 10,
                  outline: "none",
                  fontFamily: "'Share Tech Mono', monospace",
                }}
              />
            </div>

            <ActionParamsEditor
              params={actionConfig.params || {}}
              onChange={(params) => {
                const next = { ...actionConfig, params };
                setActionConfig(next);
                onUpdate({ ...node, config: { type: "action" as const, ...next } });
              }}
            />
          </>
        )}

        {node.type === "condition" && (
          <>
            <div>
              <label style={{ fontSize: 9, color: "var(--muted, #8a8a8a)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Operator
              </label>
              <select
                value={conditionConfig.operator || ""}
                onChange={(e) => {
                  const op = e.target.value as ConditionConfig["operator"] | "";
                  const next = { ...conditionConfig, operator: op || undefined };
                  setConditionConfig(next);
                  onUpdate({ ...node, config: { type: "condition" as const, ...next } });
                }}
                style={{
                  width: "100%",
                  marginTop: 4,
                  background: "var(--background, #181818)",
                  border: "1px solid var(--border, #2e2e2e)",
                  borderRadius: 0,
                  padding: "5px 8px",
                  color: "var(--foreground, #e8e8e8)",
                  fontSize: 10,
                  outline: "none",
                  fontFamily: "'Share Tech Mono', monospace",
                }}
              >
                <option value="">— Select —</option>
                {conditionOperators.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 9, color: "var(--muted, #8a8a8a)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Field
              </label>
              <input
                value={conditionConfig.field || ""}
                onChange={(e) => {
                  const next = { ...conditionConfig, field: e.target.value || undefined };
                  setConditionConfig(next);
                  onUpdate({ ...node, config: { type: "condition" as const, ...next } });
                }}
                placeholder="e.g. unread_count"
                style={{
                  width: "100%",
                  marginTop: 4,
                  background: "var(--background, #181818)",
                  border: "1px solid var(--border, #2e2e2e)",
                  borderRadius: 0,
                  padding: "5px 8px",
                  color: "var(--foreground, #e8e8e8)",
                  fontSize: 10,
                  outline: "none",
                  fontFamily: "'Share Tech Mono', monospace",
                }}
              />
            </div>

            {conditionConfig.operator && conditionConfig.operator !== "exists" && (
              <div>
                <label style={{ fontSize: 9, color: "var(--muted, #8a8a8a)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Value
                </label>
                <input
                  value={conditionConfig.value || ""}
                  onChange={(e) => {
                    const next = { ...conditionConfig, value: e.target.value || undefined };
                    setConditionConfig(next);
                    onUpdate({ ...node, config: { type: "condition" as const, ...next } });
                  }}
                  placeholder="comparison value"
                  style={{
                    width: "100%",
                    marginTop: 4,
                    background: "var(--background, #181818)",
                    border: "1px solid var(--border, #2e2e2e)",
                    borderRadius: 0,
                    padding: "5px 8px",
                    color: "var(--foreground, #e8e8e8)",
                    fontSize: 10,
                    outline: "none",
                    fontFamily: "'Share Tech Mono', monospace",
                  }}
                />
              </div>
            )}
          </>
        )}

        {node.type === "note" && (
          <p style={{ fontSize: 10, color: "var(--muted, #8a8a8a)", fontStyle: "italic" }}>
            Notes are freeform — use the description field above.
          </p>
        )}
      </div>

      {/* Footer: Delete */}
      <div
        style={{
          padding: "8px 10px",
          borderTop: "1px solid var(--border, #2e2e2e)",
        }}
      >
        <button
          onClick={() => onDelete(node.id)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            width: "100%",
            padding: "6px 8px",
            background: "transparent",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#ef4444",
            borderRadius: 0,
            fontSize: 10,
            fontFamily: "'Share Tech Mono', monospace",
            cursor: "pointer",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
          className="hover:bg-red-500/10 transition-colors"
        >
          <Trash2 className="h-3 w-3" />
          Delete Node
        </button>
      </div>
    </div>
  );
}

// ── Sub-component: Action params key/value editor ─────

function ActionParamsEditor({
  params,
  onChange,
}: {
  params: Record<string, string>;
  onChange: (params: Record<string, string>) => void;
}) {
  const entries = Object.entries(params);

  function setParam(key: string, value: string) {
    const next = { ...params, [key]: value };
    // Clean up empties
    Object.keys(next).forEach((k) => {
      if (!next[k]) delete next[k];
    });
    onChange(next);
  }

  function addParam() {
    onChange({ ...params, "": "" });
  }

  function removeParam(key: string) {
    const next = { ...params };
    delete next[key];
    onChange(next);
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <label style={{ fontSize: 9, color: "var(--muted, #8a8a8a)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Params
        </label>
        <button
          onClick={addParam}
          style={{
            fontSize: 10,
            color: "var(--accent, #c8f135)",
            background: "transparent",
            border: "1px solid var(--border, #2e2e2e)",
            borderRadius: 0,
            padding: "2px 6px",
            cursor: "pointer",
            fontFamily: "'Share Tech Mono', monospace",
          }}
          className="hover:opacity-80 transition-opacity"
        >
          + Add
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {entries.map(([key, val], i) => (
          <div key={i} style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input
              value={key}
              onChange={(e) => {
                const next = { ...params };
                delete next[key];
                next[e.target.value] = val || "";
                onChange(next);
              }}
              placeholder="key"
              style={{
                flex: 1,
                background: "var(--background, #181818)",
                border: "1px solid var(--border, #2e2e2e)",
                borderRadius: 0,
                padding: "4px 6px",
                color: "var(--foreground, #e8e8e8)",
                fontSize: 10,
                outline: "none",
                fontFamily: "'Share Tech Mono', monospace",
              }}
            />
            <input
              value={val}
              onChange={(e) => setParam(key, e.target.value)}
              placeholder="value"
              style={{
                flex: 1,
                background: "var(--background, #181818)",
                border: "1px solid var(--border, #2e2e2e)",
                borderRadius: 0,
                padding: "4px 6px",
                color: "var(--foreground, #e8e8e8)",
                fontSize: 10,
                outline: "none",
                fontFamily: "'Share Tech Mono', monospace",
              }}
            />
            <button
              onClick={() => removeParam(key)}
              className="text-muted hover:text-red-400 transition-colors"
              style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2 }}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
