mod commands;

use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            parse_pasted_table,
            snapshot_data,
            reset_snapshot,
            clear_data,
            check_site_status,
            wa_status,
            wa_groups,
            wa_broadcast,
            wa_start_server,
            wa_logout,
            pick_db_file,
            load_db_excel,
            lookup_site,
            get_down_sites_coords,
            get_wa_config,
            save_wa_groups,
            update_site_db,
            export_db,
            open_url,
            find_nearest_sites
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
