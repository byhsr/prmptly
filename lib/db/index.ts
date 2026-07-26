import Database from "@tauri-apps/plugin-sql";
import { join } from "@tauri-apps/api/path"

export type DB = typeof db
let db: Database | null = null;
let currentWorkspacePath: string | null = null;

// ── Migrations ────────────────────────────────────────────────────────────────
// Add new migrations to the END of this array only. Never edit existing ones.
const MIGRATIONS: { id: number; sql: string }[] = [
  {
    id: 1,
    sql: `-- ── App Settings ───────────────────────────────────

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
  meta_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS template_sections (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_json TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  meta_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_template_sections_template_id
  ON template_sections(template_id);

-- ── Outputs ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS outputs (
  id TEXT PRIMARY KEY,
  text TEXT,
  json TEXT,
  xml TEXT,
  meta_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ── Collections ────────────────────────────────────

CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES collections(id) ON DELETE CASCADE,
  meta_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_collections_parent_id
  ON collections(parent_id);

-- ── Documents (Prompt + Quicks, standalone) ────────

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,

  type TEXT NOT NULL CHECK(type IN ('quick','prompt')),

  name TEXT NOT NULL,

  template_id TEXT REFERENCES templates(id) ON DELETE SET NULL,
  collection_id TEXT REFERENCES collections(id) ON DELETE SET NULL,

  sections_json TEXT NOT NULL,

  scratchpad_text_path TEXT,
  scratchpad_flow_path TEXT,

  output_id TEXT REFERENCES outputs(id) ON DELETE SET NULL,

  meta_json TEXT NOT NULL DEFAULT '{}',

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_template_id ON documents(template_id);
CREATE INDEX IF NOT EXISTS idx_documents_collection_id ON documents(collection_id);
CREATE INDEX IF NOT EXISTS idx_documents_output_id ON documents(output_id);

-- ── Context Assets ─────────────────────────────────

CREATE TABLE IF NOT EXISTS document_assets (
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES deterministic_assets(id) ON DELETE CASCADE,
  PRIMARY KEY (document_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_document_assets_asset_id
  ON document_assets(asset_id);

-- ── Library Namespaces ─────────────────────────────

CREATE TABLE IF NOT EXISTS namespaces (
  prefix TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'deterministic',
  meta_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  section_id TEXT NOT NULL,
  anchor_from INTEGER NOT NULL,
  anchor_to INTEGER NOT NULL,
  quoted_text TEXT NOT NULL,
  body TEXT NOT NULL,
  resolved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_document ON comments(document_id, section_id);

-- ── Deterministic Assets ───────────────────────────

CREATE TABLE IF NOT EXISTS deterministic_assets (
  id TEXT PRIMARY KEY,

  namespace TEXT NOT NULL REFERENCES namespaces(prefix) ON DELETE CASCADE,

  key TEXT NOT NULL,
  title TEXT,
  value TEXT NOT NULL,

  meta_json TEXT NOT NULL DEFAULT '{}',

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(namespace, key)
);

CREATE INDEX IF NOT EXISTS idx_deterministic_assets_namespace
  ON deterministic_assets(namespace);`
  },
  // migration 2: add source column to namespaces for existing databases
  {
    id: 2,
    sql: `ALTER TABLE namespaces ADD COLUMN source TEXT NOT NULL DEFAULT 'deterministic';`
  },
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

export async function initDB(workspacePath: string) {
  if (db && currentWorkspacePath === workspacePath) return db;

  // switching workspaces — close the old connection first
  if (db && currentWorkspacePath !== workspacePath) {
    await db.close();
    db = null;
  }

  const dbPath = await join(workspacePath, ".prmptly", "db.sqlite");

  db = await Database.load(`sqlite:${dbPath}?mode=rwc`);

  await db.execute("PRAGMA journal_mode=WAL");
  await db.execute("PRAGMA busy_timeout=5000");
  await db.execute("PRAGMA foreign_keys=ON"); // must be set every connection, SQLite doesn't persist this in the file

  await runMigrations(db);

  currentWorkspacePath = workspacePath;
  return db;
}

export function getDB() {
  if (!db) throw new Error("DB not initialized — call initDB() first");
  return db;
}

export async function closeDB() {
  if (db) {
    await db.close();
    db = null;
    currentWorkspacePath = null;
  }
}

export async function runTransaction<T>(
  db: Database,
  fn: (db: Database) => Promise<T>
): Promise<T> {
  await db.execute("BEGIN");

  try {
    const result = await fn(db);
    await db.execute("COMMIT");
    return result;
  } catch (err) {
    await db.execute("ROLLBACK").catch(() => {});
    throw err;
  }
}

export async function getSetting(key: string) {
  const db = getDB();

  const rows = await db.select<{ value: string }[]>(
    `SELECT value FROM app_settings WHERE key = ?`,
    [key]
  );

  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  const db = getDB();

  await db.execute(
    `INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)`,
    [key, value]
  );
}

export async function getAppBasePath() {
  const basePath = await getSetting("base_path");
  return { basePath };
}