use serde::Serialize;
use tauri::Manager;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativePlatformInfo {
    pub os: String,
    pub arch: String,
    pub runtime: String,
    pub app_version: String,
}

#[tauri::command]
fn get_native_platform_info(app: tauri::AppHandle) -> NativePlatformInfo {
    let os = std::env::consts::OS.to_string();
    let arch = std::env::consts::ARCH.to_string();
    let runtime = if os == "android" {
        "Tauri Android APK".to_string()
    } else if os == "windows" {
        "Tauri Windows Desktop".to_string()
    } else {
        format!("Tauri {}", os)
    };

    NativePlatformInfo {
        os,
        arch,
        runtime,
        app_version: app.package_info().version.to_string(),
    }
}

#[tauri::command]
fn save_library_backup(app: tauri::AppHandle, filename: String, json_content: String) -> Result<String, String> {
    let safe_name: String = filename
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-' || *c == '.')
        .collect();
    let final_name = if safe_name.is_empty() {
        "lumina_backup.json".to_string()
    } else {
        safe_name
    };

    let data_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Falha ao localizar pasta de dados: {}", e))?;
    std::fs::create_dir_all(&data_dir)
        .map_err(|e| format!("Falha ao criar diretório local: {}", e))?;

    let target_path = data_dir.join(final_name);
    std::fs::write(&target_path, json_content)
        .map_err(|e| format!("Falha ao gravar backup: {}", e))?;

    Ok(target_path.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            get_native_platform_info,
            save_library_backup
        ])
        .run(tauri::generate_context!())
        .expect("Erro ao iniciar o aplicativo Lumina Tauri");
}
