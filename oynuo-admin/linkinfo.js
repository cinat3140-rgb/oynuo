/* ============================================================
   LİNK ANALİZİ
   Admin'de link girildiğinde: sağlayıcıyı tanır, gerçek dosya
   adını/boyutunu okumaya çalışır. PC uygulamasındaki
   resolve.rs ile aynı mantık (MediaFire sayfa taraması).
   ============================================================ */
"use strict";
const { execSync } = require("child_process");

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function curlText(url) {
  try {
    return execSync(
      `curl.exe -sSL --connect-timeout 25 -A "${UA}" "${url}"`,
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 45000, windowsHide: true }
    );
  } catch {
    return "";
  }
}

function curlHeaders(url) {
  try {
    return execSync(
      `curl.exe -sSIL -L --connect-timeout 25 -A "${UA}" "${url}"`,
      { encoding: "utf8", maxBuffer: 4 * 1024 * 1024, timeout: 45000, windowsHide: true }
    ).toLowerCase();
  } catch {
    return "";
  }
}

function unescapeHtml(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** "2.29 GB" gibi metni bayta çevirir */
function humanToBytes(text) {
  const t = String(text || "").toLowerCase();
  const units = [
    ["tb", 1099511627776],
    ["gb", 1073741824],
    ["mb", 1048576],
    ["kb", 1024],
  ];
  for (const [unit, mult] of units) {
    const pos = t.indexOf(unit);
    if (pos < 0) continue;
    const head = t.slice(0, pos).trimEnd();
    const m = head.match(/([\d.,]+)\s*$/);
    if (!m) continue;
    const v = parseFloat(m[1].replace(",", "."));
    if (isFinite(v) && v > 0) return Math.round(v * mult);
  }
  return 0;
}

function formatBytes(n) {
  if (!n || n <= 0) return "?";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0, v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return v.toFixed(v >= 100 || i === 0 ? 0 : 2) + " " + u[i];
}

/** Sağlayıcıyı linkten tanır */
function detectProvider(url) {
  const u = String(url || "").toLowerCase();
  if (u.startsWith("magnet:")) return { key: "magnet", name: "Magnet", mode: "torrent" };
  if (u.includes("mediafire.com")) return { key: "mediafire", name: "MediaFire", mode: "cozulebilir" };
  if (u.includes("gofile.io")) return { key: "gofile", name: "Gofile", mode: "tarayici" };
  if (u.includes("pixeldrain.com")) return { key: "pixeldrain", name: "PixelDrain", mode: "cozulebilir" };
  if (u.includes("1fichier.com")) return { key: "1fichier", name: "1fichier", mode: "tarayici" };
  if (u.includes("mixdrop.co") || u.includes("mixdrop.me")) return { key: "mixdrop", name: "MixDrop", mode: "tarayici" };
  if (u.includes("mega.nz") || u.includes("mega.co.nz")) return { key: "mega", name: "MEGA", mode: "tarayici" };
  if (u.includes("dropbox.com")) return { key: "dropbox", name: "Dropbox", mode: "dogrudan" };
  if (u.includes("drive.google.com")) return { key: "gdrive", name: "Google Drive", mode: "tarayici" };
  if (u.includes("github.com") || u.includes("githubusercontent.com")) return { key: "github", name: "GitHub", mode: "dogrudan" };
  if (/\.(torrent)$/i.test(u)) return { key: "torrentfile", name: "Torrent dosyasi", mode: "torrent" };
  if (/\.(zip|rar|7z|exe|msi|iso|apk)$/i.test(u)) return { key: "dosya", name: "Dogrudan dosya", mode: "dogrudan" };
  return { key: "bilinmiyor", name: "Bilinmeyen site", mode: "dogrudan" };
}

/** Sayfadan gerçek CDN indirme linkini çıkarır (MediaFire) */
function mfDownloadHref(html) {
  const tag = html.match(/<a[^>]*id="downloadButton"[^>]*>/i);
  if (tag) {
    const href = tag[0].match(/href="([^"]+)"/i);
    if (href) return unescapeHtml(href[1]);
  }
  // CDN deseni: https://download123.mediafire.com/...
  const cdn = html.match(/https:\/\/download\d*\.mediafire\.com\/[^'"\s<>\\]+/i);
  return cdn ? unescapeHtml(cdn[0]) : null;
}

/**
 * Linki analiz eder.
 * Dönüş: { provider, mode, realUrl, fileName, sizeBytes, note }
 */
function analyzeLink(url) {
  const provider = detectProvider(url);
  const out = {
    provider: provider.name,
    providerKey: provider.key,
    mode: provider.mode,
    realUrl: url,
    fileName: "",
    sizeBytes: 0,
    note: "",
  };

  if (provider.mode === "torrent") {
    out.fileName = "magnet / torrent";
    out.note = "Torrent istemcisi acilacak.";
    return out;
  }

  if (provider.mode === "tarayici") {
    out.fileName = "(tarayicida belirlenir)";
    out.note = "Bu site JavaScript ile calisiyor - uygulama indirme sayfasini tarayicida acar, ordan indir butonuna basarsin.";
    return out;
  }

  // cozulebilir / dogrudan: sayfayi veya header'i oku
  if (provider.key === "mediafire") {
    const html = curlText(url);
    const real = mfDownloadHref(html);
    if (real) {
      out.realUrl = real;
      const title = (html.match(/<title>([^<]+)<\/title>/i) || [])[1];
      if (title) {
        out.fileName = unescapeHtml(title).split(" - MediaFire")[0].trim();
      }
      const size = (html.match(/\(([\d.,]+\s*[KMGT]B)\)/i) || [])[1];
      out.sizeBytes = humanToBytes(size);
      out.note = "Uygulama baglantiyi cozup cok parcali indirir, arsivi acar, oyunu calistirir.";
    } else {
      out.note = "MediaFire sayfasi okunamadi. Link yine de kaydedilebilir.";
    }
  }

  if (!out.fileName) {
    try {
      out.fileName = decodeURIComponent(String(url).split("?")[0].split("/").pop() || "");
    } catch { out.fileName = ""; }
  }

  if (!out.sizeBytes) {
    const h = curlHeaders(out.realUrl);
    const cr = h.match(/content-length:\s*(\d+)/i);
    if (cr) out.sizeBytes = parseInt(cr[1], 10);
  }
  if (!out.sizeBytes) {
    const res = humanToBytes(humanToBytesTest(out.realUrl));
    if (res) out.sizeBytes = res;
  }

  if (out.mode === "dogrudan" && !out.note) {
    out.note = out.realUrl === url
      ? "Dogrudan baglanti - uygulama cok parcali indirir."
      : "Baglanti cozuldu - uygulama cok parcali indirir.";
  }

  return out;
}

/** HEAD yerine GET+Range ile boyut dener (MediaFire HEAD'i sevmez) */
function humanToBytesTest(url) {
  try {
    const out = execSync(
      `curl.exe -sSL --connect-timeout 20 -A "${UA}" -r 0-0 -D - -o NUL "${url}"`,
      { encoding: "utf8", maxBuffer: 1024 * 1024, timeout: 40000, windowsHide: true }
    ).toLowerCase();
    const cr = out.match(/content-range:\s*bytes\s+\d+-\d+\/(\d+)/i);
    if (cr) return String(parseInt(cr[1], 10));
    const cl = out.match(/content-length:\s*(\d+)/i);
    if (cl) return String(parseInt(cl[1], 10));
  } catch { /* yoksay */ }
  return "";
}

module.exports = {
  detectProvider,
  analyzeLink,
  formatBytes,
  humanToBytes,
  UA,
};