/* ============================================================
   OYNUO ADMIN  v1.0  —  Oyun katalogu yönetim aracı
   ------------------------------------------------------------
   Kullanım:
     OYNUO-ADMIN.bat                      -> menü (kolay)
     node admin.js                        -> menü
     node admin.js add --title "..." ...   -> hızlı ekleme
     node admin.js soon --title "..." ...  -> yakında oyun ekle
     node admin.js rm 30                   -> oyun sil
     node admin.js sync                    -> canlı siteyi doğrula
     node sign.js                          -> imza (sertifika) durumu
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const https = require("https");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const CATALOG = path.join(ROOT, "catalog.json");
const SITE = "https://cinat3140-rgb.github.io/oynuo";

/* ---------- renkler ---------- */
const C = {
  r: "\x1b[0m", b: "\x1b[1m", d: "\x1b[2m",
  red: "\x1b[31m", grn: "\x1b[32m", yel: "\x1b[33m",
  blu: "\x1b[34m", mag: "\x1b[35m", cya: "\x1b[36m",
  wht: "\x1b[37m", gra: "\x1b[90m",
  bgB: "\x1b[44m\x1b[97m", bgG: "\x1b[42m\x1b[30m", bgY: "\x1b[43m\x1b[30m", bgR: "\x1b[41m\x1b[97m"
};
const PLATFORMS = [
  { key: "pc", label: "PC (Windows) — indirme linki", badge: "PC" },
  { key: "torrent", label: "Torrent — magnet / .torrent", badge: "TORRENT" },
  { key: "apk", label: "Android APK — apk linki", badge: "APK" }
];

/* ---------- ekran yardimcilari ---------- */
const line = (ch = "─", n = 58) => C.d + ch.repeat(n) + C.r;
function clear() { process.stdout.write("\x1b[2J\x1b[H"); }
function header(sub) {
  clear();
  console.log("");
  console.log(C.bgB + C.b + "   O Y N U O   A D M I N   v1.0   " + C.r);
  console.log(line("━"));
  if (sub) console.log(C.d + "  " + sub + C.r);
  console.log("");
}
function ok(m) { console.log(C.grn + "  ✓ " + m + C.r); }
function warn(m) { console.log(C.yel + "  ! " + m + C.r); }
function err(m) { console.log(C.red + "  ✗ " + m + C.r); }
function info(m) { console.log(C.d + "  " + m + C.r); }
function fail(m) { err(m); process.exit(9); }
function head(t) { console.log("\n" + C.b + C.cya + "  " + t + C.r); console.log(line()); }

/* ---------- katalog ---------- */
function readCatalog() {
  if (!fs.existsSync(CATALOG)) fail("catalog.json bulunamadi: " + CATALOG);
  let d;
  try { d = JSON.parse(fs.readFileSync(CATALOG, "utf8")); }
  catch (e) { fail("catalog.json okunamadi: " + e.message); }
  if (!Array.isArray(d.categories) || !d.categories.length) fail("catalog.json içinde categories yok");
  if (!Array.isArray(d.games)) d.games = [];
  if (!Array.isArray(d.upcomingGames)) d.upcomingGames = [];
  return d;
}
const nextId = c => (c.games.length ? Math.max(...c.games.map(g => +g.id || 0)) : 0) + 1;
const findCat = (c, q) => {
  const s = String(q || "").trim().toLowerCase();
  if (!s) return c.categories[0];
  return c.categories.find(x => String(x.id) === s || x.slug.toLowerCase() === s || x.name.toLowerCase() === s) || null;
};
const catName = (c, id) => (c.categories.find(x => x.id === id) || {}).name || "?";

/* ---------- girdi ---------- */
const rl = require("readline").createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(res => rl.question(q, a => res(String(a).trim())));
async function choose(q, options) {
  console.log(C.b + C.cya + "  " + q + C.r);
  options.forEach((o, i) => console.log(C.grn + "   " + (i + 1) + C.r + ") " + o.label));
  for (;;) {
    const n = parseInt(await ask(C.d + "   seçim [1-" + options.length + "]: " + C.r), 10);
    if (n >= 1 && n <= options.length) return options[n - 1];
    warn("geçersiz — tekrar dene");
  }
}
async function confirm(q) { return (await ask(C.b + "  " + q + " [e/h]: " + C.r)).toLowerCase().startsWith("e"); }

/* ---------- araclar ---------- */
function parseSize(raw) {
  const m = String(raw || "").trim().match(/^([\d.,]+)\s*(b|kb|mb|gb)?$/i);
  if (!m) return 0;
  let v = parseFloat(m[1].replace(",", "."));
  if (!isFinite(v) || v < 0) v = 0;
  const mult = { b: 1, kb: 1024, mb: 1048576, gb: 1073741824 };
  return Math.round(v * (mult[(m[2] || "mb").toLowerCase()] || mult.mb));
}
function fmtBytes(b) {
  if (!b) return "-";
  const mb = b / 1048576;
  if (mb >= 1024) return (mb / 1024).toFixed(1).replace(/\.0$/, "") + " GB";
  return (mb < 10 ? mb.toFixed(1) : Math.round(mb)) + " MB";
}
const isUrl = s => { try { return /^https?:$/.test(new URL(s).protocol); } catch { return false; } };
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function get(src, dest) {
  return new Promise((res, rej) => {
    https.get(src, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) return res(get(r.headers.location, dest));
      if (r.statusCode !== 200) return rej(new Error("HTTP " + r.statusCode));
      const ws = fs.createWriteStream(dest);
      r.pipe(ws);
      ws.on("finish", () => { ws.close(); res(dest); });
      ws.on("error", e => { fs.unlink(dest, () => {}); rej(e); });
    }).on("error", e => { try { fs.unlinkSync(dest); } catch {} rej(e); });
  });
}
async function importCover(gameId, input) {
  const p = String(input || "").trim();
  if (!p) return "images/placeholder.png";
  const dir = path.join(ROOT, "games", String(gameId));
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, "cover.png");
  if (/^https?:\/\//i.test(p)) {
    try { await get(p, dest); return "games/" + gameId + "/cover.png"; }
    catch (e) { warn("kapak indirilemedi (" + e.message + ") — placeholder kullanılıyor"); return "images/placeholder.png"; }
  }
  if (!fs.existsSync(p)) { warn("dosya yok: " + p + " — placeholder kullanılıyor"); return "images/placeholder.png"; }
  fs.copyFileSync(p, dest);
  return "games/" + gameId + "/cover.png";
}

/* ---------- kaydet + push ---------- */
function save(cat) {
  cat.games.sort((a, b) => b.id - a.id);
  fs.writeFileSync(CATALOG, JSON.stringify(cat, null, 2) + "\n", "utf8");
  ok("catalog.json güncellendi");
}
async function commitAndPush(cat, msg, doPush) {
  save(cat);
  if (!doPush) { info("push atlandı (--no-push)"); return false; }
  try {
    const run = c => execSync(c, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    run("git add catalog.json games/ downloads/ index.html app-update.json oynuo-admin/");
    run("git commit -m " + JSON.stringify(msg));
    run("git pull --rebase origin main");
    run("git push origin main");
    ok("GitHub'a gönderildi — site 1-2 dakikada güncellenir");
    return true;
  } catch (e) {
    err("push başarısız: " + String(e.message || e).split("\n")[0]);
    warn("dosyalar kayıtlı. Elle gönder: cd \"" + ROOT + "\" && git push origin main");
    return false;
  }
}
const gameUrl = id => SITE + "/#/oyun/" + id;

/* ---------- oyun kurma ---------- */
async function addGame(cat, o) {
  const id = nextId(cat);
  const now = new Date().toISOString();
  const g = {
    id, title: o.title,
    description: o.description || "",
    developer: o.developer || "",
    publisher: o.publisher || "",
    releaseDate: o.releaseDate || now,
    categoryId: o.category.id,
    genre: o.genre || "",
    platform: o.platform.key,
    isFeatured: !!o.featured,
    membersOnly: false,
    popularity: 0,
    stats: { views: 0, downloads: 0 },
    coverUrl: o.cover || "images/placeholder.png",
    bannerUrl: null,
    requirements: { minimum: {}, recommended: {} },
    versions: [{ id, version: o.version, changelog: o.changelog || "", releasedAt: now }],
    latestVersion: { id, version: o.version, changelog: o.changelog || "", releasedAt: now },
    latestFiles: [],
    torrent: null, apk: null, screenshots: [],
    category: o.category.slug,
    createdAt: now,
    popularityLabel: ""
  };
  if (o.platform.key === "torrent" && o.link) {
    const m = o.link.startsWith("magnet:");
    g.torrent = { magnetUrl: m ? o.link : "", torrentUrl: m ? "" : o.link };
  } else if (o.platform.key === "apk" && o.link) {
    g.apk = { url: o.link };
  } else if (o.link) {
    g.latestFiles.push({
      id, versionId: id, source: "external", kind: "file",
      fileName: o.fileName || o.title, fileSize: o.sizeBytes || 0,
      sha256: "", executablePath: "", downloadUrl: o.link
    });
  }
  cat.games.push(g);
  return g;
}

/* ---------- listeler ---------- */
function showGames(cat) {
  if (!cat.games.length) { info("hiç oyun yok"); return; }
  head("OYUNLAR (" + cat.games.length + ")");
  for (const g of cat.games.slice().sort((a, b) => b.id - a.id)) {
    const p = g.platform || "pc";
    const link = p === "torrent" ? ((g.torrent || {}).magnetUrl || (g.torrent || {}).torrentUrl)
      : p === "apk" ? ((g.apk || {}).url)
      : ((g.latestFiles || [])[0] || {}).downloadUrl;
    const st = g.stats || {};
    console.log("  " + C.cya + String(g.id).padEnd(4) + C.r + C.b + (g.title || "?") + C.r);
    console.log("       " + C.d + catName(cat, g.categoryId) + " · " + p.toUpperCase() +
      (g.isFeatured ? " · ★ Öne Çıkan" : "") +
      " · 👁 " + (st.views || 0) + " · ⬇ " + (st.downloads || 0) + C.r);
    console.log("       " + (link ? C.gra + link.slice(0, 76) + C.r : C.yel + "bağlantı yok (yakında)" + C.r));
  }
  if (cat.upcomingGames.length) {
    head("YAKINDA (" + cat.upcomingGames.length + ")");
    for (const u of cat.upcomingGames) {
      const d = u.releaseDate ? new Date(u.releaseDate) : null;
      const left = d && isFinite(d) ? Math.ceil((d - new Date()) / 864e5) : null;
      const rel = left == null ? "Yakında" : left < 0 ? "Çıktı" : left === 0 ? "Bugün" : left + " gün kaldı";
      console.log("  " + C.yel + "○ " + C.r + C.b + u.title + C.r + C.d + "  [" + u.platform + "] " + (u.releaseDate || "") + " — " + rel + C.r);
    }
  }
}

/* ---------- canlı kontrol ---------- */
function liveCheck() {
  return new Promise(res => {
    https.get(SITE + "/catalog.json?v=" + Date.now(), { headers: { "Cache-Control": "no-cache" } }, r => {
      let b = "";
      r.on("data", c => (b += c));
      r.on("end", () => {
        try {
          const d = JSON.parse(b);
          res({ ok: r.statusCode === 200, status: r.statusCode, games: d.games.length, upcoming: (d.upcomingGames || []).length });
        } catch (e) { res({ ok: false, status: r.statusCode, err: e.message }); }
      });
    }).on("error", e => res({ ok: false, err: e.message }));
  });
}

/* ---------- komutlar ---------- */
function parseFlags(argv) {
  const f = {};
  for (let i = 2; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const k = argv[i].slice(2);
    const v = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "1";
    if (f[k] === undefined) f[k] = v; else f[k] = [].concat(f[k], v);
  }
  return f;
}

async function cmdAdd(f) {
  const cat = readCatalog();
  const pKey = String(f.platform || f.p || "pc").toLowerCase();
  const plat = PLATFORMS.find(x => x.key === pKey) || PLATFORMS[0];
  const category = findCat(cat, f.category || f.cat);
  if (!category) fail("Kategori yok. Seçenekler: " + cat.categories.map(c => c.slug).join(", "));
  const title = f.title || f.t;
  if (!title) fail('Oyun adı zorunlu: --title "Grand Theft Auto"');
  const link = f.link || f.l || "";
  if (link && plat.key !== "torrent" && !isUrl(link)) fail("Geçersiz link (http/https olmalı): " + link);
  const g = await addGame(cat, {
    title, platform: plat, category, link,
    description: f.desc || "", developer: f.dev || "", publisher: f.pub || "",
    genre: f.genre || "", version: f.version || "1.0.0", changelog: f.changelog || "",
    featured: f.featured === "1", cover: await importCover(nextId(cat), f.cover),
    sizeBytes: parseSize(f.size)
  });
  await commitAndPush(cat, `Oyun eklendi: ${g.title} [${plat.badge}] (admin aracı)`, f["no-push"] !== "1");
  console.log(C.bgG + C.b + "  " + gameUrl(g.id) + "  " + C.r);
}

async function cmdSoon(f) {
  const cat = readCatalog();
  const title = f.title || f.t;
  if (!title) fail('Oyun adı zorunlu: --title "Grand Theft Auto VI"');
  const pKey = String(f.platform || f.p || "pc").toLowerCase();
  const plat = PLATFORMS.find(x => x.key === pKey) || PLATFORMS[0];
  const rel = f.date || "";
  cat.upcomingGames.push({
    id: "up-" + slug(title), title, platform: plat.key,
    releaseDate: /^\d{4}-\d{2}-\d{2}$/.test(rel) ? rel : (rel || null),
    note: f.note || null, status: "coming-soon"
  });
  await commitAndPush(cat, `Yakında oyun eklendi: ${title} (admin aracı)`, f["no-push"] !== "1");
  ok("yakında listesi: " + cat.upcomingGames.length + " oyun");
}

async function cmdRemove(f) {
  const cat = readCatalog();
  const id = parseInt(f.id || f._, 10);
  if (!id) fail("Oyun id gerekli: node admin.js rm 30");
  const i = cat.games.findIndex(g => g.id === id);
  if (i < 0) fail("Oyun bulunamadı: " + id);
  const gone = cat.games[i];
  cat.games.splice(i, 1);
  await commitAndPush(cat, `Oyun silindi: ${gone.title} (admin aracı)`, f["no-push"] !== "1");
}

async function cmdSync() {
  const r = await liveCheck();
  if (!r.ok) { err("canlı siteye ulaşılamadı" + (r.err ? ": " + r.err : "")); return; }
  ok("site yayında — " + r.games + " oyun, " + r.upcoming + " yakında oyun");
}

/* ---------- menü ---------- */
async function menu() {
  const cat = readCatalog();
  let dirty = false;
  for (;;) {
    header("Oyun katalogunu düzenle, otomatik GitHub'a gönder  ·  " + cat.games.length + " oyun, " + cat.upcomingGames.length + " yakında");
    const sel = await choose(C.b + "  Ne yapmak istiyorsun?" + C.r, [
      { key: "add", label: "➕  Yeni oyun ekle" },
      { key: "list", label: "📋  Oyunları görüntüle" },
      { key: "soon", label: "🕐  Yakında çıkacak oyun ekle" },
      { key: "srm", label: "🗑️  Yakında listesinden sil" },
      { key: "rm", label: "❌  Oyun sil" },
      { key: "live", label: "🌐  Canlı siteyi kontrol et" },
      { key: "sign", label: "🔐  İmza (sertifika) durumu" },
      { key: "push", label: "🚀  Sadece değişiklikleri gönder" },
      { key: "quit", label: "🚪  Çıkış" }
    ]);
    if (sel.key === "quit") { console.log("\n" + C.grn + "  Görüşürüz! 👋" + C.r + "\n"); break; }

    if (sel.key === "list") { header(); showGames(cat); await ask(C.d + "\n  Enter ile devam..." + C.r); continue; }

    if (sel.key === "live") { header(); const r = await liveCheck(); r.ok ? ok(`site yayında — ${r.games} oyun, ${r.upcoming} yakında`) : err("ulaşılamadı: " + (r.err || r.status)); await ask(C.d + "\n  Enter ile devam..." + C.r); continue; }

    if (sel.key === "sign") { header(); try { execSync('node "' + path.join(__dirname, "sign.js") + '"', { stdio: "inherit" }); } catch {} await ask(C.d + "\n  Enter ile devam..." + C.r); continue; }

    if (sel.key === "push") { header(); await commitAndPush(cat, "Manuel gonderim (admin aracı)", true); await ask(C.d + "\n  Enter ile devam..." + C.r); continue; }

    if (sel.key === "rm") {
      if (!cat.games.length) { warn("silinecek oyun yok"); continue; }
      header(); showGames(cat);
      const id = parseInt(await ask(C.b + "\n  Silinecek oyun id: " + C.r), 10);
      const g = cat.games.find(x => x.id === id);
      if (!g) { err("bulunamadı: " + id); continue; }
      if (!await confirm(`"${g.title}" silinsin mi?`)) { info("iptal"); continue; }
      cat.games = cat.games.filter(x => x.id !== id);
      await commitAndPush(cat, `Oyun silindi: ${g.title} (admin aracı)`, true);
      continue;
    }

    if (sel.key === "srm") {
      if (!cat.upcomingGames.length) { warn("yakında listesi boş"); continue; }
      header(); showGames(cat);
      const i = parseInt(await ask(C.b + "\n  Silinecek yakında oyun sıra no: " + C.r), 10);
      if (!(i >= 1 && i <= cat.upcomingGames.length)) { err("geçersiz"); continue; }
      const g = cat.upcomingGames[i - 1];
      if (!await confirm(`"${g.title}" listeden silinsin mi?`)) { info("iptal"); continue; }
      cat.upcomingGames.splice(i - 1, 1);
      await commitAndPush(cat, `Yakında oyun silindi: ${g.title} (admin aracı)`, true);
      continue;
    }

    if (sel.key === "soon") {
      head("YAKINDA ÇIKACAK OYUN EKLE");
      const title = await ask("  Oyun adı: ");
      if (!title) { warn("ad zorunlu"); continue; }
      const plat = await choose("  Platform:", PLATFORMS);
      const rel = await ask(C.d + "  Çıkış tarihi (YYYY-AA-GG, boş bırakılabilir): " + C.r);
      const note = await ask(C.d + "  Kısa not (opsiyonel): " + C.r);
      cat.upcomingGames.push({
        id: "up-" + slug(title), title, platform: plat.key,
        releaseDate: /^\d{4}-\d{2}-\d{2}$/.test(rel) ? rel : (rel || null),
        note: note || null, status: "coming-soon"
      });
      ok(`"${title}" yakında listesine eklendi`);
      if (await confirm("  Şimdi GitHub'a gönderilsin mi?")) await commitAndPush(cat, `Yakında oyun eklendi: ${title} (admin aracı)`, true);
      continue;
    }

    // add
    head("YENİ OYUN EKLE");
    const title = await ask(C.b + "  Oyun adı: " + C.r);
    if (!title) { warn("ad zorunlu"); continue; }
    const plat = await choose("  Platform:", PLATFORMS);
    head("  Kategoriler:");
    cat.categories.forEach(c => console.log(C.grn + "   " + String(c.id).padEnd(3) + C.r + C.d + c.name.padEnd(14) + C.r + C.gra + c.slug + C.r));
    let category = null;
    while (!category) {
      const q = await ask(C.d + "   kategori no / slug: " + C.r);
      category = findCat(cat, q);
      if (!category) warn("bulunamadı, tekrar dene");
    }
    let link = await ask(C.b + `\n  ${plat.badge} bağlantısı (boş bırakılırsa oyun "yakında" olur): ` + C.r);
    if (link && plat.key !== "torrent" && !isUrl(link)) { warn("geçerli http(s) linki olmalı"); link = ""; }
    const cover = await ask(C.d + "  Kapak görseli (dosya yolu veya URL, boş olabilir): " + C.r);
    const developer = await ask(C.d + "  Geliştirici (opsiyonel): " + C.r);
    const publisher = await ask(C.d + "  Yayıncı (opsiyonel): " + C.r);
    const genre = await ask(C.d + "  Tür (opsiyonel, ör. Action): " + C.r);
    const size = await ask(C.d + "  Boyut (opsiyonel, ör. 250 MB / 2 GB): " + C.r);
    const version = await ask(C.d + "  Sürüm (Enter = 1.0.0): " + C.r) || "1.0.0";
    const description = await ask(C.d + "  Açıklama (opsiyonel): " + C.r);
    const featured = await confirm("  Öne çıkan olsun mu?");

    const g = await addGame(cat, {
      title, platform: plat, category, link, developer, publisher,
      genre, version, description, featured,
      cover: await importCover(nextId(cat), cover),
      sizeBytes: parseSize(size)
    });

    console.log("");
    head("ÖZET");
    console.log("  Başlık     : " + C.b + g.title + C.r);
    console.log("  Platform   : " + g.platform.toUpperCase());
    console.log("  Kategori   : " + category.name);
    console.log("  Bağlantı   : " + C.d + (link || "(yok — yakında)") + C.r);
    console.log("  Kapak      : " + C.d + g.coverUrl + C.r);
    if (g.latestFiles[0]) console.log("  Boyut      : " + fmtBytes(g.latestFiles[0].fileSize));
    console.log("  Öne çıkan  : " + (g.isFeatured ? "evet" : "hayır"));
    console.log("\n" + C.d + "  " + gameUrl(g.id) + C.r);
    console.log("");
    if (!await confirm("  Kaydedip GitHub'a gönderilsin mi?")) { err("vazgeçildi"); continue; }
    await commitAndPush(cat, `Oyun eklendi: ${g.title} [${plat.badge}] (admin aracı)`, true);
    console.log(C.bgG + C.b + "  " + gameUrl(g.id) + "  " + C.r);
  }
}

/* ---------- giriş ---------- */
(async () => {
  const args = process.argv.slice(2);
  const cmd = args.find(a => !a.startsWith("--")) || "";
  const f = parseFlags(process.argv);
  try {
    switch (cmd.toLowerCase()) {
      case "add": return await cmdAdd(f);
      case "soon": return await cmdSoon(f);
      case "rm": case "remove": return await cmdRemove(f);
      case "sync": case "live": return await cmdSync();
      case "list": { const c = readCatalog(); header(); showGames(c); return; }
      case "sign": return execSync('node "' + path.join(__dirname, "sign.js") + '"', { stdio: "inherit" });
      default: await menu();
    }
  } catch (e) {
    err(String(e.message || e));
    process.exit(1);
  } finally {
    rl.close();
  }
})();
