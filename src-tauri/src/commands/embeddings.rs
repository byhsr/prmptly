use fastembed::{TextEmbedding, InitOptions, EmbeddingModel};
use rusqlite::Connection;
use serde::Serialize;
use tauri::Emitter;
use zerocopy::AsBytes;
use crate::EmbeddingState;
use std::sync::{Arc, Mutex};

// Call this ONCE at app startup in main.rs, not per query
pub fn register_sqlite_vec() {
    unsafe {
        rusqlite::ffi::sqlite3_auto_extension(Some(
            std::mem::transmute(sqlite_vec::sqlite3_vec_init as *const ())
        ));
    }
}

pub async fn setup_embeddings_inner(
    model_path: String,
    window: tauri::WebviewWindow<tauri::Wry>,
    state: Arc<Mutex<Option<TextEmbedding>>>,
) -> Result<(), String> {
    // Already loaded
    if state.lock().unwrap().is_some() {
        window.emit("model-progress", "ready").ok();
        return Ok(());
    }

    let cache = std::path::PathBuf::from(&model_path)
        .join("models")
        .join("fastembed");

    std::fs::create_dir_all(&cache).map_err(|e| e.to_string())?;

    let already_cached = cache.read_dir()
        .map(|mut d| d.next().is_some())
        .unwrap_or(false);

    window.emit("model-progress", if already_cached { "loading" } else { "downloading" }).ok();

    let model = tokio::task::spawn_blocking(move || {
        TextEmbedding::try_new(
            InitOptions::new(EmbeddingModel::NomicEmbedTextV15)
                .with_cache_dir(cache)
        )
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    *state.lock().unwrap() = Some(model);
    window.emit("model-progress", "ready").ok();
    Ok(())
}

#[tauri::command]
pub async fn setup_embeddings(
    model_path: String,
    window: tauri::WebviewWindow<tauri::Wry>,
    state: tauri::State<'_, EmbeddingState>,
) -> Result<(), String> {
    setup_embeddings_inner(model_path, window, state.0.clone()).await
}


#[tauri::command]
pub async fn generate_embeddings(
    texts: Vec<String>,
    state: tauri::State<'_, EmbeddingState>
) -> Result<Vec<Vec<f32>>, String> {
    // Pull model out of state before spawn_blocking (State isn't Send)
    let mut guard = state.0.lock().unwrap();
    let model = guard.as_mut().ok_or("Model not initialized")?;
    model.embed(texts, None).map_err(|e| e.to_string())
}

#[derive(Serialize)]
pub struct SearchResult {
    pub node_version_id: String,
    pub node_id: String,
    pub content: String,
    pub distance: f64,
}

#[tauri::command]
pub async fn check_model_exists(model_path: String) -> bool {
    let cache = std::path::PathBuf::from(&model_path)
        .join("models")
        .join("fastembed");

    cache.read_dir()
        .map(|mut d| d.next().is_some())
        .unwrap_or(false)

}

#[tauri::command]
pub async fn search_similar(
    db_path: String,
    query_embedding: Vec<f32>,
    scope_id: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<SearchResult>, String> {
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(5);
    let embedding_bytes = query_embedding.as_bytes().to_vec(); // owned for closure

    let results = tokio::task::spawn_blocking(move || -> Result<Vec<SearchResult>, String> {
        let mut results = vec![];

        match scope_id {
            Some(sid) => {
                let mut stmt = conn.prepare(
                    "SELECT v.node_version_id, n.id as node_id, nv.content, v.distance
                     FROM vec_index v
                     JOIN node_versions nv ON nv.id = v.node_version_id
                     JOIN nodes n ON n.id = nv.node_id
                     WHERE v.embedding MATCH ?1 AND k = ?2
                     AND n.scope_id = ?4
                     ORDER BY v.distance
                     LIMIT ?3"
                ).map_err(|e| e.to_string())?;

                let rows = stmt.query_map(
                    rusqlite::params![embedding_bytes, limit, limit, sid],
                    |row| Ok(SearchResult {
                        node_version_id: row.get(0)?,
                        node_id: row.get(1)?,
                        content: row.get(2)?,
                        distance: row.get(3)?,
                    })
                ).map_err(|e| e.to_string())?;

                for r in rows { results.push(r.map_err(|e| e.to_string())?); }
            },
            None => {
                let mut stmt = conn.prepare(
                    "SELECT v.node_version_id, n.id as node_id, nv.content, v.distance
                     FROM vec_index v
                     JOIN node_versions nv ON nv.id = v.node_version_id
                     JOIN nodes n ON n.id = nv.node_id
                     WHERE v.embedding MATCH ?1 AND k = ?2
                     ORDER BY v.distance
                     LIMIT ?2"
                ).map_err(|e| e.to_string())?;

                let rows = stmt.query_map(
                    rusqlite::params![embedding_bytes, limit],
                    |row| Ok(SearchResult {
                        node_version_id: row.get(0)?,
                        node_id: row.get(1)?,
                        content: row.get(2)?,
                        distance: row.get(3)?,
                    })
                ).map_err(|e| e.to_string())?;

                for r in rows { results.push(r.map_err(|e| e.to_string())?); }
            }
        }

        Ok(results)
    })
    .await
    .map_err(|e| e.to_string())?? ;

    Ok(results)
}