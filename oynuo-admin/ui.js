/* ============================================================
   OYNUO ADMIN — menu motoru
   Her sey sekme sekme: menu > alt menu > alt alt menu
   Her ekranin altinda "Geriye don" secenegi
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");

const CFG_PATH = path.join(__dirname, "admin-config.json");
const W = 64;                       // icerik genisligi

/* ---------------- temalar ---------------- */
const THEMES = {
  hacker:  { name: "Hacker",    desc: "Klasik yesil matrix",        accent: 46, dim: 30,  text: 37,  ok: 46,  warn: 214, err: 203, box: 34  },
  matrix:  { name: "Matrix",    desc: "Koyu yesil",                 accent: 34, dim: 28,  text: 37,  ok: 40,  warn: 214, err: 196, box: 28  },
  amber:   { name: "Amber",     desc: "Turuncu CRT",               accent: 214, dim: 130, text: 37,  ok: 220, warn: 214, err: 203, box: 130 },
  ice:     { name: "Ice",       desc: "Buz mavisi",                accent: 51, dim: 27,  text: 252, ok: 51,  warn: 214, err: 203, box: 27  },
  cyber:   { name: "Cyberpunk", desc: "Macenta + buz",             accent: 201, dim: 61,  text: 252, ok: 51,  warn: 214, err: 203, box: 61  },
  mono:    { name: "Mono",      desc: "Sade beyaz",                accent: 15, dim: 240, text: 252, ok: 15,  warn: 214, err: 203, box: 240 }
};
const THEME_KEYS = Object.keys(THEMES);
const DEFAULTS = { theme: "hacker", banner: "OYNUO", owner: "admin", timestamp: true, effects: true };
let CFG = { ...DEFAULTS };
try { if (fs.existsSync(CFG_PATH)) CFG = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(CFG_PATH, "utf8")) }; } catch {}
if (!THEMES[CFG.theme]) CFG.theme = "hacker";
const saveConfig = () => { fs.writeFileSync(CFG_PATH, JSON.stringify(CFG, null, 2) + "\n", "utf8"); return CFG; };
let T = THEMES[CFG.theme];
const setTheme = k => { if (THEMES[k]) { T = THEMES[k]; CFG.theme = k; saveConfig(); } };
const refreshTheme = () => { T = THEMES[CFG.theme]; };

/* ---------------- renkler ---------------- */
const c  = (n, s) => `\x1b[38;5;${n}m${s}\x1b[0m`;
const bg = (n, s) => `\x1b[48;5;${n}m\x1b[38;5;16m\x1b[1m${s}\x1b[0m`;
const B  = s => `\x1b[1m${s}\x1b[0m`;
const D  = s => `\x1b[2m${s}\x1b[0m`;
const DM = s => `\x1b[2m${s}\x1b[0m`;
const A  = s => c(T.accent, s);
const TX = s => c(T.text, s);
const OK = s => c(T.ok, s);
const WN = s => c(T.warn, s);
const ER = s => c(T.err, s);
const BX = s => c(T.box, s);

/* ---------------- genislik ---------------- */
const stripAnsi = s => String(s).replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
const WIDE = /[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/;
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{20E3}]/u;
function width(s) { let n = 0; for (const ch of stripAnsi(s)) n += (WIDE.test(ch) || EMOJI.test(ch)) ? 2 : 1; return n; }
const pad = (s, n) => s + " ".repeat(Math.max(0, n - width(s)));
const trunc = (s, n) => { const t = stripAnsi(s); return width(t) <= n ? t : t.slice(0, Math.max(1, n - 1)) + "~"; };

/* ---------------- buyuk banner ---------------- */
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
function bigText(text) {
  const rows = ["", "", "", "", "", ""];
  for (const ch of String(text).toUpperCase()) {
    const g = F[ch] || F.O;
    for (let i = 0; i < 6; i++) rows[i] += g[i] + " ";
  }
  return rows.map(r => "  " + A(r.replace(/\s+$/, "")));
}
const banner = sub => ["", ...bigText(CFG.banner), "", "  " + DM("[" + pad(sub || "", W - 4) + "]")].join("\n");

/* ---------------- ekran ---------------- */
const write = s => process.stdout.write(s);
const clear = () => process.stdout.write("\x1b[2J\x1b[H");
const hideCursor = () => process.stdout.write("\x1b[?25l");
const showCursor = () => process.stdout.write("\x1b[?25h");
const sleep = ms => new Promise(r => setTimeout(r, ms));

function stamp() {
  if (!CFG.timestamp) return "";
  const d = new Date(), p = n => String(n).padStart(2, "0");
  return DM(p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear()) + " " + DM(p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds()));
}

/* Baslikli blok ciz */
function box(title, lines, color) {
  const cc = color || BX;
  const IW = W - 4;
  const out = ["  " + cc("+" + "-".repeat(IW) + "+")];
  if (title) out.push("  " + cc("+") + " " + B(pad(title, IW - 2)) + " " + cc("+"));
  if (title) out.push("  " + cc("+" + "=".repeat(IW) + "+"));
  for (const l of lines) {
    const t = String(l);
    out.push("  " + cc("|") + " " + pad(t, IW - 2) + " " + cc("|"));
  }
  out.push("  " + cc("+" + "-".repeat(IW) + "+"));
  return out;
}

/* ==================== MENU MOTORU ==================== */
/*
  Yapi:
    root: { title, items: [{ label, hint, run }] }
    ctx.push(title, items)  -> alt menu acilir (sekme sekme)
    ctx.pop()               -> bir ust menu
    ctx.result(title, lines)-> menu ALTINDA sonuc gosterir
    ctx.ask(q)              -> metin girdisi
    ctx.quit()              -> cikis
  Her menunun en altinda "--> Geriye don <--" var.
*/
function runMenu(rl, root, done) {
  const stack = [{ title: root.title, items: root.items, selected: 0, result: null }];
  const input = rl.input;
  let finished = false;

  const top = () => stack[stack.length - 1];

  function visible(m) {
    return m.items.concat([{ label: null, back: true }]);
  }

  function draw() {
    const m = top();
    const items = visible(m);
    if (m.selected >= items.length) m.selected = items.length - 1;
    const out = [];
    // banner
    out.push(banner(root.subtitle || "ADMIN KONSOL"));
    // breadcrumb
    if (stack.length > 1) {
      out.push("");
      const bc = stack.map(s => DM(s.title)).join(A(" > "));
      out.push("  " + bc);
    }
    out.push("");
    // menu kutusu
    const lines = [];
    items.forEach((it, i) => {
      const sel = i === m.selected;
      const mark = it.back ? "  -> " : (i + 1) + ". ";
      const body = it.back ? A("<-  Geriye don") : (it.label || "");
      const cell = pad(mark + body, W - 6);
      lines.push((sel ? bg(T.accent, cell) : cell));
    });
    const IW = W - 4;
    out.push("  " + BX("+" + "-".repeat(IW) + "+"));
    if (m.title) {
      out.push("  " + BX("+") + " " + B(pad(m.title, IW - 2)) + " " + BX("+"));
      out.push("  " + BX("+" + "=".repeat(IW) + "+"));
    }
    for (const l of lines) out.push("  " + BX("|") + " " + l + " " + BX("|"));
    out.push("  " + BX("+" + "-".repeat(IW) + "+"));
    // sonuc (menu altinda)
    if (m.result) {
      out.push("");
      out.push(box(m.result.title || "SONUC", m.result.lines || []).join("\n"));
    }
    // ipucu
    out.push("");
    out.push("  " + DM("[ ↑/↓ ] hareket   [ Enter ] sec   [ Esc ] geri   [ 1-9 ] dogrudan"));
    if (m.items[m.selected] && m.items[m.selected].hint && !m.items[m.selected].back) {
      out.push("  " + DM("  " + m.items[m.selected].hint));
    }
    out.push("  " + DM("  oynuo - " + CFG.theme + " tema  -  " + stamp()));
    write("\x1b[2J" + out.join("\n") + "\n");
  }

  // Metin girdisi: raw mode kapat, readline kullan, geri ac
  function ask(q) {
    return new Promise(res => {
      input.removeListener("keypress", onKey);
      if (input.setRawMode) { try { input.setRawMode(false); } catch {} }
      showCursor();
      write("\n  " + DM("  " + q + " ") + A(">") + " ");
      rl.question("", ans => { res(String(ans).trim()); });
    }).then(v => {
      if (input.setRawMode) { try { input.setRawMode(true); } catch {} }
      hideCursor();
      input.on("keypress", onKey);
      return v;
    });
  }

  const ctx = {
    get stackDepth() { return stack.length; },
    push(title, items, sub) {
      stack.push({ title, items: items || [], selected: 0, result: sub ? { title: "BILGI", lines: sub } : null });
    },
    pop() { if (stack.length > 1) { stack.pop(); } },
    setResult(title, lines) { top().result = { title, lines }; },
    clearResult() { top().result = null; },
    ask,
    quit() { finished = true; },
    setSubtitle(s) { root.subtitle = s; },
    reload() { const m = top(); if (m.itemsProvider) m.items = m.itemsProvider(); }
  };

  let busy = false;
  async function onKey(str, key) {
    if (finished || busy) return;
    const name = key && key.name ? key.name : "";
    const m = top();
    const items = visible(m);

    if (name === "up") { m.selected = (m.selected - 1 + items.length) % items.length; draw(); return; }
    if (name === "down") { m.selected = (m.selected + 1) % items.length; draw(); return; }
    if (name === "home") { m.selected = 0; draw(); return; }
    if (name === "end") { m.selected = items.length - 1; draw(); return; }

    if (name === "escape") { ctx.pop(); draw(); return; }

    if (name === "return" || name === "enter") {
      const it = items[m.selected];
      if (it && it.back) { ctx.pop(); draw(); return; }
      if (it && it.run) {
        busy = true;
        try { await it.run(ctx, it); }
        catch (e) { top().result = { title: "HATA", lines: [ER(String(e.message || e))] }; }
        busy = false;
        if (!finished) draw();
      }
      return;
    }

    if (/^[0-9]$/.test(str || "")) {
      const n = Number(str) - 1;
      if (n >= 0 && n < items.length) {
        m.selected = n;
        draw();
        const it = items[n];
        if (it && it.back) { ctx.pop(); draw(); return; }
        if (it && it.run) {
          busy = true;
          try { await it.run(ctx, it); }
          catch (e) { top().result = { title: "HATA", lines: [ER(String(e.message || e))] }; }
          busy = false;
          if (!finished) draw();
        }
      }
    }
  }

  // baslat
  require("readline").emitKeypressEvents(input);
  if (input.setRawMode) { try { input.setRawMode(true); } catch {} }
  hideCursor();
  input.on("keypress", onKey);
  draw();

  const finish = () => {
    finished = true;
    input.removeListener("keypress", onKey);
    if (input.setRawMode) { try { input.setRawMode(false); } catch {} }
    showCursor();
    if (typeof done === "function") done();
  };
  const origQuit = ctx.quit;
  ctx.quit = () => { finished = true; setImmediate(finish); };
  return { ctx, finish };
}

module.exports = {
  THEMES, THEME_KEYS, CFG, saveConfig, setTheme, refreshTheme, T, W,
  c, bg, B, D, DM, A, TX, OK, WN, ER, BX,
  bigText, banner, box, clear, write, hideCursor, showCursor, stamp, sleep,
  stripAnsi, width, pad, trunc,
  runMenu,
  themePreview: k => {
    const t = THEMES[k];
    const sw = c(t.accent, "###") + c(t.ok, "###") + c(t.warn, "###") + c(t.err, "###") + c(t.dim, "###");
    return (k === CFG.theme ? "[*] " : "[ ] ") + k.padEnd(9) + DM(t.name.padEnd(10)) + sw + "  " + DM(t.desc);
  },
  CFG_PATH
};