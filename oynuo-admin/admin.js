/* ============================================================
   OYNUO ADMIN  v2.0  —  katalog yonetim konsolu
   ------------------------------------------------------------
   node admin.js                -> tam menü (ok tusu ile secim)
   node admin.js add --title ...  -> hizli ekleme
   node admin.js soon --title ... -> yakinda oyun
   node admin.js rm 30            -> oyun sil
   node admin.js sync             -> canli site kontrolu
   node admin.js sign             -> imza durumu
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const https = require("https");
const { execSync } = require("child_process");
const U = require("./ui.js");

const ROOT = path.resolve(__dirname, "..");
const CATALOG = path.join(ROOT, "catalog.json");
const SITE = "https://cinat3140-rgb.github.io/oynuo";

const PLATFORMS = [
  { key: "pc", label: "PC (Windows) — indirme linki", badge: "PC" },
  { key: "torrent", label: "Torrent — magnet / .torrent", badge: "TORRENT" },
  { key: "apk", label: "Android APK — apk linki", badge: "APK" }
];

const rl = require("readline").createInterface({ input: process.stdin, output: process.stdout });
const ask = async q => String(await rl.question(q)).trim();
const confirm = async q => U.yes(await ask("  " + U.A("[?]") + " " + U.B(q) + " " + U.D("[e/h]") + " "));
const pause = async (m = "Enter ile devam") => { await ask("  " + U.D(m + "...")); };

/* ---------------- katalog ---------------- */
function read() {
  if (!fs.existsSync(CATALOG)) U.err("catalog.json yok: " + CATALOG) || process.exit(9);
  let d;
  try { d = JSON.parse(fs.readFileSync(CATALOG, "utf8")); } catch (e) { U.err("catalog.json okunamadı: " + e.message); process.exit(9); }
  if (!Array.isArray(d.categories) || !d.categories.length) { U.err("catalog.json içinde categories yok"); process.exit(9); }
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
const catName = (c, id) => ((c.categories.find(x => x.id === id) || {}).name) || "?";

function gameLink(g) {
  const p = g.platform || "pc";
  if (p === "torrent") return (g.torrent || {}).magnetUrl || (g.torrent || {}).torrentUrl || "";
  if (p === "apk") return (g.apk || {}).url || "";
  return ((g.latestFiles || [])[0] || {}).downloadUrl || "";
}
function sizeOf(cat, g) {
  const f = (g.latestFiles || []).find(x => x.fileSize > 0) || (g.latestFiles || [])[0];
  if (!f || !f.fileSize) return "";
  const mb = f.fileSize / 1048576;
  return mb >= 1024 ? (mb / 1024).toFixed(1).replace(/\.0$/, "") + " GB" : (mb < 10 ? mb.toFixed(1) : Math.round(mb)) + " MB";
}
function daysLeft(date) {
  if (!date) return null;
  const d = new Date(date + "T00:00:00");
  if (!isFinite(d)) return null;
  return Math.ceil((d - new Date()) / 864e5);
}
function when(date) {
  const n = daysLeft(date);
  if (n == null) return U.D("—");
  if (n < 0) return U.c(240, "çıktı");
  if (n === 0) return U.c(214, "bugün");
  if (n <= 60) return U.c(T_OK, n + " gün");
  return U.D(date || "—");
}
const T_OK = 46;

/* ---------------- araclar ---------------- */
function parseSize(raw) {
  const m = String(raw || "").trim().match(/^([\d.,]+)\s*(b|kb|mb|gb)?$/i);
  if (!m) return 0;
  let v = parseFloat(m[1].replace(",", "."));
  if (!isFinite(v) || v < 0) v = 0;
  const mult = { b: 1, kb: 1024, mb: 1048576, gb: 1073741824 };
  return Math.round(v * (mult[(m[2] || "mb").toLowerCase()] || mult.mb));
}
const isUrl = s => { try { return /^https?:$/.test(new URL(s).protocol); } catch { return false; } };
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function fetchFile(src, dest) {
  return new Promise((res, rej) => {
    https.get(src, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) return res(fetchFile(r.headers.location, dest));
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
    try { await fetchFile(p, dest); return "games/" + gameId + "/cover.png"; }
    catch (e) { U.warn("kapak indirilemedi (" + e.message + ") — placeholder"); return "images/placeholder.png"; }
  }
  if (!fs.existsSync(p)) { U.warn("dosya yok: " + p + " — placeholder"); return "images/placeholder.png"; }
  fs.copyFileSync(p, dest);
  return "games/" + gameId + "/cover.png";
}

/* ---------------- kaydet + gonder ---------------- */
function save(cat) {
  cat.games.sort((a, b) => b.id - a.id);
  fs.writeFileSync(CATALOG, JSON.stringify(cat, null, 2) + "\n", "utf8");
  U.ok("catalog.json kaydedildi");
}
async function push(cat, msg, doPush) {
  save(cat);
  if (!doPush) { U.info("push atlandı (--no-push)"); return false; }
  try {
    const run = c => execSync(c, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    run("git add -A");
    run("git commit -m " + JSON.stringify(msg));
    run("git pull --rebase origin main");
    run("git push origin main");
    U.ok("GitHub'a gönderildi — site 1-2 dakikada güncellenir");
    return true;
  } catch (e) {
    U.err("push başarısız: " + String(e.message || e).split("\n")[0]);
    U.warn('elle gönder: cd "' + ROOT + '" && git push origin main');
    return false;
  }
}
const url = id => SITE + "/#/oyun/" + id;

/* ---------------- oyun olustur ---------------- */
function build(cat, o) {
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
    g.latestFiles.push({ id, versionId: id, source: "external", kind: "file", fileName: o.fileName || o.title, fileSize: o.sizeBytes || 0, sha256: "", executablePath: "", downloadUrl: o.link });
  }
  cat.games.push(g);
  return g;
}

/* ---------------- gorunum ---------------- */
function gameRow(cat, g, maxTitle = 24) {
  const lk = gameLink(g);
  const st = g.stats || {};
  let t = g.title || "?";
  if (t.length > maxTitle) t = t.slice(0, maxTitle - 1) + "~";
  const bits = [];
  bits.push(catName(cat, g.categoryId));
  bits.push((g.platform || "pc").toUpperCase());
  if (g.isFeatured) bits.push("*");
  const size = sizeOf(cat, g);
  if (size) bits.push(size);
  bits.push("v" + (st.views || 0));
  bits.push("d" + (st.downloads || 0));
  const right = lk ? U.DM(bits.join(" ")) : U.DM(bits.join(" ")) + " " + U.c(U.T.warn, "[link yok]");
  const gap = Math.max(1, 52 - U.width(t) - U.width(right));
  return U.B(U.TX(t)) + " ".repeat(gap) + right;
}

function showDetail(cat, g) {
  U.screen("OYUN DETAYI", g.title ? U.trunc(g.title, 42) : "OYUN");
  const rows = [
    ["Oyun adı", g.title],
    ["ID", String(g.id)],
    ["Kategori", catName(cat, g.categoryId) + "  (" + (g.category || "-") + ")"],
    ["Platform", (g.platform || "pc").toUpperCase()],
    ["Geliştirici", g.developer || "—"],
    ["Yayıncı", g.publisher || "—"],
    ["Tür", g.genre || "—"],
    ["Sürüm", (g.latestVersion || {}).version || "—"],
    ["Boyut", sizeOf(cat, g) || "—"],
    ["Öne çıkan", g.isFeatured ? "evet" : "hayır"],
    ["Kapak", g.coverUrl || "—"],
    ["Görüntülenme", String((g.stats || {}).views || 0)],
    ["İndirme", String((g.stats || {}).downloads || 0)],
    ["Bağlantı", gameLink(g) || "— (yakında)"],
    ["Açıklama", (g.description || "—").slice(0, 46)],
    ["Eklenme", (g.createdAt || "").slice(0, 10)]
  ];
  console.log("  " + U.BX("+" + "-".repeat(64) + "+"));
  for (const [k, v] of rows) {
    const val = String(v == null ? "-" : v);
    console.log("  " + U.BX("|") + " " + U.D(U.pad(k, 14)) + " " + U.TX(U.pad(U.trunc(val, 44), 44)) + " " + U.BX("|"));
  }
  console.log("  " + U.BX("+" + "-".repeat(64) + "+"));
  console.log("");
  console.log("  " + U.D(url(g.id)));
}

/* ---------------- canli ---------------- */
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

/* ---------------- ekranlar ---------------- */
async function screenList(cat) {
  U.screen(cat.games.length + " OYUN  |  " + cat.upcomingGames.length + " YAKINDA", "OYUNLAR");
  const sorted = cat.games.slice().sort((a, b) => b.id - a.id);
  if (!sorted.length) U.info("henüz oyun yok");
  sorted.forEach(g => {
    console.log("  " + U.c(U.T.accent, String(g.id).padEnd(4)) + gameRow(cat, g));
  });
  if (cat.upcomingGames.length) {
    console.log("");
    U.head("YAKINDA ÇIKACAKLAR");
    cat.upcomingGames.forEach(u => {
      const n = daysLeft(u.releaseDate);
      const rel = n == null ? U.D("—") : n < 0 ? U.c(U.T.err, "çıktı") : n === 0 ? U.c(U.T.warn, "bugün") : U.c(T_OK, n + " gün");
      console.log("  " + U.c(U.T.warn, ".") + " " + U.B(U.TX(String(u.title).padEnd(34))) + "  " + U.D((u.platform || "").toUpperCase().padEnd(8)) + rel);
    });
  }
  console.log("");
  await pause();
}

async function screenLive() {
  U.screen("CANLI KONTROL");
  U.head("SİTE DURUMU");
  console.log("  " + U.D("adres   ") + SITE);
  const r = await liveCheck();
  if (r.ok) {
    U.ok("site yayında");
    console.log("    " + U.D("oyun      ") + U.B(r.games + " adet"));
    console.log("    " + U.D("yakında   ") + U.B(r.upcoming + " adet"));
    const local = read();
    if (local.games.length !== r.games) U.warn("yerel " + local.games.length + " / canlı " + r.games + " — push bekliyor olabilir");
    else U.ok("yerel ve canlı eşit");
  } else U.err("ulaşılamadı" + (r.err ? ": " + r.err : ""));
  console.log("");
  await pause();
}

async function screenSign() {
  U.screen("İMZA DURUMU");
  try { execSync('node "' + path.join(__dirname, "sign.js") + '"', { stdio: "inherit" }); } catch {}
  console.log("");
  await pause();
}

async function screenSettings() {
  for (;;) {
    U.screen("KISISELLESTIRME", "TERCIHLER");
    const items = [
      { k: "theme", label: "Tema: " + U.CFG.theme + U.D("  (" + U.THEMES[U.CFG.theme].desc + ")") },
      { k: "banner", label: "Banner metni: " + U.B(U.CFG.banner) },
      { k: "owner", label: "Sahip etiketi: " + U.CFG.owner },
      { k: "timestamp", label: "Saat damgası: " + (U.CFG.timestamp ? "açık" : "kapalı") },
      { k: "effects", label: "Açılış efekti: " + (U.CFG.effects ? "açık" : "kapalı") },
      { k: "back", label: "← Geri" }
    ];
    const sel = await U.selectList(rl, items, { render: x => x.label, page: 6 });
    if (!sel || sel.k === "back") return;

    if (sel.k === "theme") {
      U.screen("GORSEL AYARLARI", "TEMA SEC (ok tuslariyla)");
      const keys = U.THEME_KEYS.map(k => ({ k, label: U.themePreview(k) }));
      const t = await U.selectList(rl, keys, { render: x => x.label, page: 6 });
      if (t) { U.setTheme(t.k); U.refreshTheme(); U.ok("tema: " + t.k); await pause(); }
    } else if (sel.k === "banner") {
      const v = await ask("  " + U.D("yeni banner metni: "));
      if (v) { U.CFG.banner = v; U.saveConfig(); U.refreshTheme(); U.ok("banner güncellendi"); await pause(); }
    } else if (sel.k === "owner") {
      const v = await ask("  " + U.D("sahip etiketi: "));
      U.CFG.owner = v || "admin"; U.saveConfig(); U.ok("güncellendi"); await pause();
    } else if (sel.k === "timestamp") {
      U.CFG.timestamp = !U.CFG.timestamp; U.saveConfig(); U.ok("saat damgası " + (U.CFG.timestamp ? "açık" : "kapalı")); await pause();
    } else if (sel.k === "effects") {
      U.CFG.effects = !U.CFG.effects; U.saveConfig(); U.ok("efekt " + (U.CFG.effects ? "açık" : "kapalı")); await pause();
    }
  }
}

/* ---------------- oyun silme (ok tusu) ---------------- */
async function screenRemove(cat) {
  if (!cat.games.length) { U.warn("silinecek oyun yok"); return; }
  const sorted = cat.games.slice().sort((a, b) => a.id - b.id);
  const g = await U.selectList(rl, sorted, {
    render: x => gameRow(cat, x, 28),
    page: 12,
    title: "OYUN SILME  -  silinecek oyunu sec",
    hint: "↑/↓ hareket  •  Enter sec  •  Esc iptal  •  rakam: dogrudan sec"
  });
  if (!g) { U.info("iptal edildi"); return; }

  showDetail(cat, g);
  console.log("");
  if (!await confirm('"' + g.title + '" kalıcı olarak silinecek. Emin misin?')) { U.info("iptal edildi"); return; }
  const again = await ask("  " + U.D("teyit için oyun adını yaz (iptal için boş): "));
  if (again.toLowerCase() !== String(g.title).toLowerCase().trim()) { U.info("isim eşleşmedi — iptal"); return; }

  cat.games = cat.games.filter(x => x.id !== g.id);
  // kapak dosyasini da temizle
  const cd = path.join(ROOT, "games", String(g.id));
  if (fs.existsSync(cd)) { try { fs.rmSync(cd, { recursive: true, force: true }); U.ok("kapak klasörü silindi: games/" + g.id); } catch {} }
  await push(cat, "Oyun silindi: " + g.title + " (admin aracı)", true);
}

/* ---------------- yakinda silme ---------------- */
async function screenSoonRemove(cat) {
  if (!cat.upcomingGames.length) { U.warn("yakında listesi boş"); return; }
  const g = await U.selectList(rl, cat.upcomingGames, {
    title: "YAKINDA LISTESINDEN SIL",
    render: x => {
      const n = daysLeft(x.releaseDate);
      const rel = n == null ? U.D("—") : n < 0 ? U.c(U.T.err, "çıktı") : n === 0 ? U.c(U.T.warn, "bugün") : U.c(T_OK, n + " gün");
      return U.B(U.TX(String(x.title).padEnd(34))) + "  " + U.D((x.platform || "").toUpperCase().padEnd(8)) + rel;
    }, page: 12
  });
  if (!g) { U.info("iptal"); return; }
  if (!await confirm('"' + g.title + '" listeden silinsin mi?')) { U.info("iptal"); return; }
  cat.upcomingGames = cat.upcomingGames.filter(x => x.title !== g.title);
  await push(cat, "Yakında oyun silindi: " + g.title + " (admin aracı)", true);
}

/* ---------------- oyun ekleme ---------------- */
async function screenAdd(cat) {
  U.screen("YENİ OYUN EKLE");
  U.askQ("Oyun adı:");
  const title = await ask("  " + U.A("> "));
  if (!title) { U.warn("ad zorunlu"); return; }

  U.askQ("Platform:");
  const keys = PLATFORMS.map(p => ({ k: p.key, label: p.label, p }));
  const pk = await U.selectList(rl, keys, { render: x => x.label, page: 3, hint: "↑/↓  •  Enter seç" });
  if (!pk) return;
  const plat = pk.p;

  U.head("KATEGORİLER");
  const cats = cat.categories.map(c => ({ c, label: U.c(U.T.accent, String(c.id).padEnd(3)) + " " + U.TX(c.name.padEnd(14)) + U.D(c.slug) }));
  const cs = await U.selectList(rl, cats, { render: x => x.label, page: 11, hint: "↑/↓  •  Enter seç  •  ya da numara" });
  if (!cs) return;
  const category = cs.c;

  U.askQ(plat.badge + " bağlantısı (boş = oyun 'yakında' görünür):");
  let link = await ask("  " + U.A("> "));
  if (link && plat.key !== "torrent" && !isUrl(link)) { U.warn("geçerli http(s) linki olmalı"); link = ""; }
  if (link && plat.key === "torrent" && !/^(magnet:|https?:)/i.test(link)) { U.warn("magnet: ile başlamalı"); link = ""; }

  U.askQ("Kapak görseli (dosya yolu veya URL — boş olabilir):");
  const cover = await ask("  " + U.A("> "));
  U.askQ("Geliştirici (opsiyonel):");
  const developer = await ask("  " + U.A("> "));
  U.askQ("Yayıncı (opsiyonel):");
  const publisher = await ask("  " + U.A("> "));
  U.askQ("Tür (opsiyonel, ör. Action):");
  const genre = await ask("  " + U.A("> "));
  U.askQ("Boyut (opsiyonel, ör. 250 MB / 2 GB):");
  const size = await ask("  " + U.A("> "));
  U.askQ("Sürüm (Enter = 1.0.0):");
  const version = (await ask("  " + U.A("> "))) || "1.0.0";
  U.askQ("Açıklama (opsiyonel):");
  const description = await ask("  " + U.A("> "));
  const featured = await confirm("Öne çıkan olsun mu?");

  const g = build(cat, {
    title, platform: plat, category, link, developer, publisher,
    genre, version, description, featured,
    cover: await importCover(nextId(cat), cover),
    sizeBytes: parseSize(size)
  });

  U.screen("ÖNİZLEME");
  showDetail(cat, g);
  if (!await confirm("Kaydedip GitHub'a gönderilsin mi?")) { U.warn("vazgeçildi — katalog değiştirilmedi geri alınacak"); cat.games.pop(); return; }
  await push(cat, "Oyun eklendi: " + g.title + " [" + plat.badge + "] (admin aracı)", true);
  console.log("");
  console.log("  " + U.bg(U.T.ok, "  " + url(g.id) + "  "));
  console.log("");
  await pause();
}

async function screenSoonAdd(cat) {
  U.screen("YAKINDA OYUN EKLE");
  U.askQ("Oyun adı:");
  const title = await ask("  " + U.A("> "));
  if (!title) { U.warn("ad zorunlu"); return; }
  U.askQ("Platform:");
  const keys = PLATFORMS.map(p => ({ k: p.key, label: p.label, p }));
  const pk = await U.selectList(rl, keys, { render: x => x.label, page: 3, hint: "↑/↓  •  Enter seç" });
  if (!pk) return;
  U.askQ("Çıkış tarihi (YYYY-AA-GG, boş olabilir):");
  const rel = await ask("  " + U.A("> "));
  U.askQ("Kısa not (opsiyonel):");
  const note = await ask("  " + U.A("> "));

  cat.upcomingGames.push({
    id: "up-" + slug(title), title, platform: pk.p.key,
    releaseDate: /^\d{4}-\d{2}-\d{2}$/.test(rel) ? rel : (rel || null),
    note: note || null, status: "coming-soon"
  });
  U.ok('"' + title + '" yakında listesine eklendi');
  if (await confirm("GitHub'a gönderilsin mi?")) await push(cat, "Yakında oyun eklendi: " + title + " (admin aracı)", true);
}

/* ---------------- ana menu ---------------- */
async function menu() {
  await U.boot();
  const cat = read();
  U.info("Oynuo Admin Konsolu v2.0 - hazir"); U.info("");
  for (;;) {
    const items = [
      { k: "add", label: U.c(U.T.ok, "+") + "  Yeni oyun ekle" },
      { k: "soonadd", label: U.c(U.T.accent, "*") + "  Yakında çıkacak oyun ekle" },
      { k: "list", label: U.c(U.T.accent, ">") + "  Oyunları görüntüle" },
      { k: "rm", label: U.c(U.T.warn, "x") + "  Oyun sil  " + U.D("(ok tuşlarıyla seç)") },
      { k: "soonrm", label: U.c(U.T.warn, "x") + "  Yakında listesinden sil" },
      { k: "live", label: U.c(U.T.accent, "o") + "  Canlı siteyi kontrol et" },
      { k: "sign", label: U.c(U.T.accent, "#") + "  İmza (sertifika) durumu" },
      { k: "push", label: U.c(U.T.ok, "^") + "  Değişiklikleri gönder" },
      { k: "set", label: U.c(U.T.box, "@") + "  Ayarlar  " + U.D("(tema, banner, saat)") },
      { k: "quit", label: U.c(U.T.err, "q") + "  Çıkış" }
    ];
    const sel = await U.selectList(rl, items, {
      render: x => x.label,
      page: 10,
      title: "ANA MENU   |   " + cat.games.length + " oyun   |   " + cat.upcomingGames.length + " yakında   |   tema: " + U.CFG.theme,
      hint: "↑/↓ hareket  •  Enter sec  •  Esc cikis  •  rakam: dogrudan sec"
    });
    if (!sel || sel.k === "quit") { U.clear(); console.log("\n  " + U.c(U.T.ok, "Gorusuruz!") + "\n"); break; }

    if (sel.k === "add") await screenAdd(cat);
    else if (sel.k === "soonadd") await screenSoonAdd(cat);
    else if (sel.k === "rm") await screenRemove(cat);
    else if (sel.k === "soonrm") await screenSoonRemove(cat);
    else if (sel.k === "list") await screenList(cat);
    else if (sel.k === "live") await screenLive();
    else if (sel.k === "sign") await screenSign();
    else if (sel.k === "set") await screenSettings();
    else if (sel.k === "push") { U.screen("MANUEL GONDERIM", "GIT COMMIT + PUSH"); await push(cat, "Manuel gonderim (admin araci)", true); await pause(); }
  }
}

/* ---------------- CLI ---------------- */
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
async function cliAdd(f) {
  const cat = read();
  const plat = PLATFORMS.find(x => x.key === String(f.platform || f.p || "pc").toLowerCase()) || PLATFORMS[0];
  const category = findCat(cat, f.category || f.cat);
  if (!category) U.err("kategori yok: " + cat.categories.map(c => c.slug).join(", ")) || process.exit(1);
  const title = f.title || f.t;
  if (!title) U.err('--title gerekli: node admin.js add --title "GTA" --category action') || process.exit(1);
  const link = f.link || f.l || "";
  if (link && plat.key !== "torrent" && !isUrl(link)) { U.err("geçersiz link"); process.exit(1); }
  const g = build(cat, {
    title, platform: plat, category, link,
    description: f.desc || "", developer: f.dev || "", publisher: f.pub || "",
    genre: f.genre || "", version: f.version || "1.0.0",
    featured: f.featured === "1", cover: await importCover(nextId(cat), f.cover),
    sizeBytes: parseSize(f.size)
  });
  await push(cat, "Oyun eklendi: " + g.title + " [" + plat.badge + "] (admin aracı)", f["no-push"] !== "1");
  console.log("  " + U.bg(U.T.ok, "  " + url(g.id) + "  "));
  rl.close();
}
async function cliSoon(f) {
  const cat = read();
  const title = f.title || f.t;
  if (!title) { U.err('--title gerekli'); process.exit(1); }
  const plat = PLATFORMS.find(x => x.key === String(f.platform || f.p || "pc").toLowerCase()) || PLATFORMS[0];
  const rel = f.date || "";
  cat.upcomingGames.push({ id: "up-" + slug(title), title, platform: plat.key, releaseDate: /^\d{4}-\d{2}-\d{2}$/.test(rel) ? rel : (rel || null), note: f.note || null, status: "coming-soon" });
  await push(cat, "Yakında oyun eklendi: " + title + " (admin aracı)", f["no-push"] !== "1");
  U.ok("yakında: " + cat.upcomingGames.length + " oyun");
  rl.close();
}
async function cliRemove(f) {
  const cat = read();
  const id = parseInt(f.id || f._, 10);
  if (!id) { U.err("id gerekli: node admin.js rm 30"); process.exit(1); }
  const g = cat.games.find(x => x.id === id);
  if (!g) { U.err("bulunamadı: " + id); process.exit(1); }
  cat.games = cat.games.filter(x => x.id !== id);
  await push(cat, "Oyun silindi: " + g.title + " (admin aracı)", f["no-push"] !== "1");
  rl.close();
}

(async () => {
  const args = process.argv.slice(2);
  const cmd = args.find(a => !a.startsWith("--")) || "";
  const f = flags(process.argv);
  try {
    switch (cmd.toLowerCase()) {
      case "add": return await cliAdd(f);
      case "soon": return await cliSoon(f);
      case "rm": case "remove": return await cliRemove(f);
      case "list": await screenList(read()); return rl.close();
      case "live": case "sync": await screenLive(); return rl.close();
      case "sign": await screenSign(); return rl.close();
      default: await menu();
    }
  } catch (e) {
    U.err(String(e.message || e));
    process.exit(1);
  }
})();
