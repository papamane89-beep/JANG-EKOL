/* eslint-disable */
// scripts/build.js — Build Windows-compatible
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`   ⚠️  Source introuvable : ${src}`);
    return false;
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
  return true;
}

console.log("\n▶ 1/3 — Compilation Next.js...");
execSync("next build --webpack", { stdio: "inherit", shell: true });

const standalone = ".next/standalone";
if (!fs.existsSync(standalone)) {
  console.error("❌ .next/standalone introuvable. Vérifiez output: 'standalone'.");
  process.exit(1);
}

console.log("\n▶ 2/3 — Copie des fichiers statiques...");
copyDir(".next/static", path.join(standalone, ".next", "static"));
copyDir("public", path.join(standalone, "public"));

console.log("\n▶ 3/3 — Copie des packages natifs (Prisma, sharp)...");
const natives = [
  ["node_modules/.prisma", path.join(standalone, "node_modules", ".prisma")],
  ["node_modules/@prisma", path.join(standalone, "node_modules", "@prisma")],
  ["node_modules/prisma",  path.join(standalone, "node_modules", "prisma")],
  ["node_modules/sharp",   path.join(standalone, "node_modules", "sharp")],
  ["node_modules/@img",    path.join(standalone, "node_modules", "@img")],
];
for (const [from, to] of natives) {
  if (copyDir(from, to)) console.log(`   ✅ ${from}`);
}

if (fs.existsSync("prisma/schema.prisma")) {
  const dest = path.join(standalone, "prisma", "schema.prisma");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync("prisma/schema.prisma", dest);
  console.log("   ✅ prisma/schema.prisma");
}

console.log("\n✅ Build terminé — .next/standalone prêt.\n");