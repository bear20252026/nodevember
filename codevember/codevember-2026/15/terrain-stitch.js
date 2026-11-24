// Join two ordered edges even when their vertex counts differ. Every vertex
// on both boundaries participates, so coarse rings cannot cut across peaks
// in the finer edge. Winding faces upward for the landscape's ring ordering.
export function stitchTerrainEdge(inner, outer) {
  const triangles = [], bins = Array.from({ length: outer.length - 1 }, () => []);
  let i = 0, j = 0;
  while (i < inner.length - 1 || j < outer.length - 1) {
    const u0 = Math.min(i / (inner.length - 1), j / (outer.length - 1));
    let triangle;
    if (j === outer.length - 1 || (i < inner.length - 1 && (i + 1) / (inner.length - 1) <= (j + 1) / (outer.length - 1))) {
      triangle = [inner[i], inner[++i], outer[j]];
    } else {
      triangle = [inner[i], outer[j + 1], outer[j]]; j++;
    }
    triangles.push(...triangle);
    // A strip triangle can cross several coarse cells when the inner edge
    // has fewer vertices. Keep a small candidate list for wheel contact.
    const u1 = Math.max(i / (inner.length - 1), j / (outer.length - 1));
    const first = Math.max(0, Math.floor(u0 * bins.length));
    const last = Math.min(bins.length - 1, Math.floor(u1 * bins.length));
    for (let cell = first; cell <= last; cell++) bins[cell].push(triangle);
  }
  return { triangles, bins };
}
