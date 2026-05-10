import { Sparkle } from "lucide-react";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { readConfig, writeConfig } from "@/lib/fs/fs";
import { appDataDir } from "@tauri-apps/api/path";

type Stage = "idle" | "downloading" | "ready" | "error";

export default function ContextSetupGate({ onReady }: { onReady?: () => void }) {
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [statusLabel, setStatusLabel] = useState("");

  const startSetup = async () => {
    setStage("downloading");
    let unlisten: (() => void) | null = null;

    unlisten = await listen("model-progress", (event) => {
      const payload = event.payload as string;

      if (payload === "downloading") {
        setStatusLabel("downloading NomicEmbedTextV1.5");
        setProgress(10);
      } else if (payload === "loading") {
        setStatusLabel("loading model into memory");
        setProgress(60);
      } else if (payload === "ready") {
        setStatusLabel("ready");
        setProgress(100);
        unlisten?.();
        setTimeout(async () => {
          // mark model as downloaded in config
          const config = await readConfig();
          if (config) await writeConfig({ ...config, has_model: true });
          setStage("ready");
          onReady?.();
        }, 400);
      }
    });

    try {
      const modelPath = await appDataDir();
      await invoke("setup_embeddings", { modelPath });
    } catch (e) {
      console.error("Model setup failed:", e);
      unlisten?.();
      setStage("error");
    }
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: 400, padding: "3rem 2rem",
    }}>
      {/* Icon */}
      <div style={{
        width: 56, height: 56, borderRadius: 14,
        border: stage === "ready" ? "1.5px solid rgba(200,255,0,0.3)" : "1.5px solid #2a2a2a",
        display: "flex", alignItems: "center",
        justifyContent: "center", marginBottom: 24, position: "relative",
      }}>
        {stage !== "ready" && (
          <div style={{
            position: "absolute", inset: -4, borderRadius: 18,
            border: "1px solid #c8ff00", opacity: 0,
            animation: "pulse 2.4s ease-out infinite",
          }} />
        )}
        <Sparkle className="text-accent" />
      </div>

      {/* Title */}
      <p style={{ fontSize: 15, fontWeight: 500, color: "#f0f0f0", marginBottom: 8, textAlign: "center" }}>
        {stage === "idle" && "Context needs a Brain"}
        {stage === "downloading" && "initializing model..."}
        {stage === "ready" && "model ready"}
      </p>

      {/* Description */}
      <p style={{ fontSize: 12, color: "#666", textAlign: "center", lineHeight: 1.7, maxWidth: 340, marginBottom: 28 }}>
        {stage === "idle" && <>
          The <code style={{ color: "#c8ff00", background: "rgba(200,255,0,0.07)", padding: "1px 5px", borderRadius: 4 }}>Context</code> tab
          uses a local model to organize your data, so you can build better context for your prompts, everything stays on your device.
        </>}
        {stage === "downloading" && <>
          Fetching <code style={{ color: "#c8ff00", background: "rgba(200,255,0,0.07)", padding: "1px 5px", borderRadius: 4 }}>NomicEmbedTextV1.5</code> — this only happens once. Future launches are instant.
        </>}
        {stage === "ready" && "Your context engine is initialized. Paste your first document to get started."}
      </p>

      {/* CTA Button */}
      {stage === "idle" && (
        <button onClick={startSetup} style={{
          background: "#c8ff00", color: "#0f0f0f", border: "none", borderRadius: 8,
          padding: "10px 22px", fontFamily: "inherit", fontSize: 12, fontWeight: 600,
          letterSpacing: "0.02em", cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
        }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#0f0f0f" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          initialize model
        </button>
      )}

      {stage === "ready" && (
        <button style={{
          background: "#c8ff00", color: "#0f0f0f", border: "none", borderRadius: 8,
          padding: "10px 22px", fontFamily: "inherit", fontSize: 12, fontWeight: 600,
          letterSpacing: "0.02em", cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
        }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#0f0f0f" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          add first document
        </button>
      )}

      {/* Progress bar */}
      {stage === "downloading" && (
        <>
          <div style={{ width: 280, height: 2, background: "#2a2a2a", borderRadius: 2, overflow: "hidden", marginTop: 20 }}>
            <div style={{ height: "100%", background: "#c8ff00", width: `${progress}%`, transition: "width 0.3s ease", borderRadius: 2 }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#c8ff00", animation: "blink 1s ease-in-out infinite" }} />
            <span style={{ fontSize: 11, color: "#666" }}>{statusLabel}</span>
          </div>
        </>
      )}

      {/* Footer hint */}
      {stage === "idle" && (
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 24 }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#2a2a2a" }} />
          <span style={{ fontSize: 11, color: "#555" }}>~80mb · one-time download · local only</span>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#2a2a2a" }} />
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0% { opacity: 0.5; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.18); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
      `}</style>
    </div>
  );
}