use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::SystemTime;

fn latest_source_mtime(dir: &Path) -> Option<SystemTime> {
    let entries = fs::read_dir(dir).ok()?;
    let mut newest: Option<SystemTime> = None;

    for entry in entries.flatten() {
        let path = entry.path();
        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        let is_go_input = name == "go.mod"
            || name == "go.sum"
            || (name.ends_with(".go") && !name.ends_with("_test.go"));
        if !is_go_input {
            continue;
        }
        if let Ok(meta) = entry.metadata() {
            if let Ok(mtime) = meta.modified() {
                newest = Some(match newest {
                    Some(prev) if prev >= mtime => prev,
                    _ => mtime,
                });
            }
        }
    }

    newest
}

fn ensure_wa_server_binary() {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."));
    let wa_go_dir = manifest_dir
        .parent()
        .unwrap_or(&manifest_dir)
        .join("wa_server_go");

    if !wa_go_dir.is_dir() {
        return;
    }

    for watched in [
        "go.mod",
        "go.sum",
        "main.go",
        "retry_cache.go",
        "jid_resolver.go",
    ] {
        println!(
            "cargo:rerun-if-changed={}",
            wa_go_dir.join(watched).display()
        );
    }

    let exe_path = wa_go_dir.join("wa_server.exe");
    let exe_mtime = fs::metadata(&exe_path).and_then(|m| m.modified()).ok();
    let newest_src = latest_source_mtime(&wa_go_dir);

    let needs_rebuild = match (exe_mtime, newest_src) {
        (None, _) => true,
        (Some(bin_time), Some(src_time)) => src_time > bin_time,
        _ => false,
    };

    if !needs_rebuild {
        return;
    }

    match Command::new("go")
        .args(["build", "-o", "wa_server.exe", "."])
        .current_dir(&wa_go_dir)
        .output()
    {
        Ok(out) if out.status.success() => {}
        Ok(out) => {
            let stderr = String::from_utf8_lossy(&out.stderr);
            println!(
                "cargo:warning=Automatic 'go build' for wa_server.exe failed ({}). Using existing binary if present.",
                stderr.trim()
            );
        }
        Err(err) => {
            println!(
                "cargo:warning=Go toolchain unavailable while checking wa_server.exe ({}).",
                err
            );
        }
    }
}

fn main() {
    ensure_wa_server_binary();
    tauri_build::build()
}
