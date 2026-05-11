mod commands;
use fastembed::TextEmbedding;
use std::sync::{Arc, Mutex};
use tauri::Manager;

pub struct EmbeddingState(pub Arc<Mutex<Option<TextEmbedding>>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    commands::embeddings::register_sqlite_vec();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .target(tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::Stdout,
                ))
                .build(),
        )
        .manage(EmbeddingState(Arc::new(Mutex::new(None)))) // Arc wrapped
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            let state = app.state::<EmbeddingState>().inner().0.clone();
            let model_path = app
                .path()
                .app_data_dir()
                .unwrap()
                .to_string_lossy()
                .to_string();

            // Only auto-init if already downloaded
            let cache = std::path::PathBuf::from(&model_path)
                .join("models")
                .join("fastembed");
            let already_cached = cache
                .read_dir()
                .map(|mut d| d.next().is_some())
                .unwrap_or(false);

            if already_cached {
                tauri::async_runtime::spawn(async move {
                    if let Err(e) =
                        commands::embeddings::setup_embeddings_inner(model_path, window, state)
                            .await
                    {
                        eprintln!("Model init failed: {}", e);
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::embeddings::setup_embeddings,
            commands::embeddings::generate_embeddings,
            commands::embeddings::search_similar,
            commands::embeddings::chunk_text,
            commands::db::setup_vec_table,
            commands::db::insert_node_version_with_embedding,
            commands::db::delete_node_version_embedding,
            commands::db::search_fts,
            
        ])
        .run(tauri::generate_context!())
        .expect("error while running pr0mptly");
}
