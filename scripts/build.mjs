// Membangun folder www/ dari src/ untuk aplikasi iOS & Android.
//  - src/app/index.html  : kode aplikasi (sama dengan versi web)
//  - pustaka CDN diganti salinan lokal (bisa dipakai tanpa internet)
//  - src/native/native.js dibundel menjadi www/native.js
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'www';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'vendor/fonts'), { recursive: true });

let html = fs.readFileSync('src/app/index.html', 'utf8');
const fontRe = /<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/;
const pdfRe = /<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/jspdf\/[^"]*"><\/script>/;
if (!fontRe.test(html) || !pdfRe.test(html)) throw new Error('Tag font/jsPDF di src/app/index.html tidak ditemukan');
html = html.replace(fontRe, '<link rel="stylesheet" href="vendor/fonts.css">')
           .replace(pdfRe, '<script src="vendor/jspdf.umd.min.js"></script>\n<script src="native.js"></script>');
html = html.replace('<title>', `<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<meta name="theme-color" content="#16191d">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<title>`);
fs.writeFileSync(path.join(OUT, 'index.html'), html);
for (const f of fs.readdirSync('src/pwa')) if (f !== 'sw.js') fs.copyFileSync(path.join('src/pwa', f), path.join(OUT, f));

fs.copyFileSync('node_modules/jspdf/dist/jspdf.umd.min.js', path.join(OUT, 'vendor/jspdf.umd.min.js'));
// modul 3D (three.js r128) — dimuat saat tombol 3D dibuka, tersedia offline
fs.copyFileSync('node_modules/three/build/three.min.js', path.join(OUT, 'vendor/three.min.js'));
fs.copyFileSync('node_modules/three/examples/js/controls/OrbitControls.js', path.join(OUT, 'vendor/OrbitControls.js'));
// impor PDF (pdf.js) & DWG (libredwg-web, WebAssembly ±11 MB — dimuat hanya saat impor DWG)
fs.copyFileSync('node_modules/pdfjs-dist/build/pdf.min.js', path.join(OUT, 'vendor/pdf.min.js'));
fs.copyFileSync('node_modules/pdfjs-dist/build/pdf.worker.min.js', path.join(OUT, 'vendor/pdf.worker.min.js'));
for (const d of ['dist', 'wasm']) {
  fs.mkdirSync(path.join(OUT, 'vendor/dwg', d), { recursive: true });
  for (const f of fs.readdirSync(path.join('node_modules/@mlightcad/libredwg-web', d))) if (/\.(js|wasm)$/.test(f) && !/\.cjs$/.test(f))
    fs.copyFileSync(path.join('node_modules/@mlightcad/libredwg-web', d, f), path.join(OUT, 'vendor/dwg', d, f));
}

const fonts = [
  ['Roboto Condensed', 'roboto-condensed', [400, 600]],
  ['Roboto Mono', 'roboto-mono', [400, 600]],
  ['Architects Daughter', 'architects-daughter', [400]],
];
let css = '';
for (const [fam, pkg, weights] of fonts) for (const w of weights) {
  const f = `${pkg}-latin-${w}-normal.woff2`;
  fs.copyFileSync(`node_modules/@fontsource/${pkg}/files/${f}`, path.join(OUT, 'vendor/fonts', f));
  css += `@font-face{font-family:"${fam}";font-style:normal;font-weight:${w};font-display:swap;src:url(fonts/${f}) format("woff2")}\n`;
}
fs.writeFileSync(path.join(OUT, 'vendor/fonts.css'), css);

await build({ entryPoints: ['src/native/native.js'], bundle: true, format: 'iife', minify: true,
  target: ['es2020', 'safari15', 'chrome90'], outfile: path.join(OUT, 'native.js'), logLevel: 'warning' });

// service worker: daftar semua file agar aplikasi jalan offline
const list = []; const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else list.push('./' + path.relative(OUT, p).split(path.sep).join('/')); } };
walk(OUT);
const files = list.filter(f => !/\/_headers$/.test(f) && !f.includes('/vendor/dwg/'));
const version = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
fs.writeFileSync(path.join(OUT, 'sw.js'), fs.readFileSync('src/pwa/sw.js', 'utf8').replaceAll('__VERSION__', version).replaceAll('__FILES__', JSON.stringify(['./', ...files])));
fs.writeFileSync(path.join(OUT, 'version.txt'), version + '\n');

const kb = f => (fs.statSync(f).size / 1024).toFixed(0) + ' KB';
console.log('✓ www siap:', 'index.html', kb(path.join(OUT, 'index.html')), '· native.js', kb(path.join(OUT, 'native.js')));
