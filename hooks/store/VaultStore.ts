import { create } from "zustand";
import { join } from "@tauri-apps/api/path";

import {
  readConfig,
  writeConfig,
  setupWorkspace,
} from "@/lib/fs/fs";

export type Workspace = {
  id: string;
  name: string;
  path: string;
  createdAt: string;
};

type WorkspaceState = {
  workspaces: Workspace[];
  activeWorkspace: string;

  hydrate: () => Promise<void>;

  createWorkspace: (
    name: string,
    workspaceRoot: string
  ) => Promise<void>;

  switchWorkspace: (id: string) => Promise<void>;
};

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  activeWorkspace: "",

  hydrate: async () => {
    const config = await readConfig();

    set({
      workspaces: config?.workspaces ?? [],
      activeWorkspace: config?.activeWorkspace ?? "",
    });
  },

  createWorkspace: async (name, workspaceRoot) => {
    const id = crypto.randomUUID();

    const workspacePath = await join(workspaceRoot, id);

    await setupWorkspace(workspacePath);

    const workspace: Workspace = {
      id,
      name,
      path: workspacePath,
      createdAt: new Date().toISOString(),
    };

    const workspaces = [...get().workspaces, workspace];

    set({ workspaces });

    await writeConfig({
      workspaces,
    });
  },

  switchWorkspace: async (id) => {
    set({
      activeWorkspace: id,
    });

    await writeConfig({
      activeWorkspace: id,
    });
  },
}));