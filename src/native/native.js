// ============================================================
//  Lapisan native Denah Skala (iOS & Android via Capacitor)
//  Menyediakan window.claude.use(...) versi aplikasi, sehingga
//  kode aplikasi (src/app/index.html) sama persis dengan versi web.
//   - downloads → simpan ke folder Dokumen + lembar Bagikan (iCloud/Drive/WA/Email)
//   - db + user → Firebase (opsional, lihat src/firebase-config.js)
//   - sample    → API Claude dengan kunci milik pengguna (opsional)
//   - salinan data ke folder Dokumen agar tidak hilang bila cache dibersihkan
// ============================================================
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { App } from '@capacitor/app';
import { initializeApp } from 'firebase/app';
import { initializeAuth, indexedDBLocalPersistence, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { getFirestore, doc as fsDoc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import FB from '../firebase-config.js';

const NATIVE = Capacitor.isNativePlatform();
// Mode web mandiri (PWA): dibuka dari hosting sendiri, bukan dari aplikasi native atau dari Claude.
const WEB = !NATIVE && !window.claude && /^https?:$/.test(location.protocol);
const KEY_STORE = 'ds_native_claude_key';
const IOS = Capacitor.getPlatform() === 'ios';
// iOS: folder Dokumen aplikasi (terlihat di app File). Android: penyimpanan privat aplikasi (aman, tanpa izin).
const DOC_DIR = IOS ? Directory.Documents : Directory.Data;
const EXP_DIR = IOS ? Directory.Documents : Directory.Cache;
const DATA_FILE = 'DenahSkala/data.json';
const IMG_DIR = 'DenahSkala/foto';

/* ---------- util ---------- */
const blobToB64 = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = rej; r.readAsDataURL(b); });
const toBlob = d => d instanceof Blob ? d : new Blob([d]);

/* ---------- penyimpanan awet: salin localStorage + foto ke folder Dokumen ---------- */
function lsSnapshot() { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && (k.startsWith('ds2_') || k.startsWith('denahskala'))) o[k] = localStorage.getItem(k); } return o; }
function idbOpen() { return new Promise(r => { try { const q = indexedDB.open('denahskala', 1); q.onupgradeneeded = () => q.result.createObjectStore('img'); q.onsuccess = () => r(q.result); q.onerror = () => r(null); } catch (e) { r(null); } }); }
async function idbGet(k) { const db = await idbOpen(); if (!db) return null; return new Promise(r => { try { const q = db.transaction('img').objectStore('img').get(k); q.onsuccess = () => r(q.result || null); q.onerror = () => r(null); } catch (e) { r(null); } }); }
async function idbPut(k, v) { const db = await idbOpen(); if (!db) return; return new Promise(r => { try { const t = db.transaction('img', 'readwrite'); t.objectStore('img').put(v, k); t.oncomplete = () => r(true); t.onerror = () => r(false); } catch (e) { r(false); } }); }
let lastSnap = '', mirrored = new Set();
async function mirrorNow() {
  try {
    const snap = lsSnapshot(), txt = JSON.stringify(snap);
    if (txt !== lastSnap) { await Filesystem.writeFile({ path: DATA_FILE, data: txt, directory: DOC_DIR, encoding: Encoding.UTF8, recursive: true }); lastSnap = txt; }
    const ids = new Set(); for (const [k, v] of Object.entries(snap)) if (k.startsWith('ds2_p_')) for (const m of v.matchAll(/"iid":"([a-z0-9]+)"/g)) ids.add(m[1]);
    for (const id of ids) { if (mirrored.has(id)) continue; const b = await idbGet(id); if (!b) continue;
      await Filesystem.writeFile({ path: `${IMG_DIR}/${id}.jpg`, data: await blobToB64(b), directory: DOC_DIR, recursive: true }); mirrored.add(id); }
  } catch (e) { /* abaikan; dicoba lagi nanti */ }
}
async function restoreIfEmpty() {
  const hasData = Object.keys(lsSnapshot()).some(k => k.startsWith('ds2_index'));
  try {
    const r = await Filesystem.readFile({ path: DATA_FILE, directory: DOC_DIR, encoding: Encoding.UTF8 });
    const d = JSON.parse(r.data); lastSnap = r.data;
    try { const list = await Filesystem.readdir({ path: IMG_DIR, directory: DOC_DIR }); for (const f of list.files || []) { const id = (f.name || f).replace(/\.jpg$/, ''); mirrored.add(id);
        if (!hasData || !(await idbGet(id))) { const fr = await Filesystem.readFile({ path: `${IMG_DIR}/${f.name || f}`, directory: DOC_DIR }); const bin = atob(fr.data); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); await idbPut(id, new Blob([u], { type: 'image/jpeg' })); } } } catch (e) {}
    if (!hasData && d && Object.keys(d).length) { for (const [k, v] of Object.entries(d)) localStorage.setItem(k, v); location.reload(); }
  } catch (e) { /* belum ada salinan */ }
}

/* ---------- unduhan → Dokumen + Bagikan ---------- */
const downloads = {
  async save({ filename, data }) {
    const safe = String(filename || 'file').replace(/[\\/:*?"<>|]+/g, '_');
    const path = `DenahSkala/Ekspor/${safe}`;
    try {
      await Filesystem.writeFile({ path, data: await blobToB64(toBlob(data)), directory: EXP_DIR, recursive: true });
      const { uri } = await Filesystem.getUri({ path, directory: EXP_DIR });
      try { await Share.share({ title: safe, files: [uri], dialogTitle: 'Simpan / bagikan ' + safe }); }
      catch (e) { /* lembar bagikan ditutup: file tetap tersimpan di folder Dokumen/DenahSkala/Ekspor */ }
      return { status: 'saved' };
    } catch (e) { throw { code: 'unavailable', message: String(e && e.message || e) }; }
  }
};

/* ---------- unduhan versi web: lembar Bagikan / unduh biasa ---------- */
const MIME = { pdf: 'application/pdf', png: 'image/png', json: 'application/json', zip: 'application/zip', txt: 'text/plain' };
function shareSheetButton(file) {
  return new Promise((res, rej) => {
    const w = document.createElement('div');
    w.style.cssText = 'position:fixed;inset:0;background:rgba(20,22,25,.45);display:flex;align-items:center;justify-content:center;z-index:99;padding:20px;font:15px -apple-system,Arial,sans-serif';
    w.innerHTML = `<div style="background:#fff;border-radius:16px;padding:18px;max-width:380px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.25)">
      <div style="font-weight:600;font-size:17px;margin-bottom:6px">File siap</div><div style="color:#6b7078;margin-bottom:14px;word-break:break-all">${file.name}</div>
      <div style="display:flex;gap:8px;justify-content:flex-end"><button data-x style="height:42px;padding:0 14px;border:0;border-radius:9px;background:#f0eee9;font:inherit">Batal</button>
      <button data-s style="height:42px;padding:0 16px;border:0;border-radius:9px;background:#16191d;color:#fff;font:inherit;font-weight:600">Simpan / Bagikan</button></div></div>`;
    document.body.appendChild(w);
    w.querySelector('[data-x]').onclick = () => { w.remove(); rej({ code: 'declined' }); };
    w.querySelector('[data-s]').onclick = async () => { try { await navigator.share({ files: [file], title: file.name }); w.remove(); res({ status: 'saved' }); } catch (e) { w.remove(); if (e && e.name === 'AbortError') rej({ code: 'declined' }); else { anchorDownload(file); res({ status: 'saved' }); } } };
  });
}
function anchorDownload(file) { const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 8000); }
const webDownloads = {
  async save({ filename, data }) {
    const ext = String(filename).split('.').pop().toLowerCase();
    const file = new File([toBlob(data)], filename, { type: MIME[ext] || 'application/octet-stream' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: filename }); return { status: 'saved' }; }
      catch (e) { if (e && e.name === 'AbortError') throw { code: 'declined' }; return shareSheetButton(file); }
    }
    anchorDownload(file); return { status: 'saved' };
  }
};

/* ---------- Firebase (opsional) ---------- */
const FB_ON = !!(FB && FB.apiKey && FB.projectId);
const ON = NATIVE || WEB;
let auth = null, fs = null, authReady = Promise.resolve(null);
if (ON && FB_ON) {
  try {
    const app = initializeApp(FB);
    auth = initializeAuth(app, { persistence: indexedDBLocalPersistence });
    fs = getFirestore(app);
    authReady = new Promise(res => { const un = onAuthStateChanged(auth, u => { un(); res(u); }); setTimeout(() => res(auth.currentUser), 8000); });
  } catch (e) { console.warn('Firebase gagal', e); }
}
const mapErr = e => { const m = String(e && (e.code || e.message) || e); return { code: /exceed|too large|maximum/i.test(m) ? 'invalid_argument' : /permission/i.test(m) ? 'invalid_argument' : 'unavailable', message: m }; };
const db = {
  doc(path) {
    const ref = fsDoc(fs, path);
    return {
      async get() { try { const s = await getDoc(ref); return { exists: s.exists(), data: () => s.data() }; } catch (e) { throw mapErr(e); } },
      async set(d) { try { await setDoc(ref, d); } catch (e) { throw mapErr(e); } },
      async delete() { try { await deleteDoc(ref); } catch (e) { throw mapErr(e); } }
    };
  }
};
const user = { async id() { const u = await authReady; return (auth && auth.currentUser || u) ? (auth.currentUser || u).uid : null; } };

/* ---------- API Claude (tulisan tangan → font) ---------- */
const getKey = () => { try { return localStorage.getItem(KEY_STORE) || ''; } catch (e) { return ''; } };
async function sample(prompt, opts = {}) {
  const key = getKey(); if (!key) throw { code: 'no_key', message: 'Kunci API belum diisi' };
  const content = [];
  for (const b of [].concat(opts.images || [])) content.push({ type: 'image', source: { type: 'base64', media_type: b.type || 'image/png', data: await blobToB64(b) } });
  content.push({ type: 'text', text: String(prompt) });
  let r;
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 400, messages: [{ role: 'user', content }] }) });
  } catch (e) { throw { code: 'upstream_error', message: 'Tidak ada koneksi internet' }; }
  if (!r.ok) { const t = await r.text().catch(() => ''); throw { code: r.status === 401 || r.status === 403 ? 'no_key' : r.status === 429 ? 'rate_limited' : 'upstream_error', message: t }; }
  const j = await r.json(); return { text: (j.content || []).map(c => c.text || '').join(''), truncated: j.stop_reason === 'max_tokens' };
}

/* ---------- dialog Akun & kunci API ---------- */
function accountDialog(ui) {
  const { openDlg, closeDlg, toast, esc, $ } = ui;
  const u = auth && auth.currentUser;
  const fbPart = !FB_ON
    ? `<p><b>Sinkron antar perangkat belum diaktifkan</b> di versi aplikasi ini. Data tetap aman di perangkat & folder Dokumen/DenahSkala. Untuk mengaktifkan: isi <code>src/firebase-config.js</code> lalu build ulang (lihat README).</p>`
    : u ? `<p>☁ Masuk sebagai <b>${esc(u.email || u.uid)}</b>. Proyek tersinkron otomatis ke semua perangkat yang masuk dengan akun ini.</p><div class="acts" style="justify-content:flex-start"><button class="btn" data-d="out">Keluar</button></div>`
    : `<p>Masuk dengan akun yang sama di iPad, iPhone & Android agar semua proyek otomatis muncul.</p>
       <label>Email</label><input type="text" id="ae" inputmode="email" autocomplete="username" autocapitalize="off">
       <label>Kata sandi (min. 6 karakter)</label><input type="password" id="ap" autocomplete="current-password" style="width:100%;height:44px;border:1px solid var(--line);border-radius:9px;padding:0 10px">
       <div class="acts" style="justify-content:flex-start"><button class="btn pri" data-d="in">Masuk</button><button class="btn" data-d="up">Daftar akun baru</button><button class="btn" data-d="rs">Lupa sandi</button></div>`;
  const k = getKey();
  openDlg(`<h2>Akun sinkron & kunci API</h2>${fbPart}
    <label>Kunci API Claude (untuk tulisan tangan → font)</label>
    <input type="password" id="ak" placeholder="sk-ant-…" value="${esc(k)}" style="width:100%;height:44px;border:1px solid var(--line);border-radius:9px;padding:0 10px">
    <p>Buat kunci di console.anthropic.com → API Keys. Biaya per tulisan sangat kecil dan ditagih ke akun Anthropic Anda. Kunci hanya disimpan di perangkat ini.</p>
    <p>${WEB?'Data tersimpan di perangkat ini (aplikasi layar utama). Cadangkan rutin lewat Menu → Cadangkan.':IOS?'Salinan data & ekspor tersimpan juga di app <b>File → Di iPad/iPhone Saya → Denah Skala</b>.':'Salinan data tersimpan di penyimpanan aplikasi; ekspor & cadangan disimpan lewat lembar Bagikan (Drive, File, WhatsApp, Email).'}</p>
    <div class="acts">${k ? '<button class="btn dan" data-d="kdel">Hapus kunci</button>' : ''}<button class="btn" data-d="x">Tutup</button><button class="btn pri" data-d="ksave">Simpan kunci</button></div>`, {
    x: closeDlg,
    ksave: () => { const v = $('#ak').value.trim(); try { localStorage.setItem(KEY_STORE, v); } catch (e) {} toast(v ? 'Kunci API disimpan' : 'Kunci dikosongkan'); closeDlg(); },
    kdel: () => { try { localStorage.removeItem(KEY_STORE); } catch (e) {} toast('Kunci dihapus'); closeDlg(); },
    in: async () => { try { await signInWithEmailAndPassword(auth, $('#ae').value.trim(), $('#ap').value); toast('Berhasil masuk — memuat proyek…'); setTimeout(() => location.reload(), 600); } catch (e) { toast('Gagal masuk: ' + friendly(e)); } },
    up: async () => { try { await createUserWithEmailAndPassword(auth, $('#ae').value.trim(), $('#ap').value); toast('Akun dibuat — menyinkronkan…'); setTimeout(() => location.reload(), 600); } catch (e) { toast('Gagal daftar: ' + friendly(e)); } },
    rs: async () => { try { await sendPasswordResetEmail(auth, $('#ae').value.trim()); toast('Email reset sandi dikirim'); } catch (e) { toast('Gagal: ' + friendly(e)); } },
    out: async () => { await mirrorNow(); await signOut(auth); toast('Keluar dari akun'); setTimeout(() => location.reload(), 500); }
  });
}
const friendly = e => { const c = String(e && e.code || ''); return ({ 'auth/invalid-email': 'email tidak valid', 'auth/invalid-credential': 'email atau sandi salah', 'auth/wrong-password': 'sandi salah', 'auth/user-not-found': 'akun tidak ditemukan', 'auth/email-already-in-use': 'email sudah terdaftar — pilih Masuk', 'auth/weak-password': 'sandi minimal 6 karakter', 'auth/network-request-failed': 'tidak ada koneksi' })[c] || c || 'coba lagi'; };

/* ---------- PWA: offline, pembaruan, ajakan pasang ---------- */
function banner(html, btns) {
  const b = document.createElement('div');
  b.style.cssText = 'position:fixed;left:50%;bottom:calc(40px + env(safe-area-inset-bottom));transform:translateX(-50%);background:#16191d;color:#fff;border-radius:14px;padding:12px 14px;z-index:98;display:flex;gap:10px;align-items:center;font:14px -apple-system,Arial,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25);max-width:92vw';
  b.innerHTML = `<div style="flex:1">${html}</div>` + btns.map((t, i) => `<button data-i="${i}" style="height:36px;padding:0 12px;border:0;border-radius:8px;background:${i ? '#fff' : 'transparent'};color:${i ? '#16191d' : '#fff'};font:inherit;font-weight:600;white-space:nowrap">${t[0]}</button>`).join('');
  b.onclick = e => { const x = e.target.closest('[data-i]'); if (!x) return; b.remove(); btns[+x.dataset.i][1] && btns[+x.dataset.i][1](); };
  document.body.appendChild(b);
}
function setupPWA() {
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}
  if ('serviceWorker' in navigator) {
    const had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) banner('Versi baru Denah Skala sudah terpasang.', [['Nanti'], ['Muat ulang', () => location.reload()]]); });
  }
  const standalone = window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  let seen = false; try { seen = localStorage.getItem('ds_install_hint') === '1'; } catch (e) {}
  if (!standalone && !seen) setTimeout(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    banner(ios ? 'Pasang di layar utama: ketuk <b>Bagikan ⬆︎</b> lalu <b>Tambah ke Layar Utama</b>.' : 'Pasang sebagai aplikasi: menu <b>⋮</b> lalu <b>Instal aplikasi / Tambahkan ke layar utama</b>.', [['Mengerti', () => { try { localStorage.setItem('ds_install_hint', '1'); } catch (e) {} }]]);
  }, 2500);
}

/* ---------- pasang ---------- */
if (ON) {
  window.DS_NATIVE = { platform: NATIVE ? Capacitor.getPlatform() : 'web', accountDialog, firebase: FB_ON };
  window.claude = {
    use: async (name) => {
      if (name === 'downloads') return NATIVE ? downloads : webDownloads;
      if (name === 'sample') return sample;
      if (name === 'user') { if (!FB_ON) return null; const u = await authReady; return u ? user : null; }
      if (name === 'db') { if (!FB_ON || !fs) return null; const u = await authReady; return u ? db : null; }
      return null; // assets: foto disimpan lokal + folder Dokumen
    }
  };
  if (NATIVE) {
    restoreIfEmpty();
    setInterval(mirrorNow, 15000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') mirrorNow(); });
    App.addListener('pause', () => mirrorNow());
    App.addListener('backButton', () => { const m = document.getElementById('modal'); if (m && m.classList.contains('show')) m.classList.remove('show'); else App.minimizeApp(); });
  } else {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupPWA); else setupPWA();
  }
}
