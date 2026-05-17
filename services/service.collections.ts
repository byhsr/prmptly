import { getDB } from "../lib/db"

export type CollectionRow = {
  id: string
  name: string
  parent_id: string | null
}

export type PromptRow = {
  id: string
  name: string
  collection_id: string | null
}

export type CollectionNode = {
  id: string
  name: string
  children: CollectionNode[]
  prompts: PromptRow[]
}

export type CollectionTree = {
  tree: CollectionNode[]
  rootPrompts: PromptRow[]
}

export async function createCollection(
  name: string,
  parent_id: string | null = null
): Promise<{ id: string }> {
  const db = await getDB()

  if (!name.trim()) throw new Error("Collection name required")

  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  await db.execute(
    `INSERT INTO collections (id, name, parent_id, created_at) VALUES (?, ?, ?, ?)`,
    [id, name, parent_id, now]
  )

  return { id }
}

export async function renameCollection(id: string, name: string): Promise<void> {
  const db = await getDB()

  if (!name.trim()) throw new Error("Collection name required")

  await db.execute(
    `UPDATE collections SET name = ? WHERE id = ?`,
    [name, id]
  )
}

export async function deleteCollection(id: string): Promise<void> {
  const db = await getDB()
  await db.execute(`DELETE FROM collections WHERE id = ?`, [id])
  // CASCADE handles nested children, SET NULL floats prompts to root
}

export async function getCollectionsTree(): Promise<CollectionTree> {
  const db = await getDB()

  const collections = await db.select(
    `SELECT id, name, parent_id FROM collections`
  ) as CollectionRow[]

  const prompts = await db.select(
    `SELECT id, name, collection_id FROM prompts`
  ) as PromptRow[]

  const collectionMap = new Map<string | null, CollectionRow[]>()
  for (const col of collections) {
    const key = col.parent_id ?? null
    if (!collectionMap.has(key)) collectionMap.set(key, [])
    collectionMap.get(key)!.push(col)
  }

  const promptMap = new Map<string | null, PromptRow[]>()
  for (const p of prompts) {
    const key = p.collection_id ?? null
    if (!promptMap.has(key)) promptMap.set(key, [])
    promptMap.get(key)!.push(p)
  }

  function build(parentId: string | null): CollectionNode[] {
    return (collectionMap.get(parentId) || []).map((col) => ({
      id: col.id,
      name: col.name,
      children: build(col.id),
      prompts: promptMap.get(col.id) || [],
    }))
  }

  return {
    tree: build(null),
    rootPrompts: promptMap.get(null) || [],
  }
}