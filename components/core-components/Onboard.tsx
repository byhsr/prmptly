import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";

import {
  ensureDirectory,
  setupWorkspace,
  writeConfig,
} from "@/lib/fs/fs";

export default function Onboarding({
  onDone,
}: {
  onDone: (workspaceRoot: string, workspaceName?: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSelectFolder() {
    try {
      setLoading(true);
      setError(null);

      const selected = await open({
        directory: true,
        multiple: false,
      });

      if (!selected || Array.isArray(selected)) return;

      const workspaceName = "default";

      await ensureDirectory(selected);

      await writeConfig({
        onboarded: true,
        workspaceRoot: selected,
        activeWorkspace: workspaceName,
        workspaces: [
          {
            id: workspaceName,
            name: "Default",
            path: `${selected}/${workspaceName}`,
            createdAt: new Date().toISOString(),
          },
        ],
      });

      await setupWorkspace(`${selected}/${workspaceName}`);

      onDone(selected, workspaceName);
    } catch (err) {
      console.error("Workspace setup failed:", err);
      setError("Failed to create workspace.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-screen flex items-center justify-center bg">
      <div className="w-[400px] space-y-6 rounded-2xl border border-border/40 bg-surface p-8 backdrop-blur-sm">
        <div className="space-y-1">
          <p className="text-[8px] font-mono uppercase tracking-[0.2em] text-muted-foreground/60">
            System / Init
          </p>

          <h2 className="text-base font-medium tracking-tight">
            Get Started
          </h2>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Select a folder where Promptly will store your workspaces.
        </p>

        <button
          onClick={handleSelectFolder}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-accent/80 p-2.5 font-mono text-sm tracking-wide text-black transition-all duration-150 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Creating Workspace..." : "Select Folder"}
        </button>

        {error && (
          <p className="border-l border-red-400/40 pl-3 font-mono text-[11px] text-red-400/80">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}