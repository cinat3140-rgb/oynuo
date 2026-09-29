/* OYNUO Admin - imza (kod signing) yardimcisi
 * Sertifika (.pfx) mevcutsa dosyalari imzalar, yoksa uyarir.
 * Kullanim:
 *   node sign.js            -> imzali mi kontrol et
 *   node sign.js <pfx> <sifre>  -> bu sertifika ile imzala
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const B = path.join("C:/Users/PC/OneDrive/Belgeler/Default Project/GameLauncher/launcher/src-tauri/target/release");
const TARGETS = [
  path.join(B, "bundle/nsis/Oynuo PC_1.4.5_x64-setup.exe"),
  path.join(B, "bundle/msi/Oynuo PC_1.4.5_x64_en-US.msi"),
  path.join(B, "Oynuo.exe"),
];
const CLS = { r: "\x1b[0m", g: "\x1b[32m", y: "\x1b[33m", c: "\x1b[36m", d: "\x1b[2m" };

function status(f) {
  try {
    const out = execFileSync("powershell.exe", [
      "-NoProfile", "-Command",
      `(Get-AuthenticodeSignature -FilePath '${f}').Status.ToString()`
    ], { encoding: "utf8" }).trim();
    return out;
  } catch { return "HATA"; }
}

function sign(f, pfx, pwd) {
  const args = ["sign", "/fd", "sha256", "/tr", "http://timestamp.digicert.com", "/td", "sha256", "/f", pfx];
  if (pwd) args.push("/p", pwd);
  args.push(f);
  execFileSync("signtool.exe", args, { stdio: "inherit" });
}

const pfx = process.argv[2];
const pwd = process.argv[3];

console.log(CLS.c + "  OYNUO imza durumu" + CLS.r + "\n");
for (const t of TARGETS) {
  if (!fs.existsSync(t)) { console.log(`  ${CLS.d}${(CLS.y + "yok")}${CLS.r}  ${path.basename(t)}`); continue; }
  const s = status(t);
  const color = s === "Valid" ? CLS.g : s === "NotSigned" ? CLS.y : CLS.d;
  console.log(`  ${color}${s}${CLS.r}  ${path.basename(t)}`);
}

if (pfx) {
  if (!fs.existsSync(pfx)) { console.log(CLS.y + "\n  pfx bulunamadi: " + pfx + CLS.r); process.exit(1); }
  console.log(CLS.c + "\n  imzalaniyor: " + pfx + CLS.r);
  for (const t of TARGETS) if (fs.existsSync(t)) { sign(t, pfx, pwd); console.log(CLS.g + "  imzalandi: " + path.basename(t) + CLS.r); }
  console.log(CLS.g + "\n  Tamam. SHA256 dosyalarini yeniden hesaplayip app-update.json'i guncelle." + CLS.r);
} else {
  console.log(CLS.d + "\n  Sertifika yok -> dosyalar imzasiz. Windows uyarir (bu normal)." + CLS.r);
  console.log(CLS.d + "  Kullaniciya cozum: 'Daha fazla bilgi' -> 'Yine de calistir'." + CLS.r);
  console.log(CLS.d + "  Bu exe senin build'in, bozuk degil - sadece imzali degil." + CLS.r);
}
