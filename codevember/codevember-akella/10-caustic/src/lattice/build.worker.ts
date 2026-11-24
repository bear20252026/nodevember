// the lattice is built off the main thread: the merged surface takes a moment. A mesh to grow it on is sent
// once and kept here.
import { buildForm, parseMeshBin, type BaseMesh } from "./form";
import { buildLattice, type LatticeParams } from "./geometry";

let base: BaseMesh | null = null;

self.onmessage = (e: MessageEvent<{ id: number; params: LatticeParams; mesh?: ArrayBuffer }>) => {
  if (e.data.mesh) base = parseMeshBin(e.data.mesh);
  const t0 = performance.now();
  const L = e.data.params.form !== "vessel" && base ? buildForm(e.data.params, base) : buildLattice(e.data.params);
  const reply = { id: e.data.id, ms: performance.now() - t0, ...L };
  (self as unknown as Worker).postMessage(reply, [L.vertices.buffer, L.indices.buffer, L.glints.buffer]);
};
