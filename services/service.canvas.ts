import { getDB } from "@/lib/db"
import { buildPath, dirs, getCanvasDocPath } from "@/lib/fs/fsHelpers"
import { deleteFolder, ensureDirectory, readFile, writeFile, pathExists } from "@/lib/fs/fs"
import { CanvasDocument, emptyCanvasDocument } from "@/lib/types/canvasDoc"

export interface CanvasMeta {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

interface CanvasRow {
  id: string
  name: string
  meta_json: string
  created_at: string
  updated_at: string
}

function mapRow(row: CanvasRow): CanvasMeta {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function ensureCanvasDir() {
  await ensureDirectory(await buildPath(dirs.canvases))
}

export const canvasService = {
  async list(): Promise<CanvasMeta[]> {
    const db = getDB()
    const rows = await db.select<CanvasRow[]>(
      "SELECT * FROM canvases ORDER BY updated_at DESC"
    )
    return rows.map(mapRow)
  },

  async get(id: string): Promise<CanvasMeta | null> {
    const db = getDB()
    const rows = await db.select<CanvasRow[]>("SELECT * FROM canvases WHERE id = ?", [id])
    return rows[0] ? mapRow(rows[0]) : null
  },

  async create(name: string): Promise<CanvasMeta> {
    const db = getDB()
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    await db.execute(
      `INSERT INTO canvases (id, name, meta_json, created_at, updated_at)
       VALUES (?, ?, '{}', ?, ?)`,
      [id, name, now, now]
    )

    await ensureCanvasDir()
    await writeFile(
      await getCanvasDocPath(id),
      JSON.stringify(emptyCanvasDocument(name), null, 2)
    )

    return { id, name, createdAt: now, updatedAt: now }
  },

  async rename(id: string, name: string): Promise<void> {
    const db = getDB()
    await db.execute("UPDATE canvases SET name = ?, updated_at = ? WHERE id = ?", [
      name,
      new Date().toISOString(),
      id,
    ])
  },

  async remove(id: string): Promise<void> {
    const db = getDB()
    await db.execute("DELETE FROM canvases WHERE id = ?", [id])
    try {
      const path = await getCanvasDocPath(id)
      if (await pathExists(path)) await deleteFolder(path)
    } catch {
      /* the file may already be gone */
    }
  },

  // The document is opaque here — whatever ark last exported.
  async read(id: string): Promise<CanvasDocument> {
    try {
      const path = await getCanvasDocPath(id)
      if (!(await pathExists(path))) return emptyCanvasDocument("")
      const parsed = JSON.parse(await readFile(path))
      return (parsed ?? {}) as CanvasDocument
    } catch {
      return emptyCanvasDocument("")
    }
  },

  async write(id: string, doc: CanvasDocument): Promise<void> {
    await ensureCanvasDir()
    await writeFile(await getCanvasDocPath(id), JSON.stringify(doc, null, 2))

    const db = getDB()
    await db.execute("UPDATE canvases SET updated_at = ? WHERE id = ?", [
      new Date().toISOString(),
      id,
    ])
  },
}
