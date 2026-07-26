import { getDB } from "./index";
import { claimNamespace } from "@/services/namespaces";
import { Snippet } from "../types/library";

interface DeterministicAssetRow {
  id: string;
  namespace: string;
  key: string;
  title: string | null;
  value: string;
  meta_json: string;
  created_at: string;
  updated_at: string;
}

function mapRow(row: DeterministicAssetRow): Snippet {
  return {
    key: row.key,
    value: row.value,
    scope: row.namespace,
  };
}

export const libraryService = {
  async create(namespace: string | undefined, key: string, value: string, title?: string): Promise<void> {
    const db = getDB();
    const ns = namespace ?? "__global__";
    const id = crypto.randomUUID();

    // Ensure namespace exists
    await claimNamespace(ns, "deterministic");

    const existing = await db.select<{ id: string }[]>(
      `SELECT id FROM deterministic_assets WHERE namespace = ? AND key = ?`,
      [ns, key]
    );

    if (existing.length > 0) {
      throw new Error(`Asset "${ns}:${key}" already exists`);
    }

    await db.execute(
      `INSERT INTO deterministic_assets (id, namespace, key, title, value, meta_json)
       VALUES (?, ?, ?, ?, ?, '{}')`,
      [id, ns, key, title ?? null, value]
    );
  },

  async update(oldNamespace: string | undefined, oldKey: string, newNamespace: string | undefined, newKey: string, value: string, title?: string): Promise<void> {
    const db = getDB();
    const oldNs = oldNamespace ?? "__global__";
    const newNs = newNamespace ?? "__global__";

    if (oldNs !== newNs || oldKey !== newKey) {
      const existing = await db.select<{ id: string }[]>(
        `SELECT id FROM deterministic_assets WHERE namespace = ? AND key = ?`,
        [newNs, newKey]
      );
      if (existing.length > 0) {
        throw new Error(`Asset "${newNs}:${newKey}" already exists`);
      }
    }

    await db.execute(
      `UPDATE deterministic_assets SET namespace = ?, key = ?, value = ?, title = ? WHERE namespace = ? AND key = ?`,
      [newNs, newKey, value, title ?? null, oldNs, oldKey]
    );
  },

  async upsert(namespace: string | undefined, key: string, value: string, title?: string): Promise<void> {
    const db = getDB();
    const ns = namespace ?? "__global__";

    await claimNamespace(ns, "deterministic");

    await db.execute(
      `INSERT INTO deterministic_assets (id, namespace, key, title, value, meta_json)
       VALUES (?, ?, ?, ?, ?, '{}')
       ON CONFLICT(namespace, key) DO UPDATE SET value = excluded.value, title = COALESCE(excluded.title, title), updated_at = CURRENT_TIMESTAMP`,
      [crypto.randomUUID(), ns, key, title ?? null, value]
    );
  },

  async getAll(): Promise<Snippet[]> {
    const db = getDB();
    const rows = await db.select<DeterministicAssetRow[]>(
      `SELECT * FROM deterministic_assets ORDER BY created_at DESC`
    );
    return rows.map(mapRow);
  },

  async getByNamespace(namespace: string): Promise<Snippet[]> {
    const db = getDB();
    const rows = await db.select<DeterministicAssetRow[]>(
      `SELECT * FROM deterministic_assets WHERE namespace = ? ORDER BY key ASC`,
      [namespace]
    );
    return rows.map(mapRow);
  },

  async delete(namespace: string, key: string): Promise<void> {
    const db = getDB();
    await db.execute(
      `DELETE FROM deterministic_assets WHERE namespace = ? AND key = ?`,
      [namespace, key]
    );
  },

  async deleteByKey(fullKey: string): Promise<void> {
    const db = getDB();
    await db.execute(`DELETE FROM deterministic_assets WHERE key = ?`, [fullKey]);
  },
};
