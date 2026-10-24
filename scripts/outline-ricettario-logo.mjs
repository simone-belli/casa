// One-off: replaces the live-text "R" in logos/ricettario.svg with an outlined
// path, so the logo renders identically everywhere (Georgia isn't installed on
// every device, and rasterisers ignore web fonts). Gelasio is an open-source
// font designed to match Georgia's metrics.
import fs from "node:fs";
import path from "node:path";
import opentype from "opentype.js";

const root = path.resolve(import.meta.dirname, "..");
const svgPath = path.join(root, "logos/ricettario.svg");
const fontPath = path.join(
  root,
  "node_modules/@fontsource/gelasio/files/gelasio-latin-700-italic.woff",
);

const svg = fs.readFileSync(svgPath, "utf8");
const textMatch = svg.match(/<text[^>]*>R<\/text>/);
if (!textMatch) {
  console.log("ricettario.svg has no <text> element; nothing to do.");
  process.exit(0);
}

const buffer = fs.readFileSync(fontPath);
const font = opentype.parse(
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
);
const size = 120;
const centreX = 90;
const baseline = 126;
const width = font.getAdvanceWidth("R", size);
const glyph = font.getPath("R", centreX - width / 2, baseline, size);
const d = glyph.toPathData(2);

const replacement = `<path fill="#FFFFFF" d="${d}"/>`;
fs.writeFileSync(svgPath, svg.replace(textMatch[0], replacement));
console.log("Outlined the R in logos/ricettario.svg");
