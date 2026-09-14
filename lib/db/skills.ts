import { getDB } from "./index";
import {
  CreateSkillGroupInput,
  CreateSkillInput,
  Skill,
  SkillGroup,
  SkillGroupNode,
  SkillValue,
  UpdateSkillGroupInput,
  UpdateSkillInput,
} from "../types/skill";

// ── Rows ───────────────────────────────────────────

interface SkillRow {
  id: string;
  name: string;
  description: string | null;
  group_id: string | null;
  template_id: string | null;
  values_json: string;
  meta_json: string;
  created_at: string;
  updated_at: string;
}

interface SkillGroupRow {
  id: string;
  name: string;
  parent_id: string | null;
  order_index: number;
  meta_json: string;
  created_at: string;
  updated_at: string;
}

// ── Mappers ────────────────────────────────────────

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function mapSkillRow(row: SkillRow): Skill {
  const values = parseJson<unknown>(row.values_json, []);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    groupId: row.group_id,
    templateId: row.template_id,
    values: Array.isArray(values) ? (values as SkillValue[]) : [],
    meta: parseJson<Record<string, unknown>>(row.meta_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapGroupRow(row: SkillGroupRow): SkillGroup {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    orderIndex: row.order_index,
    meta: parseJson<Record<string, unknown>>(row.meta_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializeValues(values: SkillValue[] | undefined): string {
  return JSON.stringify(values ?? []);
}

// ── Skills ─────────────────────────────────────────

export const skillService = {
  async getAll(): Promise<Skill[]> {
    const db = getDB();
    const rows = await db.select<SkillRow[]>(
      `SELECT * FROM skills ORDER BY name ASC`
    );
    return rows.map(mapSkillRow);
  },

  async getByGroup(groupId: string | null): Promise<Skill[]> {
    const db = getDB();
    const rows = await db.select<SkillRow[]>(
      groupId === null
        ? `SELECT * FROM skills WHERE group_id IS NULL ORDER BY name ASC`
        : `SELECT * FROM skills WHERE group_id = ? ORDER BY name ASC`,
      groupId === null ? [] : [groupId]
    );
    return rows.map(mapSkillRow);
  },

  async get(id: string): Promise<Skill | null> {
    const db = getDB();
    const rows = await db.select<SkillRow[]>(
      `SELECT * FROM skills WHERE id = ?`,
      [id]
    );
    return rows[0] ? mapSkillRow(rows[0]) : null;
  },

  async create(input: CreateSkillInput): Promise<Skill> {
    const db = getDB();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    if (input.groupId) {
      const group = await skillGroupService.get(input.groupId);
      if (!group) throw new Error("Skill group not found");
    }

    await db.execute(
      `INSERT INTO skills (id, name, description, group_id, template_id, values_json, meta_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.name,
        input.description ?? null,
        input.groupId ?? null,
        input.templateId ?? null,
        serializeValues(input.values),
        JSON.stringify(input.meta ?? {}),
        now,
        now,
      ]
    );

    const skill = await this.get(id);
    if (!skill) throw new Error("Failed to create skill");
    return skill;
  },

  async update(id: string, input: UpdateSkillInput): Promise<Skill> {
    const db = getDB();

    if (input.groupId) {
      const group = await skillGroupService.get(input.groupId);
      if (!group) throw new Error("Skill group not found");
    }

    const sets: string[] = [];
    const params: unknown[] = [];

    if (input.name !== undefined) {
      sets.push("name = ?");
      params.push(input.name);
    }
    if (input.description !== undefined) {
      sets.push("description = ?");
      params.push(input.description);
    }
    if (input.groupId !== undefined) {
      sets.push("group_id = ?");
      params.push(input.groupId);
    }
    if (input.templateId !== undefined) {
      sets.push("template_id = ?");
      params.push(input.templateId);
    }
    if (input.values !== undefined) {
      sets.push("values_json = ?");
      params.push(serializeValues(input.values));
    }
    if (input.meta !== undefined) {
      sets.push("meta_json = ?");
      params.push(JSON.stringify(input.meta));
    }

    if (sets.length === 0) {
      const existing = await this.get(id);
      if (!existing) throw new Error("Skill not found");
      return existing;
    }

    sets.push("updated_at = ?");
    params.push(new Date().toISOString());
    params.push(id);

    await db.execute(`UPDATE skills SET ${sets.join(", ")} WHERE id = ?`, params);

    const skill = await this.get(id);
    if (!skill) throw new Error("Skill not found after update");
    return skill;
  },

  async delete(id: string): Promise<void> {
    const db = getDB();
    await db.execute(`DELETE FROM skills WHERE id = ?`, [id]);
  },
};

// ── Skill Groups ───────────────────────────────────

export const skillGroupService = {
  async getAll(): Promise<SkillGroup[]> {
    const db = getDB();
    const rows = await db.select<SkillGroupRow[]>(
      `SELECT * FROM skill_groups ORDER BY order_index ASC, name ASC`
    );
    return rows.map(mapGroupRow);
  },

  async get(id: string): Promise<SkillGroup | null> {
    const db = getDB();
    const rows = await db.select<SkillGroupRow[]>(
      `SELECT * FROM skill_groups WHERE id = ?`,
      [id]
    );
    return rows[0] ? mapGroupRow(rows[0]) : null;
  },

  async list(parentId?: string | null): Promise<SkillGroup[]> {
    const db = getDB();

    if (parentId === undefined) return this.getAll();

    const rows = await db.select<SkillGroupRow[]>(
      parentId === null
        ? `SELECT * FROM skill_groups WHERE parent_id IS NULL ORDER BY order_index ASC, name ASC`
        : `SELECT * FROM skill_groups WHERE parent_id = ? ORDER BY order_index ASC, name ASC`,
      parentId === null ? [] : [parentId]
    );
    return rows.map(mapGroupRow);
  },

  // nested tree of all groups with their directly-assigned skills
  async getTree(): Promise<SkillGroupNode[]> {
    const [groups, skills] = await Promise.all([
      this.getAll(),
      skillService.getAll(),
    ]);

    const byId = new Map<string, SkillGroupNode>(
      groups.map((g) => [g.id, { ...g, children: [], skills: [] }])
    );

    for (const skill of skills) {
      if (skill.groupId && byId.has(skill.groupId)) {
        byId.get(skill.groupId)!.skills.push(skill);
      }
    }

    const roots: SkillGroupNode[] = [];

    for (const node of byId.values()) {
      if (node.parentId && byId.has(node.parentId)) {
        byId.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  },

  async create(input: CreateSkillGroupInput): Promise<SkillGroup> {
    const db = getDB();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    if (input.parentId) {
      const parent = await this.get(input.parentId);
      if (!parent) throw new Error("Parent skill group not found");
    }

    await db.execute(
      `INSERT INTO skill_groups (id, name, parent_id, order_index, meta_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.name,
        input.parentId ?? null,
        input.orderIndex ?? 0,
        JSON.stringify(input.meta ?? {}),
        now,
        now,
      ]
    );

    const group = await this.get(id);
    if (!group) throw new Error("Failed to create skill group");
    return group;
  },

  async update(id: string, input: UpdateSkillGroupInput): Promise<SkillGroup> {
    const db = getDB();

    if (input.parentId) {
      if (input.parentId === id) {
        throw new Error("Skill group cannot be its own parent");
      }
      const wouldCycle = await isDescendant(input.parentId, id);
      if (wouldCycle) {
        throw new Error("Cannot move a skill group into its own descendant");
      }
    }

    const sets: string[] = [];
    const params: unknown[] = [];

    if (input.name !== undefined) {
      sets.push("name = ?");
      params.push(input.name);
    }
    if (input.parentId !== undefined) {
      sets.push("parent_id = ?");
      params.push(input.parentId);
    }
    if (input.orderIndex !== undefined) {
      sets.push("order_index = ?");
      params.push(input.orderIndex);
    }
    if (input.meta !== undefined) {
      sets.push("meta_json = ?");
      params.push(JSON.stringify(input.meta));
    }

    if (sets.length === 0) {
      const existing = await this.get(id);
      if (!existing) throw new Error("Skill group not found");
      return existing;
    }

    sets.push("updated_at = ?");
    params.push(new Date().toISOString());
    params.push(id);

    await db.execute(
      `UPDATE skill_groups SET ${sets.join(", ")} WHERE id = ?`,
      params
    );

    const group = await this.get(id);
    if (!group) throw new Error("Skill group not found after update");
    return group;
  },

  async delete(id: string): Promise<void> {
    const db = getDB();
    await db.execute(`DELETE FROM skill_groups WHERE id = ?`, [id]);
  },

  // move child groups + skills up a level, then delete just this group (no cascade)
  async deleteKeepContents(id: string): Promise<void> {
    const db = getDB();
    const group = await this.get(id);
    if (!group) return;

    await db.execute(
      `UPDATE skill_groups SET parent_id = ? WHERE parent_id = ?`,
      [group.parentId, id]
    );
    await db.execute(
      `UPDATE skills SET group_id = ? WHERE group_id = ?`,
      [group.parentId, id]
    );

    await db.execute(`DELETE FROM skill_groups WHERE id = ?`, [id]);
  },
};

// checks if `candidateId` is a descendant of `ancestorId` — prevents cycles on move
async function isDescendant(candidateId: string, ancestorId: string): Promise<boolean> {
  let current = await skillGroupService.get(candidateId);
  while (current?.parentId) {
    if (current.parentId === ancestorId) return true;
    current = await skillGroupService.get(current.parentId);
  }
  return false;
}
