const fs = require('fs');
let lib = fs.readFileSync('src-tauri/src/lib.rs', 'utf8');
if (!lib.includes('find_nearest_sites')) {
  lib = lib.replace('open_url', 'open_url,\n            find_nearest_sites');
  fs.writeFileSync('src-tauri/src/lib.rs', lib, 'utf8');
  console.log('Exposed find_nearest_sites in lib.rs');
}
