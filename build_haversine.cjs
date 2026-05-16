const fs = require('fs');

let rs = fs.readFileSync('src-tauri/src/commands.rs', 'utf8');

const rsHaversine = `
fn haversine(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    let r = 6371.0; // Earth radius in km
    let d_lat = (lat2 - lat1).to_radians();
    let d_lon = (lon2 - lon1).to_radians();
    let a = (d_lat / 2.0).sin().powi(2)
        + lat1.to_radians().cos() * lat2.to_radians().cos() * (d_lon / 2.0).sin().powi(2);
    let c = 2.0 * a.sqrt().atan2((1.0 - a).sqrt());
    r * c
}

#[tauri::command]
pub fn find_nearest_sites(state: State<'_, AppState>, lat: f64, lon: f64, limit: usize) -> Result<Vec<serde_json::Value>, String> {
    let db = state.db_df.lock().unwrap();
    let headers = state.db_headers.lock().unwrap();
    
    let mut distances = Vec::new();
    
    for row in db.iter() {
        let g = |c: &str| -> String {
            for key in row.keys() {
                if key.to_uppercase().contains(&c.to_uppercase()) {
                    return row.get(key).cloned().unwrap_or_default();
                }
            }
            String::new()
        };

        // Try exact first, then fallback
        let mut row_lat_str = g("LAT");
        let mut row_lon_str = g("LONG");
        if row_lon_str.is_empty() { row_lon_str = g("LON"); }
        
        let site_lat = row_lat_str.parse::<f64>().unwrap_or(0.0);
        let site_lon = row_lon_str.parse::<f64>().unwrap_or(0.0);
        
        if site_lat != 0.0 && site_lon != 0.0 {
            let dist = haversine(lat, lon, site_lat, site_lon);
            distances.push((dist, row.clone(), site_lat, site_lon));
        }
    }
    
    // Sort by distance ascending
    distances.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
    
    let top_k = distances.into_iter().take(limit).map(|(dist, row, r_lat, r_lon)| {
        let g = |c: &str| -> String {
            for key in row.keys() {
                if key.to_uppercase() == c.to_uppercase() {
                    return row.get(key).cloned().unwrap_or_default();
                }
            }
            String::new()
        };
        
        let gcol = |idx: usize| -> String {
            if idx < headers.len() {
                row.get(&headers[idx]).cloned().unwrap_or_default()
            } else {
                String::new()
            }
        };

        let sid = g("Site ID MSH");
        let site_name = g("Site Name");
        let cluster = g("MC");
        let rts = g("RTS Name");
        
        serde_json::json!({
            "site_id": sid,
            "site_name": site_name,
            "cluster": cluster,
            "rts": rts,
            "lat": r_lat,
            "lon": r_lon,
            "distance_km": dist
        })
    }).collect();
    
    Ok(top_k)
}
`;

if (!rs.includes('pub fn find_nearest_sites')) {
  rs += rsHaversine;
  fs.writeFileSync('src-tauri/src/commands.rs', rs, 'utf8');
  console.log('Added find_nearest_sites to commands.rs');
} else {
  console.log('find_nearest_sites already exists in commands.rs');
}
