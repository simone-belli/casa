// Generates the app icons and brand assets in public/ from the source logos
// in logos/. Run with `npm run icons` after changing a logo.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const logosDir = path.join(root, "logos");
const brandDir = path.join(root, "public/brand");
const iconsDir = path.join(root, "public/icons");
fs.mkdirSync(brandDir, { recursive: true });
fs.mkdirSync(iconsDir, { recursive: true });

const sections = ["casa", "ricettario", "agenda"];
for (const name of sections) {
  fs.copyFileSync(path.join(logosDir, `${name}.svg`), path.join(brandDir, `${name}.svg`));
}

// Home-screen icons use the Casa logo. iOS and Android apply their own corner
// mask, so these are drawn full-bleed (square corners) to avoid black corners.
const casa = fs.readFileSync(path.join(logosDir, "casa.svg"), "utf8");
const casaSquare = casa.replace('rx="28"', 'rx="0"');

async function png(svg, size, file) {
  await sharp(Buffer.from(svg), { density: 600 })
    .resize(size, size)
    .png()
    .toFile(path.join(iconsDir, file));
}

await png(casaSquare, 180, "apple-touch-icon.png");
await png(casaSquare, 192, "icon-192.png");
await png(casaSquare, 512, "icon-512.png");

// Maskable icon: the logo artwork shrunk into the 80% safe zone on a
// full-bleed background in the logo's own terracotta.
const inner = await sharp(Buffer.from(casaSquare), { density: 600 }).resize(410, 410).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#C65D3B" } })
  .composite([{ input: inner, gravity: "centre" }])
  .png()
  .toFile(path.join(iconsDir, "icon-maskable-512.png"));

fs.copyFileSync(path.join(logosDir, "casa.svg"), path.join(root, "src/app/icon.svg"));
console.log("Icons written to public/icons and public/brand");
