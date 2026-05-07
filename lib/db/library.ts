import {getDB}  from "./index.ts"

export const upsertSnippet = async (scope: string | undefined, key: string, value: string) => {
  const db = await getDB()
  const fullKey = scope ? `${scope}:${key}` : key
  await db.execute(
    "INSERT OR REPLACE INTO deterministic_assets (key, value) VALUES ($1, $2)",
    [fullKey, value]
  )
}


