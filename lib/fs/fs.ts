import {
  mkdir,
  writeTextFile,
  readTextFile,
  remove,
  exists,
  readDir,
} from "@tauri-apps/plugin-fs";

import { appDataDir, join } from "@tauri-apps/api/path";

import { AppConfig } from "../types/AppTypes";

export const WORKSPACE_DIRS = [
  ".prmptly",
  "prompts",
  "templates",
  "scratchpads",
  "outputs",
  "assets",
  "library",
] as const;

async function getConfigPath() {
  return join(await appDataDir(), "config.json");
}

export async function ensureDirectory(path: string) {
  await mkdir(path, {
    recursive: true,
  });
}

export async function setupWorkspace(workspacePath: string) {
  await Promise.all(
    WORKSPACE_DIRS.map(async (dir) =>
      ensureDirectory(await join(workspacePath, dir))
    )
  );
}

export async function createFolder(path: string) {
  await ensureDirectory(path);
}

export async function createFile(filePath: string, content = "") {
  await writeTextFile(filePath, content);
}

export async function readFile(filePath: string) {
  return readTextFile(filePath);
}

export async function deleteFolder(path: string) {
  await remove(path, {
    recursive: true,
  });
}

export async function pathExists(path: string) {
  return exists(path);
}

export async function listDirectory(path: string) {
  return readDir(path);
}

export async function readConfig(): Promise<AppConfig | null> {
  try {
    const configPath = await getConfigPath();

    if (!(await exists(configPath))) {
      return null;
    }

    const content = await readTextFile(configPath);
    return JSON.parse(content);
  } catch (err) {
    console.error("Failed to read config:", err);
    return null;
  }
}

export async function writeConfig(
  update: Partial<AppConfig>
): Promise<void> {
  const configPath = await getConfigPath();

  await ensureDirectory(await appDataDir());

  const existing = (await readConfig()) ?? ({} as AppConfig);

  const config: AppConfig = {
    ...existing,
    ...update,
  };

  await writeTextFile(
    configPath,
    JSON.stringify(config, null, 2)
  );
}