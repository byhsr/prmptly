import { join } from "@tauri-apps/api/path";

export const dirs = {
  promptly: ".prmptly",
  prompts: "prompts",
  templates: "templates",
  scratchpads: "scratchpads",
  outputs: "outputs",
  assets: "assets",
  library: "library",
} as const;

let WORKSPACE: string | null = null;

export function initWorkspace(path: string) {
  WORKSPACE = path;
}

function workspace() {
  if (!WORKSPACE) {
    throw new Error("Workspace not initialized");
  }

  return WORKSPACE;
}

export async function getDir(key: keyof typeof dirs) {
  return join(workspace(), dirs[key]);
}

export async function buildPath(...parts: string[]) {
  return join(workspace(), ...parts);
}

export const getPromptDir = (id: string) =>
  buildPath("prompts", id);

export const getTemplateDir = (id: string) =>
  buildPath("templates", id);

export const getScratchpadDir = (id: string) =>
  buildPath("scratchpads", id);

export const getOutputDir = (id: string) =>
  buildPath("outputs", id);

export const getAssetDir = (id: string) =>
  buildPath("assets", id);