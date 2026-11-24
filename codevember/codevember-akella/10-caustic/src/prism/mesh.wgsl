// the light mesh: every cell of a band's photon grid, drawn where its four corners landed, as bright as
// it was squeezed (the area it left over the area it lands on). A neighbour tells how the bundle
// stretched, so the caustic stays sharp however thin it is drawn: anisotropic footprints, exactly.

@group(0) @binding(2) var<storage, read> landed: array<vec4f>;

struct VOut {
  @builtin(position) pos: vec4f,
  @location(0) col: vec3f,
};

fn photon(base: u32, q: vec2i) -> vec4f {
  let c = clamp(q, vec2i(0), vec2i(i32(U.nu), i32(U.nv)) - 1);
  return landed[base + u32(c.y) * u32(U.nu) + u32(c.x)];
}

// how a photon's bundle was squeezed, from its own neighbours either side (a central-difference
// Jacobian), or the cell's own if they went another way
fn squeeze(base: u32, q: vec2i, code: f32, cellArea: f32) -> f32 {
  let l = photon(base, q - vec2i(1, 0));
  let r = photon(base, q + vec2i(1, 0));
  let dn = photon(base, q - vec2i(0, 1));
  let up = photon(base, q + vec2i(0, 1));
  if (l.w != code || r.w != code || dn.w != code || up.w != code) { return cellArea; }
  let jx = (r.xy - l.xy) * 0.5;
  let jy = (up.xy - dn.xy) * 0.5;
  return abs(jx.x * jy.y - jx.y * jy.x);
}

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) band: u32) -> VOut {
  var o: VOut;
  o.pos = vec4f(0.0, 0.0, -2.0, 1.0);
  o.col = vec3f(0.0);
  let nu = u32(U.nu);
  let cells = nu - 1u;
  let cell = vi / 6u;
  let cx = cell % cells;
  let cy = cell / cells;
  let base = band * nu * u32(U.nv);
  let a = landed[base + cy * nu + cx];
  let b = landed[base + cy * nu + cx + 1u];
  let c = landed[base + (cy + 1u) * nu + cx];
  let d = landed[base + (cy + 1u) * nu + cx + 1u];
  // corners that went different ways (or nowhere) tear the mesh
  if (a.w < 0.0 || a.w != b.w || a.w != c.w || a.w != d.w) { return o; }
  let e1 = max(distance(a.xy, b.xy), distance(c.xy, d.xy));
  let e2 = max(distance(a.xy, c.xy), distance(b.xy, d.xy));
  if (max(e1, e2) > U.tearLen) { return o; }
  let diag1 = d.xy - a.xy;
  let diag2 = c.xy - b.xy;
  let cellArea = 0.5 * abs(diag1.x * diag2.y - diag1.y * diag2.x);
  var corners = array<u32, 6>(0u, 1u, 3u, 0u, 3u, 2u);
  var quad = array<vec4f, 4>(a, b, c, d);
  var offs = array<vec2i, 4>(vec2i(0, 0), vec2i(1, 0), vec2i(0, 1), vec2i(1, 1));
  let k = corners[vi % 6u];
  let q = quad[k];
  let area = select(cellArea, squeeze(base, vec2i(i32(cx), i32(cy)) + offs[k], a.w, cellArea), U.smoothShade > 0.5);
  // a vertex by a fold may be squeezed to nothing; across a big cell that would paint a bright shard,
  // so no vertex may be brighter than a few times its cell's own average (energy kept per cell)
  let flux = q.z * U.cellArea;
  let e = U.power * min(min(flux / max(area, U.cellArea * 1e-4), 4.0 * flux / max(cellArea, U.cellArea * 1e-4)), U.maxGain);
  let uv = (q.xy - vec2f(U.fx0, U.fz0)) / U.fsize;
  o.pos = vec4f(uv.x * 2.0 - 1.0, uv.y * 2.0 - 1.0, 0.5, 1.0);
  o.col = bands[band].yzw * e;
  return o;
}

@fragment
fn fs(in: VOut) -> @location(0) vec4f {
  return vec4f(in.col, 1.0);
}
