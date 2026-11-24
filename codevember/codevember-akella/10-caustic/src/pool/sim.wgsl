// the water: a height and a vertical speed per cell, stepped with the wave equation (Evan Wallace's
// WebGL Water scheme). Objects push it by the change in how much of each column they fill below the
// line, so anything entering, bobbing or sinking makes its own rings.

@group(0) @binding(1) var<storage, read> objs: array<Obj>;
@group(0) @binding(2) var<storage, read_write> src: array<vec2f>;
@group(0) @binding(3) var<storage, read_write> dst: array<vec2f>;
@group(0) @binding(4) var surfOut: texture_storage_2d<rgba16float, write>;
@group(0) @binding(5) var<storage, read_write> probes: array<vec4f>;
@group(0) @binding(6) var<storage, read> imps: array<vec4f>;
@group(0) @binding(7) var allOut: texture_storage_2d<rgba16float, write>;

fn cellPos(id: vec2u) -> vec2f { return vec2f(-U.PX, -U.PZ) + (vec2f(id) + 0.5) * U.cell; }

/**
 * about how much of the column through p a ball at c of radius r fills below the still water line. The
 * true chord has an edge of infinite slope, which rings the grid at its own size and the light mesh turns
 * that into speckle; this smooth footprint holds about the same volume.
 */
fn column(c: vec3f, r: f32, p: vec2f) -> f32 {
  let R = r * 1.3;
  let d2 = dot(p - c.xz, p - c.xz) / (R * R);
  if (d2 >= 1.0) { return 0.0; }
  let f = (1.0 - d2) * (1.0 - d2);
  return clamp(r - c.y, 0.0, 2.0 * r) * f * 0.6;
}

fn at(x: i32, z: i32) -> f32 {
  let nx = i32(U.nx);
  let nz = i32(U.nz);
  return src[u32(clamp(z, 0, nz - 1) * nx + clamp(x, 0, nx - 1))].x;
}

@compute @workgroup_size(8, 8)
fn disturb(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= u32(U.nx) || id.y >= u32(U.nz)) { return; }
  let k = id.y * u32(U.nx) + id.x;
  let p = cellPos(id.xy);
  var dh = 0.0;
  for (var i = 0u; i < u32(U.nObj); i++) {
    let o = objs[i];
    let r = o.a.w * (o.c.x + o.c.y + o.c.z) / 3.0;
    dh += column(o.b.xyz, r, p) - column(o.a.xyz, r, p);
  }
  // displaced water mostly leaves sideways in a real splash: only part of it stays as a dent, at most a
  // centimetre a frame, or a fast ball digs a crater the wave equation turns into a tidal wave
  dh = clamp(dh * U.displace, -0.012, 0.012);
  for (var i = 0u; i < u32(U.nImp); i++) {
    let m = imps[i];
    let d = p - m.xy;
    dh -= m.w * exp(-dot(d, d) / (m.z * m.z));
  }
  src[k].x += dh;
}

@compute @workgroup_size(8, 8)
fn step(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= u32(U.nx) || id.y >= u32(U.nz)) { return; }
  let x = i32(id.x);
  let z = i32(id.y);
  let k = id.y * u32(U.nx) + id.x;
  let c = src[k];
  let avg = 0.25 * (at(x - 1, z) + at(x + 1, z) + at(x, z - 1) + at(x, z + 1));
  var v = (c.y + (avg - c.x) * U.stiff) * U.damp;
  // a touch of viscosity: the shortest, grid-sized waves die first
  let h = clamp(mix(c.x, avg, U.visc) + v, -0.08, 0.08);
  dst[k] = vec2f(h, v);
}

@compute @workgroup_size(8, 8)
fn surface(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= u32(U.nx) || id.y >= u32(U.nz)) { return; }
  let x = i32(id.x);
  let z = i32(id.y);
  let h = at(x, z);
  let gx = (at(x + 1, z) - at(x - 1, z)) / (2.0 * U.cell);
  let gz = (at(x, z + 1) - at(x, z - 1)) / (2.0 * U.cell);
  textureStore(surfOut, vec2i(id.xy), vec4f(h, gx, gz, 0.0));
  // and with the breeze ripples in, for everything that only needs the surface's slope, not its curvature
  textureStore(allOut, vec2i(id.xy), vec4f(vec3f(h, gx, gz) + ambient(cellPos(id.xy)), 0.0));
}

/** the simulated water under each object, for its buoyancy (read back a frame or two late) */
@compute @workgroup_size(64)
fn probe(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= u32(U.nObj)) { return; }
  let p = (objs[id.x].a.xz + vec2f(U.PX, U.PZ)) / U.cell - 0.5;
  let x = i32(floor(p.x));
  let z = i32(floor(p.y));
  let f = p - floor(p);
  let h = mix(mix(at(x, z), at(x + 1, z), f.x), mix(at(x, z + 1), at(x + 1, z + 1), f.x), f.y);
  let gx = (mix(at(x + 1, z), at(x + 1, z + 1), f.y) - mix(at(x, z), at(x, z + 1), f.y)) / U.cell;
  let gz = (mix(at(x, z + 1), at(x + 1, z + 1), f.x) - mix(at(x, z), at(x + 1, z), f.x)) / U.cell;
  probes[id.x] = vec4f(h, gx, gz, 0.0);
}
