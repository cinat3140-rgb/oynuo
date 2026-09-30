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

const ROOT = path.resolve(__dirname, "..");
const CATALOG = path.join(ROOT, "catalog.json");
const SITE = "https://cinat3140-rgb.github.io/oynuo";
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
function save(cat) {
  cat.games.sort((a, b) => b.id - a.id);
  fs.writeFileSync(CATALOG, JSON.stringify(cat, null, 2) + "\n", "utf8");
}
async function pushGit(cat, msg, doPush) {
  save(cat);
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
    label: U.B(U.TX(U.pad(U.trunc(g.title, 30), 31))) + "  " + U.D(String(catName(cat, g.categoryId)).padEnd(8) + " " + U.pad((g.platform || "pc").toUpperCase(), 8)) + (gameLink(g) ? "" : U.c(U.T.warn, "[link yok]")),
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

/* ==================== OYUN EKLEME (alt menulerle) ==================== */
async function addFlow(cat, ctx) {
  const title = await ctx.ask("Oyun adi:");
  if (!title) { ctx.setResult("IPTAL", ["Oyun adi bos."]); return; }
  // PLATFORM -> alt menu
  platformMenu(ctx, async p => {
    categoryMenu(cat, ctx, async category => {
      ctx.push("OYUN BILGILERI - " + U.trunc(title, 30), [
        { label: "Baglanti / indirme linki gir", run: async c2 => { const link = await c2.ask(p.badge + " baglantisi (bos = 'yakinda'):"); if (link && p.key !== "torrent" && !isUrl(link)) { c2.setResult("HATA", ["Gecersiz link (http/https olmali)"]); return; } c2.setResult("LINK KAYDEDILDI", [link || "(bos - oyun 'yakinda' olur)"]); } },
        { label: "Kapak gorseli gir", run: async c2 => { const cv = await c2.ask("Dosya yolu veya URL (bos olabilir):"); c2.setResult("KAPAK", [cv || "(placeholder kullanilacak)"]); } },
        { label: "Gelistirici / yayinci / tur", run: async c2 => { c2.setResult("BILGI", ["Bu adimi ekleme sirasinda doldurabilirsin."]); } },
        { label: "Boyut / surum / aciklama", run: async c2 => { c2.setResult("BILGI", ["Bu adimi ekleme sirasinda doldurabilirsin."]); } },
        { label: "ONAYLA ve oyunu ekle", run: async c2 => {
            const g = await doAdd(cat, { title, platform: p, category: c2._add || category, link: c2._link || "", version: "1.0.0", featured: false });
            const res = await pushGit(cat, "Oyun eklendi: " + g.title + " [" + p.badge + "] (admin araci)", true);
            c2.setResult("EKLENDI: " + g.title, [...res, "", "Sayfa: " + gameUrl(g.id)]);
            c2.pop(); c2.pop();
          } }
      ]);
      ctx.clearResult();
      ctx.setResult("OYUN EKLENDI: " + title, ["Yukari sekmelerden platform ve kategori secildi.", "Simdi " + U.D("OYUN BILGILERI") + " sekmesinden baglanti ve kapak gir."]);
    });
    ctx.clearResult();
    ctx.setResult("OYUN EKLENDI: " + title, ["Simdi " + U.D("KATEGORI SEC") + " ekranindan kategori sec."]);
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
  if (o.platform.key === "torrent" && o.link) { const m = o.link.startsWith("magnet:"); g.torrent = { magnetUrl: m ? o.link : "", torrentUrl: m ? "" : o.link }; }
  else if (o.platform.key === "apk" && o.link) g.apk = { url: o.link };
  else if (o.link) g.latestFiles.push({ id, versionId: id, source: "external", kind: "file", fileName: o.fileName || o.title, fileSize: o.sizeBytes || 0, sha256: "", executablePath: "", downloadUrl: o.link });
  cat.games.push(g);
  return g;
}

/* ==================== ANA MENU ==================== */
function buildMenu(cat) {
  return {
    title: "ANA MENU",
    subtitle: cat.games.length + " OYUN  |  " + cat.upcomingGames.length + " YAKINDA  |  " + U.CFG.theme.toUpperCase() + " TEMA",
    items: [
      { label: U.c(U.T.ok, ">>") + "  Yeni oyun ekle", run: async ctx => { await addFlow(cat, ctx); } },
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
    const link = f.link || f.l || "";
    if (link && plat.key !== "torrent" && !isUrl(link)) { out(U.c(U.T.err, "Hata: gecersiz link (http/https olmali)")); return; }
    const g = await doAdd(cat, { title, platform: plat, category, link, version: f.version || "1.0.0", developer: f.dev || "", publisher: f.pub || "", genre: f.genre || "", description: f.desc || "", featured: f.featured === "1", sizeBytes: parseSize(f.size) });
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