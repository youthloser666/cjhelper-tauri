use chrono::NaiveDateTime;
use csv::ReaderBuilder;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
use tauri::State;
use calamine::{open_workbook_auto, Reader, Data};
use tauri_plugin_dialog::DialogExt;
use serde_json::Value;

// A generic row where keys are uppercase column names
pub type DataFrame = Vec<HashMap<String, String>>;

pub struct AppState {
    pub master_df: Mutex<DataFrame>,
    pub sub_master_df: Mutex<DataFrame>,
    pub db_df: Mutex<Vec<Vec<String>>>,
    pub db_headers: Mutex<Vec<String>>,
    pub db_lookup: Mutex<HashMap<String, usize>>,
    pub db_te_cache: Mutex<HashMap<String, String>>,
    pub db_indices: Mutex<HashMap<String, usize>>, // Cache for column indices
    pub wa_config: Mutex<serde_json::Value>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            master_df: Mutex::new(Vec::new()),
            sub_master_df: Mutex::new(Vec::new()),
            db_df: Mutex::new(Vec::new()),
            db_headers: Mutex::new(Vec::new()),
            db_lookup: Mutex::new(HashMap::new()),
            db_te_cache: Mutex::new(HashMap::new()),
            db_indices: Mutex::new(HashMap::new()),
            wa_config: Mutex::new(serde_json::json!({ "saved_groups": [] })),
        }
    }
}

// -----------------------------------------
// Broadcast Message Structures
// -----------------------------------------
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BroadcastEntry {
    pub wa_line: String,
    pub disp_line: String,
    pub nm: String,
    pub ol: String,
    pub nw: String,
    pub st_fmt: String,
    pub re: String,
    pub cat: String,
    pub impact: String,
    pub cluster: String,
    pub pic: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct BroadcastMessage {
    pub msg: String,
    pub preview: String,
    pub cluster: String,
    pub pic: String,
    pub te: String,
    pub rts: String,
    pub display: String,
    pub count: usize,
    pub entries: Vec<BroadcastEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BroadcastFormat {
    pub line_tpl: String,
    pub remark_tpl: String,
    pub header_tpl: String,
    pub section_sd: String,
    pub section_cd: String,
    pub section_bcch: String,
    pub bcch_keyword: String,
    pub icon_char: String,
    pub spacing: bool,
}

impl Default for BroadcastFormat {
    fn default() -> Self {
        Self {
            line_tpl: "{icon} {rts} / {cluster} /  {new}  / {sitename} / {category} / {time}".to_string(),
            remark_tpl: " / {remark}".to_string(),
            header_tpl: "*SITE FULLY DOWN {region}  {date} {jam}*\n*TOTAL SITEDOWN : {total_sd}*".to_string(),
            section_sd: "SITE DOWN :".to_string(),
            section_cd: "CELLS DOWN :".to_string(),
            section_bcch: "CELL DOWN BCCH Missing NOKIA :".to_string(),
            bcch_keyword: "BCCH".to_string(),
            icon_char: "▶️".to_string(),
            spacing: false,
        }
    }
}

// -----------------------------------------
// TSV Parsing
// -----------------------------------------
#[derive(Serialize)]
pub struct ParseResult {
    pub count: usize,
    pub status: String,
}

#[tauri::command]
pub fn parse_pasted_table(state: State<'_, AppState>, text: String) -> Result<ParseResult, String> {
    let lines: Vec<&str> = text.lines().collect();
    if lines.is_empty() {
        return Ok(ParseResult { count: 0, status: "EMPTY".to_string() });
    }

    let kw: HashSet<&str> = [
        "DATE", "STATUS", "NEW SITE", "SITE NAME", "CLUSTER", "IMPACT SITE", "ROH", "RTS", "REMARK", "START TIME",
    ].into_iter().collect();

    let mut hrow = 0;
    for (i, line) in lines.iter().enumerate() {
        let cols: Vec<String> = line.split('\t').map(|s| s.trim().to_uppercase()).collect();
        let mut count = 0;
        for c in &cols {
            for k in &kw {
                if c.contains(k) { count += 1; break; }
            }
        }
        if count >= 3 { hrow = i; break; }
    }

    let csv_text = lines[hrow..].join("\n");
    let mut rdr = ReaderBuilder::new()
        .delimiter(b'\t')
        .has_headers(true)
        .from_reader(csv_text.as_bytes());

    let mut df = DataFrame::new();
    let headers: Vec<String> = rdr.headers().map_err(|e| e.to_string())?
        .iter().map(|s| s.trim().to_uppercase()).collect();

    for result in rdr.records() {
        let record = result.map_err(|e| e.to_string())?;
        let mut row = HashMap::new();
        for (i, val) in record.iter().enumerate() {
            if i < headers.len() {
                row.insert(headers[i].clone(), val.trim().to_string());
            }
        }
        df.push(row);
    }

    let count = df.len();
    if count == 0 { return Ok(ParseResult { count: 0, status: "EMPTY".to_string() }); }

    let mut master = state.master_df.lock().unwrap();
    let mut sub_master = state.sub_master_df.lock().unwrap();

    let mut is_same = false;
    if !master.is_empty() && master.len() == count {
        if *master == df {
            is_same = true;
        } else {
            let mut old_ids = HashSet::new();
            let mut new_ids = HashSet::new();
            for r in master.iter() {
                if let Some(ns) = fc(r, &["NEW", "SITE"]) {
                    old_ids.insert(r.get(&ns).unwrap_or(&"".to_string()).trim().to_uppercase());
                }
            }
            for r in df.iter() {
                if let Some(ns) = fc(r, &["NEW", "SITE"]) {
                    new_ids.insert(r.get(&ns).unwrap_or(&"".to_string()).trim().to_uppercase());
                }
            }
            if !old_ids.is_empty() && old_ids == new_ids { is_same = true; }
        }
    }

    let status = if is_same {
        if *master != df {
            *master = df.clone();
            "UPDATED_DETAILS".to_string()
        } else {
            "UNCHANGED".to_string()
        }
    } else {
        if !master.is_empty() {
            *sub_master = master.clone();
            *master = df.clone();
            "UPDATED".to_string()
        } else {
            *sub_master = df.clone();
            *master = df.clone();
            "NEW_BASELINE".to_string()
        }
    };

    Ok(ParseResult { count, status })
}

#[tauri::command]
pub fn snapshot_data(state: State<'_, AppState>) -> Result<usize, String> {
    let master = state.master_df.lock().unwrap().clone();
    let count = master.len();
    *state.sub_master_df.lock().unwrap() = master;
    Ok(count)
}

#[tauri::command]
pub fn reset_snapshot(state: State<'_, AppState>) -> Result<(), String> {
    *state.sub_master_df.lock().unwrap() = Vec::new();
    Ok(())
}

#[tauri::command]
pub fn clear_data(state: State<'_, AppState>) -> Result<(), String> {
    *state.master_df.lock().unwrap() = Vec::new();
    Ok(())
}

#[derive(Serialize)]
pub struct SiteStatus {
    pub status: String,
    pub icon: String,
    pub new_site: String,
    pub site_name: String,
    pub cluster: String,
    pub impact: String,
    pub rts: String,
    pub start_time: String,
    pub agging: String,
    pub remark: String,
    pub start_timestamp: i64,
    pub old_site: String,
    pub category: String,
    pub site_class: String,
    pub pic: String,
    pub vendor: String,
}

fn fc(row: &HashMap<String, String>, kws: &[&str]) -> Option<String> {
    let exact = kws.join(" ");
    for k in row.keys() {
        if k.to_uppercase() == exact.to_uppercase() { return Some(k.clone()); }
    }
    let mut best_match = None;
    let mut min_len = usize::MAX;
    for k in row.keys() {
        let ku = k.to_uppercase();
        if kws.iter().all(|&w| ku.contains(w)) {
            if ku.len() < min_len {
                min_len = ku.len();
                best_match = Some(k.clone());
            }
        }
    }
    best_match
}

fn get_val(row: &HashMap<String, String>, kws: &[&str]) -> String {
    if let Some(col) = fc(row, kws) {
        row.get(&col).cloned().unwrap_or_default()
    } else {
        "".to_string()
    }
}

fn calc_dur(st: &str) -> String {
    if st.is_empty() || st.to_lowercase() == "nan" { return "".to_string(); }
    let s = st.replace("|", " ").trim().to_string();
    let s = if s.to_lowercase().ends_with(" p") { s[..s.len() - 2].trim().to_string() }
            else if s.to_lowercase().ends_with("p") { s[..s.len() - 1].trim().to_string() }
            else { s };

    let formats = [
        "%d/%m/%Y %H:%M:%S", "%d-%m-%Y %H:%M:%S", "%d/%m/%Y %H:%M", "%d-%m-%Y %H:%M",
        "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%m/%d/%Y %H:%M", "%d-%b-%y %H:%M",
    ];

    let mut parsed_dt = None;
    for fmt in formats {
        if let Ok(dt) = NaiveDateTime::parse_from_str(&s, fmt) {
            parsed_dt = Some(dt);
            break;
        }
    }

    if let Some(dt) = parsed_dt {
        let now = chrono::Local::now().naive_local();
        let diff = now.signed_duration_since(dt).num_seconds();
        if diff < 0 { return "0j 0m".to_string(); }
        let h = diff / 3600;
        let m = (diff % 3600) / 60;
        format!("{}j {}m", h, m)
    } else {
        "".to_string()
    }
}

fn fmt_dt(st: &str) -> String {
    let s = st.replace("|", " ").trim().to_string();
    let formats = ["%d/%m/%Y %H:%M:%S", "%d-%m-%Y %H:%M:%S", "%d/%m/%Y %H:%M", "%d-%m-%Y %H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"];
    for fmt in &formats {
        if let Ok(dt) = NaiveDateTime::parse_from_str(&s, fmt) {
            return dt.format("%d/%m/%Y | %H:%M").to_string();
        }
    }
    st.to_string()
}

fn fmt_st(st: &str) -> String {
    let s = st.replace("|", " ").trim().to_string();
    let formats = [
        "%d/%m/%Y %H:%M:%S", "%d-%m-%Y %H:%M:%S", "%d/%m/%Y %H:%M", "%d-%m-%Y %H:%M",
        "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%m/%d/%Y %H:%M", "%d-%b-%y %H:%M",
    ];
    for fmt in &formats {
        if let Ok(dt) = NaiveDateTime::parse_from_str(&s, fmt) {
            return dt.format("%d-%m-%Y %H:%M:%S").to_string();
        }
    }
    s.replace("/", "-")
}

fn fmt_wa_line(impact: &str, cluster: &str, sitename: &str, old: &str, new: &str, st_fmt: &str, remark: &str, show_remark: bool, category: &str, s_class: &str, fmt: &BroadcastFormat) -> (String, String) {
    let is_fully = impact.to_lowercase().contains("fully");
    let type_raw = if is_fully { "SITE DOWN" } else { "CELLS DOWN" };
    let combined = format!("{} {}", category, impact).to_uppercase();
    let is_hub = combined.contains("HUB") && (combined.contains("MEDIUM") || combined.contains("BIG"));
    let is_critical = s_class.to_uppercase().contains("CRITICAL");
    let icon_char = if is_hub || is_critical { "⚠️ ".to_string() } else { fmt.icon_char.clone() };
    let ctx = vec![
        ("icon", icon_char), ("type", type_raw.to_string()), ("cluster", cluster.to_string()), ("sitename", sitename.to_string()),
        ("old", old.to_string()), ("new", new.to_string()), ("time", st_fmt.to_string()), ("remark", remark.to_string()),
        ("category", category.to_string()), ("rts", "".to_string()),
    ];
    let mut wa_line = fmt.line_tpl.clone();
    for (key, val) in &ctx { wa_line = wa_line.replace(&format!("{{{}}}", key), val); }
    if show_remark && !remark.is_empty() && !fmt.remark_tpl.is_empty() {
        let mut remark_line = fmt.remark_tpl.clone();
        for (key, val) in &ctx { remark_line = remark_line.replace(&format!("{{{}}}", key), val); }
        wa_line = format!("{}\n{}", wa_line, remark_line);
    }
    let disp_line = wa_line.clone();
    (wa_line, disp_line)
}

fn natural_sort_key(s: &str) -> Vec<String> {
    let mut result = Vec::new();
    let mut current = String::new();
    let mut is_digit = false;
    for ch in s.chars() {
        let ch_is_digit = ch.is_numeric();
        if ch_is_digit != is_digit {
            if !current.is_empty() {
                if is_digit { result.push(format!("__{}", current.parse::<u64>().unwrap_or(0))); }
                else { result.push(current.to_lowercase()); }
                current.clear();
            }
            is_digit = ch_is_digit;
        }
        current.push(ch);
    }
    if !current.is_empty() {
        if is_digit { result.push(format!("__{}", current.parse::<u64>().unwrap_or(0))); }
        else { result.push(current.to_lowercase()); }
    }
    result
}

#[tauri::command]
pub fn generate_pm_messages(state: State<'_, AppState>, show_remark: bool) -> Result<Vec<BroadcastMessage>, String> {
    let sdf = state.sub_master_df.lock().unwrap();
    let db_te_lookup = state.db_te_cache.lock().unwrap();
    if sdf.is_empty() { return Ok(Vec::new()); }
    let fmt = BroadcastFormat::default();
    let mut groups: HashMap<(String, String), Vec<BroadcastEntry>> = HashMap::new();
    for row in sdf.iter() {
        let cl = get_val(row, &["CLUSTER"]).trim().to_string();
        let nm = get_val(row, &["SITE", "NAME"]).trim().to_string();
        let im = get_val(row, &["IMPACT"]).trim().to_string();
        let ol = get_val(row, &["OLD", "SITE"]).trim().to_string();
        let nw = get_val(row, &["NEW", "SITE"]).trim().to_string();
        let st = get_val(row, &["START"]).trim().to_string();
        let re = get_val(row, &["REMARK"]).trim().to_string();
        let cat = get_val(row, &["CATEGORY"]).trim().to_string();
        let s_cls = get_val(row, &["SITE", "CLASS"]).trim().to_string();
        if cl.is_empty() || cl == "nan" || nm.is_empty() || nm == "nan" { continue; }
        let pic = db_te_lookup.get(&nw.to_uppercase()).cloned().unwrap_or_default();
        let st_fmt = fmt_dt(&st);
        let (wa_line, disp_line) = fmt_wa_line(&im, &cl, &nm, &ol, &nw, &st_fmt, &re, show_remark, &cat, &s_cls, &fmt);
        let entry = BroadcastEntry { wa_line, disp_line, nm, ol, nw, st_fmt, re, cat, impact: im.clone(), cluster: cl.clone(), pic: pic.clone() };
        let gkey = (cl, pic);
        groups.entry(gkey).or_insert_with(Vec::new).push(entry);
    }
    let mut sorted_keys: Vec<(String, String)> = groups.keys().cloned().collect();
    sorted_keys.sort_by(|a, b| natural_sort_key(&a.0).cmp(&natural_sort_key(&b.0)));
    let mut msgs = Vec::new();
    for (cl, pic) in sorted_keys {
        let entries = groups.remove(&(cl.clone(), pic.clone())).unwrap_or_default();
        let mut fully = Vec::new(); let mut cell = Vec::new(); let mut cell_bcch = Vec::new();
        for entry in entries.iter() {
            if entry.impact.to_lowercase().contains("fully") { fully.push(entry.clone()); }
            else if entry.re.to_uppercase().contains("BCCH") { cell_bcch.push(entry.clone()); }
            else { cell.push(entry.clone()); }
        }
        let hdr_ctx = [("cluster", cl.clone()), ("pic", pic.clone()), ("te", pic.clone()), ("rts", "".to_string())];
        let mut hdr_out = fmt.header_tpl.clone();
        for (key, val) in &hdr_ctx { hdr_out = hdr_out.replace(&format!("{{{}}}", key), val); }
        hdr_out = hdr_out.replace("  |    |  ", "  |  ");
        let mut lines_wa = vec![hdr_out.clone(), "".to_string()];
        let mut lines_prev = vec![hdr_out.clone(), "".to_string()];
        if !fully.is_empty() {
            lines_wa.push(fmt.section_sd.clone()); lines_prev.push(fmt.section_sd.clone());
            for e in &fully {
                lines_wa.push(e.wa_line.clone()); lines_prev.push(e.disp_line.clone());
                if fmt.spacing { lines_wa.push("".to_string()); lines_prev.push("".to_string()); }
            }
            if !fmt.spacing { lines_wa.push("".to_string()); lines_prev.push("".to_string()); }
        }
        if !cell.is_empty() {
            lines_wa.push(fmt.section_cd.clone()); lines_prev.push(fmt.section_cd.clone());
            for e in &cell {
                lines_wa.push(e.wa_line.clone()); lines_prev.push(e.disp_line.clone());
                if fmt.spacing { lines_wa.push("".to_string()); lines_prev.push("".to_string()); }
            }
            if !fmt.spacing { lines_wa.push("".to_string()); lines_prev.push("".to_string()); }
        }
        if !cell_bcch.is_empty() {
            lines_wa.push(fmt.section_bcch.clone()); lines_prev.push(fmt.section_bcch.clone());
            for e in &cell_bcch {
                lines_wa.push(e.wa_line.clone()); lines_prev.push(e.disp_line.clone());
                if fmt.spacing { lines_wa.push("".to_string()); lines_prev.push("".to_string()); }
            }
            if !fmt.spacing { lines_wa.push("".to_string()); lines_prev.push("".to_string()); }
        }
        let total_count = fully.len() + cell.len() + cell_bcch.len();
        let display = if !pic.is_empty() { format!("{}  |  {}", cl, pic) } else { cl.clone() };
        let mut all_entries = Vec::new(); all_entries.extend(fully); all_entries.extend(cell); all_entries.extend(cell_bcch);
        msgs.push(BroadcastMessage { msg: lines_wa.join("\n"), preview: lines_prev.join("\n"), cluster: cl, pic: pic.clone(), te: pic.clone(), rts: "".to_string(), display, count: total_count, entries: all_entries });
    }
    Ok(msgs)
}

#[tauri::command]
pub fn get_broadcast_format() -> Result<BroadcastFormat, String> { Ok(BroadcastFormat::default()) }

// -----------------------------------------
// WhatsApp Integration
// -----------------------------------------
#[tauri::command]
pub async fn wa_status() -> Result<Value, String> {
    let client = reqwest::Client::new();
    let res = client.get("http://127.0.0.1:3579/status").send().await.map_err(|e| e.to_string())?;
    let json = res.json::<Value>().await.map_err(|e| e.to_string())?;
    Ok(json)
}

#[tauri::command]
pub async fn wa_groups() -> Result<Value, String> {
    let client = reqwest::Client::new();
    let res = client.get("http://127.0.0.1:3579/groups").send().await.map_err(|e| e.to_string())?;
    let json = res.json::<Value>().await.map_err(|e| e.to_string())?;
    Ok(json)
}

#[tauri::command]
pub async fn wa_broadcast(targets: Vec<Value>, delay_ms: Option<u64>) -> Result<Value, String> {
    let client = reqwest::Client::new();
    let delay = delay_ms.unwrap_or(1500);
    let res = client.post("http://127.0.0.1:3579/broadcast").json(&serde_json::json!({ "targets": targets, "delay_ms": delay })).send().await.map_err(|e| e.to_string())?;
    let json = res.json::<Value>().await.map_err(|e| e.to_string())?;
    Ok(json)
}

#[tauri::command]
pub fn wa_start_server(app: tauri::AppHandle) -> Result<(), String> {
    use std::process::{Command, Stdio};
    use tauri::Manager;
    use tauri::path::BaseDirectory;

    // 1. Coba cari lokasi wa_server secara dinamis
    let mut wa_dir = std::path::PathBuf::new();
    let mut found = false;

    // A. Coba cari di folder resource Tauri (jika dibundle)
    if let Ok(resource_path) = app.path().resolve("wa_server", BaseDirectory::Resource) {
        if resource_path.exists() && resource_path.is_dir() {
            wa_dir = resource_path;
            found = true;
        }
    }
    if !found {
        if let Ok(resource_path) = app.path().resolve("_up_/_up_/wa_server", BaseDirectory::Resource) {
            if resource_path.exists() && resource_path.is_dir() {
                wa_dir = resource_path;
                found = true;
            }
        }
    }

    // B. Coba cari sibling dari executable (portable run)
    if !found {
        if let Ok(mut exe_path) = std::env::current_exe() {
            exe_path.pop(); // ke folder exe
            let sibling_path = exe_path.join("wa_server");
            if sibling_path.exists() && sibling_path.is_dir() {
                wa_dir = sibling_path;
                found = true;
            } else {
                // C. Coba cari relative path saat tauri dev (../../../wa_server)
                let dev_path = exe_path.join("../../..").join("wa_server");
                if dev_path.exists() && dev_path.is_dir() {
                    wa_dir = dev_path;
                    found = true;
                }
            }
        }
    }

    // D. Fallback ke path default pengembang jika tidak ditemukan
    if !found {
        let fallback = std::path::PathBuf::from("d:\\WEB\\PROJECT V2\\wa_server");
        if fallback.exists() {
            wa_dir = fallback;
            found = true;
        }
    }

    if !found {
        return Err("Folder 'wa_server' tidak ditemukan. Harap pastikan folder 'wa_server' berada di direktori aplikasi atau sibling executable.".to_string());
    }

    // 2. Cek apakah file server.js ada di folder wa_server tersebut
    if !wa_dir.join("server.js").exists() {
        return Err(format!(
            "File 'server.js' tidak ditemukan di folder: {:?}",
            wa_dir
        ));
    }

    // 3. Jalankan server node
    #[cfg(target_os = "windows")]
    {
        // Jalankan perintah node, tangkap jika gagal karena node tidak terinstal
        Command::new("cmd")
            .args(&["/C", "node server.js"])
            .current_dir(&wa_dir)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| {
                if e.kind() == std::io::ErrorKind::NotFound {
                    "Node.js tidak ditemukan di sistem. Harap instal Node.js terlebih dahulu agar fitur WhatsApp dapat berjalan.".to_string()
                } else {
                    format!("Gagal menjalankan WA server: {}", e)
                }
            })?;
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        Command::new("node")
            .arg("server.js")
            .current_dir(&wa_dir)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| {
                if e.kind() == std::io::ErrorKind::NotFound {
                    "Node.js tidak ditemukan di sistem. Harap instal Node.js terlebih dahulu agar fitur WhatsApp dapat berjalan.".to_string()
                } else {
                    format!("Gagal menjalankan WA server: {}", e)
                }
            })?;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn wa_logout() -> Result<Value, String> {
    let client = reqwest::Client::new();
    let res = client.post("http://127.0.0.1:3579/logout").send().await.map_err(|e| e.to_string())?;
    let json = res.json::<Value>().await.map_err(|e| e.to_string())?;
    Ok(json)
}

// -----------------------------------------
// Database Operations
// -----------------------------------------
#[tauri::command]
pub async fn pick_db_file(app: tauri::AppHandle) -> Result<String, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog().file().add_filter("Excel", &["xlsx", "xlsm", "xlsb"]).pick_file(move |file_path| {
        let path_str = match file_path {
            Some(p) => p.into_path().unwrap().to_string_lossy().to_string(),
            None => "".to_string(),
        };
        tx.send(path_str).unwrap();
    });
    let path = rx.recv().map_err(|e| e.to_string())?;
    Ok(path)
}

#[tauri::command]
pub fn load_db_excel(state: State<'_, AppState>, path: String) -> Result<usize, String> {
    if path.is_empty() { return Ok(0); }
    let mut workbook = open_workbook_auto(&path).map_err(|e| format!("Gagal membuka file Excel: {}", e))?;
    let sheet_names = workbook.sheet_names().to_vec();
    let first_sheet = sheet_names.first().ok_or("Sheet tidak ditemukan")?.clone();
    let range = workbook.worksheet_range(&first_sheet).map_err(|e| e.to_string())?;
    let (rows_count, _) = range.get_size();
    if rows_count == 0 { return Ok(0); }

    let mut db_rows = Vec::with_capacity(range.height());
    let mut db_lookup = HashMap::with_capacity(range.height());
    let mut db_indices = HashMap::new();
    let mut te_cache = HashMap::with_capacity(range.height());
    let mut headers = Vec::new();
    
    let cols_count = range.width();

    let mut site_id_idx: Option<usize> = None;
    let mut system_name_idx: Option<usize> = None;
    let mut new_site_idx: Option<usize> = None;

    for (i, row) in range.rows().enumerate() {
        if i == 0 {
            for (j, cell) in row.iter().enumerate() {
                let h_orig = cell.to_string().trim().to_string();
                let h = h_orig.to_uppercase();
                if h.contains("SITE") && h.contains("ID") && h.contains("MSH") { site_id_idx = Some(j); }
                if h.contains("SYSTEM") && h.contains("NAME") { system_name_idx = Some(j); }
                if h.contains("NEW") && h.contains("SITE") { new_site_idx = Some(j); }
                
                // Cache common columns for speed
                if h == "VENDOR" { db_indices.insert("VENDOR".to_string(), j); }
                if h.contains("LAT") { db_indices.insert("LAT".to_string(), j); }
                if h.contains("LONG") || h.contains("LON") { db_indices.insert("LON".to_string(), j); }
                if h == "MC" { db_indices.insert("MC".to_string(), j); }
                if h == "SITE NAME" { db_indices.insert("SITE_NAME".to_string(), j); }
                if h == "OLD SITE ID" || h == "OLD_SITE_ID" || (h.contains("OLD") && h.contains("SITE")) { db_indices.insert("OLD_SITE".to_string(), j); }
                
                // Flexible TE/CME Name detection (use first occurrence for Database Lookup tab)
                if h == "TE NAME" || h == "TE_NAME" || h == "PIC" { db_indices.entry("TE_NAME".to_string()).or_insert(j); }
                if h == "TE PHONE" || h == "TE_PHONE" || h == "TE PHONE NUMBER" { db_indices.entry("TE_PHONE".to_string()).or_insert(j); }
                if h == "TE EMAIL" || h == "TE_EMAIL" { db_indices.entry("TE_EMAIL".to_string()).or_insert(j); }
                if h == "CME NAME" || h == "CME_NAME" { db_indices.entry("CME_NAME".to_string()).or_insert(j); }
                if h == "CME PHONE" || h == "CME_PHONE" || h == "CME PHONE NUMBER" { db_indices.entry("CME_PHONE".to_string()).or_insert(j); }
                if h == "CME EMAIL" || h == "CME_EMAIL" { db_indices.entry("CME_EMAIL".to_string()).or_insert(j); }
                if h == "FM OFFICE" || h == "FM_OFFICE" || h == "FM OFFICE NEW" { db_indices.entry("FM_OFFICE".to_string()).or_insert(j); }
                if h.contains("HOST") && h.contains("NAME") { db_indices.entry("HOST_NAME".to_string()).or_insert(j); }
                if h == "TLP" || h == "TLP NAME" || h == "TLP_NAME" { db_indices.entry("TLP".to_string()).or_insert(j); }
                
                headers.push(h_orig);
            }
            // Fallbacks for hardcoded indices if not found by name
            if !db_indices.contains_key("TE_NAME") { db_indices.insert("TE_NAME".to_string(), 32); }
            if !db_indices.contains_key("TE_PHONE") { db_indices.insert("TE_PHONE".to_string(), 33); }
            if !db_indices.contains_key("TE_EMAIL") { db_indices.insert("TE_EMAIL".to_string(), 35); }
            if !db_indices.contains_key("CME_NAME") { db_indices.insert("CME_NAME".to_string(), 28); }
            if !db_indices.contains_key("CME_PHONE") { db_indices.insert("CME_PHONE".to_string(), 29); }
            if !db_indices.contains_key("CME_EMAIL") { db_indices.insert("CME_EMAIL".to_string(), 31); }
            if !db_indices.contains_key("FM_OFFICE") { db_indices.insert("FM_OFFICE".to_string(), 11); }
            if !db_indices.contains_key("HOST_NAME") { db_indices.insert("HOST_NAME".to_string(), 132); }
            if !db_indices.contains_key("TLP") { db_indices.insert("TLP".to_string(), 50); }

        } else {
            // OPTIMIZATION: Only convert cells to string once.
            let mut row_vec = Vec::with_capacity(cols_count);
            for cell in row.iter() {
                let val = match cell {
                    Data::String(s) => s.trim().to_string(),
                    Data::Empty => String::new(),
                    Data::Float(f) => if f.fract() == 0.0 { (*f as i64).to_string() } else { f.to_string() },
                    Data::Int(i) => i.to_string(),
                    _ => cell.to_string().trim().to_string(),
                };
                row_vec.push(val);
            }
            
            let row_idx = db_rows.len();
            let key = if let Some(idx) = site_id_idx { row_vec.get(idx).cloned().unwrap_or_default() }
                      else if let Some(idx) = system_name_idx { row_vec.get(idx).cloned().unwrap_or_default() }
                      else if let Some(idx) = new_site_idx { row_vec.get(idx).cloned().unwrap_or_default() }
                      else { String::new() };
            
            let key_up = key.trim().to_uppercase();
            if !key_up.is_empty() && !db_lookup.contains_key(&key_up) {
                db_lookup.insert(key_up.clone(), row_idx);
                
                // TE Cache uses the exact same TE Name index as shown in the database lookup
                let te_idx = db_indices.get("TE_NAME").cloned().unwrap_or(32);
                if let Some(te) = row_vec.get(te_idx).cloned() {
                    let te = te.trim().to_string();
                    if !te.is_empty() && te != "nan" && te != "0" {
                        te_cache.insert(key_up, te);
                    }
                }
            }
            db_rows.push(row_vec);
        }
    }
    
    let count = db_rows.len();
    *state.db_te_cache.lock().unwrap() = te_cache;
    *state.db_lookup.lock().unwrap() = db_lookup;
    *state.db_indices.lock().unwrap() = db_indices;
    *state.db_df.lock().unwrap() = db_rows;
    *state.db_headers.lock().unwrap() = headers;
    Ok(count)
}


#[tauri::command]
pub fn lookup_site(state: State<'_, AppState>, site_id: String) -> Result<Option<HashMap<String, String>>, String> {
    let db = state.db_df.lock().unwrap();
    let db_lookup = state.db_lookup.lock().unwrap();
    let headers = state.db_headers.lock().unwrap();
    let idx_cache = state.db_indices.lock().unwrap();
    
    let sid = site_id.trim().to_uppercase();
    if let Some(&idx) = db_lookup.get(&sid) {
        if let Some(row_vec) = db.get(idx) {
            let mut out = HashMap::new();
            
            let g = |c: &str| -> String {
                headers.iter().position(|h| h.to_uppercase() == c.to_uppercase())
                    .and_then(|i| row_vec.get(i))
                    .cloned()
                    .unwrap_or_default()
            };
            
            let g_idx = |idx: usize| -> String {
                row_vec.get(idx).cloned().unwrap_or_default()
            };
            
            let te_idx = idx_cache.get("TE_NAME").cloned().unwrap_or(32);
            let ph_idx = idx_cache.get("TE_PHONE").cloned().unwrap_or(33);
            let em_idx = idx_cache.get("TE_EMAIL").cloned().unwrap_or(35);
            let cme_name_idx = idx_cache.get("CME_NAME").cloned().unwrap_or(28);
            let cme_phone_idx = idx_cache.get("CME_PHONE").cloned().unwrap_or(29);
            let cme_email_idx = idx_cache.get("CME_EMAIL").cloned().unwrap_or(31);
            let host_idx = idx_cache.get("HOST_NAME").cloned().unwrap_or(132);
            let fm_idx = idx_cache.get("FM_OFFICE").cloned().unwrap_or(11);
            let tlp_idx = idx_cache.get("TLP").cloned().unwrap_or(50);
            
            out.insert("Site ID (New)".to_string(), g("Site ID MSH"));
            out.insert("Old Site ID".to_string(), g("Old Site ID"));
            out.insert("Site Name".to_string(), g("Site Name"));
            out.insert("Host Name".to_string(), g_idx(host_idx));
            out.insert("Cluster (MC)".to_string(), g("MC"));
            out.insert("FM Office".to_string(), g_idx(fm_idx));
            out.insert("Area".to_string(), g("Area"));
            out.insert("Vendor".to_string(), g("Vendor"));
            out.insert("TE Name".to_string(), g_idx(te_idx));
            out.insert("TE Phone".to_string(), g_idx(ph_idx));
            out.insert("TE Email".to_string(), g_idx(em_idx));
            out.insert("Longitude".to_string(), g("Long"));
            out.insert("Latitude".to_string(), g("Lat"));
            out.insert("RTS Name".to_string(), g("RTS Name"));
            out.insert("RTS Phone".to_string(), g("RTS Phone Name"));
            out.insert("CME Name".to_string(), g_idx(cme_name_idx));
            out.insert("CME Phone".to_string(), g_idx(cme_phone_idx));
            out.insert("CME Email".to_string(), g_idx(cme_email_idx));
            out.insert("Site Class".to_string(), g("Site Class"));
            out.insert("Hub Type".to_string(), g("Hub Type"));
            out.insert("Address".to_string(), g("Address"));
            out.insert("RTS Email".to_string(), g("RTS Email"));
            out.insert("RTS NEW".to_string(), g("RTS NEW"));
            out.insert("TLP".to_string(), g_idx(tlp_idx));
            
            return Ok(Some(out));
        }
    }
    Ok(None)
}

#[derive(Serialize)]
pub struct MapSite { pub site_id: String, pub site_name: String, pub cluster: String, pub rts: String, pub lat: f64, pub lon: f64, pub status: String, pub impact: String, pub start_time: String, pub remark: String }

#[tauri::command]
pub fn get_down_sites_coords(state: State<'_, AppState>) -> Result<Vec<MapSite>, String> {
    let down_sites = check_site_status(state.clone())?;
    let db = state.db_df.lock().unwrap();
    let db_lookup = state.db_lookup.lock().unwrap();
    let idx_cache = state.db_indices.lock().unwrap();
    
    let lat_idx = idx_cache.get("LAT").cloned();
    let lon_idx = idx_cache.get("LON").cloned();
    
    if lat_idx.is_none() || lon_idx.is_none() { return Ok(Vec::new()); }
    let (lat_idx, lon_idx) = (lat_idx.unwrap(), lon_idx.unwrap());
    
    let mut map_data = Vec::new();
    for s in down_sites {
        if s.status == "DOWN" {
            if let Some(&idx) = db_lookup.get(&s.new_site.to_uppercase()) {
                if let Some(row) = db.get(idx) {
                    let lat_str = row.get(lat_idx).cloned().unwrap_or_default();
                    let lon_str = row.get(lon_idx).cloned().unwrap_or_default();
                    if let (Ok(lat), Ok(lon)) = (lat_str.parse::<f64>(), lon_str.parse::<f64>()) {
                        map_data.push(MapSite { site_id: s.new_site, site_name: s.site_name, cluster: s.cluster, rts: s.rts, lat, lon, status: s.status.clone(), impact: s.impact.clone(), start_time: s.start_time.clone(), remark: s.remark.clone() });
                    }
                }
            }
        }
    }
    Ok(map_data)
}

#[tauri::command]
pub fn check_site_status(state: State<'_, AppState>) -> Result<Vec<SiteStatus>, String> {
    let mdf = state.master_df.lock().unwrap();
    let sdf = state.sub_master_df.lock().unwrap();
    let db_df = state.db_df.lock().unwrap();
    let db_lookup = state.db_lookup.lock().unwrap();
    let db_te_lookup = state.db_te_cache.lock().unwrap();
    let idx_cache = state.db_indices.lock().unwrap();
    
    if mdf.is_empty() && sdf.is_empty() { return Ok(Vec::new()); }
    
    let vendor_idx = idx_cache.get("VENDOR").cloned();
    let old_site_idx = idx_cache.get("OLD_SITE").cloned();
    
    let mut results = Vec::new();
    let mut last_fmt_idx: Option<usize> = None;
    let formats = ["%d/%m/%Y %H:%M:%S", "%d-%m-%Y %H:%M:%S", "%d/%m/%Y %H:%M", "%d-%m-%Y %H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%m/%d/%Y %H:%M", "%d-%b-%y %H:%M"];

    // 1. Collect all active DOWN sites from master_df (mdf)
    let mut m_site_ids = HashSet::new();
    let mut m_ns_col = None;
    if let Some(first) = mdf.first() {
        m_ns_col = fc(first, &["NEW", "SITE"]);
    }

    if let Some(ref ns_col) = m_ns_col {
        for row in mdf.iter() {
            if let Some(ns) = row.get(ns_col) {
                let ns_val = ns.trim().to_string();
                if ns_val.is_empty() || ns_val == "0" || ns_val.to_lowercase() == "nan" { continue; }
                let ns_upper = ns_val.to_uppercase();
                m_site_ids.insert(ns_upper.clone());

                let nm = get_val(row, &["SITE", "NAME"]);
                let cl = get_val(row, &["CLUSTER"]);
                let mut ol = get_val(row, &["OLD", "SITE"]);
                if ol.is_empty() {
                    if let Some(idx) = old_site_idx {
                        ol = db_lookup.get(&ns_upper)
                            .and_then(|&row_idx| db_df.get(row_idx))
                            .and_then(|r| r.get(idx))
                            .cloned()
                            .unwrap_or_default();
                    }
                }
                let cat = get_val(row, &["CATEGORY"]);
                let s_cls = get_val(row, &["SITE", "CLASS"]);
                
                let pic = db_te_lookup.get(&ns_upper).cloned().unwrap_or_default();
                let vendor = if let Some(idx) = vendor_idx { 
                    db_lookup.get(&ns_upper)
                        .and_then(|&row_idx| db_df.get(row_idx))
                        .and_then(|r| r.get(idx))
                        .cloned()
                        .unwrap_or_default() 
                } else { String::new() };

                let st = get_val(row, &["START"]);
                let mut agg = get_val(row, &["AGG"]);
                if agg.is_empty() { agg = calc_dur(&st); }
                let rts = get_val(row, &["RTS"]);
                let rem = get_val(row, &["REMARK"]);
                let imp = get_val(row, &["IMPACT"]);

                // Optimized Date Parsing
                let s_parsed = st.replace("|", " ").trim().to_string();
                let s_parsed = if s_parsed.to_lowercase().ends_with(" p") { s_parsed[..s_parsed.len() - 2].trim().to_string() } else if s_parsed.to_lowercase().ends_with("p") { s_parsed[..s_parsed.len() - 1].trim().to_string() } else { s_parsed };
                
                let mut start_ts = 0;
                if !s_parsed.is_empty() {
                    if let Some(idx) = last_fmt_idx {
                        if let Ok(dt) = NaiveDateTime::parse_from_str(&s_parsed, formats[idx]) {
                            start_ts = dt.and_utc().timestamp();
                        }
                    }
                    if start_ts == 0 {
                        for (idx, fmt) in formats.iter().enumerate() {
                            if let Ok(dt) = NaiveDateTime::parse_from_str(&s_parsed, fmt) {
                                start_ts = dt.and_utc().timestamp();
                                last_fmt_idx = Some(idx);
                                break;
                            }
                        }
                    }
                }

                results.push(SiteStatus {
                    status: "DOWN".to_string(),
                    icon: "❌".to_string(),
                    new_site: ns_val,
                    site_name: nm,
                    cluster: cl,
                    impact: imp,
                    rts,
                    start_time: fmt_st(&st),
                    agging: agg,
                    remark: rem,
                    start_timestamp: start_ts,
                    old_site: ol,
                    category: if cat.is_empty() { get_val(row, &["CATEG"]) } else { cat },
                    site_class: s_cls,
                    pic,
                    vendor
                });
            }
        }
    }

    // 2. Collect all recovered UP sites from sub_master_df (sdf) which are no longer in mdf
    let mut s_ns_col = None;
    if let Some(first) = sdf.first() {
        s_ns_col = fc(first, &["NEW", "SITE"]);
    }

    if let Some(ref ns_col) = s_ns_col {
        for row in sdf.iter() {
            if let Some(ns) = row.get(ns_col) {
                let ns_val = ns.trim().to_string();
                if ns_val.is_empty() || ns_val == "0" || ns_val.to_lowercase() == "nan" { continue; }
                let ns_upper = ns_val.to_uppercase();

                // If it is NOT in m_site_ids, it means it was recovered (went UP)!
                if !m_site_ids.contains(&ns_upper) {
                    let nm = get_val(row, &["SITE", "NAME"]);
                    let cl = get_val(row, &["CLUSTER"]);
                    let mut ol = get_val(row, &["OLD", "SITE"]);
                    if ol.is_empty() {
                        if let Some(idx) = old_site_idx {
                            ol = db_lookup.get(&ns_upper)
                                .and_then(|&row_idx| db_df.get(row_idx))
                                .and_then(|r| r.get(idx))
                                .cloned()
                                .unwrap_or_default();
                        }
                    }
                    let cat = get_val(row, &["CATEGORY"]);
                    let s_cls = get_val(row, &["SITE", "CLASS"]);
                    
                    let pic = db_te_lookup.get(&ns_upper).cloned().unwrap_or_default();
                    let vendor = if let Some(idx) = vendor_idx { 
                        db_lookup.get(&ns_upper)
                            .and_then(|&row_idx| db_df.get(row_idx))
                            .and_then(|r| r.get(idx))
                            .cloned()
                            .unwrap_or_default() 
                    } else { String::new() };

                    let st = get_val(row, &["START"]);
                    let mut agg = get_val(row, &["AGG"]);
                    if agg.is_empty() { agg = calc_dur(&st); }
                    let rts = get_val(row, &["RTS"]);
                    let rem = get_val(row, &["REMARK"]);
                    let imp = get_val(row, &["IMPACT"]);

                    // Optimized Date Parsing
                    let s_parsed = st.replace("|", " ").trim().to_string();
                    let s_parsed = if s_parsed.to_lowercase().ends_with(" p") { s_parsed[..s_parsed.len() - 2].trim().to_string() } else if s_parsed.to_lowercase().ends_with("p") { s_parsed[..s_parsed.len() - 1].trim().to_string() } else { s_parsed };
                    
                    let mut start_ts = 0;
                    if !s_parsed.is_empty() {
                        if let Some(idx) = last_fmt_idx {
                            if let Ok(dt) = NaiveDateTime::parse_from_str(&s_parsed, formats[idx]) {
                                start_ts = dt.and_utc().timestamp();
                            }
                        }
                        if start_ts == 0 {
                            for (idx, fmt) in formats.iter().enumerate() {
                                if let Ok(dt) = NaiveDateTime::parse_from_str(&s_parsed, fmt) {
                                    start_ts = dt.and_utc().timestamp();
                                    last_fmt_idx = Some(idx);
                                    break;
                                }
                            }
                        }
                    }

                    results.push(SiteStatus {
                        status: "UP".to_string(),
                        icon: "✅".to_string(),
                        new_site: ns_val,
                        site_name: nm,
                        cluster: cl,
                        impact: imp,
                        rts,
                        start_time: fmt_st(&st),
                        agging: agg,
                        remark: rem,
                        start_timestamp: start_ts,
                        old_site: ol,
                        category: if cat.is_empty() { get_val(row, &["CATEG"]) } else { cat },
                        site_class: s_cls,
                        pic,
                        vendor
                    });
                }
            }
        }
    }

    Ok(results)
}

// -----------------------------------------
// Others: WA Management & DB Edit
// -----------------------------------------
#[tauri::command]
pub fn get_wa_config(app: tauri::AppHandle, state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    use tauri::Manager;
    let mut config = state.wa_config.lock().unwrap();
    if config["saved_groups"].as_array().map_or(true, |a| a.is_empty()) {
        if let Ok(path) = app.path().app_config_dir() {
            let file_path = path.join("wa_config.json");
            if file_path.exists() {
                if let Ok(content) = std::fs::read_to_string(&file_path) {
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                        *config = val;
                    }
                }
            }
        }
    }
    Ok(config.clone())
}

#[tauri::command]
pub fn save_wa_groups(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    saved_groups: Vec<serde_json::Value>,
) -> Result<(), String> {
    use tauri::Manager;
    let mut config = state.wa_config.lock().unwrap();
    config["saved_groups"] = serde_json::Value::Array(saved_groups);
    
    if let Ok(path) = app.path().app_config_dir() {
        let _ = std::fs::create_dir_all(&path);
        let file_path = path.join("wa_config.json");
        if let Ok(json_str) = serde_json::to_string_pretty(&*config) {
            let _ = std::fs::write(file_path, json_str);
        }
    }
    Ok(())
}

#[derive(Deserialize)]
pub struct SiteEditData {
    pub site_id: String, pub lon: String, pub site_name: String, pub lat: String, pub old_site_id: String, pub tlp: String, pub cluster: String, pub site_class: String, pub area: String, pub hub_type: String, pub fm_office: String, pub address: String, pub vendor: String, pub host_name: String,
    pub rts_name: String, pub rts_email: String, pub rts_phone: String, pub rts_new: String,
    pub te_name: String, pub te_phone: String, pub te_email: String,
    pub cme_name: String, pub cme_phone: String, pub cme_email: String,
}

#[tauri::command]
pub fn update_site_db(state: State<'_, AppState>, edit_data: SiteEditData) -> Result<(), String> {
    let mut db = state.db_df.lock().unwrap();
    let headers = state.db_headers.lock().unwrap();
    let idx_cache = state.db_indices.lock().unwrap();
    
    if db.is_empty() { return Err("DB kosong".into()); }
    
    let key_idx = headers.iter().position(|h| h.contains("SITE ID MSH")).ok_or("Kolom SITE ID MSH tidak ditemukan")?;
    let sid_upper = edit_data.site_id.to_uppercase();
    
    for row_vec in db.iter_mut() {
        if let Some(val) = row_vec.get(key_idx) {
            if val.to_uppercase() == sid_upper {
                // Update based on cached indices
                let mut update_field = |row: &mut Vec<String>, idx_key: &str, new_val: &str| {
                    if let Some(&idx) = idx_cache.get(idx_key) {
                        if let Some(cell) = row.get_mut(idx) { *cell = new_val.to_string(); }
                    }
                };
                
                update_field(row_vec, "LON", &edit_data.lon);
                update_field(row_vec, "LAT", &edit_data.lat);
                update_field(row_vec, "SITE_NAME", &edit_data.site_name);
                update_field(row_vec, "MC", &edit_data.cluster);
                update_field(row_vec, "VENDOR", &edit_data.vendor);
                update_field(row_vec, "TE_NAME", &edit_data.te_name);
                update_field(row_vec, "TE_PHONE", &edit_data.te_phone);
                update_field(row_vec, "TE_EMAIL", &edit_data.te_email);
                update_field(row_vec, "CME_NAME", &edit_data.cme_name);
                update_field(row_vec, "CME_PHONE", &edit_data.cme_phone);
                update_field(row_vec, "CME_EMAIL", &edit_data.cme_email);
                update_field(row_vec, "FM_OFFICE", &edit_data.fm_office);
                update_field(row_vec, "HOST_NAME", &edit_data.host_name);
                update_field(row_vec, "TLP", &edit_data.tlp);

                // Fallback for fields not in cache
                let mut try_update_raw = |row: &mut Vec<String>, k_match: &str, new_val: &str| {
                    if let Some(idx) = headers.iter().position(|h| h.contains(k_match)) {
                        if let Some(cell) = row.get_mut(idx) { *cell = new_val.to_string(); }
                    }
                };

                try_update_raw(row_vec, "OLD SITE", &edit_data.old_site_id);
                try_update_raw(row_vec, "SITE CLASS", &edit_data.site_class);
                try_update_raw(row_vec, "AREA", &edit_data.area);
                try_update_raw(row_vec, "HUB TYPE", &edit_data.hub_type);
                try_update_raw(row_vec, "ADDRESS", &edit_data.address);
                try_update_raw(row_vec, "RTS NAME", &edit_data.rts_name);
                try_update_raw(row_vec, "RTS EMAIL", &edit_data.rts_email);
                try_update_raw(row_vec, "RTS PHONE", &edit_data.rts_phone);
                try_update_raw(row_vec, "RTS NEW", &edit_data.rts_new);
                try_update_raw(row_vec, "CME NAME", &edit_data.cme_name);
                try_update_raw(row_vec, "CME PHONE", &edit_data.cme_phone);
                try_update_raw(row_vec, "CME EMAIL", &edit_data.cme_email);
                
                // Update active in-memory TE cache
                let mut te_cache = state.db_te_cache.lock().unwrap();
                let te = edit_data.te_name.trim().to_string();
                if !te.is_empty() && te != "nan" && te != "0" {
                    te_cache.insert(sid_upper, te);
                } else {
                    te_cache.remove(&sid_upper);
                }

                return Ok(());
            }
        }
    }
    Err("Site tidak ditemukan di memory".into())
}

#[tauri::command]
pub async fn export_db(app: tauri::AppHandle, state: State<'_, AppState>) -> Result<String, String> {
    use rust_xlsxwriter::{Workbook, Format};
    let db = state.db_df.lock().unwrap().clone();
    let headers = state.db_headers.lock().unwrap().clone();
    if db.is_empty() { return Err("DB kosong".into()); }
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog().file().add_filter("Excel", &["xlsx"]).save_file(move |file_path| {
        let path_str = match file_path { Some(p) => p.into_path().unwrap().to_string_lossy().to_string(), None => "".to_string() };
        tx.send(path_str).unwrap();
    });
    let path = rx.recv().map_err(|e| e.to_string())?;
    if path.is_empty() { return Ok("Batal menyimpan".into()); }
    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();
    let bold = Format::new().set_bold();
    for (col_idx, header) in headers.iter().enumerate() { worksheet.write_string_with_format(0, col_idx as u16, header, &bold).map_err(|e| e.to_string())?; }
    for (row_idx, row_vec) in db.iter().enumerate() {
        for (col_idx, val) in row_vec.iter().enumerate() { worksheet.write_string((row_idx + 1) as u32, col_idx as u16, val).map_err(|e| e.to_string())?; }
    }
    workbook.save(&path).map_err(|e| e.to_string())?;
    Ok(format!("Tersimpan di {}", path))
}

#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let safe_url = url.replace("&", "^&");
        std::process::Command::new("cmd").args(["/C", "start", "", &safe_url]).spawn().map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "windows"))]
    { std::process::Command::new("xdg-open").arg(&url).spawn().map_err(|e| e.to_string())?; }
    Ok(())
}

fn haversine(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    let r = 6371.0; let d_lat = (lat2 - lat1).to_radians(); let d_lon = (lon2 - lon1).to_radians();
    let a = (d_lat / 2.0).sin().powi(2) + lat1.to_radians().cos() * lat2.to_radians().cos() * (d_lon / 2.0).sin().powi(2);
    let c = 2.0 * a.sqrt().atan2((1.0 - a).sqrt());
    r * c
}

#[tauri::command]
pub fn find_nearest_sites(state: State<'_, AppState>, lat: f64, lon: f64, limit: usize) -> Result<Vec<serde_json::Value>, String> {
    let db = state.db_df.lock().unwrap();
    let headers = state.db_headers.lock().unwrap();
    let idx_cache = state.db_indices.lock().unwrap();
    
    let lat_idx = idx_cache.get("LAT").cloned();
    let lon_idx = idx_cache.get("LON").cloned();
    
    if lat_idx.is_none() || lon_idx.is_none() { return Ok(Vec::new()); }
    let (lat_idx, lon_idx) = (lat_idx.unwrap(), lon_idx.unwrap());
    
    // Find Site ID column index case-insensitively
    let sid_idx = headers.iter().position(|h| {
        let hu = h.to_uppercase();
        hu.contains("SITE") && hu.contains("ID") && hu.contains("MSH")
    }).or_else(|| {
        headers.iter().position(|h| {
            let hu = h.to_uppercase();
            hu.contains("SITE ID") || hu.contains("NEW SITE")
        })
    });
    
    let mut distances = Vec::new();
    let mut seen_sids = HashSet::new();
    
    for row in db.iter() {
        let (row_lat_str, row_lon_str) = (row.get(lat_idx).cloned().unwrap_or_default(), row.get(lon_idx).cloned().unwrap_or_default());
        let (site_lat, site_lon) = (row_lat_str.parse::<f64>().unwrap_or(0.0), row_lon_str.parse::<f64>().unwrap_or(0.0));
        
        if site_lat != 0.0 && site_lon != 0.0 {
            let sid = sid_idx.and_then(|i| row.get(i)).cloned().unwrap_or_default();
            let sid_upper = sid.trim().to_uppercase();
            
            // Skip invalid PLMN or MRBTS site IDs to only show clean New Site IDs
            if sid_upper.contains("PLMN") || sid_upper.contains("MRBTS") {
                continue;
            }
            
            // Deduplicate by Site ID to prevent double/multiple outputs for the same physical site
            if !sid_upper.is_empty() {
                if seen_sids.contains(&sid_upper) {
                    continue;
                }
                seen_sids.insert(sid_upper.clone());
            }
            
            distances.push((haversine(lat, lon, site_lat, site_lon), row, site_lat, site_lon, sid));
        }
    }
    
    distances.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
    
    let top_k = distances.into_iter().take(limit).map(|(dist, row, r_lat, r_lon, sid)| {
        let site_name_idx = idx_cache.get("SITE_NAME").cloned();
        let mc_idx = idx_cache.get("MC").cloned();
        
        let site_name = site_name_idx.and_then(|i| row.get(i)).cloned().unwrap_or_default();
        let cluster = mc_idx.and_then(|i| row.get(i)).cloned().unwrap_or_default();
        
        // RTS Name search (slow but ok for top K)
        let rts_idx = headers.iter().position(|h| h.to_uppercase() == "RTS NAME");
        let rts = rts_idx.and_then(|i| row.get(i)).cloned().unwrap_or_default();
        
        serde_json::json!({ "site_id": sid, "site_name": site_name, "cluster": cluster, "rts": rts, "lat": r_lat, "lon": r_lon, "distance_km": dist })
    }).collect();
    
    Ok(top_k)
}
