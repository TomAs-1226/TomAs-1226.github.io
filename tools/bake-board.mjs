// Bake a KiCad board export for the web. Run through tools/export-board.py, which makes the export.
//
//   node tools/bake-board.mjs raw.glb models/o0x-m.glb
//
// KiCad writes every component as its own uncompressed mesh, so a 6-layer board with ~140 parts comes
// out over 20 MB. This welds and de-duplicates the meshes, merges what shares a material, simplifies
// only where it cannot be seen (error under 0.4 µm-ish of the model's size), quantizes and packs it
// with meshopt. The page's loader sets three's MeshoptDecoder.
//
// It also fixes KiCad's materials, which arrive with metalness 1 on everything, so the mask, silk and
// every plastic body render as chrome: only copper/gold and bare grey metal stay metallic. The mask and
// silk come half-transparent, which sorts badly over the board body they sit on; they are made opaque.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression } from "@gltf-transform/extensions";
import { dedup, weld, prune, flatten, join, simplify, quantize } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import { statSync } from "node:fs";

const [src, out] = process.argv.slice(2);
if (!src || !out) { console.error("usage: bake-board.mjs <in.glb> <out.glb>"); process.exit(1); }

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });

function hsl([r, g, b]) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

const doc = await io.read(src);
for (const m of doc.getRoot().listMaterials()) {
  const c = m.getBaseColorFactor();
  const { h, s, l } = hsl(c);
  const gold = s > 0.5 && h > 30 && h < 60 && l > 0.25; // ENIG pads, copper, pin plating
  const bareMetal = s < 0.15 && l > 0.35 && l < 0.75 && c[3] > 0.99; // leads, shields, crystal cans (white is plastic)
  const mask = c[3] < 0.95 && s > 0.2 && l < 0.3; // solder mask
  const silk = c[3] < 0.95 && l > 0.85; // silkscreen
  if (gold || bareMetal) { m.setMetallicFactor(1); m.setRoughnessFactor(gold ? 0.28 : 0.35); }
  else { m.setMetallicFactor(0); m.setRoughnessFactor(mask ? 0.42 : silk ? 0.6 : 0.55); }
  if (mask) m.setBaseColorFactor([0.035, 0.15, 0.085, 1]);
  if (c[3] < 1) { m.setAlphaMode("OPAQUE"); m.setBaseColorFactor([...m.getBaseColorFactor().slice(0, 3), 1]); }
  m.setName(gold ? "copper" : bareMetal ? "metal" : mask ? "mask" : silk ? "silk" : "body");
}

await doc.transform(
  dedup(),
  flatten(),
  join(),
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: 0.0, error: 0.0004 }),
  prune(),
  quantize(),
);
doc.createExtension(EXTMeshoptCompression).setRequired(true)
  .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
await io.write(out, doc);
console.log(`${out}: ${(statSync(src).size / 1e6).toFixed(2)} MB -> ${(statSync(out).size / 1e6).toFixed(2)} MB`);
