# 🌟 CJHelper App

<div align="center">
  <img src="src-tauri/icons/128x128.png" alt="CJHelper Logo" width="128" height="128" style="border-radius: 24px; box-shadow: 0 8px 30px rgba(0,0,0,0.3); margin-bottom: 20px;" />

  <h3>Asisten Desktop Modern untuk Manajemen Database & WhatsApp Broadcasting</h3>

  [![Tauri Version](https://img.shields.io/badge/Tauri-v2-blue?style=for-the-badge&logo=tauri)](https://tauri.app/)
  [![Rust](https://img.shields.io/badge/Rust-Backend-orange?style=for-the-badge&logo=rust)](https://www.rust-lang.org/)
  [![Vanilla JS](https://img.shields.io/badge/JS-Vanilla-yellow?style=for-the-badge&logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
  [![Security](https://img.shields.io/badge/Security-Minisign_Signed-green?style=for-the-badge&logo=dependabot)](https://jedisct1.github.io/minisign/)
</div>

---

**CJHelper** adalah aplikasi desktop modern berbasis **Tauri v2** dan **Rust** dengan antarmuka web bergaya *glassmorphic* premium. Aplikasi ini dirancang khusus untuk mempermudah operasi WhatsApp broadcasting massal yang aman serta pengolahan database berskala besar secara responsif dan super cepat.

---

## ✨ Fitur Unggulan

### 1. 🚀 WhatsApp Blaster & Broadcaster Pro
*   **Anti-Bot & Human Simulation:** Mencegah pemblokiran akun dengan simulasi pengetikan manusia (typing state), status online tiruan, tanda terima baca (read receipts), serta jeda waktu pengiriman acak yang dinamis.
*   **Format Pesan Cerdas:** Pembulatan otomatis jadwal kirim, visibilitas remark opsional, dan templat dinamis yang terintegrasi langsung dengan data.
*   **Stabilitas Sesi:** Manajemen koneksi otomatis yang mencegah crash pada sesi WhatsApp Web dan secara otomatis melepas file lock jika terjadi pemutusan.

### 2. ⚡ Database Engine yang Dioptimalkan
*   **Virtual Tree Rendering:** Mampu memuat dan menampilkan ratusan hingga ribuan entitas grup database secara instan tanpa mengalami lag/GUI membeku.
*   **Penyaringan & Pencarian Cepat:** Pencarian database berkinerja tinggi langsung melalui backend Rust.

### 3. 🔒 Keamanan & Auto-Updater Mandiri
*   Fitur pembaruan otomatis terenkripsi menggunakan tanda tangan digital **Minisign** untuk memastikan rilis pembaruan tidak dapat dimanipulasi oleh pihak ketiga.

---

## 🛠️ Prasyarat Instalasi

Sebelum memulai pengembangan atau menjalankan build, pastikan sistem Anda memiliki:
*   [Rust](https://www.rust-lang.org/tools/install) (versi terbaru, disarankan menggunakan `rustup`)
*   [Node.js](https://nodejs.org/) (versi LTS)
*   [Build Tools untuk Windows C++](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (jika menggunakan OS Windows)

---

## 🚀 Menjalankan Aplikasi di Lokal

1.  **Clone Repositori:**
    ```bash
    git clone https://github.com/youthloser666/cjhelper-tauri.git
    cd cjhelper-app
    ```

2.  **Instalasi Dependensi:**
    ```bash
    npm install
    ```

3.  **Jalankan Mode Pengembangan (Dev Mode):**
    ```bash
    npm run tauri dev
    ```

---

## 📦 Panduan Build & Auto-Update

### 1. Mempersiapkan Kunci Tanda Tangan (Signer Key)
Untuk merilis pembaruan baru, file updater `.zip` harus ditandatangani. Jika Anda belum memiliki pasangan kunci, buat terlebih dahulu:
```bash
npx tauri signer generate -w ./cjhelper.key
```
*Catatan: File `*.key` privat Anda aman dan sudah diabaikan (`.gitignore`) agar tidak terunggah ke repositori.*

### 2. Melakukan Build dengan Kunci Privat
Ekspor kunci privat Anda ke dalam environment variable sebelum melakukan kompilasi rilis:

**Di PowerShell (Windows):**
```powershell
$env:TAURI_SIGNING_PRIVATE_KEY="d:\WEB\PROJECT V2\cjhelper-app\cjhelper.key"
npm run tauri build
```

**Di Bash (Linux/macOS):**
```bash
export TAURI_SIGNING_PRIVATE_KEY="/path/to/cjhelper.key"
npm run tauri build
```

### 3. Memperbarui `latest.json`
Setelah build selesai, salin seluruh isi teks dari file tanda tangan digital yang dihasilkan:
`src-tauri/target/release/bundle/nsis/cjhelper-app_[VERSION]_x64-setup.nsis.zip.sig`

Lalu tempelkan ke kolom `signature` pada file `latest.json` di root direktori proyek Anda.

---

## 📂 Struktur Proyek

```text
├── src/                  # Kode antarmuka (Frontend - HTML, CSS, JS)
│   ├── assets/           # Media & Gambar
│   ├── index.html        # UI Utama Aplikasi
│   ├── styles.css        # Styling Glassmorphism Premium
│   └── main.js           # Logika interaksi frontend & Integrasi IPC Tauri
├── src-tauri/            # Kode sistem & backend (Backend - Rust)
│   ├── src/
│   │   ├── main.rs       # Entrypoint aplikasi Rust
│   │   └── commands.rs   # Penanganan command Rust (Database & WA logic)
│   ├── tauri.conf.json   # Konfigurasi Tauri & Updater
│   └── Cargo.toml        # Dependensi modul Rust
├── latest.json           # Manifest pembaruan versi (Auto-update feed)
└── README.md             # Dokumentasi proyek
```

---

<div align="center">
  <sub>Built with ❤️ using Tauri & Rust. Designed for performance and security.</sub>
</div>
