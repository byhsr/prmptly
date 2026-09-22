import { create } from "zustand";
import { join } from "@tauri-apps/api/path";

import { pathExists, readConfig, setupWorkspace, writeConfig } from "@/lib/fs/fs";
import type { Workspace } from "@/lib/types/AppTypes";

type VaultState = {
  vaults: Workspace[];
  // Config also calls this `activeWorkspace`; it holds a vault id.
  activeId: string;
  loaded: boolean;
  /** true from the moment a swap starts until the reload takes over */
  switching: boolean;

  hydrate: () => Promise<void>;
  createVault: (name: string) => Promise<void>;
  switchVault: (id: string) => Promise<void>;
};

// Folder-safe form of a vault name, so the directory is readable rather than a uuid.
function slug(name: string) {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "vault"
  );
}

// Switching swaps which SQLite file is open, so the window is reloaded instead of trying to
// re-point every store at a different database mid-session. Wait for two frames first so the
// transition screen is actually painted before the webview navigates away.
function reopen() {
  requestAnimationFrame(() => requestAnimationFrame(() => window.location.reload()));
}

export const useVaultStore = create<VaultState>((set, get) => ({
  vaults: [],
  activeId: "",
  loaded: false,
  switching: false,

  hydrate: async () => {
    const config = await readConfig();
    set({
      vaults: config?.workspaces ?? [],
      activeId: config?.activeWorkspace ?? "",
      loaded: true,
    });
  },

  createVault: async (name) => {
    const config = await readConfig();
    if (!config?.workspaceRoot) throw new Error("No workspace root configured");

    const base = slug(name);
    let dir = base;
    let n = 2;
    while (await pathExists(await join(config.workspaceRoot, dir))) {
      dir = `${base}-${n++}`;
    }

    const path = await join(config.workspaceRoot, dir);
    await setupWorkspace(path);

    const vault: Workspace = {
      id: crypto.randomUUID(),
      name: name.trim() || dir,
      path,
      createdAt: new Date().toISOString(),
    };

    const vaults = [...(config.workspaces ?? []), vault];
    await writeConfig({ workspaces: vaults, activeWorkspace: vault.id });
    set({ vaults, activeId: vault.id, switching: true });
    reopen();
  },

  switchVault: async (id) => {
    if (id === get().activeId) return;
    await writeConfig({ activeWorkspace: id });
    set({ activeId: id, switching: true });
    reopen();
  },
}));
