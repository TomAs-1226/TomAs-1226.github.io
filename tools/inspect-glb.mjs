// Print what a GLB is made of: meshes, nodes, and vertex count per material.
//   node tools/inspect-glb.mjs models/o0x-m.glb
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const doc = await io.read(process.argv[2]);
const root = doc.getRoot();
console.log("meshes", root.listMeshes().length, "nodes", root.listNodes().length, "materials", root.listMaterials().length);
const counts = new Map();
for (const mesh of root.listMeshes()) {
  for (const p of mesh.listPrimitives()) {
    const m = p.getMaterial();
    const k = `${m?.getName()} ${JSON.stringify(m?.getBaseColorFactor().map((v) => +v.toFixed(2)))} ${m?.getAlphaMode()} metal=${m?.getMetallicFactor()}`;
    counts.set(k, (counts.get(k) || 0) + p.getAttribute("POSITION").getCount());
  }
}
[...counts].sort((a, b) => b[1] - a[1]).slice(0, 30).forEach(([k, v]) => console.log(String(v).padStart(8), k));
