import { skillService } from "@/lib/db/skills";
import { libraryService } from "@/lib/db/library";
import { templateService } from "@/lib/db/template";
import { CreateSkillInput, Skill, SkillMarkdown } from "@/lib/types/skill";
import {
  deleteFolder,
  ensureDirectory,
  pathExists,
  readFile,
  writeFile,
} from "@/lib/fs/fs";
import { getSkillDir, getSkillFile } from "@/lib/fs/fsHelpers";

// ── SKILL.md serialization ─────────────────────────

export function serializeSkillMarkdown(skill: SkillMarkdown): string {
  const lines = ["---", `name: ${skill.name}`];
  if (skill.description) lines.push(`description: ${skill.description}`);
  lines.push("---", "", skill.body ?? "");
  return lines.join("\n");
}

export function parseSkillMarkdown(text: string, fallbackName = "Untitled Skill"): SkillMarkdown {
  const normalized = text.replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?/);

  if (!match) {
    return { name: fallbackName, description: "", body: normalized };
  }

  const frontmatter = match[1];
  const body = normalized.slice(match[0].length);

  let name = fallbackName;
  let description = "";

  for (const line of frontmatter.split("\n")) {
    const sep = line.indexOf(":");
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim().toLowerCase();
    const value = line.slice(sep + 1).trim();
    if (key === "name") name = value || name;
    if (key === "description") description = value;
  }

  return { name, description, body };
}

// ── Compile: template + library key/value pairs ────

// Seeds a skill body from a template's sections (blueprint → markdown skeleton)
export async function templateToMarkdown(templateId: string): Promise<string> {
  const sections = await templateService.getSections(templateId);
  return sections
    .map((s) => `## ${s.title}`)
    .join("\n\n");
}

// Resolves {{key}} tokens from the skill's own values, then from library snippets
export async function compileSkill(skill: Skill, body: string): Promise<string> {
  const map = new Map<string, string>();

  for (const snippet of await libraryService.getAll()) {
    map.set(snippet.key, snippet.value);
  }
  for (const { key, value } of skill.values) {
    if (key) map.set(key, value);
  }

  return body.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (whole, key: string) =>
    map.has(key) ? map.get(key)! : whole
  );
}

// ── Persistence ────────────────────────────────────

export const skillFileService = {
  async read(id: string): Promise<string> {
    const path = await getSkillFile(id);
    if (!(await pathExists(path))) return "";
    return readFile(path).catch(() => "");
  },

  async write(id: string, markdown: SkillMarkdown): Promise<void> {
    await ensureDirectory(await getSkillDir(id));
    await writeFile(await getSkillFile(id), serializeSkillMarkdown(markdown));
  },
};

export const skillServiceWithFiles = {
  async create(input: CreateSkillInput, body = ""): Promise<Skill> {
    const skill = await skillService.create(input);
    await skillFileService.write(skill.id, {
      name: skill.name,
      description: skill.description ?? "",
      body,
    });
    return skill;
  },

  async read(id: string): Promise<{ skill: Skill; body: string } | null> {
    const skill = await skillService.get(id);
    if (!skill) return null;
    return { skill, body: await skillFileService.read(id) };
  },

  async save(
    id: string,
    patch: Parameters<typeof skillService.update>[1],
    body?: string
  ): Promise<Skill> {
    const skill = await skillService.update(id, patch);
    if (body !== undefined) {
      await skillFileService.write(id, {
        name: skill.name,
        description: skill.description ?? "",
        body,
      });
    }
    return skill;
  },

  async remove(id: string): Promise<void> {
    await skillService.delete(id);
    if (await pathExists(await getSkillDir(id))) {
      await deleteFolder(await getSkillDir(id));
    }
  },

  async export(id: string): Promise<string> {
    const found = await this.read(id);
    if (!found) throw new Error(`Skill "${id}" not found`);
    const compiled = await compileSkill(found.skill, found.body);
    return serializeSkillMarkdown({
      name: found.skill.name,
      description: found.skill.description ?? "",
      body: compiled,
    });
  },

  async import(
    markdown: string,
    groupId: string | null = null,
    fallbackName?: string
  ): Promise<Skill> {
    const parsed = parseSkillMarkdown(markdown, fallbackName);
    return this.create(
      { name: parsed.name, description: parsed.description || null, groupId },
      parsed.body
    );
  },
};
