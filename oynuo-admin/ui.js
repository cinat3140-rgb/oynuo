/* ============================================================
   OYNUO ADMIN — arayuz katmani
   Her ekran banner ile baslar. Windows CMD uyumlu.
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");

const CFG_PATH = path.join(__dirname, "admin-config.json");
const W = 60;                       // icerik genisligi

/* ---------- temalar ---------- */
const THEMES = {
  hacker:  { name: "Hacker",   desc: "Klasik yesil, matrix hissi",      accent: 46, dim: 30,  text: 37,  ok: 46,  warn: 214, err: 203, box: 34  },
  matrix:  { name: "Matrix",   desc: "Koyu yesil, derin terminal",     accent: 34, dim: 28,  text: 37,  ok: 40,  warn: 214, err: 196, box: 28  },
  amber:   { name: "Amber",    desc: "Turuncu, eski CRT terminali",    accent: 214, dim: 130, text: 37,  ok: 220, warn: 214, err: 203, box: 130 },
  ice:     { name: "Ice",      desc: "Buz mavisi, sade ve temiz",      accent: 51, dim: 27,  text: 252, ok: 51,  warn: 214, err: 203, box: 27  },
  cyber:   { name: "Cyberpunk", desc: "Macenta ve buz mavisi",         accent: 201, dim: 61,  text: 252, ok: 51,  warn: 214, err: 203, box: 61  },
  mono:    { name: "Mono",     desc: "Sade beyaz / gri, yazisma uygun", accent: 15, dim: 240, text: 252, ok: 15,  warn: 214, err: 203, box: 240 }
};
const THEME_KEYS = Object.keys(THEMES);

const DEFAULTS = { theme: "hacker", banner: "OYNUO", owner: "admin", timestamp: true, effects: true };

let CFG = { ...DEFAULTS };
try { if (fs.existsSync(CFG_PATH)) CFG = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(CFG_PATH, "utf8")) }; } catch {}
if (!THEMES[CFG.theme]) CFG.theme = "hacker";
function saveConfig() { fs.writeFileSync(CFG_PATH, JSON.stringify(CFG, null, 2) + "\n", "utf8"); return CFG; }

let T = THEMES[CFG.theme];
function setTheme(k) { if (THEMES[k]) { T = THEMES[k]; CFG.theme = k; saveConfig(); } }
const refreshTheme = () => { T = THEMES[CFG.theme]; };

/* ---------- renkler ---------- */
const c   = (n, s) => `\x1b[38;5;${n}m${s}\x1b[0m`;
const bg  = (n, s) => `\x1b[48;5;${n}m\x1b[38;5;16m\x1b[1m${s}\x1b[0m`;
const B   = s => `\x1b[1m${s}\x1b[0m`;
const D   = s => `\x1b[2m${s}\x1b[0m`;
const DM  = s => `\x1b[2m${s}\x1b[0m`;
const A   = s => c(T.accent, s);
const TX  = s => c(T.text, s);
const OK  = s => c(T.ok, s);
const WN  = s => c(T.warn, s);
const ER  = s => c(T.err, s);
const BX  = s => c(T.box, s);

/* ---------- genislik ---------- */
const stripAnsi = s => String(s).replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
const WIDE = /[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/;
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{20E3}\u{1F1E6}-\u{1F1FF}]/u;
function width(s) {
  let n = 0;
  for (const ch of stripAnsi(s)) n += (WIDE.test(ch) || EMOJI.test(ch)) ? 2 : 1;
  return n;
}
const pad = (s, n) => s + " ".repeat(Math.max(0, n - width(s)));
const trunc = (s, n) => (width(s) <= n ? s : stripAnsi(s).slice(0, n - 1) + "~");

/* ---------- buyuk ASCII banner ---------- */
const F = {
  O: ["  ██████╗ ", " ██╔═══██╗", " ██║   ██║", " ██║   ██║", " ╚██████╔╝", "  ╚═════╝ "],
  Y: ["██╗   ██╗", "╚██╗ ██╔╝", " ╚████╔╝ ", "  ╚██╔╝  ", "   ██║   ", "   ╚═╝   "],
  N: ["███╗   ██╗", "████╗  ██║", "██╔██╗ ██║", "██║╚██╗██║", "██║ ╚████║", "╚═╝  ╚═══╝"],
  U: ["██╗   ██╗", "██║   ██║", "██║   ██║", "██║   ██║", "╚██████╔╝", " ╚═════╝ "],
  A: [" █████╗  ", "██╔══██╗ ", "███████║ ", "██╔══██║ ", "██║  ██║ ", "╚═╝  ╚═╝ "],
  D: ["██████╗  ", "██╔══██╗ ", "██║  ██║ ", "██║  ██║ ", "██████╔╝ ", "╚═════╝ "],
  M: ["███╗   ███╗", "████╗ ████║", "██╔████╔██║", "██║╚██╔╝██║", "██║ ╚═╝ ██║", "╚═╝     ╚═╝"],
  I: [" ██╗", " ██║", " ██║", " ██║", " ██║", " ╚═╝"],
  S: [" ███████╗", "██╔════██║", "╚██████╔╝", " ╚════██║", "███████╔╝", "╚══════╝ "],
  Z: ["███████╗", "╚══███╔╝", "  ██╔╝ ", " ██╔╝  ", "███████╗", "╚══════╝"],
  E: ["███████╗", "██╔════╝", "█████╗  ", "██╔══╝  ", "███████╗", "╚══════╝"],
  V: ["██╗   ██╗", "██║   ██║", "██║   ██║", "╚██╗ ██╔╝", " ╚████╔╝ ", "  ╚═══╝  "],
  R: ["██████╗ ", "██╔══██╗", "██████╔╝", "██╔══██╗", "██║  ██║", "╚═╝  ╚═╝"],
  T: ["█████████", "  ██╗   ", "  ██║   ", "  ██║   ", "  ██║   ", "  ╚═╝   "],
  P: ["██████╗ ", "██╔══██╗", "██████╔╝", "██╔══██╗", "██║  ██║", "╚═╝  ╚═╝"],
  B: ["██████╗ ", "██╔══██╗", "██████╔╝", "██╔══██╗", "██║  ██║", "╚═╝  ╚═╝"],
  L: ["██╗     ", "██║     ", "██║     ", "██║     ", "███████╗", "╚══════╝"],
  K: ["██╗  ██╗", "██║ ██╔╝", "█████╔╝ ", "██╔═██╗ ", "██║  ██╗", "╚═╝  ╚═╝"],
  G: [" ██████╗ ", "██╔════╝ ", "█████╗  ", "██╔══╝  ", "███████╗", "╚══════╝"],
  H: ["██╗  ██╗", "██║  ██║", "███████║", "██╔══██║", "██║  ██║", "╚═╝  ╚═╝"]
};
const KNOWN = new Set(Object.keys(F));
function bigText(text, colorFn) {
  const fn = colorFn || A;
  const rows = ["", "", "", "", "", ""];
  for (const ch of String(text).toUpperCase()) {
    const g = F[ch] || F.O;
    for (let i = 0; i < 6; i++) rows[i] += g[i] + " ";
  }
  return rows.map(r => "  " + fn(r.replace(/\s+$/, "")));
}

function banner(sub) {
  const out = ["", ...bigText(CFG.banner)];
  if (sub) {
    out.push("");
    out.push("  " + DM("+" + "-".repeat(W - 4) + "+"));
    out.push("  " + DM("|") + A(pad(" " + sub, W - 4)) + DM("|"));
    out.push("  " + DM("+" + "-".repeat(W - 4) + "+"));
  }
  return out.join("\n");
}

/* ---------- ekran ---------- */
const clear = () => process.stdout.write("\x1b[2J\x1b[H");
const line = (ch = "-") => "  " + DM(ch.repeat(W - 4));
const goTop = () => process.stdout.write("\x1b[H");
const hideCursor = () => process.stdout.write("\x1b[?25l");
const showCursor = () => process.stdout.write("\x1b[?25h");
const write = s => process.stdout.write(s);

/* Ekran ac: temizle + banner + baslik. HER ekranda cagrilir. */
function screen(sub, title) {
  const buf = [clear ? "" : ""];
  clear();
  buf.push(banner(sub));
  if (title) {
    buf.push("");
    buf.push("  " + BX("+" + "=".repeat(W - 4) + "+"));
    buf.push("  " + BX("|") + " " + B(pad(title, W - 6)) + " " + BX("|"));
    buf.push("  " + BX("+" + "=".repeat(W - 4) + "+"));
  }
  buf.push("");
  write(buf.filter(Boolean).join("\n") + "\n");
}

function stamp() {
  if (!CFG.timestamp) return "";
  const d = new Date(), p = n => String(n).padStart(2, "0");
  return DM(p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear()) + DM(" ") + DM(p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds()));
}
const tag = () => (CFG.timestamp ? A("[oynuo]") + " " + stamp() + "  " : A("[oynuo]") + "  ");
const ok   = m => write(tag() + OK("[+]") + " " + TX(m) + "\n");
const warn = m => write(tag() + WN("[!]") + " " + TX(m) + "\n");
const err  = m => write(tag() + ER("[-]") + " " + TX(m) + "\n");
const info = m => write(tag() + A("[*]") + " " + TX(m) + "\n");
const step = m => write(tag() + DM("[~]") + " " + DM(m) + "\n");
const askQ = m => write(tag() + A("[?]") + " " + B(TX(m)) + "\n");
function head(m) {
  write("\n" + "  " + BX("+" + "-".repeat(W - 4) + "+") + "\n");
  write("  " + BX("|") + " " + B(pad(m, W - 6)) + " " + BX("|") + "\n");
  write("  " + BX("+" + "-".repeat(W - 4) + "+") + "\n");
}

/* ---------- acilis ---------- */
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function boot() {
  if (!CFG.effects) { screen(); return; }
  const steps = [
    "Oynuo Admin Konsolu baslatiliyor",
    "Katalog dosyasi okunuyor",
    "GitHub baglantisi hazir",
    "Arayuz yukleniyor"
  ];
  for (const s of steps) { step(s); await sleep(120); }
  await sleep(200);
  clear();
}

/* ---------- tus secimi ---------- */
function selectList(rl, items, opts = {}) {
  const o = { render: x => String(x), hint: "↑/↓ hareket  •  Enter sec  •  Esc iptal  •  rakam: dogrudan", page: 10, ...opts };
  if (!items.length) return Promise.resolve(null);
  const IW = W - 6;
  return new Promise(resolve => {
    let i = 0, top = 0;
    const page = o.page || 10;
    const input = rl.input;

    const rows = () => {
      const out = [];
      // Baslik (verilirse) listenin uzerinde cizilir
      if (o.title) {
        out.push("");
        out.push("  " + BX("+" + "=".repeat(IW + 2) + "+"));
        out.push("  " + BX("|") + " " + B(pad(o.title, IW)) + " " + BX("|"));
        out.push("  " + BX("+" + "=".repeat(IW + 2) + "+"));
        out.push("");
      }      out.push("  " + BX("+" + "-".repeat(IW + 2) + "+"));
      // Gosterilecek satir sayisi = min(page, items) -> gereksiz bosluk yok
      for (let k = 0; k < Math.min(page, Math.max(items.length - top, 1)); k++) {
        const idx = top + k;
        if (idx >= items.length) break;
        const sel = idx === i;
        const num = String(top + k + 1) + ".";
        const body = o.render(items[idx], idx, sel);
        const cell = pad(num + " " + body, IW);
        out.push("  " + BX("|") + " " + (sel ? bg(T.accent, cell) : cell) + " " + BX("|"));
      }
      out.push("  " + BX("+" + "-".repeat(IW + 2) + "+"));
      const more = top > 0 || i + page < items.length;
      out.push("  " + DM(o.hint) + (more ? DM("   (" + (top + 1) + "-" + Math.min(items.length, top + page) + "/" + items.length + ")") : ""));
      return out;
    };

    // Ilk cizimde ekrani temizle ve tum listeyi (banner + baslik) yaz.
    // Sonraki cizimlerde yazdigimiz satir sayisi kadar yukarI cikip üzerine yaz.
    let first = true;
    const draw = () => {
      const r = rows();
      if (first) { first = false; write("\x1b[2J" + r.join("\n") + "\n" + "\x1b[0J"); return; }
      write("\x1b[" + r.length + "A" + r.join("\n") + "\n" + "\x1b[0J");
    };

    let doneCalled = false;
    let onData = null;
    const done = v => {
      if (doneCalled) return;
      doneCalled = true;
      input.removeListener("keypress", onKey);
      if (onData) input.removeListener("data", onData);
      if (input.setRawMode) { try { input.setRawMode(false); } catch {} }
      showCursor();
      write("\n");
      resolve(v);
    };

    const onKey = (str, key) => {
      if (!key && !str) return;
      const name = key && key.name ? key.name : "";
      switch (name) {
        case "up":     i = Math.max(0, i - 1); if (i < top) top = i; draw(); break;
        case "down":   i = Math.min(items.length - 1, i + 1); if (i >= top + page) top = i - page + 1; draw(); break;
        case "pageup": i = Math.max(0, i - page); top = Math.max(0, top - page); draw(); break;
        case "pagedown": i = Math.min(items.length - 1, i + page); top = Math.min(Math.max(0, items.length - page), top + page); draw(); break;
        case "home":   i = 0; top = 0; draw(); break;
        case "end":    i = items.length - 1; top = Math.max(0, items.length - page); draw(); break;
        case "return": case "enter": done(items[i]); break;
        case "escape": done(null); break;
        default:
          if (str === "q" || str === "Q") { done(null); break; }
          if (/^[0-9]$/.test(str || "")) { const n = top + Number(str) - 1; if (n >= 0 && n < items.length) done(items[n]); }
      }
    };

    // TTY/pipe fark etmez: process.stdin uzerinden keypress yayinla
    const readline = require("readline");
    if (input.setRawMode) { try { input.setRawMode(true); } catch {} }
    hideCursor();
    readline.emitKeypressEvents(input);
    input.on("keypress", onKey);
    draw();
  });
}

/* ---------- dogrulama ---------- */
const yes = s => /^e(vet)?$/i.test(String(s).trim());
const themePreview = k => {
  const t = THEMES[k];
  const sw = c(t.accent, "###") + c(t.ok, "###") + c(t.warn, "###") + c(t.err, "###") + c(t.dim, "###");
  return (k === CFG.theme ? "[*] " : "[ ] ") + k.padEnd(9) + DM(t.name.padEnd(10)) + sw + "  " + DM(t.desc);
};

module.exports = {
  THEMES, THEME_KEYS, CFG, saveConfig, setTheme, refreshTheme, T, W,
  c, bg, B, D, A, DM, TX, OK, WN, ER, BX,
  bigText, banner, screen, clear, line, head, goTop, hideCursor, showCursor, write,
  ok, warn, err, info, step, askQ, stamp, boot, selectList,
  stripAnsi, width, pad, trunc, yes, no: s => !yes(s), themePreview, sleep, CFG_PATH
};
