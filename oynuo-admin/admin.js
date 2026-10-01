/* ============================================================
   OYNUO ADMIN v3.0 — tamamen sekme sekme (menu yigini)
   Her menude en altta "Geriye don" var.
   Sonuclar menu ALTINDA gorunur.
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const https = require("https");
const { execSync } = require("child_process");
const U = require("./ui.js");
const L = require("./linkinfo.js");

const ROOT = path.resolve(__dirname, "..");
const CATALOG = path.join(ROOT, "catalog.json");
const SITE = "https://cinat3140-rgb.github.io/oynuo";
const LAUNCHER_CATALOG = "C:/Users/PC/OneDrive/Belgeler/Default Project/GameLauncher/launcher/public/catalog.json";
const LAUNCHER_ROOT = "C:/Users/PC/OneDrive/Belgeler/Default Project/GameLauncher/launcher";
const PLATFORMS = [
  { key: "pc", label: "PC (Windows) - indirme linki", badge: "PC" },
  { key: "torrent", label: "Torrent - magnet / .torrent", badge: "TORRENT" },
  { key: "apk", label: "Android APK - apk linki", badge: "APK" }
];

const rl = require("readline").createInterface({ input: process.stdin, output: process.stdout });

/* ---------------- katalog ---------------- */
function read() {
  if (!fs.existsSync(CATALOG)) { U.write(U.c(U.T.err, "catalog.json yok: " + CATALOG) + "\n"); process.exit(9); }
  let d; try { d = JSON.parse(fs.readFileSync(CATALOG, "utf8")); } catch (e) { U.write(U.c(U.T.err, "catalog.json okunamadi: " + e.message) + "\n"); process.exit(9); }
  if (!Array.isArray(d.categories) || !d.categories.length) { U.write(U.c(U.T.err, "categories yok") + "\n"); process.exit(9); }
  if (!Array.isArray(d.games)) d.games = [];
  if (!Array.isArray(d.upcomingGames)) d.upcomingGames = [];
  return d;
}
const nextId = c => (c.games.length ? Math.max(...c.games.map(g => +g.id || 0)) : 0) + 1;
const catName = (c, id) => ((c.categories.find(x => x.id === id) || {}).name) || "?";
function gameLink(g) {
  const p = g.platform || "pc";
  if (p === "torrent") return (g.torrent || {}).magnetUrl || (g.torrent || {}).torrentUrl || "";
  if (p === "apk") return (g.apk || {}).url || "";
  return ((g.latestFiles || [])[0] || {}).downloadUrl || "";
}
function sizeOf(g) {
  const f = (g.latestFiles || []).find(x => x.fileSize > 0) || (g.latestFiles || [])[0];
  if (!f || !f.fileSize) return "";
  const mb = f.fileSize / 1048576;
  return mb >= 1024 ? (mb / 1024).toFixed(1).replace(/\.0$/, "") + " GB" : (mb < 10 ? mb.toFixed(1) : Math.round(mb)) + " MB";
}
function daysLeft(d) {
  if (!d) return null;
  const x = new Date(d + "T00:00:00");
  return isFinite(x) ? Math.ceil((x - new Date()) / 864e5) : null;
}
function when(d) {
  const n = daysLeft(d);
  if (n == null) return "-";
  if (n < 0) return "cıktı";
  if (n === 0) return "bugün";
  if (n <= 60) return n + " gün";
  return "yakında";
}
const isUrl = s => { try { return /^https?:$/.test(new URL(s).protocol); } catch { return false; } };
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function parseSize(r) {
  const m = String(r || "").trim().match(/^([\d.,]+)\s*(b|kb|mb|gb)?$/i);
  if (!m) return 0;
  let v = parseFloat(m[1].replace(",", "."));
  if (!isFinite(v) || v < 0) v = 0;
  const mu = { b: 1, kb: 1024, mb: 1048576, gb: 1073741824 };
  return Math.round(v * (mu[(m[2] || "mb").toLowerCase()] || mu.mb));
}

/* ---------------- katalog yazma ---------------- */
// Katalog surumu: her kayitta artar. Site + PC uygulamasi bunu
// "v0" yerine gercek surum olarak gosterir.
function nextVersion(cat) {
  const cur = Number(cat.version || 0);
  const next = (isFinite(cur) && cur > 0 ? cur : 0) + 1;
  cat.version = next;
  return next;
}
function save(cat) {
  cat.games.sort((a, b) => b.id - a.id);
  nextVersion(cat);
  fs.writeFileSync(CATALOG, JSON.stringify(cat, null, 2) + "\n", "utf8");
}
function syncLauncherCatalog(cat) {
  // PC uygulamasinin gomulu katalogunu oynuo ile ayni yap
  try {
    if (!fs.existsSync(LAUNCHER_ROOT)) return null;
    const merged = JSON.parse(JSON.stringify(cat));
    // backend sayaclarini tazele
    try {
      const Database = require("C:/Users/PC/OneDrive/Belgeler/Default Project/GameLauncher/backend/node_modules/better-sqlite3");
      const db = new Database("C:/Users/PC/OneDrive/Belgeler/Default Project/GameLauncher/backend/data/app.sqlite", { readonly: true });
      const m = {};
      db.prepare("SELECT id, view_count, download_count FROM games").all().forEach(r => { m[String(r.id)] = { views: r.view_count || 0, downloads: r.download_count || 0 }; });
      db.close();
      merged.games.forEach(g => { const x = m[String(g.id)]; g.stats = x ? { views: x.views, downloads: x.downloads } : { views: 0, downloads: 0 }; });
      merged.metricsUrl = "http://127.0.0.1:3001/api/metrics";
    } catch {}
    fs.writeFileSync(LAUNCHER_CATALOG, JSON.stringify(merged, null, 2) + "\n", "utf8");

    // kapaklari kopyala (yeni oyunlar icin)
    merged.games.forEach(g => {
      if (!g.coverUrl || g.coverUrl.includes("placeholder")) return;
      const src = path.join(ROOT, g.coverUrl);
      const dest = path.join(LAUNCHER_ROOT, "public", g.coverUrl);
      if (fs.existsSync(src) && !fs.existsSync(dest)) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
      }
    });

    // KALAN KLASORLERI TEMIZLE (silinen oyunlarin kapagi gitmesin)
    const validIds = new Set(merged.games.map(g => String(g.id)));
    [path.join(LAUNCHER_ROOT, "public", "games"), path.join(LAUNCHER_ROOT, "dist", "games")].forEach(base => {
      if (!fs.existsSync(base)) return;
      fs.readdirSync(base).forEach(dir => {
        if (!validIds.has(dir)) {
          try { fs.rmSync(path.join(base, dir), { recursive: true, force: true }); console.log("  " + U.D("temizlendi: " + base.split(/[\\\/]/).pop() + "/" + dir)); } catch {}
        }
      });
    });

    // dist/catalog.json da guncellensin (build yapilmadan da tutarli olsun)
    const distCat = path.join(LAUNCHER_ROOT, "dist", "catalog.json");
    if (fs.existsSync(distCat)) {
      fs.writeFileSync(distCat, JSON.stringify(merged, null, 2) + "\n", "utf8");
    }
    // dist/games kapaklari
    const distGames = path.join(LAUNCHER_ROOT, "dist", "games");
    merged.games.forEach(g => {
      if (!g.coverUrl || g.coverUrl.includes("placeholder")) return;
      const src = path.join(LAUNCHER_ROOT, "public", g.coverUrl);
      const dest = path.join(LAUNCHER_ROOT, "dist", g.coverUrl);
      if (fs.existsSync(src) && !fs.existsSync(dest)) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
      }
    });

    return merged.games.length;
  } catch (e) {
    return null;
  }
}


async function pushGit(cat, msg, doPush) {
  save(cat);
  const synced = syncLauncherCatalog(cat);
  if (synced !== null) console.log("  " + U.D("PC uygulamasi katalogu esitlendi: " + synced + " oyun"));
  if (!doPush) return ["catalog.json kaydedildi (push atlandi)"];
  try {
    const run = c => execSync(c, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    run("git add -A");
    run("git commit -m " + JSON.stringify(msg));
    run("git pull --rebase origin main");
    run("git push origin main");
    return ["catalog.json kaydedildi", "GitHub'a gonderildi - site 1-2 dakika sonra guncellenir"];
  } catch (e) {
    return ["catalog.json kaydedildi", U.c(U.T.err, "push basarisiz: " + String(e.message || e).split("\n")[0])];
  }
}
const gameUrl = id => SITE + "/#/oyun/" + id;
const yes = s => /^e(vet)?$/i.test(String(s).trim());

/* ==================== ALT MENU KURUCULARI ==================== */

// KATEGORI SECIMI (oyun eklerken)
function categoryMenu(cat, ctx, onPick) {
  ctx.push("KATEGORI SEC", cat.categories.map(c => ({
    label: U.c(U.T.accent, U.pad(String(c.id), 3)) + " " + U.TX(U.pad(c.name, 14)) + U.D(c.slug),
    run: () => { ctx.pop(); onPick(c); }
  })));
}

// PLATFORM SECIMI
function platformMenu(ctx, onPick) {
  ctx.push("PLATFORM SEC", PLATFORMS.map(p => ({
    label: U.B(p.label),
    run: () => { ctx.pop(); onPick(p); }
  })));
}

// OYUN SILME: oyun listesini dogrudan sekme olarak acar
function removeMenu(cat, ctx) {
  if (!cat.games.length) { ctx.setResult("BILGI", ["Silinecek oyun yok."]); return; }
  ctx.push("OYUN SILME - oyunu sec", cat.games.slice().sort((a, b) => a.id - b.id).map(g => ({
    label: U.B(U.TX(U.pad(U.trunc(g.title, 30), 31))) + "  " + U.D(U.pad(String(catName(cat, g.categoryId)), 8) + " " + U.pad((g.platform || "pc").toUpperCase(), 8)) + (gameLink(g) ? "" : U.c(U.T.warn, "[link yok]")),
    run: async c2 => { await confirmDelete(cat, g, c2); }
  })));
}

async function confirmDelete(cat, g, ctx) {
  const st = g.stats || {};
  ctx.setResult("OYUN DETAYI - SILINEcek", [
    "Ad          : " + g.title,
    "ID          : " + g.id,
    "Kategori    : " + catName(cat, g.categoryId),
    "Platform    : " + (g.platform || "pc").toUpperCase(),
    "Kapak       : " + (g.coverUrl || "-"),
    "Gosterilme  : " + (st.views || 0),
    "Indirme     : " + (st.downloads || 0),
    "Baglanti    : " + (gameLink(g) || "(yok)"),
    "",
    "Bu oyun kalici olarak silinecek ve GitHub'a gonderilecek."
  ]);
  const ans = await ctx.ask("Onayliyor musun? Silmek icin 'e' yaz:");
  if (!yes(ans)) { ctx.setResult("IPTAL", ["Silme iptal edildi."]); return; }
  const t = await ctx.ask("Guvence icin oyun adini tam yaz (iptal icin bos):");
  if (t.toLowerCase() !== String(g.title).toLowerCase().trim()) { ctx.setResult("IPTAL", ["Isim eslesmedi - silme iptal."]); return; }
  cat.games = cat.games.filter(x => x.id !== g.id);
  const cd = path.join(ROOT, "games", String(g.id));
  if (fs.existsSync(cd)) { try { fs.rmSync(cd, { recursive: true, force: true }); } catch {} }
  // parcali buyuk dosya parcalarini da temizle (disk dolmasin)
  if (g.chunked && g.chunked.baseUrl) {
    const cd2 = path.join(ROOT, String(g.chunked.baseUrl).split("/").join(path.sep));
    if (fs.existsSync(cd2)) {
      try {
        fs.rmSync(cd2, { recursive: true, force: true });
        U.ok("parcalar silindi: " + (g.chunked.chunkCount || 0) + " parça");
      } catch {}
    }
  }
  const res = await pushGit(cat, "Oyun silindi: " + g.title + " (admin araci)", true);
  ctx.setResult("SILINDI: " + g.title, res);
  ctx.pop(); // silme listesinden cik
}

// YAKINDA SILME
function soonRemoveMenu(cat, ctx) {
  if (!cat.upcomingGames.length) { ctx.setResult("BILGI", ["Yakinda listesi bos."]); return; }
  ctx.push("YAKINDA SIL - oyunu sec", cat.upcomingGames.map(u => ({
    label: U.B(U.TX(U.pad(U.trunc(u.title, 32), 33))) + "  " + U.D(StringU.pad((u.platform || "").toUpperCase(), 8)) + U.c(U.T.ok, when(u.releaseDate)),
    run: async c2 => {
      c2.setResult("SILINEcek", [u.title, "Tarih: " + (u.releaseDate || "-"), "Not: " + (u.note || "-")]);
      const a = await c2.ask("Silmek icin 'e' yaz:");
      if (!yes(a)) { c2.setResult("IPTAL", ["Silme iptal."]); return; }
      cat.upcomingGames = cat.upcomingGames.filter(x => x.title !== u.title);
      const res = await pushGit(cat, "Yakinda oyun silindi: " + u.title + " (admin araci)", true);
      c2.setResult("SILINDI", res);
      c2.pop();
    }
  })));
}

// AYARLAR alt menu
function settingsMenu(ctx) {
  ctx.push("KISISELLESTIRME", U.THEME_KEYS.map(k => ({
    label: U.themePreview(k),
    run: async c2 => { U.setTheme(k); c2.setResult("TEMA", ["Yeni tema: " + k + " (" + U.THEMES[k].desc + ")"]); c2.pop(); }
  })).concat([
    { label: "Banner metnini degistir  (simdi: " + U.CFG.banner + ")", run: async c2 => { const v = await c2.ask("Yeni banner metni:"); if (v) { U.CFG.banner = v; U.saveConfig(); c2.setResult("BANNER", ["Banner: " + v]); } c2.pop(); } },
    { label: "Saat damgasi: " + (U.CFG.timestamp ? "ACIK" : "KAPALI"), run: async c2 => { U.CFG.timestamp = !U.CFG.timestamp; U.saveConfig(); c2.setResult("SAAT", ["Saat damgasi: " + (U.CFG.timestamp ? "acik" : "kapali")]); c2.pop(); } },
    { label: "Acilis efekti: " + (U.CFG.effects ? "ACIK" : "KAPALI"), run: async c2 => { U.CFG.effects = !U.CFG.effects; U.saveConfig(); c2.setResult("EFEKT", ["Acilis efekti: " + (U.CFG.effects ? "acik" : "kapali")]); c2.pop(); } }
  ]));
}

// CANLI KONTROL
function liveCheck() {
  return new Promise(res => {
    https.get(SITE + "/catalog.json?v=" + Date.now(), { headers: { "Cache-Control": "no-cache" } }, r => {
      let b = ""; r.on("data", d => (b += d));
      r.on("end", () => { try { const d = JSON.parse(b); res({ ok: r.statusCode === 200, status: r.statusCode, games: d.games.length, upcoming: (d.upcomingGames || []).length }); } catch (e) { res({ ok: false, err: e.message }); } });
    }).on("error", e => res({ ok: false, err: e.message }));
  });
}


/* ==================== DOSYA YUKLEME ==================== */
/* Windows dosya secme dialogu (PowerShell OpenFileDialog) */
function pickFile(filter) {
  const ps = filter || 'Tum dosyalar (*.*)|*.*';
  const script = 'Add-Type -AssemblyName System.Windows.Forms;' +
    '$d = New-Object System.Windows.Forms.OpenFileDialog;' +
    '$d.Title = "Dosya sec (Oynuo Admin)";' +
    '$d.Filter = "' + ps.replace(/"/g, '\"') + '";' +
    'if ($d.ShowDialog() -eq "OK") { $d.FileName }';
  try {
    const out = execSync('powershell.exe -NoProfile -STA -Command "' + script.replace(/"/g, '\\"') + '"', { encoding: 'utf8' });
    const p = String(out).trim().split('\n').pop().trim();
    return p && fs.existsSync(p) ? p : null;
  } catch {
    return null;
  }
}
const PICK_TORRENT = 'Torrent dosyalari (*.torrent)|*.torrent|Diger dosyalar (*.*)|*.*';
const PICK_GAME = 'Oyun dosyalari (*.zip;*.rar;*.7z;*.exe;*.iso;*.bin)|*.zip;*.rar;*.7z;*.exe;*.iso;*.bin|Her tur dosya (*.*)|*.*';
const PICK_APK = 'Android APK (*.apk)|*.apk';
const PICK_BIG = 'Buyuk oyun dosyalari (*.zip;*.rar;*.7z;*.iso;*.bin)|*.zip;*.rar;*.7z;*.iso;*.bin|Her tur dosya (*.*)|*.*';

/* GitHub 100 MB limiti */
const GH_LIMIT = 100 * 1024 * 1024;

/* Dosyayi kopyalayip katalog'a yaz. Doner: {rel, size, warn} */
function uploadFile(src, gameId, kind) {
  const stat = fs.statSync(src);
  const size = stat.size;
  let rel, destDir;

  if (kind === "torrent") {
    destDir = path.join(ROOT, "downloads", "torrents");
    const base = path.basename(src);
    rel = "downloads/torrents/" + base;
  } else if (kind === "apk") {
    destDir = path.join(ROOT, "downloads", "apk");
    fs.mkdirSync(destDir, { recursive: true });
    rel = "downloads/apk/" + path.basename(src);
  } else {
    // oyun dosyasi: games/<id>/versions/<v>/
    destDir = path.join(ROOT, "games", String(gameId), "versions", "1");
    rel = "games/" + gameId + "/versions/1/" + path.basename(src);
  }
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, path.basename(src));
  fs.copyFileSync(src, dest);
  return {
    rel: rel.split(path.sep).join("/"),
    size,
    warn: size > GH_LIMIT ? "DOSYA " + (size / 1073741824).toFixed(2) + " GB - GitHub 100 MB limiti var, yukleme reddedilecek!" : null
  };
}

/* addFlow icindeki link sorusunu iki modlu yap */
async function uploadFlow(cat, ctx, platform, category, title) {
  const ans = await ctx.ask("Baglanti / N = dosya sec:");
  if (!ans) { ctx.setResult("BILGI", ["Link bos birakildi - oyun 'yakinda' olur."]); return null; }
  if (ans.toLowerCase() === "n") {
    ctx.setResult("DOSYA SEC", ["Bir sonraki pencerede dosya sec...", "Torrent icin .torrent dosyasi, oyun icin .zip/.exe/.rar/.7z"]);
    const filter = platform.key === "torrent" ? PICK_TORRENT : platform.key === "apk" ? PICK_APK : PICK_GAME;
    const src = pickFile(filter);
    if (!src) { ctx.setResult("IPTAL", ["Dosya secilmedi."]); return null; }
    const kind = platform.key === "torrent" ? "torrent" : platform.key === "apk" ? "apk" : "game";
    const id = nextId(cat);
    const up = uploadFile(src, id, kind);
    return { mode: "file", ...up, abs: src, kind };
  }
  if (!isUrl(ans) && !ans.startsWith("magnet:")) {
    ctx.setResult("HATA", ["Gecersiz link. http/https ile baslamali ya da 'n' yazip dosya secmelisin."]);
    return null;
  }
  return { mode: "link", url: ans };
}

/* ==================== OYUN EKLEME (alt menulerle) ====================
   Mod 1: Link girersin  -> direkt kaydedilir
   Mod 2: "n" yazarsin  -> dosya secilir, kopyalanir, katalog'a yazilir
   Torrent dosyalari (.torrent) her iki yerde de calisir
   ================================================================ */
/* ==================== LİNKLE OYUN EKLEME ====================
   Admin'de link yapıştırırsın; dosya bize gelmez.
   Uygulama oyunu indirir, arşivi açar, çalıştırır.
   Sağlayıcı tanınır (MediaFire/gofile/pixeldrain...),
   gerçek dosya adı ve boyutu okunur.
   ================================================================ */
async function linkGameAddFlow(cat, ctx) {
  ctx.push("LIKLE OYUN EKLE", [
    { label: "Oyun adi gir", run: async c => {
        c._lgTitle = await c.ask("Oyun adi:");
        c.setResult("OYUN ADI", [c._lgTitle || "(bos - iptal)"]);
      } },
    { label: "Indirme linkini yapistir", run: async c => {
        const url = await c.ask("Link (mediafire / gofile / dogrudan / magnet):");
        if (!url) { c.setResult("IPTAL", ["Link girilmedi."]); return; }
        const t = url.trim();
        if (!isUrl(t) && !t.startsWith("magnet:")) {
          c.setResult("HATA", ["Gecersiz link. http/https ile baslamali ya da magnet: ile."]);
          return;
        }
        c.setResult("LINK ANALIZ EDILIYOR...", ["Baglanti okunuyor, dosya adi ve boyut araniyor..."]);
        let info;
        try {
          info = L.analyzeLink(t);
        } catch (e) {
          c.setResult("HATA", ["Baglanti analiz edilemedi: " + e.message]);
          return;
        }
        c._lgLink = info;
        const lines = [
          "Saglayici : " + info.provider + "  (" + info.mode + ")",
          "Dosya     : " + (info.fileName || "(bilinmiyor)"),
          "Boyut     : " + L.formatBytes(info.sizeBytes),
          "",
        ];
        if (info.realUrl !== t) lines.push("Cozulen adres:", info.realUrl.slice(0, 60));
        if (info.note) { lines.push(""); lines.push(info.note); }
        lines.push("");
        lines.push("Dosya bize yuklenmedi - sadece adres kaydedilecek.");
        c.setResult("BAGLANTI HAZIR", lines);
      } },
    { label: "Platform sec", run: c => {
        platformMenu(c, p => { c._lgPlat = p; c.setResult("PLATFORM", [p.badge]); c.pop(); });
      } },
    { label: "Kategori sec", run: c => {
        categoryMenu(cat, c, k => { c._lgCat = k; c.setResult("KATEGORI", [k.name]); c.pop(); });
      } },
    { label: "Kapak gorseli sec", run: async c => {
        const src = pickFile("Gorseller (*.png;*.jpg;*.jpeg;*.webp)|*.png;*.jpg;*.jpeg;*.webp");
        if (!src) { c.setResult("IPTAL", []); return; }
        const id = nextId(cat);
        const dir = path.join(ROOT, "games", String(id));
        fs.mkdirSync(dir, { recursive: true });
        fs.copyFileSync(src, path.join(dir, "cover.png"));
        c._lgCover = "games/" + id + "/cover.png";
        c.setResult("KAPAK", [c._lgCover]);
      } },
    { label: "Gelistirici / aciklama", run: async c => {
        c._lgDev = await c.ask("Gelistirici (bos = gec):") || "";
        c.setResult("GELISTIRICI", [c._lgDev || "(bos)"]);
      } },
    { label: "LISTEYE EKLE ve yayinla", run: async c => {
        const title = c._lgTitle;
        const info = c._lgLink;
        if (!title) { c.setResult("HATA", ["Once oyun adi gir."]); return; }
        if (!info) { c.setResult("HATA", ["Once indirme linkini yapistir."]); return; }
        const plat = c._lgPlat || PLATFORMS[0];
        const cover = c._lgCover || "images/placeholder.png";
        const dev = c._lgDev || "";

        // Bu yontem sadece PC icin tasarlandi
        if (plat.key !== "pc") {
          c.setResult("UYARI", [
            plat.badge + " kategorisi icin bu yontem uygun degil.",
            "",
            "PC disi kategorilerde:",
            "  - Torrent : magnet ya da .torrent dosyasi sec",
            "  - APK     : APK dosyasi sec",
            "",
            "Platformu PC olarak degistirip tekrar dene, ya da",
            "ana menudeki uygun yontemi kullan.",
          ]);
          return;
        }

        const isTorrent = info.providerKey === "magnet";

        const g = await doAdd(cat, {
          title, platform: plat,
          category: c._lgCat || cat.categories[0],
          version: "1.0.0", developer: dev, cover,
          link: info.realUrl,
          sizeBytes: info.sizeBytes,
          fileName: info.fileName || title,
        });
        const res = await pushGit(cat, "Oyun eklendi (link): " + g.title + " [" + info.provider + "] (admin araci)", true);
        c.setResult("EKLENDI: " + g.title, [
          ...res,
          "",
          "Saglayici : " + info.provider,
          "Dosya     : " + (info.fileName || "-"),
          "Boyut     : " + L.formatBytes(info.sizeBytes),
          "Sayfa     : " + gameUrl(g.id),
          "",
          isTorrent
            ? "Torrent istemcisi acilacak."
            : "Uygulamada 'Indir' butonu dosyayi indirir, arsivi acar, oyunu calistirir.",
        ]);
        c.pop(); c.pop();
      } },
    { label: "Bilgi", run: c => { c.setResult("LIKLE OYUN EKLEME", [
        "Bu yontemde dosya BIZE GELMEZ - sadece adres kaydedilir.",
        "Sadece PC kategorisi icin gecerlidir.",
        "",
        "PC oyununda ne olur:",
        "  1) 'Indir' butonuna basin",
        "  2) Uygulama baglantiyi cozer",
        "  3) Gercek adresi alir, 8 paralel baglantiyla indirir",
        "  4) .7z/.rar/.zip arsivi 7-Zip ile acar",
        "  5) Icindeki oyun otomatik calisir",
        "",
        "OTOMATIK COZULEBILEN SITELER:",
        "  MediaFire      sayfa taramasi",
        "  Pixeldrain     /u/<id>  ->  /api/file/<id>",
        "  Filebin        /download/ adresi",
        "  Dropbox        ?dl=1 parametresi",
        "  Google Drive   uc?export=download",
        "  Uploadhaven    sayfa taramasi",
        "  Krakenfiles    sayfa taramasi",
        "",
        "TARAYICIYA ACILANLAR (otomatik cozulemez):",
        "  Gofile         yeni koruma katmani",
        "  MEGA           sifreli baglanti",
        "  1fichier / MixDrop  bu agdan erisilemiyor",
        "",
        "Boyut siniri YOK - 2 GB, 100 GB oyunlar eklenebilir.",
        "Link her zaman calisir durumda kalmali.",
      ]); } }
  ]);
  ctx.setResult("LIKLE OYUN EKLEME", [
    "Adimlar:",
    "  1) Oyun adi gir",
    "  2) Indirme linkini yapistir (otomatik analiz edilir)",
    "  3) Platform + kategori sec",
    "  4) Kapak sec (istege bagli)",
    "  5) LISTEYE EKLE ve yayinla",
    "",
    "Dosya hicbir zaman bize yuklenmez.",
  ]);
}

async function addFlow(cat, ctx) {
  const title = await ctx.ask("Oyun adi:");
  if (!title) { ctx.setResult("IPTAL", ["Oyun adi bos."]); return; }

  // 1) PLATFORM sec
  platformMenu(ctx, async p => {
    // 2) KATEGORI sec
    categoryMenu(cat, ctx, async category => {
      // 3) BILGI ekrani
      const st = { link: null, file: null, cover: null, dev: "", size: "" };

      const infoMenu = () => ctx.push("OYUN BILGILERI - " + U.trunc(title, 30), [
        { label: "Baglanti gir  (veya 'n' = dosya sec)", run: async c => {
            c.setResult("BAGLANTI SECIMI", [
              "  LINK YAZARSAN  -> sadece adres kaydedilir, BOYUT SINIRI YOK",
              "                   100 GB / 500 GB oyunlar da eklenebilir",
              "                   (dosya bize yuklenmez, kullanicidan indirir)",
              "",
              "  'n' YAZARSAN    -> dosyayi BIZIM SITEMIZE yüklersin",
              "                   .torrent  -> downloads/torrents/",
              "                   .apk      -> downloads/apk/",
              "                   oyun      -> games/<id>/versions/1/",
              "                   ⚠ 100 MB GitHub limiti var (torrent sorunsuz)",
              "",
              "Link ornegi : https://www.mediafire.com/file/xxxxx"
            ]);
            const ans = await c.ask("Link gir ya da 'n' yazip dosya sec:");
            if (!ans) { st.link = ""; st.file = null; c.setResult("BAGLANTI", ["Bos birakildi - oyun 'yakinda' olur."]); return; }
            if (ans.toLowerCase() === "n") {
              const filter = p.key === "torrent" ? PICK_TORRENT : p.key === "apk" ? PICK_APK : PICK_GAME;
              c.setResult("DOSYA SEC", ["Dosya secme penceresi aciliyor..."]);
              const src = pickFile(filter);
              if (!src) { c.setResult("IPTAL", ["Dosya secilmedi."]); return; }
              const kind = p.key === "torrent" ? "torrent" : p.key === "apk" ? "apk" : "game";
              const up = uploadFile(src, nextId(cat), kind);
              st.file = { ...up, abs: src, kind };
              st.link = "";
              c.setResult("DOSYA YUKLENDI", [
                "Dosya   : " + path.basename(src),
                "Boyut   : " + (up.size / 1048576).toFixed(2) + " MB",
                "Konum   : " + up.rel,
                up.warn ? "  " + up.warn : "  GitHub'a yuklenmeye hazir."
              ]);
              return;
            }
            if (!isUrl(ans) && !ans.startsWith("magnet:")) {
              c.setResult("HATA", ["Gecersiz. http/https ile baslamali ya da 'n' yaz."]);
              return;
            }
            st.link = ans; st.file = null;
            c.setResult("BAGLANTI KAYDEDILDI", [
              ans,
              "",
              "Sadece adres kaydedildi - dosya bize yuklenmedi.",
              "Bu yuzden boyut siniri yok (100 GB oyun da eklenebilir)."
            ]);
          } },
        { label: "Kapak gorseli sec", run: async c => {
            const src = pickFile("Gorseller (*.png;*.jpg;*.jpeg;*.webp)|*.png;*.jpg;*.jpeg;*.webp");
            if (!src) { c.setResult("IPTAL", []); return; }
            const id = nextId(cat);
            const dir = path.join(ROOT, "games", String(id));
            fs.mkdirSync(dir, { recursive: true });
            fs.copyFileSync(src, path.join(dir, "cover.png"));
            st.cover = "games/" + id + "/cover.png";
            c.setResult("KAPAK", [st.cover]);
          } },
        { label: "Gelistirici / yayinci / tur", run: async c => {
            st.dev = await c.ask("Gelistirici (bos = gec):") || "";
            c.setResult("GELISTIRICI", [st.dev || "(bos)"]);
          } },
        { label: "Aciklama yaz", run: async c => { c.setResult("BILGI", ["Eklerken otomatik 'Aciklama' alani bos kalir."]); } },
        { label: "ONAYLA ve kaydet", run: async c => {
            if (!st.link && !st.file) {
              c.setResult("HATA", ["Once baglanti gir ya da 'n' ile dosya sec."]);
              return;
            }
            const opts = {
              title, platform: p, category,
              version: "1.0.0", developer: st.dev,
              cover: st.cover || "images/placeholder.png"
            };
            let g;
            if (st.file) {
              // Dosya yuklendi: kaydedilmis dosyayi isaretle
              const kind = st.file.kind;
              const size = st.file.size;
              g = await doAdd(cat, { ...opts, link: "", fileRel: st.file.rel, fileSize: size, fileName: path.basename(st.file.abs), fileKind: kind });
            } else {
              g = await doAdd(cat, { ...opts, link: st.link });
            }
            const res = await pushGit(cat, "Oyun eklendi: " + g.title + " [" + p.badge + "] (admin araci)", true);
            c.setResult("EKLENDI: " + g.title, [
              ...res,
              "",
              "Sayfa : " + gameUrl(g.id),
              "Baglanti: " + (st.file ? st.file.rel : st.link)
            ]);
            c.pop(); c.pop();
          } }
      ]);
      infoMenu();
      ctx.clearResult();
      ctx.setResult("OYUN BILGILERI: " + title, [
        "Platform ve kategori secildi: " + p.badge + " / " + category.name,
        "",
        "Simdi OYUN BILGILERI sekmesinden baglanti gir:",
        "  • Link yazarsan  -> site + uygulamaya direkt link olarak eklenir",
        "  • 'n' yazarsan   -> dosya sec, otomatik yuklenir (torrent dahil)"
      ]);
    });
    ctx.clearResult();
    ctx.setResult("OYUN: " + title, ["Simdi KATEGORI SEC ekranindan kategori sec."]);
  });
}

async function doAdd(cat, o) {
  const id = nextId(cat);
  const now = new Date().toISOString();
  const g = {
    id, title: o.title, description: o.description || "", developer: o.developer || "",
    publisher: o.publisher || "", releaseDate: o.releaseDate || now,
    categoryId: o.category.id, genre: o.genre || "", platform: o.platform.key,
    isFeatured: !!o.featured, membersOnly: false, popularity: 0,
    stats: { views: 0, downloads: 0 },
    coverUrl: o.cover || "images/placeholder.png", bannerUrl: null,
    requirements: { minimum: {}, recommended: {} },
    versions: [{ id, version: o.version, changelog: o.changelog || "", releasedAt: now }],
    latestVersion: { id, version: o.version, changelog: o.changelog || "", releasedAt: now },
    latestFiles: [], torrent: null, apk: null, screenshots: [],
    category: o.category.slug, createdAt: now, popularityLabel: ""
  };
  // Baglanti veya yuklenmis dosya
  if (o.fileRel) {
    // Dosya admin tarafindan yuklendi -> relative yol
    const rel = o.fileRel;
    if (o.platform.key === "torrent") {
      g.torrent = { magnetUrl: "", torrentUrl: rel, uploaded: true, fileSize: o.fileSize || 0, fileName: o.fileName || "" };
    } else if (o.platform.key === "apk") {
      g.apk = { url: rel, uploaded: true, fileSize: o.fileSize || 0, fileName: o.fileName || "" };
    } else {
      g.latestFiles.push({
        id, versionId: id, source: "uploaded", kind: o.fileKind === "game" ? "archive" : "file",
        fileName: o.fileName || o.title, fileSize: o.fileSize || 0,
        sha256: "", executablePath: "", downloadUrl: rel
      });
    }
  } else if (o.platform.key === "torrent" && o.link) {
    const m = o.link.startsWith("magnet:");
    g.torrent = { magnetUrl: m ? o.link : "", torrentUrl: m ? "" : o.link };
  } else if (o.platform.key === "apk" && o.link) {
    g.apk = { url: o.link };
  } else if (o.link) {
    g.latestFiles.push({ id, versionId: id, source: "external", kind: "file", fileName: o.fileName || o.title, fileSize: o.sizeBytes || 0, sha256: "", executablePath: "", downloadUrl: o.link });
  }
  cat.games.push(g);
  return g;
}


/* ==================== YENI: OYUN DUZENLEME ==================== */
function editMenu(cat, ctx) {
  if (!cat.games.length) { ctx.setResult("BILGI", ["Duzenlenecek oyun yok."]); return; }
  ctx.push("OYUN DUZENLE - oyunu sec", cat.games.slice().sort((a, b) => a.id - b.id).map(g => ({
    key: g.id,
    label: U.B(U.TX(U.pad(U.trunc(g.title, 28), 29))) + "  " + U.D(U.pad(String(catName(cat, g.categoryId)), 8) + " " + U.pad((g.platform || "pc").toUpperCase(), 7) + " " + U.pad(String(g.id), 5)),
    run: async c2 => {
      const backup = JSON.parse(JSON.stringify(g));
      c2.push("DUZENLE: " + U.trunc(g.title, 40), [
        { label: "Ad degistir", run: async c3 => { const v = await c3.ask("Yeni oyun adi:"); if (v) g.title = v; c3.setResult("GUNCELLENDI", ["Ad: " + g.title]); c3.pop(); } },
        { label: "Kategori degistir", run: c3 => { categoryMenu(cat, c3, cc => { g.categoryId = cc.id; g.category = cc.slug; c3.setResult("GUNCELLENDI", ["Kategori: " + cc.name]); c3.pop(); }); } },
        { label: "Platform degistir", run: c3 => { platformMenu(c3, p => { g.platform = p.key; c3.setResult("GUNCELLENDI", ["Platform: " + p.badge]); c3.pop(); }); } },
        { label: "Indirme linki degistir", run: async c3 => {
            const v = await c3.ask("Yeni link (bos = 'yakinda' yap):");
            g.latestFiles = [];
            g.apk = null; g.torrent = null;
            if (v) {
              if (g.platform === "torrent") {
                const m = v.startsWith("magnet:");
                g.torrent = { magnetUrl: m ? v : "", torrentUrl: m ? "" : v };
              } else if (g.platform === "apk") {
                g.apk = { url: v };
              } else {
                g.latestFiles.push({ id: g.id, versionId: g.id, source: "external", kind: "file", fileName: g.title, fileSize: (g.latestFiles[0] || {}).fileSize || 0, sha256: "", executablePath: "", downloadUrl: v });
              }
            }
            c3.setResult("GUNCELLENDI", ["Link: " + (v || "(yok - yakinda)")]); c3.pop();
          } },
        { label: "Aciklama / gelistirici duzenle", run: async c3 => {
            const d = await c3.ask("Aciklama (bos = degistirme):");
            if (d) g.description = d;
            const dv = await c3.ask("Gelistirici (bos = degistirme):");
            if (dv) g.developer = dv;
            c3.setResult("GUNCELLENDI", ["Metin alanlari guncellendi."]); c3.pop();
          } },
        { label: "One cikan isarele / kaldir", run: c3 => { g.isFeatured = !g.isFeatured; c3.setResult("GUNCELLENDI", ["One cikan: " + (g.isFeatured ? "evet" : "hayir")]); c3.pop(); } },
        { label: "KAYDET ve GitHub'a gonder", run: async c3 => {
            const res = await pushGit(cat, "Oyun guncellendi: " + g.title + " (admin araci)", true);
            c3.pushUndo({ label: "Duzenleme: " + g.title, restore: async () => { Object.assign(g, backup); await pushGit(cat, "Geri alindi: " + g.title, true); } });
            c3.setResult("KAYDEDILDI: " + g.title, [...res, "Geri almak icin ana menude 'z' tusuna bas."]);
            c3.pop(); c3.pop();
          } }
      ]);
    }
  })));
}

/* ==================== YENI: TOPLU SIL ==================== */
function bulkMenu(cat, ctx) {
  if (!cat.games.length) { ctx.setResult("BILGI", ["Silinecek oyun yok."]); return; }
  const backups = [];
  ctx.push("TOPLU SIL - Space ile sec, X ile sil", cat.games.slice().sort((a, b) => a.id - b.id).map(g => ({
    key: g.id,
    label: U.B(U.TX(U.pad(U.trunc(g.title, 28), 29))) + "  " + U.D(U.pad(String(catName(cat, g.categoryId)), 8) + " " + U.pad((g.platform || "pc").toUpperCase(), 7) + "id " + g.id),
    run: async c2 => {
      // tek oyun sil (dogrudan bu menuden)
      const backup = JSON.parse(JSON.stringify(g));
      const a = await c2.ask('"' + U.trunc(g.title, 24) + '" silinsin mi? (e):');
      if (!yes(a)) { c2.setResult("IPTAL", []); return; }
      cat.games = cat.games.filter(x => x.id !== g.id);
      await pushGit(cat, "Oyun silindi: " + g.title + " (admin araci)", true);
      backups.push({ game: backup, cat });
      c2.pushUndo({ label: "Silme: " + g.title, restore: async cx => { cat.games.push(backup); cat.games.sort((a, b) => b.id - a.id); await pushGit(cat, "Geri alindi: " + backup.title, true); } });
      c2.setResult("SILINDI", [g.title, "Geri almak icin 'z' tusuna bas."]);
    }
  })));
  ctx.multiDelete = async (c2, sel) => {
    const a = await c2.ask(sel.length + " oyun silinecek. Emin misin? (e):");
    if (!yes(a)) { c2.setResult("IPTAL", []); return; }
    const removed = [];
    for (const it of sel) {
      const g = cat.games.find(x => x.id === it.key);
      if (g) { removed.push(JSON.parse(JSON.stringify(g))); }
    }
    const ids = new Set(removed.map(g => g.id));
    cat.games = cat.games.filter(g => !ids.has(g.id));
    const res = await pushGit(cat, "Toplu silindi: " + removed.length + " oyun (admin araci)", true);
    c2.pushUndo({ label: removed.length + " oyun silme", restore: async cx => { removed.forEach(g => cat.games.push(g)); cat.games.sort((a, b) => b.id - a.id); await pushGit(cat, "Geri alindi: " + removed.length + " oyun", true); } });
    c2.setResult("TOPLU SILINDI: " + removed.length + " oyun", [...res, "Geri almak icin 'z' tusuna bas."]);
    c2.pop();
  };
}

/* ==================== YENI: ISTATISTIK ==================== */
function statsScreen(cat, ctx) {
  const games = cat.games;
  const byPlatform = {};
  const byCategory = {};
  let views = 0, dls = 0, withLink = 0, withoutLink = 0, withCover = 0, featured = 0, totalSize = 0;
  games.forEach(g => {
    const p = g.platform || "pc";
    byPlatform[p] = (byPlatform[p] || 0) + 1;
    const cn = catName(cat, g.categoryId);
    byCategory[cn] = (byCategory[cn] || 0) + 1;
    const st = g.stats || {};
    views += st.views || 0;
    dls += st.downloads || 0;
    if (gameLink(g)) withLink++; else withoutLink++;
    if (g.coverUrl && !g.coverUrl.includes("placeholder")) withCover++;
    if (g.isFeatured) featured++;
    const f = (g.latestFiles || []).find(x => x.fileSize > 0);
    if (f) totalSize += f.fileSize;
  });
  const lines = [
    "TOPLAM OYUN            : " + games.length,
    "  PC oyunu            : " + (byPlatform.pc || 0),
    "  Torrent oyunu       : " + (byPlatform.torrent || 0),
    "  APK oyunu           : " + (byPlatform.apk || 0),
    "YAKINDA LISTESI       : " + cat.upcomingGames.length,
    "KATEGORI SAYISI       : " + cat.categories.length,
    "",
    "TOPLAM GORUNTULENME   : " + views.toLocaleString("tr-TR"),
    "TOPLAM INDIRME        : " + dls.toLocaleString("tr-TR"),
    "",
    "BAGLANTISI OLAN       : " + withLink + (withoutLink ? "   (bagsiz: " + withoutLink + ")" : ""),
    "KAPAK GORSELI OLAN    : " + withCover,
    "ONE CIKAN OYUN        : " + featured,
    "TOPLAM OYUN BOYUTU    : " + (totalSize / 1073741824).toFixed(2) + " GB",
    "",
    "KATEGORI DAGILIMI:"
  ];
  Object.entries(byCategory).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => lines.push("   " + U.pad(k, 20) + v));
  ctx.setResult("ISTATISTIKLER", lines);
}

/* ==================== YENI: YEDEKLEME ==================== */
const BACKUP_DIR = path.join(__dirname, "backups");
function backupMenu(cat, ctx) {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith(".json")).sort().reverse();
  const items = [
    { label: "Yeni yedek al (simdi)", run: async c2 => {
        const name = "catalog-" + new Date().toISOString().replace(/[:.]/g, "-") + ".json";
        fs.copyFileSync(CATALOG, path.join(BACKUP_DIR, name));
        c2.setResult("YEDEK ALINDI", [name, "Klasor: oynuo-admin/backups/"]);
        c2.pop();
      } }
  ];
  if (files.length) {
    items.push({ label: "--- Yedeklerden geri yukle ---", run: async c2 => {
        c2.push("YEDEK SEC", files.map(f => ({
          label: U.pad(f, 50),
          run: async c3 => {
            const a = await c3.ask("Bu yedek yuklenecek. Emin misin? (e):");
            if (!yes(a)) { c3.setResult("IPTAL", []); return; }
            const cur = fs.readFileSync(CATALOG, "utf8");
            const backupName = "catalog-geri-" + new Date().toISOString().replace(/[:.]/g, "-") + ".json";
            fs.copyFileSync(CATALOG, path.join(BACKUP_DIR, backupName));
            fs.copyFileSync(path.join(BACKUP_DIR, f), CATALOG);
            const newCat = read();
            const res = await pushGit(newCat, "Yedek geri yuklendi: " + f + " (admin araci)", true);
            c3.setResult("GERI YUKLENDI: " + f, [...res, "Eski hal: " + backupName]);
            c3.pop(); c3.pop();
          }
        })));
      } });
    items.push({ label: "Yedek sayisi: " + files.length, run: c2 => { c2.pop(); } });
  }
  ctx.push("YEDEKLEME", items);
}

/* ==================== YENI: TOPLU IMPORT ==================== */
function importMenu(cat, ctx) {
  ctx.push("TOPLU OYUN EKLEME", [
    { label: "Format: ad | platform | link | kategori", run: c2 => {
        c2.setResult("FORMAT", [
          "Her satira bir oyun, '|' ile ayir:",
          "",
          "  Cyberpunk 2077 | pc | https://... | action",
          "  GTA VI | torrent | magnet:?xt=... | open-world",
          "",
          "kategori bos birakilirsa varsayilan (Action) kullanilir."
        ]);
        c2.pop();
      } },
    { label: "Listeyi yapistir ve ekle", run: async c2 => {
        const txt = await c2.ask("Oyunlari yapistir (her satir bir oyun), sonra bos satir + Enter:");
        if (!txt) { c2.setResult("IPTAL", []); return; }
        const lines = txt.split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith("#"));
        let added = 0, skipped = 0;
        for (const line of lines) {
          const parts = line.split("|").map(s => s.trim());
          const title = parts[0];
          if (!title) { skipped++; continue; }
          const plat = PLATFORMS.find(p => p.key === (parts[1] || "pc").toLowerCase()) || PLATFORMS[0];
          const link = parts[2] || "";
          const cat = findCat(cat, parts[3]) || cat.categories[0];
          if (cat.games.some(g => g.title.toLowerCase() === title.toLowerCase())) { skipped++; continue; }
          const g = await doAdd(cat, { title, platform: plat, category: cat, link, version: "1.0.0" });
          added++;
        }
        const res = await pushGit(cat, "Toplu import: " + added + " oyun eklendi (admin araci)", true);
        c2.setResult("IMPORT TAMAMLANDI", ["Eklendi: " + added, "Atlandi: " + skipped, ...res]);
        c2.pop(); c2.pop();
      } }
  ]);
}

function findCat(c, q) {
  const s = String(q || "").trim().toLowerCase();
  if (!s) return c.categories[0];
  return c.categories.find(x => String(x.id) === s || x.slug.toLowerCase() === s || x.name.toLowerCase() === s) || null;
}


/* ==================== TORRENT HIZLI EKLEME ====================
   .torrent dosyasini sec -> oyun adini dosya adindan alir,
   kapak sorar, otomatik yukler. Tek adimda.
   ================================================================ */

/* Torrent dosyasindan oyun adi cikar */
function titleFromTorrent(file) {
  // 1) Bencoded info/name varsa onu kullan
  try {
    const buf = fs.readFileSync(file);
    const txt = buf.toString("latin1");
    const m = txt.match(/\d+:name(\d+):/);
    if (m) {
      const start = txt.indexOf(m[0]) + m[0].length;
      const len = parseInt(m[1], 10);
      const name = txt.slice(start, start + len);
      if (name && name.length > 1) return decodeURIComponent(escape(name));
    }
  } catch {}
  // 2) Dosya adindan: "Oyun Adi [Kalite].torrent" -> "Oyun Adi"
  const base = path.basename(file).replace(/\.torrent$/i, "");
  return base.replace(/[\[\(].*?[\]\)]/g, "").replace(/[._]+/g, " ").trim() || base;
}

async function torrentQuickAdd(cat, ctx) {
  ctx.setResult("TORRENT EKLE", [
    "Bir sonraki pencerede .torrent dosyasini sec.",
    "",
    "Otomatik yapilacaklar:",
    "  • Oyun adi dosya adindan alinir",
    "  • Dosya 'downloads/torrents/' klasorune yuklenir",
    "  • Site + PC uygulamasi ayni anda guncellenir",
    "  • Kullanici uygulamadan indirip istemciye acabilir",
    "",
    "Kategori sonradan degistirilebilir (Oyun duzenle)."
  ]);

  const src = pickFile(PICK_TORRENT);
  if (!src) { ctx.setResult("IPTAL", ["Dosya secilmedi."]); return; }

  const size = fs.statSync(src).size;
  const auto = titleFromTorrent(src);
  const title = await ctx.ask("Oyun adi (bos = '" + U.trunc(auto, 40) + "'):") || auto;

  const category = cat.categories[0];
  const id = nextId(cat);

  // Torrent dosyasini yukle
  const up = uploadFile(src, id, "torrent");

  // Kapak: ayni klasorde .png/.jpg varsa otomatik kullan
  let cover = null;
  const dir = path.dirname(src);
  const baseNoExt = path.basename(src).replace(/\.torrent$/i, "");
  for (const ext of [".png", ".jpg", ".jpeg", ".webp"]) {
    const cand = path.join(dir, baseNoExt + ext);
    if (fs.existsSync(cand)) {
      const cdir = path.join(ROOT, "games", String(id));
      fs.mkdirSync(cdir, { recursive: true });
      fs.copyFileSync(cand, path.join(cdir, "cover.png"));
      cover = "games/" + id + "/cover.png";
      break;
    }
  }
  if (!cover) {
    const askCap = await ctx.ask("Kapak gorseli sec (bos = placeholder):");
    if (askCap) {
      const cdir = path.join(ROOT, "games", String(id));
      fs.mkdirSync(cdir, { recursive: true });
      fs.copyFileSync(askCap, path.join(cdir, "cover.png"));
      cover = "games/" + id + "/cover.png";
    }
  }

  // Ekle
  const g = await doAdd(cat, {
    title, platform: PLATFORMS.find(p => p.key === "torrent"), category,
    link: "", fileRel: up.rel, fileSize: size,
    fileName: path.basename(src), fileKind: "torrent",
    cover: cover || "images/placeholder.png",
    version: "1.0.0"
  });

  const res = await pushGit(cat, "Torrent eklendi: " + g.title + " (admin araci)", true);

  ctx.setResult("TORRENT EKLENDI: " + g.title, [
    ...res,
    "",
    "Dosya     : " + path.basename(src) + "  (" + size.toLocaleString("tr-TR") + " bayt)",
    "Konum     : " + up.rel,
    "Kategori  : " + category.name + "  (Oyun duzenle ile degistir)",
    "Kapak     : " + (cover || "placeholder"),
    "",
    "Sayfa     : " + gameUrl(g.id),
    "",
    "Site ve PC uygulamasi ayni anda guncellendi."
  ]);
  ctx.pop();
}


/* ==================== BUYUK DOSYA SISTEMI (parcali yukleme) ====================
   2 GB oyunu ~95 MB parcalara boler, GitHub'a yukler.
   Uygulama parcalari indirip birlestirir.
   ============================================================================== */

const CHUNK_DIR = path.join(ROOT, "downloads", "chunks");
const CHUNK_SIZE = 95 * 1024 * 1024;      // 95 MB (GitHub 100 MB altinda)
const REPO_WARN = 1500 * 1024 * 1024;     // 1.5 GB uyari esigi

function dirSize(d) {
  let s = 0;
  if (!fs.existsSync(d)) return 0;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    s += e.isDirectory() ? dirSize(p) : fs.statSync(p).size;
  }
  return s;
}

/* Dosyayi parcalara bol -> { dir, base, ext, parts, size } */
function splitFile(src) {
  const stat = fs.statSync(src);
  const total = stat.size;
  const name = path.basename(src);
  const base = name.replace(/\.[^.]+$/, "");
  const ext = path.extname(name);
  const dir = path.join(CHUNK_DIR, base);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  const fd = fs.openSync(src, "r");
  const buf = Buffer.allocUnsafe(CHUNK_SIZE);
  let idx = 0, read = 0, totalRead = 0;

  while (totalRead < total) {
    const want = Math.min(CHUNK_SIZE, total - totalRead);
    read = fs.readSync(fd, buf, 0, want, totalRead);
    if (read <= 0) break;
    const out = path.join(dir, "part-" + String(idx + 1).padStart(3, "0") + ".bin");
    fs.writeFileSync(out, buf.slice(0, read));
    totalRead += read;
    idx++;
    process.stdout.write("\r   parcala " + idx + "  (" + (totalRead / 1048576).toFixed(0) + " / " + (total / 1048576).toFixed(0) + " MB)   ");
  }
  fs.closeSync(fd);
  process.stdout.write("\n");

  // Dogrulama: parca sayisi ve toplam boyut
  const partList = [];
  let partTotal = 0;
  for (let i = 1; i <= idx; i++) {
    const pp = path.join(dir, "part-" + String(i).padStart(3, "0") + ".bin");
    const ps = fs.existsSync(pp) ? fs.statSync(pp).size : 0;
    partList.push({ n: i, size: ps });
    partTotal += ps;
  }
  const okParts = partList.every((p) => p.size > 0) && partTotal === total;
  if (!okParts) {
    throw new Error("Parcalama hatasi: " + partTotal + " / " + total + " bayt");
  }

  // SHA256 (birlestirme sonrasi dogrulama icin)
  const crypto = require("crypto");
  const h = crypto.createHash("sha256");
  h.update(fs.readFileSync(src));
  const sha256 = h.digest("hex");

  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({
    file: name,
    size: total,
    chunks: idx,
    chunkSize: CHUNK_SIZE,
    sha256,
    parts: partList,
    createdAt: new Date().toISOString()
  }, null, 2) + "\n", "utf8");

  const repo = dirSize(CHUNK_DIR);
  return {
    dir, base, ext, parts: idx, size: total,
    rel: "downloads/chunks/" + base,
    partRel: i => "downloads/chunks/" + base + "/part-" + String(i).padStart(3, "0") + ".bin",
    warn: repo > REPO_WARN
      ? "UYARI: Parcalarla birlikte depo " + (repo / 1073741824).toFixed(1) + " GB. GitHub 2 GB sinirina yakinlasiliyor - yeni oyun eklemek riskli."
      : null
  };
}

function cleanupChunks(base) {
  const d = path.join(CHUNK_DIR, base);
  if (fs.existsSync(d)) { try { fs.rmSync(d, { recursive: true, force: true }); } catch {} }
}

/* ==================== BUYUK DOSYA EKLEME AKIISI ==================== */
async function bigFileAddFlow(cat, ctx) {
  ctx.setResult("BUYUK DOSYA EKLEME", [
    "GTA V gibi 2 GB oyunlari bu sekmeden eklersin.",
    "",
    "Nasil calisir:",
    "  1) Dosyayi secersin (2-50 GB olabilir)",
    "  2) Sistem ~95 MB parcalara boler",
    "  3) GitHub'a yukler (her parca 100 MB altinda)",
    "  4) Oyunu ekler; indirme butonu parcalari cekip birlestirir",
    "",
    "DIKKAT: Depo limiti ~2 GB. Cok buyuk oyunlarda uyari verir."
  ]);

  const src = pickFile(PICK_BIG);
  if (!src) { ctx.setResult("IPTAL", ["Dosya secilmedi."]); return; }

  const size = fs.statSync(src).size;
  if (size < 100 * 1024 * 1024) {
    ctx.setResult("BILGI", ["Bu dosya 100 MB altinda - normal 'n' yontemini kullanabilirsin."]);
    return;
  }

  const auto = path.basename(src).replace(/.[^.]+$/, "");
  const title = await ctx.ask("Oyun adi (bos = '" + U.trunc(auto, 40) + "'):") || auto;

  // Platform
  const plat = await ctx.ask("Platform (pc / torrent / apk) [pc]:") || "pc";
  const platform = PLATFORMS.find(x => x.key === plat.toLowerCase()) || PLATFORMS[0];

  const category = cat.categories[0];
  const id = nextId(cat);

  // Parcalama (buyuk dosya oldugu icin uyari)
  const parts = Math.ceil(size / CHUNK_SIZE);
  ctx.setResult("PARCALANIYOR", [
    path.basename(src),
    "Boyut : " + (size / 1073741824).toFixed(2) + " GB",
    "Parca : " + parts + " x " + (CHUNK_SIZE / 1048576).toFixed(0) + " MB",
    "",
    "Bu islem birkac dakika surebilir. Devam?"
  ]);
  if (!await ctx.ask("Devam (e):")) { ctx.setResult("IPTAL", ["Parcalama iptal."]); return; }

  let up;
  try {
    up = splitFile(src);
  } catch (e) {
    ctx.setResult("HATA", ["Parcalama basarisiz: " + e.message, "Diskte yer olmayabilir."]);
    return;
  }

  // Kapak
  let cover = null;
  const dir0 = path.dirname(src);
  const baseNoExt = path.basename(src).replace(/.[^.]+$/, "");
  for (const e of [".png", ".jpg", ".jpeg", ".webp"]) {
    const c = path.join(dir0, baseNoExt + e);
    if (fs.existsSync(c)) {
      const cd = path.join(ROOT, "games", String(id));
      fs.mkdirSync(cd, { recursive: true });
      fs.copyFileSync(c, path.join(cd, "cover.png"));
      cover = "games/" + id + "/cover.png";
      break;
    }
  }

  // Catalog'a ekle (chunked bilgisiyle)
  const now = new Date().toISOString();
  const g = {
    id, title,
    description: "", developer: "", publisher: "",
    releaseDate: now, categoryId: category.id, genre: "",
    platform: platform.key, isFeatured: false, membersOnly: false,
    popularity: 0, stats: { views: 0, downloads: 0 },
    coverUrl: cover || "images/placeholder.png", bannerUrl: null,
    requirements: { minimum: {}, recommended: {} },
    versions: [{ id, version: "1.0.0", changelog: "", releasedAt: now }],
    latestVersion: { id, version: "1.0.0", changelog: "", releasedAt: now },
    latestFiles: [], torrent: null, apk: null, screenshots: [],
    category: category.slug, createdAt: now, popularityLabel: "",
    chunked: {
      enabled: true,
      chunkCount: up.parts,
      chunkSize: CHUNK_SIZE,
      fileName: path.basename(src),
      fileSize: up.size,
      baseUrl: up.rel,
      manifestUrl: up.rel + "/manifest.json",
      filePath: CHUNK_DIR + "\\" + up.base
    }
  };
  cat.games.push(g);

  const res = await pushGit(cat, "Buyuk dosya eklendi (" + (up.size / 1073741824).toFixed(1) + " GB): " + title + " (admin araci)", true);

  ctx.setResult("BUYUK DOSYA EKLENDI: " + title, [
    ...res,
    "",
    "Dosya      : " + path.basename(src),
    "Boyut      : " + (up.size / 1073741824).toFixed(2) + " GB",
    "Parca      : " + up.parts + " x ~" + (CHUNK_SIZE / 1048576).toFixed(0) + " MB",
    "Konum      : " + up.rel + "/",
    "Kategori   : " + category.name + "  (Oyun duzenle ile degistir)",
    up.warn ? "" : "",
    up.warn || "",
    "Sayfa      : " + gameUrl(g.id)
  ].filter(Boolean));
  ctx.pop();
}

function sizeOfChunks(g) {
  if (!g.chunked) return "";
  const n = g.chunked.chunkCount || 0;
  const sz = (g.chunked.fileSize || 0) / 1073741824;
  return n + " parca / " + sz.toFixed(1) + " GB";
}

/* ==================== ANA MENU ==================== */
function buildMenu(cat) {
  return {
    title: "ANA MENU",
    subtitle: cat.games.length + " OYUN  |  " + cat.upcomingGames.length + " YAKINDA  |  " + U.CFG.theme.toUpperCase() + " TEMA",
    items: [
      { label: U.c(U.T.ok, ">>") + "  Yeni oyun ekle", run: async ctx => { await addFlow(cat, ctx); } },
      { label: U.c(U.T.ok, "L") + "  LIKLE OYUN EKLE (dosya indirme)", hint: "MediaFire/gofile - uygulama indirir", run: ctx => { linkGameAddFlow(cat, ctx); } },
      { label: U.c(U.T.ok, "@") + "  TORRENT EKLE (.torrent dosyasi sec)", hint: "HIZLI YOL - tek adimda torrent ekler", run: ctx => { torrentQuickAdd(cat, ctx); } },
      { label: U.c(U.T.warn, "B") + "  BUYUK DOSYA EKLE (2GB+ oyun)", hint: "GTA V gibi - parcalara bolup yukler", run: ctx => { bigFileAddFlow(cat, ctx); } },
      { label: U.c(U.T.accent, "*") + "  Toplu oyun ekleme (liste)", run: ctx => { importMenu(cat, ctx); } },
      { label: U.c(U.T.accent, "~") + "  Oyun duzenle", run: ctx => { editMenu(cat, ctx); } },
      { label: U.c(U.T.warn, "!") + "  Toplu islem (coklu sec)", run: ctx => { bulkMenu(cat, ctx); } },
      { label: U.c(U.T.accent, "#") + "  Istatistikler", run: ctx => { statsScreen(cat, ctx); } },
      { label: U.c(U.T.box, "=") + "  Yedekleme / geri yukleme", run: ctx => { backupMenu(cat, ctx); } },
      { label: U.c(U.T.warn, "x") + "  Oyun sil", run: ctx => { removeMenu(cat, ctx); } },
      { label: U.c(U.T.warn, "x") + "  Yakinda listesinden sil", run: ctx => { soonRemoveMenu(cat, ctx); } },
      { label: U.c(U.T.accent, ">") + "  Oyunlari goruntule", run: ctx => {
          const lines = cat.games.slice().sort((a, b) => b.id - a.id).map(g => "id " + g.id + "  " + U.pad(U.trunc(g.title, 26), 27) + "  " + U.D((g.platform || "pc").toUpperCase() + "  v" + ((g.stats || {}).views || 0) + " d" + ((g.stats || {}).downloads || 0)));
          const sl = cat.upcomingGames.map(u => U.c(U.T.warn, "○") + " " + U.pad(U.trunc(u.title, 30), 31) + "  " + U.D(when(u.releaseDate)));
          ctx.setResult("OYUN LISTESI", [...(lines.length ? lines : ["(oyun yok)"]), "", U.B("YAKINDA:"), ...(sl.length ? sl : ["(yok)"])]);
        } },
      { label: U.c(U.T.accent, "*") + "  Yakinda oyun ekle", run: ctx => {
          ctx.push("YAKINDA OYUN EKLE", [
            { label: "Oyun adi gir", run: async c2 => { c2._soonTitle = await c2.ask("Yakinda cikacak oyun adi:"); c2.setResult("ADI ALINDI", [c2._soonTitle || "(bos)"]); } },
            { label: "Cikis tarihi gir", run: async c2 => { c2._soonDate = await c2.ask("Cikis tarihi (YYYY-AA-GG, bos olabilir):"); c2.setResult("TARIH", [c2._soonDate || "(bos)"]); } },
            { label: "Platform sec", run: c2 => { platformMenu(c2, p => { c2._soonPlat = p; c2.setResult("PLATFORM", [p.badge]); c2.pop(); }); } },
            { label: "Listeye EKLE", run: async c2 => {
                const t = c2._soonTitle; if (!t) { c2.setResult("HATA", ["Once oyun adi gir."]); return; }
                cat.upcomingGames.push({ id: "up-" + slug(t), title: t, platform: (c2._soonPlat || PLATFORMS[0]).key, releaseDate: /^\d{4}-\d{2}-\d{2}$/.test(c2._soonDate || "") ? c2._soonDate : (c2._soonDate || null), note: null, status: "coming-soon" });
                const res = await pushGit(cat, "Yakinda oyun eklendi: " + t + " (admin araci)", true);
                c2.setResult("EKLENDI: " + t, res); c2.pop();
              } }
          ]);
        } },
      { label: U.c(U.T.accent, "o") + "  Canli siteyi kontrol et", run: async ctx => { const r = await liveCheck(); ctx.setResult("SITE DURUMU", r.ok ? ["Site yayinda", "Oyun: " + r.games, "Yakinda: " + r.upcoming, (r.games === cat.games.length ? "Yerel ve canli esit." : "Fark var - push bekliyor olabilir.")] : [U.c(U.T.err, "Ulasilamadi: " + (r.err || r.status))]); } },
      { label: U.c(U.T.accent, "#") + "  Imza (sertifika) durumu", run: ctx => {
          try { execSync('node "' + path.join(__dirname, "sign.js") + '"', { stdio: "pipe" }); } catch {}
          ctx.setResult("IMZA DURUMU", ["Kod imzalama sertifikasi alinmadi (yillik ucretli).", "Windows uyarir - bu normal.", "Cozum: SSS bolumu -> 'Daha fazla bilgi' -> 'Yine de calistir'", "veya: Unblock-File -Path '.\\Oynuo_1.4.5_x64-setup.exe'"]);
        } },
      { label: U.c(U.T.box, "@") + "  Ayarlar (tema / banner / saat)", run: ctx => { settingsMenu(ctx); } },
      { label: U.c(U.T.ok, "^") + "  Degisiklikleri gonder (git push)", run: async ctx => { const res = await pushGit(cat, "Manuel gonderim (admin araci)", true); ctx.setResult("GONDERILDI", res); } },
      { label: U.c(U.T.err, "q") + "  Cikis", run: ctx => { ctx.quit(); } }
    ]
  };
}

/* ---------------- acilis ---------------- */
async function boot() {
  U.clear();
  if (U.CFG.effects) {
    for (const s of ["Oynuo Admin Konsolu baslatiliyor", "Katalog okunuyor", "GitHub baglantisi", "Arayuz yukleniyor"]) {
      U.write("  " + U.c(U.T.accent, "[oynuo]") + " " + U.D(s) + "\n");
      await U.sleep(110);
    }
    await U.sleep(150);
  }
}

/* ---------------- CLI komutlari ---------------- */
function flags(argv) {
  const f = {};
  for (let i = 2; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const k = argv[i].slice(2);
    const v = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "1";
    if (f[k] === undefined) f[k] = v; else f[k] = [].concat(f[k], v);
  }
  return f;
}
function findCat(c, q) {
  const s = String(q || "").trim().toLowerCase();
  if (!s) return c.categories[0];
  return c.categories.find(x => String(x.id) === s || x.slug.toLowerCase() === s || x.name.toLowerCase() === s) || null;
}

async function cli() {
  const args = process.argv.slice(2);
  const cmd = (args.find(a => !a.startsWith("--")) || "").toLowerCase();
  const f = flags(process.argv);

  if (!cmd) { await main(); return; }

  const out = s => { U.clear(); U.write("\n  " + s + "\n\n"); rl.close(); };

  if (cmd === "add") {
    const cat = read();
    const plat = PLATFORMS.find(x => x.key === String(f.platform || f.p || "pc").toLowerCase()) || PLATFORMS[0];
    const category = findCat(cat, f.category || f.cat);
    const title = f.title || f.t;
    if (!title) { out(U.c(U.T.err, "Hata: --title gerekli") + "\n  " + U.D('ornek: node admin.js add --title "GTA" --category action --link https://...') + "\n  " + U.D('         node admin.js add --title "GTA VI" --platform torrent --link "magnet:?xt=..."')); return; }
    if (!category) { out(U.c(U.T.err, "Hata: kategori yok") + "\n  " + U.D("secenekler: " + cat.categories.map(c => c.slug).join(", "))); return; }
    // Dosya modu: --file <yol> (n yerine - otomatik yukler)
    const fileArg = f.file || f.f;
    let g;
    if (fileArg) {
      if (!fs.existsSync(fileArg)) { out(U.c(U.T.err, "Dosya yok: " + fileArg)); return; }
      const kind = plat.key === "torrent" ? "torrent" : plat.key === "apk" ? "apk" : "game";
      const up = uploadFile(fileArg, nextId(cat), kind);
      g = await doAdd(cat, { title, platform: plat, category, link: "", fileRel: up.rel, fileSize: up.size, fileName: path.basename(fileArg), fileKind: kind, version: f.version || "1.0.0", developer: f.dev || "", genre: f.genre || "", description: f.desc || "", featured: f.featured === "1" });
      if (up.warn) U.warn(up.warn);
    } else {
      const link = f.link || f.l || "";
      if (link && plat.key !== "torrent" && !isUrl(link)) { out(U.c(U.T.err, "Hata: gecersiz link (http/https olmali) ya da --file <dosya> kullan")); return; }
      // Link verildiyse analiz et: saglayici, gercek dosya adi, boyut
      let realLink = link;
      let autoName = "";
      let autoSize = parseSize(f.size);
      if (link) {
        try {
          const info = L.analyzeLink(link);
          realLink = info.realUrl;
          autoName = info.fileName || "";
          if (!autoSize) autoSize = info.sizeBytes;
          U.write(U.D("  " + info.provider + " | " + (info.fileName || "?") + " | " + L.formatBytes(info.sizeBytes)));
          if (info.note) U.write(U.D("  " + info.note));
          U.write("");
        } catch (e) {
          U.warn("Baglanti analiz edilemedi, oldu gibi kaydediliyor: " + e.message);
        }
      }
      g = await doAdd(cat, { title, platform: plat, category, link: realLink, version: f.version || "1.0.0", developer: f.dev || "", publisher: f.pub || "", genre: f.genre || "", description: f.desc || "", featured: f.featured === "1", sizeBytes: autoSize, fileName: f.name || autoName || undefined });
    }
    const res = await pushGit(cat, "Oyun eklendi: " + g.title + " [" + plat.badge + "] (admin araci)", f["no-push"] !== "1");
    out(U.B("EKLENDI: " + g.title) + "\n" + res.map(r => U.D("  " + r)).join("\n") + "\n  " + U.c(U.T.accent, gameUrl(g.id)));
    return;
  }

  if (cmd === "soon") {
    const cat = read();
    const title = f.title || f.t;
    if (!title) { out(U.c(U.T.err, "Hata: --title gerekli") + "\n  " + U.D('ornek: node admin.js soon --title "GTA VI" --date 2026-11-19')); return; }
    const plat = PLATFORMS.find(x => x.key === String(f.platform || f.p || "pc").toLowerCase()) || PLATFORMS[0];
    const rel = f.date || "";
    cat.upcomingGames.push({ id: "up-" + slug(title), title, platform: plat.key, releaseDate: /^\d{4}-\d{2}-\d{2}$/.test(rel) ? rel : (rel || null), note: f.note || null, status: "coming-soon" });
    const res = await pushGit(cat, "Yakinda oyun eklendi: " + title + " (admin araci)", f["no-push"] !== "1");
    out(U.B("EKLENDI: " + title) + "\n" + res.map(r => U.D("  " + r)).join("\n") + "\n  " + U.D("yakinda listesi: " + cat.upcomingGames.length + " oyun"));
    return;
  }

  if (cmd === "rm" || cmd === "remove") {
    const cat = read();
    const id = parseInt(f.id || f._, 10);
    if (!id) { out(U.c(U.T.err, "Hata: id gerekli") + "\n  " + U.D("ornek: node admin.js rm 30")); return; }
    const g = cat.games.find(x => x.id === id);
    if (!g) { out(U.c(U.T.err, "Oyun bulunamadi: " + id)); return; }
    cat.games = cat.games.filter(x => x.id !== id);
    const cd = path.join(ROOT, "games", String(id));
    if (fs.existsSync(cd)) { try { fs.rmSync(cd, { recursive: true, force: true }); } catch {} }
    const res = await pushGit(cat, "Oyun silindi: " + g.title + " (admin araci)", f["no-push"] !== "1");
    out(U.B("SILINDI: " + g.title) + "\n" + res.map(r => U.D("  " + r)).join("\n"));
    return;
  }

  if (cmd === "list" || cmd === "ls") {
    const cat = read();
    U.clear();
    U.write("\n" + U.banner(cat.games.length + " OYUN  |  " + cat.upcomingGames.length + " YAKINDA") + "\n\n");
    U.write(U.box("OYUNLAR (" + cat.games.length + ")", cat.games.slice().sort((a, b) => a.id - b.id).map(g =>
      "id " + U.pad(String(g.id), 4) + U.pad(U.trunc(g.title, 28), 29) + U.D(U.pad((g.platform || "pc").toUpperCase(), 8)) + "v" + ((g.stats || {}).views || 0) + " d" + ((g.stats || {}).downloads || 0) + (gameLink(g) ? "" : U.c(U.T.warn, " [link yok]"))
    )).join("\n") + "\n\n");
    U.write(U.box("YAKINDA (" + cat.upcomingGames.length + ")", cat.upcomingGames.map(u =>
      U.pad(U.trunc(u.title, 30), 31) + U.D(U.pad((u.platform || "").toUpperCase(), 8)) + when(u.releaseDate)
    )).join("\n") + "\n\n");
    rl.close();
    return;
  }

  if (cmd === "sync" || cmd === "live") {
    const cat = read();
    const r = await liveCheck();
    U.clear();
    U.write("\n" + U.banner("CANLI KONTROL") + "\n\n");
    U.write(U.box("SITE", [
      "adres : " + SITE,
      r.ok ? "durum : YAYINDA" : "durum : ULASILAMADI",
      "canli oyun   : " + (r.games != null ? r.games : "-"),
      "canli yakinda: " + (r.upcoming != null ? r.upcoming : "-"),
      "yerel oyun   : " + cat.games.length,
      (r.ok && r.games === cat.games.length) ? "sonuc : ESIT" : "sonuc : FARK VAR (push bekliyor)"
    ]).join("\n") + "\n\n");
    rl.close();
    return;
  }

  if (cmd === "stats" || cmd === "stat") {
    const cat = read();
    U.clear();
    U.write("\n" + U.banner("ISTATISTIK") + "\n\n");
    const lines = [];
    const byPlatform = {};
    let views = 0, dls = 0, withLink = 0, withoutLink = 0, featured = 0, totalSize = 0;
    const byCategory = {};
    cat.games.forEach(g => {
      const p = g.platform || "pc";
      byPlatform[p] = (byPlatform[p] || 0) + 1;
      const cn = catName(cat, g.categoryId);
      byCategory[cn] = (byCategory[cn] || 0) + 1;
      const st = g.stats || {};
      views += st.views || 0; dls += st.downloads || 0;
      if (gameLink(g)) withLink++; else withoutLink++;
      if (g.isFeatured) featured++;
      const f = (g.latestFiles || []).find(x => x.fileSize > 0);
      if (f) totalSize += f.fileSize;
    });
    lines.push("TOPLAM OYUN          : " + cat.games.length);
    lines.push("  PC / Torrent / APK : " + (byPlatform.pc || 0) + " / " + (byPlatform.torrent || 0) + " / " + (byPlatform.apk || 0));
    lines.push("YAKINDA LISTESI     : " + cat.upcomingGames.length);
    lines.push("KATEGORI            : " + cat.categories.length);
    lines.push("");
    lines.push("GORUNTULENME        : " + views.toLocaleString("tr-TR"));
    lines.push("INDIRME             : " + dls.toLocaleString("tr-TR"));
    lines.push("BAGLANTILI OYUN     : " + withLink + (withoutLink ? "  (bagsiz: " + withoutLink + ")" : ""));
    lines.push("ONE CIKAN           : " + featured);
    lines.push("TOPLAM BOYUT        : " + (totalSize / 1073741824).toFixed(2) + " GB");
    U.write(U.box("KATALOG", lines).join("\n") + "\n\n");
    rl.close();
    return;
  }

  if (cmd === "edit") {
    const cat = read();
    const id = parseInt(f.id || f._, 10);
    if (!id) { out(U.c(U.T.err, "Hata: id gerekli") + "\n  " + U.D("ornek: node admin.js edit 6 --title \"Yeni Ad\"")); return; }
    const g = cat.games.find(x => x.id === id);
    if (!g) { out(U.c(U.T.err, "Oyun bulunamadi: " + id)); return; }
    const backup = JSON.parse(JSON.stringify(g));
    if (f.title || f.t) g.title = f.title || f.t;
    if (f.link || f.l) {
      g.latestFiles = []; g.apk = null; g.torrent = null;
      const link = f.link || f.l;
      if (g.platform === "torrent") { const m = link.startsWith("magnet:"); g.torrent = { magnetUrl: m ? link : "", torrentUrl: m ? "" : link }; }
      else if (g.platform === "apk") g.apk = { url: link };
      else g.latestFiles.push({ id: g.id, versionId: g.id, source: "external", kind: "file", fileName: g.title, fileSize: f.size ? parseSize(f.size) : 0, sha256: "", executablePath: "", downloadUrl: link });
    }
    if (f.featured === "1") g.isFeatured = true;
    if (f.featured === "0") g.isFeatured = false;
    if (f.dev) g.developer = f.dev;
    if (f.desc) g.description = f.desc;
    if (f.cat || f.category) { const cc = findCat(cat, f.cat || f.category); if (cc) { g.categoryId = cc.id; g.category = cc.slug; } }
    const res = await pushGit(cat, "Oyun guncellendi: " + g.title + " (admin araci)", f["no-push"] !== "1");
    out(U.B("GUNCELLENDI: " + g.title) + "\n" + res.map(r => U.D("  " + r)).join("\n") + "\n  " + U.c(U.T.accent, gameUrl(g.id)));
    void backup;
    return;
  }

  if (cmd === "backup") {
    const bdir = path.join(__dirname, "backups");
    if (!fs.existsSync(bdir)) fs.mkdirSync(bdir, { recursive: true });
    const name = "catalog-" + new Date().toISOString().replace(/[:.]/g, "-") + ".json";
    fs.copyFileSync(CATALOG, path.join(bdir, name));
    const files = fs.readdirSync(bdir).filter(x => x.endsWith(".json"));
    out(U.B("YEDEK ALINDI") + "\n  " + U.D(name) + "\n  " + U.D("toplam yedek: " + files.length));
    return;
  }

  if (cmd === "import") {
    const cat = read();
    const file = f.file || f._;
    if (!file) { out(U.c(U.T.err, "Hata: dosya gerekli") + "\n  " + U.D("ornek: node admin.js import --file oyunlar.txt")); return; }
    if (!fs.existsSync(file)) { out(U.c(U.T.err, "Dosya yok: " + file)); return; }
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith("#"));
    let added = 0, skipped = 0;
    for (const line of lines) {
      const p = line.split("|").map(s => s.trim());
      const title = p[0]; if (!title) { skipped++; continue; }
      if (cat.games.some(g => g.title.toLowerCase() === title.toLowerCase())) { skipped++; continue; }
      const plat = PLATFORMS.find(x => x.key === (p[1] || "pc").toLowerCase()) || PLATFORMS[0];
      const catg = findCat(cat, p[3]) || cat.categories[0];
      await doAdd(cat, { title, platform: plat, category: catg, link: p[2] || "", version: "1.0.0" });
      added++;
    }
    const res = await pushGit(cat, "Toplu import: " + added + " oyun (admin araci)", f["no-push"] !== "1");
    out(U.B("IMPORT: " + added + " eklendi, " + skipped + " atlandi") + "\n" + res.map(r => U.D("  " + r)).join("\n"));
    return;
  }

  if (cmd === "sign") {
    try { execSync('node "' + path.join(__dirname, "sign.js") + '"', { stdio: "inherit" }); } catch {}
    rl.close();
    return;
  }

  await main();
}

/* ---------------- giris ---------------- */
async function main() {
  await boot();
  const cat = read();
  const m = buildMenu(cat);
  const { finish } = U.runMenu(rl, m);
  await new Promise(res => {
    const iv = setInterval(() => { if (rl.closed) { clearInterval(iv); res(); } }, 200);
    process.on("exit", () => clearInterval(iv));
    setTimeout(() => { clearInterval(iv); res(); }, 600000);
  });
  finish && finish();
  U.clear();
  U.write("\n  " + U.c(U.T.ok, "Gorusuruz!") + "\n\n");
  process.exit(0);
}

cli().catch(e => { U.write(U.c(U.T.err, "HATA: " + (e.message || e)) + "\n"); process.exit(1); });