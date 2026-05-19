import { FileTab } from "../promptly/file-tab"
import { Tab } from "../promptly/Tabbar"

export function HomeView() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      <div className="text-center">
        <p
          style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: 22,
            fontWeight: 700,
            color: "var(--color-foreground, #fff)",
            letterSpacing: "-0.5px",
          }}
        >
          What are you building today?
        </p>
        <p
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 12,
            color: "var(--color-muted, #666)",
            marginTop: 6,
          }}
        >
          @p: prompts &nbsp;·&nbsp; /t: templates &nbsp;·&nbsp; /f: files
        </p>
      </div>

      {/* Smart bar shell — wire up later */}
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          background: "var(--color-surface, #111)",
          border: "0.5px solid var(--color-border, #2a2a2a)",
          borderRadius: 14,
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <textarea
          rows={1}
          placeholder="Try: @p:cold-email or /f:brief.pdf..."
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            resize: "none",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 13,
            color: "var(--color-foreground, #fff)",
          }}
        />
        <button
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: "#c8f135",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            color: "#0a0a0a",
            flexShrink: 0,
          }}
        >
          ↗
        </button>
      </div>
    </div>
  )
}

export function PromptView({ tab }: { tab: Tab }) {

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 flex items-center justify-center">
        <FileTab tab={tab} />
      </div>
    </div>
  )
}
