import { join } from "@tauri-apps/api/path";

export const dirs = {
  promptly: ".prmptly",
  documents: "documents",
  templates: "templates",
  assets: "assets",
  library: "library",
  skills: "skills",
  canvases: "canvases",
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

// ── Documents ─────────────────────────────────────

export const getDocumentDir = (id: string) =>
  buildPath("documents", id);

export const getScratchpadPath = (id: string) =>
  buildPath("documents", id, "scratchpad.md");

export const getCanvasPath = (id: string) =>
  buildPath("documents", id, "scratchpad.flow.json");

export const getOutputPath = (id: string) =>
  buildPath("documents", id, "output.json");

// ── Templates ─────────────────────────────────────

export const getTemplateDir = (id: string) =>
  buildPath("templates", id);

// ── Assets ────────────────────────────────────────

export const getAssetDir = (id: string) =>
  buildPath("assets", id);

// ── Skills ────────────────────────────────────────

export const getSkillDir = (id: string) =>
  buildPath("skills", id);

export const getSkillFile = (id: string) =>
  buildPath("skills", id, "SKILL.md");

// ── Canvases (ark flow documents) ─────────────────

export const getCanvasDocPath = (id: string) =>
  buildPath("canvases", `${id}.json`);