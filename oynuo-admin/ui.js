/* ============================================================
   OYNUO ADMIN — arayuz katmani
   Tema, banner, animasyon, tus-tabanli secim
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");

const CFG_PATH = path.join(__dirname, "admin-config.json");

/* ---------- temalar (ANSI 256 renk) ---------- */
const THEMES = {
  hacker:  { name: "Hacker",  desc: "Klasik yesil, matrix hissi",        accent: 46, dim: 30,  text: 37,  ok: 46,  warn: 214, err: 203, bar: 46,  box: 34 },
  matrix:  { name: "Matrix",  desc: "Koyu yesil, derin terminal",       accent: 34, dim: 28,  text: 37,  ok: 40,  warn: 214, err: 196, bar: 34,  box: 28 },
  amber:   { name: "Amber",   desc: "Turuncu, eski CRT terminali",      accent: 214, dim: 130, text: 37,  ok: 220, warn: 214, err: 203, bar: 214, box: 130 },
  ice:     { name: "Ice",     desc: "Buz mavisi, sade ve temiz",        accent: 51, dim: 27,  text: 252, ok: 51,  warn: 214, err: 203, bar: 51,  box: 27 },
  cyber:   { name: "Cyberpunk", desc: "Macenta + buz mavisi",            accent: 201, dim: 61,  text: 252, ok: 51,  warn: 214, err: 203, bar: 201, box: 61 },
  mono:    { name: "Mono",    desc: "Sade beyaz / gri, yazisma uygun",   accent: 15, dim: 240, text: 252, ok: 15,  warn: 214, err: 203, bar: 240, box: 240 }
};
const THEME_KEYS = Object.keys(THEMES);

const DEFAULTS = {
  theme: "hacker",
  banner: "OYNUO",
  owner: "admin",
  timestamp: true,
  effects: true,
  sound: false
};

/* ---------- ayarlar ---------- */
let CFG = { ...DEFAULTS };
function loadConfig() {
  try { if (fs.existsSync(CFG_PATH)) CFG = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(CFG_PATH, "utf8")) }; } catch {}
  if (!THEMES[CFG.theme]) CFG.theme = "hacker";
  return CFG;
}
function saveConfig() {
  fs.writeFileSync(CFG_PATH, JSON.stringify(CFG, null, 2) + "\n", "utf8");
  return CFG;
}
loadConfig();

/* ---------- renkler ---------- */
let T = THEMES[CFG.theme];
function setTheme(k) { if (THEMES[k]) { T = THEMES[k]; CFG.theme = k; saveConfig(); } }
function refreshTheme() { T = THEMES[CFG.theme]; }

/* ---------- genislik hesabi (banner/pad icin, once tanimlanmali) ---------- */
const stripAnsi = s => String(s).replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
const WIDE_RE = /[\u1100-\u115F\u2E80-\uA4CF\uA960-\uA97F\uAC00-\uD7A3\uF900-\uFAFF\uFE10-\uFE19\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]|[\u{10000}-\u{10FFFF}]/u;
function width(s) {
  let n = 0;
  for (const ch of stripAnsi(s)) n += WIDE_RE.test(ch) ? 2 : 1;
  return n;
}
const pad = (s, n) => s + " ".repeat(Math.max(0, n - width(s)));

const c   = (n, s) => `\x1b[38;5;${n}m${s}\x1b[0m`;
const bg  = (n, s) => `\x1b[48;5;${n}m\x1b[38;5;15m${s}\x1b[0m`;
const B   = s => `\x1b[1m${s}\x1b[0m`;
const D   = s => `\x1b[2m${s}\x1b[0m`;
const A   = s => c(T.accent, s);          // accent
const DM  = s => c(T.dim, s);            // dim
const TX  = s => c(T.text, s);           // text
const OK  = s => c(T.ok, s);
const WN  = s => c(T.warn, s);
const ER  = s => c(T.err, s);
const BR  = s => c(T.bar, s);

/* ---------- buyuk ASCII banner ---------- */
const FONT = {
  O: [" ██████╗ ", "██╔═══██╗", "██║   ██║", "██║   ██║", "╚██████╔╝", " ╚═════╝ "],
  Y: ["██╗   ██╗", "╚██╗ ██╔╝", " ╚████╔╝ ", "  ╚██╔╝  ", "   ██║   ", "   ╚═╝   "],
  N: ["███╗   ██╗", "████╗  ██║", "██╔██╗ ██║", "██║╚██╗██║", "██║ ╚████║", "╚═╝  ╚═══╝"],
  U: ["██╗   ██╗", "██║   ██║", "██║   ██║", "██║   ██║", "╚██████╔╝", " ╚═════╝ "],
  O2:[" ██████╗ ", "██╔═══██╗", "██║   ██║", "██║   ██║", "╚██████╔╝", " ╚═════╝ "],
  A: [" █████╗  ", "██╔══██╗ ", "███████║ ", "██╔══██║ ", "██║  ██║ ", "╚═╝  ╚═╝ "],
  D: ["██████╗  ", "██╔══██╗ ", "██║  ██║ ", "██║  ██║ ", "██████╔╝ ", "╚═════╝ "],
  M: ["███╗   ███╗", "████╗ ████║", "██╔████╔██║", "██║╚██╔╝██║", "██║ ╚═╝ ██║", "╚═╝     ╚═╝"],
  I: ["██╗", "██║", "██║", "██║", "██║", "╚═╝"],
  N2:["███╗   ██╗", "████╗  ██║", "██╔██╗ ██║", "██║╚██╗██║", "██║ ╚████║", "╚═╝  ╚═══╝"],
  S: [" ███████╗", "██╔════██║", "╚██████╔╝", " ╚════██║", "███████╔╝", "╚══════╝ "],
  _0:[" █████╗  ", "██╔═══██╗", "██║   ██║", "██║   ██║", "╚██████╔╝", " ╚═════╝ "]
};
const WIDE = new Set(["O","Y","N","U","A","D","M","S","0"]);

function bigText(text, colorFn) {
  const fn = colorFn || A;
  const rows = ["", "", "", "", "", ""];
  for (const ch of String(text).toUpperCase()) {
    const g = FONT[ch] || (WIDE.has(ch) ? FONT.O2 : FONT.I);
    for (let i = 0; i < 6; i++) rows[i] += g[i] + " ";
  }
  return rows.map(r => fn(r.replace(/\s+$/, "")));
}

const W = 62;
const clear = () => process.stdout.write("\x1b[2J\x1b[H");
const SUBTITLE = "A D M I N   C O N S O L E";
function banner(sub) {
  const t = sub || SUBTITLE;
  const inner = W - 4;
  const out = ["", ...bigText(CFG.banner), ""];
  out.push("  " + DM("┌" + "─".repeat(inner) + "┐"));
  out.push("  " + DM("│") + " " + A(pad(t, inner - 2)) + " " + DM("│"));
  out.push("  " + DM("└" + "─".repeat(inner) + "┘"));
  return out.join("\n");
}

/* ---------- ekran ---------- */
const line = (ch = "─") => "  " + DM(ch.repeat(W - 4));
const goTop = () => process.stdout.write("\x1b[1;1H");
const hideCursor = () => process.stdout.write("\x1b[?25l");
const showCursor = () => process.stdout.write("\x1b[?25h");

function stamp() {
  if (!CFG.timestamp) return "";
  const d = new Date();
  const p = n => String(n).padStart(2, "0");
  return DM(p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear() + " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds()));
}
const tag = () => "  " + A("[oynuo]") + (CFG.timestamp ? " " + stamp() : "") + "  ";
const ok   = m => console.log(tag() + OK("[+] ") + TX(m));
const warn = m => console.log(tag() + WN("[!] ") + TX(m));
const err  = m => console.log(tag() + ER("[-] ") + TX(m));
const info = m => console.log(tag() + A("[*] ") + TX(m));
const step = m => console.log(tag() + DM("[~] ") + DM(m));
const askQ = m => console.log(tag() + A("[?] ") + B(TX(m)));
function head(m) {
  const inner = W - 4;
  console.log("");
  console.log("  " + A("╔" + "═".repeat(inner) + "╗"));
  console.log("  " + A("║") + " " + B(TX(pad(m, inner - 2))) + " " + A("║"));
  console.log("  " + A("╚" + "═".repeat(inner) + "╝"));
}

/* ---------- acilis (boot) ---------- */
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function boot() {
  clear();
  if (!CFG.effects) { console.log(banner()); return; }
  const steps = [
    "Oynuo Admin Konsolu baslatiliyor...",
    "Katalog dosyasi okunuyor...",
    "GitHub baglantisi hazir...",
    "Arayuz yukleniyor..."
  ];
  for (const s of steps) {
    step(s);
    process.stdout.write("\r");
    await sleep(110);
  }
  clear();
  console.log(banner());
}

/* ---------- tus-tabanli secim ---------- */
function selectList(rl, items, opts = {}) {
  const o = { render: x => String(x), hint: "↑/↓ hareket  •  Enter seç  •  Esc iptal  •  rakam: direkt", page: 10, ...opts };
  if (!items.length) return Promise.resolve(null);
  const IW = W - 6;                       // ic bosluk
  return new Promise(resolve => {
    let i = 0, top = 0;
    const page = o.page || 10;
    const input = rl.input;
    const wasRaw = input.isRaw;

    const draw = () => {
      goTop();
      process.stdout.write("\x1b[0J");
      console.log("  " + A("┌" + "─".repeat(IW + 2) + "┐"));
      for (let k = 0; k < page; k++) {
        const idx = top + k;
        const inner = " ".repeat(IW);
        if (idx >= items.length) { console.log("  " + A("│") + inner + A("│")); continue; }
        const sel = idx === i;
        const num = (top + k + 1) + ".";
        const body = o.render(items[idx], idx, sel);
        const plain = num + " " + stripAnsi(body);
        const text = pad(plain, IW);
        const cell = num + " " + body;
        const shown = sel ? bg(T.accent, pad(cell, IW)) : pad(cell, IW);
        console.log("  " + A("│") + " " + shown + " " + A("│"));
      }
      console.log("  " + A("└" + "─".repeat(IW + 2) + "┘"));
      const more = top > 0 || i + page < items.length;
      console.log("  " + DM(o.hint) + (more ? DM("   (" + (top + 1) + "-" + Math.min(items.length, top + page) + " / " + items.length + ")") : ""));
    };

    const cleanup = () => {
      input.removeListener("keypress", onKey);
      if (!wasRaw && input.setRawMode) input.setRawMode(false);
      showCursor();
      console.log("");
    };

    const onKey = (str, key) => {
      if (!key) return;
      if (key.name === "up") { i = Math.max(0, i - 1); if (i < top) top = i; draw(); }
      else if (key.name === "down") { i = Math.min(items.length - 1, i + 1); if (i >= top + page) top = i - page + 1; draw(); }
      else if (key.name === "pageup") { i = Math.max(0, i - page); top = Math.max(0, top - page); draw(); }
      else if (key.name === "pagedown") { i = Math.min(items.length - 1, i + page); top = Math.min(Math.max(0, items.length - page), top + page); draw(); }
      else if (key.name === "home") { i = 0; top = 0; draw(); }
      else if (key.name === "end") { i = items.length - 1; top = Math.max(0, items.length - page); draw(); }
      else if (key.name === "return" || key.name === "enter") { cleanup(); resolve(items[i]); }
      else if (key.name === "escape" || key.name === "q") { cleanup(); resolve(null); }
      else if (/^[0-9]$/.test(str)) {
        const n = top + Number(str) - 1;
        if (n < items.length) { cleanup(); resolve(items[n]); }
      }
    };

    if (input.setRawMode) input.setRawMode(true);
    hideCursor();
    require("readline").emitKeypressEvents(input);
    input.on("keypress", onKey);
    draw();
  });
}

/* ---------- dogrulama ---------- */
const yes = s => /^e(vet)?$/i.test(String(s).trim());
const no  = s => /^h(ayır)?$/i.test(String(s).trim()) || String(s).trim() === "";

/* ---------- ayar menusu icin tema onizleme ---------- */
function themePreview(k) {
  const t = THEMES[k];
  const swatch = c(t.accent, "████") + c(t.ok, "██") + c(t.warn, "██") + c(t.err, "██") + c(t.dim, "██");
  return (k === CFG.theme ? "[*] " : "[ ] ") + k.padEnd(10) + D(t.name.padEnd(11)) + swatch + "  " + D(t.desc);
}

module.exports = {
  THEMES, THEME_KEYS, CFG, saveConfig, setTheme, refreshTheme, T,
  c, bg, B, D, A, DM, TX, OK, WN, ER, BR,
  banner, bigText, clear, line, head, ok, warn, err, info, step, askQ, stamp,
  boot, selectList, stripAnsi, width, pad, yes, no, themePreview, sleep,
  CFG_PATH
};
