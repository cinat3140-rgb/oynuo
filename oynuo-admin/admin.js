/* OYNUO Admin - komut satırı aracı */
"use strict";
const fs = require("fs");
const path = require("path");
const https = require("https");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const CATALOG = path.join(ROOT, "catalog.json");

const CLR = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  bg: "\x1b[44m"
};

const PLATFORM_CHOICES = [
  { key: "pc", label: "PC (Windows) - indirme linki", badge: "PC" },
  { key: "torrent", label: "Torrent - magnet linki", badge: "TORRENT" },
  { key: "apk", label: "Android APK - apk linki", badge: "APK" }
];

function logo() {
  console.log(CLR.bg + CLR.bold + "   OYNUO ADMIN   " + CLR.reset);
  console.log(CLR.dim + "      oyun ekle, degisikligi GitHub'a atan araci" + CLR.reset + "\n");
}

function fail(msg) { console.log(CLR.red + "  ! " + msg + CLR.reset); process.exit(9); }

function readCatalog() {
  if (!fs.existsSync(CATALOG)) fail("catalog.json bulunamadi: " + CATALOG);
  let d; try { d = JSON.parse(fs.readFileSync(CATALOG, "utf8")); } catch (e) { fail("catalog.json okunamadi: " + e.message); }
  if (!d.categories || !Array.isArray(d.categories)) fail("categories yok");
  if (!Array.isArray(d.games)) d.games = [];
  if (!Array.isArray(d.upcomingGames)) d.upcomingGames = [];
  return d;
}

function nextId(cat) {
  const ids = cat.games.map(g => parseInt(g.id, 10) || 0);
  return (ids.length ? Math.max(...ids) : 0) + 1;
}

function categoryByKey(cat) {
  const c = cat.categories[0];
  return { id: c.id, slug: c.slug, name: c.name };
}

function findCategory(cat, input) {
  const q = String(input || "").trim().toLowerCase();
  if (!q) return categoryByKey(cat);
  for (const c of cat.categories) {
    if (String(c.id) === q || c.slug.toLowerCase() === q || c.name.toLowerCase() === q) return c;
  }
  return null;
}

function ask(rl, q) {
  return new Promise(res => { rl.question(q, a => res(a.trim())); });
}

async function choose(rl, q, options) {
  console.log(CLR.cyan + "\n  " + q + CLR.reset);
  options.forEach((o, i) => console.log("    " + (i + 1) + ") " + o.label));
  while (true) {
    const a = await ask(rl, "   secim [1-" + options.length + "]: ");
    const n = parseInt(a, 10);
    if (n >= 1 && n <= options.length) return options[n - 1];
    console.log(CLR.yellow + "  gecersiz girdi" + CLR.reset);
  }
}

function parseSize(raw) {
  const s = String(raw || "").trim();
  if (!s) return 0;
  const m = s.match(/^([\d.,]+)\s*(b|kb|mb|gb)?$/i);
  if (!m) return 0;
  let v = parseFloat(m[1].replace(",", ".")); if (isNaN(v) || v < 0) v = 0;
  const u = (m[2] || "mb").toLowerCase();
  const mult = { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 };
  return Math.round(v * (mult[u] || mult.mb));
}

function fmtSize(bytes) {
  if (!bytes) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return (mb / 1024).toFixed(1).replace(/\.0$/, "") + " GB";
  return (mb < 10 ? mb.toFixed(1) : Math.round(mb)) + " MB";
}

function isValidUrl(s) {
  try { const u = new URL(s); return /^https?:$/.test(u.protocol); } catch (e) { return false; }
}

function downloadFile(url, dest) {
  return new Promise((res, rej) => {
    const req = https.get(url, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        res(downloadFile(r.headers.location, dest)); return;
      }
      if (r.statusCode !== 200) { rej(new Error("http " + r.statusCode)); return; }
      const ws = fs.createWriteStream(dest);
      r.pipe(ws);
      ws.on("finish", () => { ws.close(); res(dest); });
      ws.on("error", e => { fs.unlink(dest, () => {}); rej(e); });
    });
    req.on("error", e => { try { fs.unlinkSync(dest); } catch (_) {} rej(e); });
  });
}

async function importCover(cat, gameId, input) {
  const p = String(input || "").trim();
  if (!p) return "images/placeholder.png";
  const dir = path.join(ROOT, "games", String(gameId));
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, "cover.png");
  const ext = p.toLowerCase();
  if (/^https?:\/\//.test(ext)) {
    console.log(CLR.dim + "  kapak indiriliyor: " + p + CLR.reset);
    try { await downloadFile(p, dest); return "games/" + gameId + "/cover.png"; }
    catch (e) { console.log(CLR.yellow + "  kapak indirilemedi (" + e.message + "), placeholders kullanilacak" + CLR.reset); return "images/placeholder.png"; }
  }
  if (!fs.existsSync(p)) { console.log(CLR.yellow + "  dosya bulunamadi: " + p + ", placeholders kullanilacak" + CLR.reset); return "images/placeholder.png"; }
  fs.copyFileSync(p, dest);
  return "games/" + gameId + "/cover.png";
}

function buildGame(cat, opts) {
  const id = nextId(cat);
  const now = new Date().toISOString();
  const category = opts.category;
  const platform = opts.platform;
  const link = opts.link || "";
  const size = opts.sizeBytes || 0;
  const game = {
    id: id,
    title: opts.title,
    description: opts.description || "",
    developer: opts.developer || "",
    publisher: opts.publisher || "",
    releaseDate: opts.releaseDate || now,
    categoryId: category.id,
    genre: opts.genre || "",
    platform: platform.key,
    isFeatured: !!opts.featured,
    membersOnly: false,
    popularity: 0,
    stats: { views: 0, downloads: 0 },
    coverUrl: opts.cover,
    bannerUrl: null,
    requirements: { minimum: {}, recommended: {} },
    versions: [{ id: id, version: opts.version, changelog: opts.changelog || "", releasedAt: now }],
    latestVersion: { id: id, version: opts.version, changelog: opts.changelog || "", releasedAt: now },
    latestFiles: [],
    torrent: null,
    apk: null,
    screenshots: [],
    category: category.slug,
    createdAt: now,
    popularityLabel: ""
  };
  if (platform.key === "torrent") {
    game.torrent = { magnetUrl: link.startsWith("magnet:") ? link : "", torrentUrl: link.startsWith("magnet:") ? "" : (link || "") };
    if (!link) delete game.torrent; else if (game.torrent.torrentUrl && !game.torrent.magnetUrl) { game.torrent.torrentUrl = link; }
  } else if (platform.key === "apk") {
    game.apk = { url: link || "" };
    if (!link) game.apk = null;
  } else {
    if (link) game.latestFiles.push({ id: id, versionId: id, source: "external", kind: "file", fileName: opts.fileName || opts.title, fileSize: size, sha256: "", executablePath: "", downloadUrl: link });
  }
  return game;
}

function saveAndPush(cat, doPush, msg) {
  cat.games.sort((a, b) => (b.id - a.id));
  fs.writeFileSync(CATALOG, JSON.stringify(cat, null, 2) + "\n", "utf8");
  console.log(CLR.green + "  catalog.json guncellendi" + CLR.reset);
  if (!doPush) { console.log(CLR.dim + "  push atlanildi (--no-push)" + CLR.reset); return; }
  try {
    const cmds = ["git add catalog.json games/", "git commit -m " + JSON.stringify(msg), "git pull --rebase origin main", "git push origin main"];
    for (const c of cmds) { console.log(CLR.dim + "  $ " + c + CLR.reset); execSync(c, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] }); }
    console.log(CLR.green + CLR.bold + "  PUSH OK - site kisa surede guncellenecek" + CLR.reset);
  } catch (e) {
    console.log(CLR.red + "  push basarisiz: " + (e.message || e) + CLR.reset);
    console.log(CLR.yellow + "  catalog.json ve oyun dosyalari lokal repo'ya yazildi, push'u elle at: cd \"" + ROOT + "\" ; git push origin main" + CLR.reset);
  }
}

function listGames(cat) {
  if (!cat.games.length) { console.log(CLR.dim + "  hic oyun yok" + CLR.reset); return; }
  console.log("\n" + CLR.bold + "  OYUNLAR (" + cat.games.length + ")" + CLR.reset);
  cat.games.slice().sort((a, b) => b.id - a.id).forEach(g => {
    const p = g.platform || "pc";
    const badge = p === "torrent" ? "TORRENT" : p === "apk" ? "APK" : "PC";
    const link = g.platform === "torrent" ? (g.torrent && (g.torrent.magnetUrl || g.torrent.torrentUrl)) : g.platform === "apk" ? (g.apk && g.apk.url) : (g.latestFiles && g.latestFiles.length ? g.latestFiles[0].downloadUrl : "");
    console.log("  " + CLR.cyan + String(g.id).padEnd(4) + CLR.reset + CLR.bold + (g.title || "?") + CLR.reset + CLR.dim + " [" + badge + "]" + (link ? "\n       " + link : "") + CLR.reset);
  });
  if (Array.isArray(cat.upcomingGames) && cat.upcomingGames.length) {
    console.log("\n" + CLR.bold + "  YAKINDA (" + cat.upcomingGames.length + ")" + CLR.reset);
    cat.upcomingGames.forEach(u => {
      console.log("  " + CLR.yellow + "○ " + CLR.reset + CLR.bold + (u.title || "?") + CLR.reset + CLR.dim + " [" + (u.platform || "pc") + "]" + (u.releaseDate ? " — " + u.releaseDate : "") + CLR.reset);
    });
  }
}

function cliFlags(args) {
  const f = {};
  for (let i = 2; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : "1";
      if (!f[key] || f[key] === "1") f[key] = val;
      if (val !== "1") i++;
    }
  }
  return f;
}

async function cmdAdd(flags) {
  const cat = readCatalog();
  const platKey = flags.platform || flags.p || "pc";
  const platform = PLATFORM_CHOICES.find(x => x.key === platKey.toLowerCase()) || PLATFORM_CHOICES[0];
  const catObj = findCategory(cat, flags.category || flags.cat);
  if (!catObj) fail("Kategori bulunamadi. Kategoriler: " + cat.categories.map(c => c.slug).join(", "));
  let sizeBytes = 0;
  if (flags.size) sizeBytes = parseSize(flags.size);
  const link = flags.link || flags.l || "";
  if (link && platform.key !== "torrent" && !isValidUrl(link)) fail("Gecersiz link (http/https): " + link);
  const opts = {
    title: flags.title || flags.t || "",
    description: flags.desc || "",
    developer: flags.dev || "",
    publisher: flags.pub || "",
    genre: flags.genre || "",
    releaseDate: flags.date || "",
    featured: flags.featured === "1" || flags.featured === "on",
    version: flags.version || "1.0.0",
    changelog: flags.changelog || "",
    cover: "",
    platform: platform,
    category: catObj,
    link: link,
    sizeBytes: sizeBytes,
    fileName: flags.file || ""
  };
  if (!opts.title) fail("Oyun adi zorunlu: --title \"Grand Theft Auto\"");

  async function doIt(coverPath) {
    opts.cover = await importCover(cat, nextId(cat), coverPath);
    const game = buildGame(cat, opts);
    cat.games.push(game);
    const noPush = flags["no-push"] === "1";
    saveAndPush(cat, !noPush, "Oyun eklendi: " + game.title + " [" + platform.badge + "] (admin aracı)");
    console.log(CLR.cyan + "\n  https://cinat3140-rgb.github.io/oynuo/#/oyun/" + game.id + CLR.reset);
  }

  if (flags.cover) { await doIt(flags.cover); return; }
  console.log("\n  Indirme linkiyle ilgili sorun yok, kapak gorseli icin sekmesi: herhangi dosya yolu veya URL, bos birakip sonra eklersin.");
  await doIt("");
}

async function cmdInteractive() {
  const rl = require("readline").createInterface({ input: process.stdin, output: process.stdout });
  try {
    logo();
    const cat = readCatalog();
    const menu = [
      { key: "add", label: "Yeni oyun ekle" },
      { key: "list", label: "Oyunlari listele (oyunlar + yakinda)" },
      { key: "soon", label: "Yakinda cikacak oyun ekle" },
      { key: "soonlist", label: "Yakinda listesini duzenle" },
      { key: "push", label: "Catalog-ist degil: yalnizca degisiklikleri push et" },
      { key: "quit", label: "Cikis" }
    ];
    while (true) {
      const sel = await choose(rl, "Ne yapmak istersin?", menu);
      if (sel.key === "quit") { console.log(CLR.dim + "  gorusteruz!" + CLR.reset); break; }
      if (sel.key === "list") { listGames(cat); continue; }
      if (sel.key === "soon") {
        const st = await ask(rl, "  Oyun adi: ");
        if (!st) { console.log(CLR.yellow + "  ad zorunlu, atlaniyor" + CLR.reset); continue; }
        const splat = await choose(rl, "Platform", PLATFORM_CHOICES);
        const rel = await ask(rl, "  Cikis tarihi (YYYY-MM-DD, bos olabilir): ");
        const note = await ask(rl, "  Kisa not (opsiyonel): ");
        cat.upcomingGames.push({
          id: "up-" + st.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
          title: st,
          platform: splat.key,
          releaseDate: /^\d{4}-\d{2}-\d{2}$/.test(rel) ? rel : (rel || null),
          note: note || null,
          status: "coming-soon"
        });
        const sp = (await ask(rl, "  GitHub'a push edilsin mi? (e)=evet: ")).toLowerCase() === "e";
        saveAndPush(cat, sp, "Yakinda oyun eklendi: " + st + " (admin aracı)");
        continue;
      }
      if (sel.key === "soonlist") {
        if (!cat.upcomingGames.length) { console.log(CLR.dim + "  yakinda listesi bos" + CLR.reset); continue; }
        cat.upcomingGames.forEach((u, i) => console.log("  " + CLR.cyan + String(i + 1) + CLR.reset + ") " + u.title + CLR.dim + " [" + u.platform + "]" + CLR.reset));
        const rm = await ask(rl, "  silinecek sira no (bos = silme): ");
        const idx = parseInt(rm, 10);
        if (idx >= 1 && idx <= cat.upcomingGames.length) {
          const gone = cat.upcomingGames.splice(idx - 1, 1)[0];
          console.log(CLR.green + "  silindi: " + gone.title + CLR.reset);
          const sp = (await ask(rl, "  GitHub'a push edilsin mi? (e)=evet: ")).toLowerCase() === "e";
          saveAndPush(cat, sp, "Yakinda oyun silindi: " + gone.title + " (admin aracı)");
        }
        continue;
      }
      if (sel.key === "push") { try { execSync("git push origin main", { cwd: ROOT, stdio: "inherit" }); console.log(CLR.green + "  push ok" + CLR.reset); } catch (e) { console.log(CLR.red + "  push basarisiz: " + e.message + CLR.reset); } continue; }

      const title = await ask(rl, "  Oyun adi: ");
      if (!title) { console.log(CLR.yellow + "  ad zorunlu, atlaniyor" + CLR.reset); continue; }
      const platform = await choose(rl, "Platform", PLATFORM_CHOICES);

      console.log(CLR.cyan + "  Kategoriler:" + CLR.reset);
      cat.categories.forEach(c => console.log("    " + c.id + ") " + c.name + " (" + c.slug + ")"));
      let catId = "";
      let catObj = null;
      while (!catObj) {
        catId = await ask(rl, "  kategori no/slug: ");
        catObj = findCategory(cat, catId);
        if (!catObj) console.log(CLR.yellow + "  tekrar dene" + CLR.reset);
      }

      const link = await ask(rl, "  Indirme / magnet / apk linki (bos olabilir): ");
      if (link && platform.key !== "torrent" && !isValidUrl(link)) { console.log(CLR.yellow + "  uyari: gecerli http(s) linki olmayabilir" + CLR.reset); }

      const cover = await ask(rl, "  Kapak gorseli (dosya yolu veya URL, bos olabilir): ");
      const dev = await ask(rl, "  Gelistirici (opsiyonel): ");
      const pub = await ask(rl, "  Yayinci (opsiyonel): ");
      const genre = await ask(rl, "  Tur (opsiyonel, or. Action): ");
      const desc = await ask(rl, "  Aciklama (opsiyonel): ");
      const size = await ask(rl, "  Boyut (opsiyonel, or. 250 MB / 2 GB): ");
      const ver = await ask(rl, "  Surum (varsayilan 1.0.0): ") || "1.0.0";
      const feat = (await ask(rl, "  One cikan olsun mu? (e): ")).toLowerCase() === "e";

      const opts = {
        title, description: desc, developer: dev, publisher: pub, genre,
        version: ver, featured: feat, platform, category: catObj, link,
        sizeBytes: parseSize(size), cover: "", fileName: ""
      };
      opts.cover = await importCover(cat, nextId(cat), cover);
      const game = buildGame(cat, opts);
      cat.games.push(game);
      const doPush = (await ask(rl, "  GitHub'a push edilsin mi? (e)=evet otomatik: ")).toLowerCase() === "e";
      saveAndPush(cat, doPush, "Oyun eklendi: " + game.title + " [" + platform.badge + "] (admin aracı)");
      console.log(CLR.cyan + "\n  https://cinat3140-rgb.github.io/oynuo/#/oyun/" + game.id + CLR.reset);
    }
  } finally { rl.close(); }
}

(async () => {
  const args = process.argv.slice(2);
  const cmd = (args.find(a => !a.startsWith("--")) || "");
  const flags = cliFlags(process.argv);
  if (cmd && cmd.toLowerCase() === "add") { await cmdAdd(flags); return; }
  if (cmd && cmd.toLowerCase() === "soon") {
    const cat = readCatalog();
    const title = flags.title || flags.t || "";
    if (!title) fail("Oyun adi zorunlu: --title \"Grand Theft Auto VI\"");
    const plat = (flags.platform || flags.p || "pc").toLowerCase();
    const pl = PLATFORM_CHOICES.find(x => x.key === plat) || PLATFORM_CHOICES[0];
    const rel = flags.date || "";
    cat.upcomingGames.push({
      id: "up-" + title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      title, platform: pl.key,
      releaseDate: /^\d{4}-\d{2}-\d{2}$/.test(rel) ? rel : (rel || null),
      note: flags.note || null,
      status: "coming-soon"
    });
    const noPush = flags["no-push"] === "1";
    saveAndPush(cat, !noPush, "Yakinda oyun eklendi: " + title + " (admin aracı)");
    console.log(CLR.green + "  yakinda listesi: " + cat.upcomingGames.length + " oyun" + CLR.reset);
    return;
  }
  await cmdInteractive();
})().catch(e => { console.error(e); process.exit(1); });