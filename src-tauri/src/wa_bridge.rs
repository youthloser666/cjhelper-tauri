use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use tauri::{path::BaseDirectory, Manager};

const RESOURCE_RELATIVE_CANDIDATES: &[&str] = &[
    "_up_/wa_server_go/wa_server.exe",
    "wa_server_go/wa_server.exe",
    "wa_server.exe",
];

fn push_unique(candidates: &mut Vec<PathBuf>, path: PathBuf) {
    if !candidates.iter().any(|existing| existing == &path) {
        candidates.push(path);
    }
}

/// Builds an ordered, deduplicated list of `wa_server.exe` candidate paths covering:
/// 1. Tauri v2 bundled resource paths (including `_up_/wa_server_go/wa_server.exe`)
/// 2. Running executable sibling & installed resource subdirectories
/// 3. Dynamic development workspace roots (`CARGO_MANIFEST_DIR`, `current_dir`)
pub fn collect_wa_server_candidates(
    resource_paths: &[PathBuf],
    exe_dir: Option<&Path>,
    dev_workspace_roots: &[PathBuf],
) -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    for path in resource_paths {
        push_unique(&mut candidates, path.clone());
    }

    if let Some(dir) = exe_dir {
        push_unique(&mut candidates, dir.join("wa_server.exe"));
        push_unique(&mut candidates, dir.join("wa_server_go").join("wa_server.exe"));
        push_unique(&mut candidates, dir.join("_up_").join("wa_server_go").join("wa_server.exe"));
        push_unique(
            &mut candidates,
            dir.join("resources").join("_up_").join("wa_server_go").join("wa_server.exe"),
        );
        push_unique(
            &mut candidates,
            dir.join("resources").join("wa_server_go").join("wa_server.exe"),
        );
        push_unique(&mut candidates, dir.join("../../..").join("wa_server_go").join("wa_server.exe"));
    }

    for root in dev_workspace_roots {
        push_unique(&mut candidates, root.join("wa_server_go").join("wa_server.exe"));
        push_unique(&mut candidates, root.join("wa_server.exe"));
        if let Some(parent) = root.parent() {
            push_unique(&mut candidates, parent.join("wa_server_go").join("wa_server.exe"));
        }
    }

    candidates
}

pub fn resolve_first_existing_wa_server(candidates: &[PathBuf]) -> Option<PathBuf> {
    candidates.iter().find(|path| path.is_file()).cloned()
}

pub fn find_wa_server_executable(app: &tauri::AppHandle) -> Option<PathBuf> {
    let mut resource_paths = Vec::new();
    for rel in RESOURCE_RELATIVE_CANDIDATES {
        if let Ok(resolved) = app.path().resolve(rel, BaseDirectory::Resource) {
            resource_paths.push(resolved);
        }
    }

    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(Path::to_path_buf));

    let mut workspace_roots = Vec::new();
    if let Some(manifest_dir) = option_env!("CARGO_MANIFEST_DIR") {
        workspace_roots.push(PathBuf::from(manifest_dir));
    }
    if let Ok(cwd) = std::env::current_dir() {
        workspace_roots.push(cwd);
    }

    let candidates = collect_wa_server_candidates(
        &resource_paths,
        exe_dir.as_deref(),
        &workspace_roots,
    );
    resolve_first_existing_wa_server(&candidates)
}

pub fn spawn_wa_server_process(target_exe: &Path, db_arg: &str) -> Result<(), String> {
    let working_dir = target_exe.parent().unwrap_or_else(|| Path::new("."));
    let mut cmd = Command::new(target_exe);
    if !db_arg.is_empty() {
        cmd.arg(db_arg);
    }
    cmd.current_dir(working_dir)
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    cmd.spawn()
        .map(|_| ())
        .map_err(|e| format!("Gagal menjalankan Whatsmeow WA Server (Go): {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_temp_dir(label: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("cjhelper_wa_bridge_{}_{}", label, nanos));
        fs::create_dir_all(&dir).expect("create temp test dir");
        dir
    }

    #[test]
    fn prioritizes_tauri_v2_up_resource_layout_before_fallbacks() {
        let root = unique_temp_dir("up_resource");
        let up_exe = root.join("resources").join("_up_").join("wa_server_go").join("wa_server.exe");
        let fallback_exe = root.join("dev").join("wa_server_go").join("wa_server.exe");
        fs::create_dir_all(up_exe.parent().unwrap()).unwrap();
        fs::create_dir_all(fallback_exe.parent().unwrap()).unwrap();
        fs::write(&up_exe, b"up-binary").unwrap();
        fs::write(&fallback_exe, b"dev-binary").unwrap();

        let candidates = collect_wa_server_candidates(
            &[up_exe.clone()],
            None,
            &[root.join("dev")],
        );
        let found = resolve_first_existing_wa_server(&candidates);
        assert_eq!(found, Some(up_exe));

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn resolves_sibling_resources_and_parent_workspace_paths() {
        let root = unique_temp_dir("sibling_workspace");
        let exe_dir = root.join("install");
        let sibling_up = exe_dir.join("resources").join("_up_").join("wa_server_go").join("wa_server.exe");
        fs::create_dir_all(sibling_up.parent().unwrap()).unwrap();
        fs::write(&sibling_up, b"installed").unwrap();

        let candidates = collect_wa_server_candidates(&[], Some(&exe_dir), &[]);
        assert_eq!(resolve_first_existing_wa_server(&candidates), Some(sibling_up));

        // Simulate running from `src-tauri/` where binary sits in `../wa_server_go/wa_server.exe`
        let repo_root = root.join("repo");
        let manifest_dir = repo_root.join("src-tauri");
        let parent_bin = repo_root.join("wa_server_go").join("wa_server.exe");
        fs::create_dir_all(&manifest_dir).unwrap();
        fs::create_dir_all(parent_bin.parent().unwrap()).unwrap();
        fs::write(&parent_bin, b"dev-built").unwrap();

        let dev_candidates = collect_wa_server_candidates(&[], None, &[manifest_dir]);
        assert_eq!(resolve_first_existing_wa_server(&dev_candidates), Some(parent_bin));

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn skips_directories_and_returns_none_when_missing() {
        let root = unique_temp_dir("missing");
        let fake_dir = root.join("wa_server.exe");
        fs::create_dir_all(&fake_dir).unwrap();

        let candidates = collect_wa_server_candidates(&[fake_dir], Some(&root), &[]);
        assert_eq!(resolve_first_existing_wa_server(&candidates), None);

        let _ = fs::remove_dir_all(&root);
    }
}

