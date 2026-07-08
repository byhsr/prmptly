import {getDB }from "./index";

// ── Types ──────────────────────────────────────────

export interface CollectionRow {
  id: string;
  name: string;
  parent_id: string | null;
  meta_json: string;
  created_at: string;
  updated_at: string;
}

export interface Collection {
  id: string;
  name: string;
  parentId: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCollectionInput {
  name: string;
  parentId?: string | null;
  meta?: Record<string, unknown>;
}

export interface UpdateCollectionInput {
  name?: string;
  parentId?: string | null;
  meta?: Record<string, unknown>;
}

// ── Mapper ─────────────────────────────────────────

function mapRow(row: CollectionRow): Collection {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    meta: row.meta_json ? JSON.parse(row.meta_json) : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Create ─────────────────────────────────────────

export async function createCollection(input: CreateCollectionInput): Promise<Collection> {
  const db = getDB();

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  if (input.parentId) {
    const parent = await getCollection(input.parentId);
    if (!parent) throw new Error("Parent collection not found");
  }

  await db.execute(
    `INSERT INTO collections (id, name, parent_id, meta_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.name, input.parentId ?? null, JSON.stringify(input.meta ?? {}), now, now]
  );

  const collection = await getCollection(id);
  if (!collection) throw new Error("Failed to create collection");
  return collection;
}

// ── Read ───────────────────────────────────────────

export async function getCollection(id: string): Promise<Collection | null> {
  const db = getDB();

  const rows = await db.select<CollectionRow[]>(
    `SELECT * FROM collections WHERE id = ?`,
    [id]
  );

  return rows[0] ? mapRow(rows[0]) : null;
}

export async function listCollections(parentId?: string | null): Promise<Collection[]> {
  const db = getDB();

  if (parentId === undefined) {
    const rows = await db.select<CollectionRow[]>(
      `SELECT * FROM collections ORDER BY name ASC`
    );
    return rows.map(mapRow);
  }

  const rows = await db.select<CollectionRow[]>(
    parentId === null
      ? `SELECT * FROM collections WHERE parent_id IS NULL ORDER BY name ASC`
      : `SELECT * FROM collections WHERE parent_id = ? ORDER BY name ASC`,
    parentId === null ? [] : [parentId]
  );

  return rows.map(mapRow);
}

// tree of all collections, useful for sidebar rendering
export interface CollectionNode extends Collection {
  children: CollectionNode[];
}

export async function getCollectionTree(): Promise<CollectionNode[]> {
  const all = await listCollections();

  const byId = new Map<string, CollectionNode>(
    all.map((c) => [c.id, { ...c, children: [] }])
  );

  const roots: CollectionNode[] = [];

  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// ── Update ─────────────────────────────────────────

export async function updateCollection(
  id: string,
  input: UpdateCollectionInput
): Promise<Collection> {
  const db = getDB();

  if (input.parentId) {
    if (input.parentId === id) {
      throw new Error("Collection cannot be its own parent");
    }
    const wouldCycle = await isDescendant(input.parentId, id);
    if (wouldCycle) {
      throw new Error("Cannot move a collection into its own descendant");
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
  if (input.meta !== undefined) {
    sets.push("meta_json = ?");
    params.push(JSON.stringify(input.meta));
  }

  if (sets.length === 0) {
    const existing = await getCollection(id);
    if (!existing) throw new Error("Collection not found");
    return existing;
  }

  sets.push("updated_at = ?");
  params.push(new Date().toISOString());
  params.push(id);

  await db.execute(`UPDATE collections SET ${sets.join(", ")} WHERE id = ?`, params);

  const collection = await getCollection(id);
  if (!collection) throw new Error("Collection not found after update");
  return collection;
}

// checks if `candidateId` is a descendant of `ancestorId` — prevents cycles on move
async function isDescendant(candidateId: string, ancestorId: string): Promise<boolean> {
  let current = await getCollection(candidateId);
  while (current?.parentId) {
    if (current.parentId === ancestorId) return true;
    current = await getCollection(current.parentId);
  }
  return false;
}

// ── Delete ─────────────────────────────────────────

// deletes collection + all nested children + their documents (CASCADE handles children/docs)
export async function deleteCollection(id: string): Promise<void> {
  const db = getDB();
  await db.execute(`DELETE FROM collections WHERE id = ?`, [id]);
}

// move a collection's contents up a level, then delete just this collection (no cascade)
export async function deleteCollectionKeepContents(id: string): Promise<void> {
  const db = getDB();
  const collection = await getCollection(id);
  if (!collection) return;

  await db.execute(
    `UPDATE collections SET parent_id = ? WHERE parent_id = ?`,
    [collection.parentId, id]
  );
  await db.execute(
    `UPDATE documents SET collection_id = ? WHERE collection_id = ?`,
    [collection.parentId, id]
  );

  await db.execute(`DELETE FROM collections WHERE id = ?`, [id]);
}