use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use zerocopy::AsBytes;

fn open_conn(db_path: &str) -> Result<Connection, String> {
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;")
        .map_err(|e| e.to_string())?;
    Ok(conn)
}

#[tauri::command]
pub async fn setup_vec_table(db_path: String) -> Result<(), String> {
    let conn = open_conn(&db_path)?;
    conn.execute_batch("
        CREATE VIRTUAL TABLE IF NOT EXISTS vec_index USING vec0(
            node_version_id TEXT PRIMARY KEY,
            embedding FLOAT[768]
        );
    ").map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn insert_node_version_with_embedding(
    db_path: String,
    node_version_id: String,
    node_id: String,
    scope_id: String,
    content: String,
    embedding: Vec<f32>,
) -> Result<(), String> {
    let conn = open_conn(&db_path)?;
    let embedding_bytes = embedding.as_bytes().to_vec();

    conn.execute(
        "UPDATE node_versions SET is_latest = 0 WHERE node_id = ?1",
        params![node_id],
    ).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO node_versions (id, node_id, content, embedding, is_latest, created_at)
         VALUES (?1, ?2, ?3, ?4, 1, CURRENT_TIMESTAMP)",
        params![node_version_id, node_id, content, embedding_bytes],
    ).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT OR REPLACE INTO vec_index (node_version_id, embedding)
         VALUES (?1, ?2)",
        params![node_version_id, embedding_bytes],
    ).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO fts_index (content, node_version_id, scope_id)
         VALUES (?1, ?2, ?3)",
        params![content, node_version_id, scope_id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn delete_node_version_embedding(
    db_path: String,
    node_version_id: String,
) -> Result<(), String> {
    let conn = open_conn(&db_path)?;

    conn.execute(
        "DELETE FROM vec_index WHERE node_version_id = ?1",
        params![node_version_id],
    ).map_err(|e| e.to_string())?;

    conn.execute(
        "DELETE FROM fts_index WHERE node_version_id = ?1",
        params![node_version_id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[derive(Serialize, Deserialize)]
pub struct FtsResult {
    pub node_version_id: String,
    pub node_id: String,
    pub content: String,
    pub scope_id: String,
}


#[tauri::command]
pub async fn search_fts(
    db_path: String,
    query: String,
    scope_id: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<FtsResult>, String> {
    let conn = open_conn(&db_path)?;
    let limit = limit.unwrap_or(5);
    let mut results = vec![];

    match scope_id {
        Some(sid) => {
            let mut stmt = conn.prepare(
                "SELECT f.node_version_id, n.id as node_id, f.content, f.scope_id
                 FROM fts_index f
                 JOIN node_versions nv ON nv.id = f.node_version_id
                 JOIN nodes n ON n.id = nv.node_id
                 WHERE fts_index MATCH ?1
                 AND f.scope_id = ?2
                 ORDER BY rank
                 LIMIT ?3"
            ).map_err(|e| e.to_string())?;

            let rows = stmt.query_map(
                params![query, sid, limit],
                |row| Ok(FtsResult {
                    node_version_id: row.get(0)?,
                    node_id: row.get(1)?,
                    content: row.get(2)?,
                    scope_id: row.get(3)?,
                })
            ).map_err(|e| e.to_string())?;

            for r in rows { results.push(r.map_err(|e| e.to_string())?); }
        },
        None => {
            let mut stmt = conn.prepare(
                "SELECT f.node_version_id, n.id as node_id, f.content, f.scope_id
                 FROM fts_index f
                 JOIN node_versions nv ON nv.id = f.node_version_id
                 JOIN nodes n ON n.id = nv.node_id
                 WHERE fts_index MATCH ?1
                 ORDER BY rank
                 LIMIT ?2"
            ).map_err(|e| e.to_string())?;

            let rows = stmt.query_map(
                params![query, limit],
                |row| Ok(FtsResult {
                    node_version_id: row.get(0)?,
                    node_id: row.get(1)?,
                    content: row.get(2)?,
                    scope_id: row.get(3)?,
                })
            ).map_err(|e| e.to_string())?;

            for r in rows { results.push(r.map_err(|e| e.to_string())?); }
        }
    }

    Ok(results)
}