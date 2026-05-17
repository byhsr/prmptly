import Database from "@tauri-apps/plugin-sql";
import { join } from "@tauri-apps/api/path"
import { invoke } from "@tauri-apps/api/core";

let db: Database;
export type DB = typeof db
// ── Migrations ────────────────────────────────────────────────────────────────
// Add new migrations to the END of this array only. Never edit existing ones.
const MIGRATIONS: { id: number; sql: string }[] = [
  {
    id: 1,
    sql: `
    -- ── Library ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);



-- ── Templates ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_system INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

-- ── Template Sections ──────────────────────────────
CREATE TABLE IF NOT EXISTS template_sections (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  placeholder TEXT,
  order_index INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

-- ── Outputs ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS outputs (
  id TEXT PRIMARY KEY,
  text TEXT,
  json TEXT,
  xml TEXT,
  created_at TEXT NOT NULL
);

-- ── Prompts (container) ────────────────────────────
CREATE TABLE IF NOT EXISTS prompts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  template_id TEXT REFERENCES templates(id) ON DELETE SET NULL,
  collection_id TEXT REFERENCES collections(id) ON DELETE SET NULL,
  current_version_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ── Prompt Versions ────────────────────────────────
CREATE TABLE IF NOT EXISTS prompt_versions (
  id TEXT PRIMARY KEY,
  prompt_id TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  label TEXT,
  builder_content TEXT, -- JSON [{ sectionId, order, value }]
  scratchpad_text_path TEXT,
  scratchpad_flow_path TEXT,
  output_id TEXT REFERENCES outputs(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);
-- ── Assets mapping ─────────────────────────────────

CREATE TABLE IF NOT EXISTS prompt_assets (
  prompt_id TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES library_assets(id) ON DELETE CASCADE,
  PRIMARY KEY (prompt_id, asset_id)
);

-- ── Collections (folders with nesting) ─────────────

CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES collections(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);


-- ── Quick runs ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS quick_runs (
  id TEXT PRIMARY KEY,
  raw_input TEXT NOT NULL,
  output_id TEXT REFERENCES outputs(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);



-- ── library ─────────────────────────────────────

CREATE TABLE namespaces (
  prefix TEXT PRIMARY KEY,   -- "persona", "project"
  source TEXT CHECK(source IN ('deterministic','rag')) NOT NULL
);

 CREATE TABLE IF NOT EXISTS deterministic_assets(
 
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  
);

-- ── Rag sources will go here when needed
CREATE TABLE scopes (
  name TEXT PRIMARY KEY,
  status TEXT CHECK(status IN ('active','archived')) DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  scope_name TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (scope_name) REFERENCES scopes(name)
);

CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  position INTEGER NOT NULL,  -- chunk order
  FOREIGN KEY (document_id) REFERENCES documents(id)
);

CREATE TABLE node_versions (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding BLOB,
  is_latest BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (node_id) REFERENCES nodes(id)
);

CREATE VIRTUAL TABLE fts_index USING fts5(
  content,
  node_version_id UNINDEXED,
  scope_id UNINDEXED
);
`

  },
  // migration 2 goes here when needed
];

async function runMigrations(db: Database) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const applied = await db.select<{ id: number }[]>("SELECT id FROM migrations");
  const done = new Set(applied.map((m) => m.id));

  for (const migration of MIGRATIONS) {
    if (done.has(migration.id)) continue;

    await db.execute("BEGIN");

    try {
      await db.execute(migration.sql);

      await db.execute(
        "INSERT INTO migrations (id, applied_at) VALUES (?, ?)",
        [migration.id, new Date().toISOString()]
      );

      await db.execute("COMMIT");
    } catch (e) {
      await db.execute("ROLLBACK");
      throw e;
    }
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
export async function initDB(basePath: string) {
  if (db) return db

  const dbPath = await join(basePath, "app.db")

  db = await Database.load(`sqlite:${dbPath}?mode=rwc`)
  await db.execute("PRAGMA journal_mode=WAL")
  await db.execute("PRAGMA busy_timeout=5000")

  await runMigrations(db)
  await invoke("setup_vec_table", { dbPath })
  return db
}

export function getDB() {
  if (!db) throw new Error("DB not initialized — call initDB() first");
  return db;
}

export async function runTransaction<T>(
  db: any,
  fn: (db: any) => Promise<T>
): Promise<T> {
  await db.execute("BEGIN")

  try {
    const result = await fn(db)
    await db.execute("COMMIT")
    return result
  } catch (err) {
    await db.execute("ROLLBACK").catch(() => { })
    throw err
  }
}

export async function getSetting(key: string) {
  const db = getDB()

  const rows = await db.select<{ value: string }[]>(
    `SELECT value FROM app_settings WHERE key = ?`,
    [key]
  )

  return rows[0]?.value ?? null
}

export async function setSetting(key: string, value: string) {
  const db = getDB()

  await db.execute(
    `INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)`,
    [key, value]
  )
}

export async function getAppBasePath() {
  const basePath = await getSetting("base_path")
  return { basePath }
}