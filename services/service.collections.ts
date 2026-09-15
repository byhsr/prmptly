import { getDB } from "../lib/db"

// Which tree a folder belongs to. `collections` is shared by prompts and quicks, so every
// read has to say which one it wants — otherwise the two folder sets mix.
export type CollectionKind = "prompt" | "quick"

export type CollectionRow = {
  id: string
  name: string
  parent_id: string | null
}

export type DocumentRow = {
  id: string
  name: string
  collection_id: string | null
}

export type CollectionNode = {
  id: string
  name: string
  children: CollectionNode[]
  documents: DocumentRow[]
}

export type CollectionTree = {
  tree: CollectionNode[]
  rootDocuments: DocumentRow[]
}

export async function createCollection(
  name: string,
  parent_id: string | null = null,
  kind: CollectionKind = "prompt"
): Promise<{ id: string }> {
  const db = await getDB()

  if (!name.trim()) throw new Error("Collection name required")

  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  await db.execute(
    `INSERT INTO collections (id, name, parent_id, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, name, parent_id, kind, now, now]
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
  // CASCADE handles nested children, SET NULL floats documents to root
}

// Every folder id in the subtree rooted at `id`, including `id` itself.
export async function getCollectionSubtreeIds(id: string): Promise<string[]> {
  const db = await getDB()

  const rows = await db.select<{ id: string; parent_id: string | null }[]>(
    `SELECT id, parent_id FROM collections`
  )

  const ids = new Set<string>([id])
  let grew = true
  while (grew) {
    grew = false
    for (const row of rows) {
      if (row.parent_id && ids.has(row.parent_id) && !ids.has(row.id)) {
        ids.add(row.id)
        grew = true
      }
    }
  }

  return [...ids]
}

// Deletes a folder, every subfolder, and every document inside them. Returns the deleted
// document ids so the caller can clean up files on disk and any open tabs.
export async function deleteCollectionDeep(
  id: string,
  kind: CollectionKind = "prompt"
): Promise<string[]> {
  const db = await getDB()

  const folderIds = await getCollectionSubtreeIds(id)
  const placeholders = folderIds.map(() => "?").join(",")

  const docs = await db.select<{ id: string }[]>(
    `SELECT id FROM documents WHERE type = ? AND collection_id IN (${placeholders})`,
    [kind, ...folderIds]
  )

  await db.execute(
    `DELETE FROM documents WHERE type = ? AND collection_id IN (${placeholders})`,
    [kind, ...folderIds]
  )
  await db.execute(`DELETE FROM collections WHERE id = ?`, [id])

  return docs.map((d) => d.id)
}

export async function getCollectionsTree(kind: CollectionKind = "prompt"): Promise<CollectionTree> {
  const db = await getDB()

  const collections = await db.select<CollectionRow[]>(
    `SELECT id, name, parent_id FROM collections WHERE type = ? ORDER BY name ASC`,
    [kind]
  )

  const documents = await db.select<DocumentRow[]>(
    `SELECT id, name, collection_id FROM documents WHERE type = ? ORDER BY name ASC`,
    [kind]
  )

  const collectionMap = new Map<string | null, CollectionRow[]>()
  for (const col of collections) {
    const key = col.parent_id ?? null
    if (!collectionMap.has(key)) collectionMap.set(key, [])
    collectionMap.get(key)!.push(col)
  }

  const documentMap = new Map<string | null, DocumentRow[]>()
  for (const d of documents) {
    const key = d.collection_id ?? null
    if (!documentMap.has(key)) documentMap.set(key, [])
    documentMap.get(key)!.push(d)
  }

  function build(parentId: string | null): CollectionNode[] {
    return (collectionMap.get(parentId) || []).map((col) => ({
      id: col.id,
      name: col.name,
      children: build(col.id),
      documents: documentMap.get(col.id) || [],
    }))
  }

  return {
    tree: build(null),
    rootDocuments: documentMap.get(null) || [],
  }
}
