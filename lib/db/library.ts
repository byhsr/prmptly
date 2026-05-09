import {getDB}  from "./index.ts"
import { Snippet } from "../types/library.ts"

type RawSnippet = { key: string; value: string; created_at: string; updated_at: string }

export const createSnippet = async (
  scope: string | undefined,
  key: string,
  value: string
) => {
  const db = await getDB()
  const fullKey = scope ? `${scope}:${key}` : key

  const existing = await db.select<{ key: string }[]>(
    "SELECT key FROM deterministic_assets WHERE key = $1",
    [fullKey]
  )

  if (existing.length > 0) {
    throw new Error("Snippet key already exists")
  }

  await db.execute(
    "INSERT INTO deterministic_assets (key, value) VALUES ($1, $2)",
    [fullKey, value]
  )
}

export const updateSnippet = async (
  prevKey: string,
  scope: string | undefined,
  key: string,
  value: string
) => {
  const db = await getDB()
  const newFullKey = scope ? `${scope}:${key}` : key

  if (prevKey !== newFullKey) {
    const existing = await db.select<{ key: string }[]>(
      "SELECT key FROM deterministic_assets WHERE key = $1",
      [newFullKey]
    )
    if (existing.length > 0) {
      throw new Error("Snippet key already exists")
    }
  }

  await db.execute(
    "UPDATE deterministic_assets SET key = $1, value = $2 WHERE key = $3",
    [newFullKey, value, prevKey]
  )
}
export const upsertSnippet = async (scope: string | undefined, key: string, value: string) => {
  const db = await getDB()
  const fullKey = scope ? `${scope}:${key}` : key
  await db.execute(
    "INSERT OR REPLACE INTO deterministic_assets (key, value) VALUES ($1, $2)",
    [fullKey, value]
  )
}



const normalize = (row: RawSnippet): Snippet => {
  const [scope, ...rest] = row.key.includes(":") ? row.key.split(":") : [undefined, row.key]
  return {
    key: rest.length ? rest.join(":") : scope!,
    scope: rest.length ? scope : undefined,
    value: row.value,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
export const getSnippets = async (): Promise<Snippet[]> => {
  const db = getDB()
  const rows = await db.select<RawSnippet[]>(
    "SELECT key, value, created_at, updated_at FROM deterministic_assets ORDER BY created_at DESC"
  )
  return rows.map(normalize)
}
