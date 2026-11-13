# Denah Skala — aplikasi iOS & Android

Ini aplikasi catatan + gambar berskala (gaya Notability + AutoCAD) untuk iPad, iPhone, dan Android.
Kode untuk iOS dan Android **satu dan sama**, dan sama dengan versi web di Claude. Jadi setiap
fitur baru cukup dibuat sekali, lalu dibangun ulang untuk kedua platform.

---

## 1. Isi folder

| Folder / file | Isinya |
|---|---|
| `src/app/index.html` | **Seluruh aplikasi** (alat gambar, KOP, ekspor, dll). File ini yang diubah saat ada fitur baru. |
| `src/native/native.js` | Penghubung ke fitur HP/iPad: simpan & bagikan file, salinan data, sinkron Firebase, API Claude. |
| `src/firebase-config.js` | Pengaturan sinkron antar perangkat (opsional, awalnya kosong). |
| `assets/` | Ikon & layar pembuka. |
| `android/` | Proyek Android (dibuka dengan Android Studio). |
| `ios/` | Proyek iOS (dibuka dengan Xcode di Mac). |
| `.github/workflows/` | Build otomatis di server GitHub: APK Android, iOS TestFlight, dan versi web (PWA). |
| `src/pwa/` | File pemasangan aplikasi web: ikon, manifest, mode offline. |
| `firestore.rules` | Aturan keamanan Firebase (hanya pemilik akun yang bisa membaca datanya). |

---

## 2. Android dari PC Windows — tanpa memasang apa pun (disarankan)

1. Buat akun di **github.com** (gratis), lalu pasang **GitHub Desktop** (desktop.github.com).
2. Di GitHub Desktop: *File → Add local repository* → pilih folder ini → **Create repository** →
   *Publish repository* (centang **Keep this code private**).
3. Buka repositori di github.com → tab **Actions** → *Android APK* → tunggu ±5–8 menit sampai centang hijau.
4. Klik run tersebut → bagian **Artifacts** → unduh **DenahSkala-Android** → ekstrak → file `.apk`.
5. Kirim `.apk` ke HP/tablet Android (Drive/WhatsApp/kabel) → buka → izinkan *Instal dari sumber ini* → Instal.

Setiap kali ada perubahan yang di-*push*, APK baru dibuat otomatis dengan nomor versi naik.

**Alternatif:** pasang Android Studio + Node.js di Windows, lalu di folder ini jalankan
`npm install` → `npm run android` → tombol ▶ Run (HP terhubung kabel, mode developer aktif).

---

## 2b. Tanpa Mac & gratis selamanya: versi aplikasi web (PWA) — **disarankan untuk iPad/iPhone**

Aplikasi yang sama, dipasang di layar utama dari Safari. Tidak kedaluwarsa, tidak perlu Mac,
bisa dipakai tanpa internet, update cukup unggah ulang.

### Pertama kali (dari PC Windows atau komputer apa pun)
1. Ekstrak **DenahSkala-Web.zip** → muncul folder **DenahSkala-Web**.
   (Atau buat sendiri: `npm run build` → folder `www`.)
2. Buka **app.netlify.com** → daftar gratis (bisa pakai akun Google).
3. Menu **Sites → Add new site → Deploy manually** → seret folder **DenahSkala-Web** ke kotak unggah.
4. Setelah selesai Anda mendapat alamat seperti `https://nama-acak.netlify.app`.
   Ganti nama: *Site configuration → Change site name* → mis. `denahskala-andrian` → `https://denahskala-andrian.netlify.app`.
5. **Di iPad/iPhone**: buka alamat itu di **Safari** → tombol **Bagikan ⬆︎** → **Tambah ke Layar Utama** → Tambah.
   **Di Android**: buka di **Chrome** → menu **⋮** → **Instal aplikasi**.
6. Buka **Denah Skala** dari layar utama (bukan dari Safari) — tampil layar penuh, ikon sendiri.

### Memperbarui
Netlify → situs Anda → tab **Deploys** → seret folder versi baru ke kotak *“Need to update your site? Drag and drop…”*.
Perangkat mendapat versi baru otomatis saat aplikasi dibuka (muncul tombol **Muat ulang**).

### Catatan penting
- **Pindahkan data** dari aplikasi Xcode/versi web Claude: di sana **Menu → Cadangkan**, lalu di PWA **Menu → Pulihkan dari cadangan**.
  Lakukan sebelum aplikasi Xcode habis masa 7 harinya.
- Data PWA tersimpan di perangkat (aplikasi layar utama tidak dihapus otomatis oleh iOS). Tetap **cadangkan rutin**.
- Jangan ganti alamat situs setelah dipakai — data terikat pada alamat tersebut.
- Sinkron Firebase & kunci API Claude juga berfungsi di PWA (bagian 4 & 5).
- Alternatif hosting gratis: GitHub Pages (workflow `.github/workflows/web.yml` sudah tersedia) atau Cloudflare Pages.

---

## 3. iOS (iPad / iPhone)

iOS **wajib dibangun di macOS** (aturan Apple) — bisa di Mac sendiri atau di Mac milik GitHub. Ada tiga cara:

### A. Saat Mac sudah tersedia (gratis)
1. Pasang **Xcode** (App Store) dan **Node.js** (nodejs.org) di Mac.
2. Salin folder ini ke Mac, buka Terminal di folder ini:
   ```
   npm install
   npm run ios
   ```
3. Xcode terbuka → klik **App** (kiri) → tab *Signing & Capabilities* → *Team*: masuk dengan Apple ID Anda.
4. Sambungkan iPad dengan kabel → pilih iPad di atas → tombol ▶.
   Di iPad: *Pengaturan → Umum → VPN & Manajemen Perangkat* → percayai developer.

> Dengan Apple ID gratis, aplikasi berlaku **7 hari** lalu harus dipasang ulang dari Xcode.
> Dengan **Apple Developer Program** ($99/tahun) berlaku 1 tahun dan bisa lewat TestFlight.

### B. Tanpa Mac — build di server Mac milik GitHub → TestFlight
Butuh **Apple Developer Program** ($99/tahun).
1. developer.apple.com → *Identifiers* → buat App ID `com.denahskala.app`
   (atau ganti dulu `appId` di `capacitor.config.json`, lihat bagian 7).
2. appstoreconnect.apple.com → *Apps* → **+** → New App → pilih bundle ID tadi.
3. App Store Connect → *Users and Access → Integrations → App Store Connect API* → buat kunci (akses **App Manager**).
   Catat **Key ID**, **Issuer ID**, unduh file **.p8**.
4. Di github.com → repo → *Settings → Secrets and variables → Actions* → **New repository secret**:
   - `APPLE_TEAM_ID` — Team ID (developer.apple.com → Membership)
   - `ASC_KEY_ID` — Key ID
   - `ASC_ISSUER_ID` — Issuer ID
   - `ASC_KEY_P8_BASE64` — isi file .p8 dalam base64
     (Windows PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("AuthKey_XXXX.p8"))`)
5. Tab **Actions** → *iOS TestFlight* → **Run workflow**.
6. Setelah ±15–30 menit build muncul di App Store Connect → TestFlight. Pasang app **TestFlight** di iPad → install Denah Skala.

### C. Gratis & tanpa Mac — SideStore (aplikasi iOS asli, diperpanjang otomatis)
Apple ID gratis membatasi aplikasi 7 hari; **SideStore** memperpanjangnya sendiri di iPad lewat Wi-Fi.
Komputer (PC Windows) hanya dibutuhkan **sekali** saat pemasangan awal.

**1) Buat file .ipa (sekali per versi, di GitHub, gratis)**
- Repo sudah di GitHub (bagian 2) → tab **Actions** → **iOS IPA (SideStore)** → **Run workflow**.
- ±10–15 menit kemudian: tab **Releases** → **DenahSkala.ipa**.

**2) Pasang SideStore (sekali, dengan PC Windows)** — ikuti panduan resmi di **sidestore.io** (bagian *Installation*). Ringkasnya:
- iPad: pasang **LocalDevVPN** dari App Store → buka → **Connect**.
- PC: pasang **iTunes** (versi dari situs Apple, bukan Microsoft Store) → sambungkan iPad dengan kabel → **Percayai**.
- PC: pasang **iloader** (github.com/nab138/iloader → Releases → `iloader-windows-x64.msi`) → masuk Apple ID → **Install SideStore**.
- iPad: Pengaturan → Umum → VPN & Manajemen Perangkat → percayai Apple ID → aktifkan **Mode Developer** bila diminta.

**3) Pasang Denah Skala**
- Di iPad buka halaman Releases (Safari, masuk GitHub) → unduh **DenahSkala.ipa**.
- Buka **SideStore** → **My Apps** → **+** → pilih DenahSkala.ipa → masuk Apple ID bila diminta.

**Perpanjangan & update**
- Biarkan **LocalDevVPN tetap Connect**; SideStore memperpanjang otomatis di latar belakang.
  Bisa juga manual: SideStore → My Apps → **Refresh All**.
- Versi baru: jalankan lagi workflow → unduh .ipa baru → SideStore **+** → pasang di atas yang lama (data tetap).
- Batas Apple ID gratis: 3 aplikasi aktif (SideStore ikut dihitung) & 10 App ID per minggu.
- Setelah update iPadOS, kadang *pairing file* perlu dibuat ulang dengan iloader di PC.

---

## 3D. Fitur v4 (ringkas)
- **Layar awal ala Notability**: kategori proyek, Buat baru, Buka, Ganti nama/pindah kategori/hapus (tekan lama kartu).
- **Jari vs Pencil**: Pencil menggambar; jari hanya geser/angkat objek & menggeser kertas — jari tidak pernah menulis. Tombol **Tangan** mematikan angkat-objek dengan jari.
- **Ukuran per objek** tampil/sembunyi. **Grup, Lepas grup, Komponen, Explode**. Kolom memotong dinding.
- **Survei as-built**: Ruang dari ukuran (sisi + diagonal / sudut), Titik dari 2 jarak, Jadikan dinding.
- **Tangga parametrik** lurus/L/U. **Tampilan 3D** + unduh .dxf 3D (3DFACE, mm) untuk SketchUp/AutoCAD. Modul 3D (three.js) ikut dikemas di `www/vendor` sehingga jalan offline.
- **Penyimpanan aman**: simpan otomatis di perangkat + sinkron otomatis ke Firebase (bagian 4). iCloud/Google Drive dipakai lewat **Menu → Cadangan** (satu ketukan). Aplikasi web tidak bisa menyimpan diam-diam ke iCloud/Drive — ini batasan Safari/iOS.

## 3E. Impor PDF / DWG / DXF (v6)
- Menu → **Impor PDF / DWG / DXF / gambar**. PDF dirender jadi gambar berskala; DWG/DXF jadi garis, kurva, dan teks (satu grup).
- Pembaca PDF: pdf.js (`www/vendor/pdf*.js`). Pembaca DWG: libredwg-web (WebAssembly ±11 MB di `www/vendor/dwg`, lisensi GPL-3.0), dimuat hanya saat impor DWG lalu disimpan untuk offline.
- Di halaman artifact claude.ai, impor DWG tidak tersedia (pembatasan keamanan halaman) — pakai DXF, atau versi aplikasi/PWA.

## 4. Mengaktifkan sinkron antar perangkat (Firebase, opsional, gratis)

Tanpa ini aplikasi tetap jalan: data tersimpan di perangkat dan disalin ke folder aplikasi,
dan Anda bisa *Menu → Cadangkan* ke iCloud Drive / Google Drive.

1. console.firebase.google.com → **Add project** (Google Analytics boleh dimatikan).
2. *Build → Authentication → Get started → Email/Password* → **Enable**.
3. *Build → Firestore Database → Create database* (lokasi terdekat, mis. `asia-southeast2` Jakarta) → *production mode*.
4. Tab **Rules** → hapus isinya → tempel isi file `firestore.rules` → **Publish**.
5. ⚙ *Project settings → Your apps → </> (Web)* → beri nama → salin nilai `apiKey`, `authDomain`, `projectId`, `appId`
   ke file `src/firebase-config.js`.
6. Commit & push (GitHub Desktop) → APK/iOS baru otomatis.
7. Di aplikasi: **Menu → Akun sinkron & kunci API → Daftar akun baru** (sekali), lalu **Masuk** dengan
   email yang sama di semua iPad/iPhone/Android. Semua proyek otomatis muncul.

> Pindah data dari versi web Claude: di versi web *Menu → Cadangkan*, lalu di aplikasi *Menu → Pulihkan dari cadangan*.
> Foto tidak ikut sinkron Firebase (tetap ada di perangkat & di file cadangan).

---

## 5. Tulisan tangan → font (opsional)

*Menu → Akun sinkron & kunci API* → isi **kunci API Claude** (buat di console.anthropic.com → API Keys).
Biaya per tulisan sangat kecil dan ditagih ke akun Anthropic Anda. Kunci hanya disimpan di perangkat.
Alternatif gratis di iPad: kotak **Teks** mendukung Scribble (tulis dengan Pencil → otomatis jadi ketikan).

---

## 6. Cara memperbarui aplikasi ke depan

1. Minta perubahan ke Claude dan lampirkan `src/app/index.html` (atau zip folder ini).
2. Ganti file yang diberikan Claude di folder ini.
3. GitHub Desktop → *Commit* → *Push*.
   - Android: APK baru otomatis di tab Actions → pasang di atas yang lama (**data tidak hilang**).
   - iOS: Actions → *iOS TestFlight* → Run workflow (atau di Mac: `npm run ios` → ▶).

Nomor versi naik otomatis. Data pengguna aman selama `appId` tidak diubah.

Versi web (PWA): `npm run build` → unggah folder `www` ke Netlify (lihat bagian 2b).

---

## 7. Mengganti nama, ID, ikon

- **Nama aplikasi / ID**: `capacitor.config.json` (`appName`, `appId`).
  Ubah `appId` **sebelum** rilis pertama ke iOS/Android, lalu jalankan
  `npx cap sync`, sesuaikan juga `applicationId` di `android/app/build.gradle` dan Bundle Identifier di Xcode.
- **Ikon & layar pembuka**: ganti `assets/icon-only.png` (1024×1024) & `assets/splash.png`, lalu
  `npx @capacitor/assets generate --iconBackgroundColor '#16191d' --splashBackgroundColor '#16191d'`.

---

## 8. Catatan teknis

- Dibangun dengan Capacitor 8 (WebView native). Pustaka & font dibundel lokal — aplikasi jalan tanpa internet.
- Data: penyimpanan aplikasi + salinan otomatis tiap 15 detik ke folder aplikasi
  (iOS: app **File → Di iPad Saya → Denah Skala**), dipulihkan otomatis bila cache WebView terhapus.
- Ekspor (PDF, DXF.zip, PNG, cadangan) membuka lembar **Bagikan** → Simpan ke File / iCloud Drive / Google Drive / WhatsApp / Email.
- Untuk rilis publik di App Store / Play Store nanti dibutuhkan: build *release* bertanda tangan, kebijakan privasi, screenshot, dan review toko.
