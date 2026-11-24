import { MeshStandardNodeMaterial, MeshPhysicalNodeMaterial, DataTexture, RGBAFormat, RepeatWrapping, LinearFilter, LinearMipmapLinearFilter, FrontSide } from 'three/webgpu';
import { Fn, If, attribute, positionWorld, positionView, normalWorld, normalView, cameraViewMatrix, texture, mat3, vec2, vec3, vec4, float, mix, uniform, sin, cos, smoothstep, mrt, diffuseColor } from 'three/tsl';
import { randomSeed, smoothstep as smoothCPU } from './noise.js';
import { sampleSediment } from './rock-geometry.js';

// Periodic mineral/grain texture, made locally. No scans or image downloads.
function createGrainTexture() {
  const size = 1024, data = new Uint8Array(size * size * 4), random = randomSeed(1526);
  const grid = new Float32Array(size * size);
  for (let i = 0; i < grid.length; i++) grid[i] = random();
  const sample = (x, y, scale) => {
    const px = x / scale, py = y / scale, ix = Math.floor(px), iy = Math.floor(py), period = size / scale;
    let fx = px - ix, fy = py - iy; fx *= fx * (3 - 2 * fx); fy *= fy * (3 - 2 * fy);
    const g = (a, b) => grid[((b % period + period) % period) * size + ((a % period + period) % period)];
    return (g(ix, iy) * (1 - fx) + g(ix + 1, iy) * fx) * (1 - fy) + (g(ix, iy + 1) * (1 - fx) + g(ix + 1, iy + 1) * fx) * fy;
  };
  // A periodic fracture field and mineral grains, packed into one texture.
  // These details survive meshlet LOD changes; they do not inflate silhouettes.
  const cells = 32, cellSize = size / cells, buckets = Array.from({ length: cells * cells }, () => []);
  function segment(ax, ay, bx, by, width, first, last) {
    // Replicate across the tile boundaries so long fractures wrap seamlessly.
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
      const a = ax + ox, b = ay + oy, c = bx + ox, d = by + oy, margin = width * 3;
      const x0 = Math.max(0, Math.floor((Math.min(a, c) - margin) / cellSize)), x1 = Math.min(cells - 1, Math.floor((Math.max(a, c) + margin) / cellSize));
      const y0 = Math.max(0, Math.floor((Math.min(b, d) - margin) / cellSize)), y1 = Math.min(cells - 1, Math.floor((Math.max(b, d) + margin) / cellSize));
      const edge = { ax: a, ay: b, dx: c - a, dy: d - b, length2: (c - a) ** 2 + (d - b) ** 2, width, first, last };
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) buckets[y * cells + x].push(edge);
    }
  }
  for (let i = 0; i < 70; i++) {
    let x = random() * size, y = random() * size;
    let angle = (i % 3) * Math.PI / 3 + (random() - .5) * .6;
    const count = 2 + Math.floor(random() * 5), width = .5 + random() * 1.1;
    for (let j = 0; j < count; j++) {
      angle += (random() - .5) * .38;
      const length = 18 + random() * 48, xx = x + Math.cos(angle) * length, yy = y + Math.sin(angle) * length;
      segment(x, y, xx, yy, width, j === 0, j === count - 1);
      if (j > 0 && random() < .3) {
        const branch = angle + (random() < .5 ? -1 : 1) * (.5 + random() * .55), reach = 12 + random() * 35;
        segment(x, y, x + Math.cos(branch) * reach, y + Math.sin(branch) * reach, width * .55, false, true);
      }
      x = xx; y = yy;
    }
  }
  const fractureAt = (x, y) => {
    let joint = 0;
    for (const edge of buckets[Math.floor(y / cellSize) * cells + Math.floor(x / cellSize)]) {
      const t = Math.max(0, Math.min(1, ((x - edge.ax) * edge.dx + (y - edge.ay) * edge.dy) / edge.length2));
      const distance = Math.hypot(x - edge.ax - edge.dx * t, y - edge.ay - edge.dy * t);
      const taper = (edge.first ? smoothCPU(0, .18, t) : 1) * (edge.last ? 1 - smoothCPU(.75, 1, t) : 1);
      joint = Math.max(joint, (1 - smoothCPU(edge.width * .3, edge.width * 2.5, distance)) * taper);
    }
    return joint;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const joint = fractureAt(x, y);
    const n = sample(x, y, 128) * .18 + sample(x, y, 32) * .28 + sample(x, y, 8) * .3 + sample(x, y, 2) * .17 + grid[y * size + x] * .07;
    const height = .24 + n * .65 - joint * .07;
    const i = (y * size + x) * 4;
    data[i] = Math.round(height * 255);
    data[i + 1] = Math.round(sample(x, y, 64) * 255);
    data[i + 2] = Math.round((1 - joint * .35) * 255);
    data[i + 3] = Math.round(grid[y * size + x] * 255);
  }
  const tex = new DataTexture(data, size, size, RGBAFormat);
  tex.wrapS = tex.wrapT = RepeatWrapping; tex.generateMipmaps = true; tex.magFilter = LinearFilter; tex.minFilter = LinearMipmapLinearFilter; tex.anisotropy = 16; tex.needsUpdate = true;
  return tex;
}

// Store linear height slopes, not normalized normal maps. Averaging these in
// the mip chain preserves the relief at oblique angles without depending on
// screen derivatives of the mesh's piecewise-planar interpolated surface.
function createRockGradientTexture(grain) {
  const { data: source, width, height } = grain.image;
  const data = new Uint8Array(width * height * 4);
  // The byte height field has differences in [-57, 55], fractures [-89, 89].
  // Store those signed differences exactly around 128; UV scale is applied
  // in the shader. This halves bandwidth versus floating-point gradients.
  const encode = difference => Math.max(0, Math.min(255, difference + 128));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const left = (y * width + (x + width - 1) % width) * 4, right = (y * width + (x + 1) % width) * 4;
    const down = (((y + height - 1) % height) * width + x) * 4, up = (((y + 1) % height) * width + x) * 4;
    const i = (y * width + x) * 4;
    for (const channel of [0, 2]) {
      data[i + channel] = encode(source[right + channel] - source[left + channel]);
      data[i + channel + 1] = encode(source[up + channel] - source[down + channel]);
    }
  }
  const tex = new DataTexture(data, width, height, RGBAFormat);
  tex.wrapS = tex.wrapT = RepeatWrapping; tex.generateMipmaps = true;
  // Triplanar weights already reject grazing projections. Four taps suffice
  // for these smooth slopes; the shared color/grain texture retains 16x.
  tex.magFilter = LinearFilter; tex.minFilter = LinearMipmapLinearFilter; tex.anisotropy = 4; tex.needsUpdate = true;
  return tex;
}

const perturb = Fn(([height, strength]) => {
  const dx = positionView.dFdx(), dy = positionView.dFdy();
  const rx = dy.cross(normalView), ry = normalView.cross(dx), det = dx.dot(rx);
  const grad = rx.mul(height.dFdx()).add(ry.mul(height.dFdy())).mul(det.sign());
  return normalView.mul(det.abs()).sub(grad.mul(strength)).normalize();
});

export function createMaterials() {
  const grain = createGrainTexture(), rockGradient = createRockGradientTexture(grain), relief = uniform(.7), pixelRatio = uniform(1);
  // Replicated rows keep each rock's beds isolated through the useful mip
  // levels, so thin sediment seams filter cleanly as their meshlets simplify.
  const bedPixels = new Uint8Array(2048 * 1024 * 4);
  const bedTexture = new DataTexture(bedPixels, 2048, 1024, RGBAFormat);
  bedTexture.magFilter = LinearFilter; bedTexture.minFilter = LinearMipmapLinearFilter; bedTexture.generateMipmaps = true;
  function registerRock(geometry, row) {
    for (let i = 0; i < 2048; i++) {
      const bed = sampleSediment((i + .5) / 2048 * 6 - 3, geometry.userData.beds);
      for (let y = row * 32; y < (row + 1) * 32; y++) {
        const k = (y * 2048 + i) * 4;
        bedPixels[k] = Math.round((.5 + (bed.ledge - bed.seam) * 10) * 255);
        bedPixels[k + 1] = Math.round(bed.hardness * 255); bedPixels[k + 2] = 255; bedPixels[k + 3] = 255;
      }
    }
    bedTexture.needsUpdate = true;
  }
  function triplanar(scale) {
    return Fn(() => {
      const p = positionWorld.mul(scale).toVar(), dx = p.dFdx().toVar(), dy = p.dFdy().toVar();
      const w = normalWorld.abs().pow(5), normalized = w.div(w.x.add(w.y).add(w.z));
      // Most cliff faces need only one or two projections. Fade tiny weights
      // smoothly to zero before skipping their anisotropic texture reads.
      // Explicit gradients keep mip selection valid inside divergent branches.
      const trimmed = normalized.mul(normalized.smoothstep(.005, .03));
      const blend = trimmed.div(trimmed.x.add(trimmed.y).add(trimmed.z)).toVar(), result = vec4(0).toVar();
      If(blend.x.greaterThan(0), () => { result.addAssign(texture(grain, p.yz).grad(dx.yz, dy.yz).mul(blend.x)); });
      If(blend.y.greaterThan(0), () => { result.addAssign(texture(grain, p.zx).grad(dx.zx, dy.zx).mul(blend.y)); });
      If(blend.z.greaterThan(0), () => { result.addAssign(texture(grain, p.xy).grad(dx.xy, dy.xy).mul(blend.z)); });
      return result;
    })();
  }
  function rockAltitudeTint(mineral) {
    // Pale dusty feet transition into warm exposed sandstone. Broad mineral
    // patches break up the height transition; high mountain stone cools in tone.
    const height = positionWorld.y.add(mineral.sub(.5).mul(28));
    const exposed = height.smoothstep(-6, 120), upland = height.smoothstep(250, 2000);
    return mix(vec3(1.06, 1.03, .98), vec3(1.07, .99, .91), exposed)
      .mul(mix(vec3(1), vec3(.96, .985, 1.02), upland));
  }
  function stone(weathered) {
    // Shadow the outside of the closed rock. Back-face shadow maps leak a
    // bright seam where the buried underside intersects the sand.
    const m = new MeshStandardNodeMaterial({ roughness: .94, metalness: 0, shadowSide: FrontSide });
    function surface(scale, height, fracture = 0, nearDetail = false) {
      const fields = Fn(() => {
        const p = positionWorld.mul(scale).toVar(), dx = p.dFdx().toVar(), dy = p.dFdy().toVar();
        const w = normalWorld.abs().pow(5), normalized = w.div(w.x.add(w.y).add(w.z));
        const trimmed = normalized.mul(normalized.smoothstep(.005, .03));
        const blend = trimmed.div(trimmed.x.add(trimmed.y).add(trimmed.z)).toVar();
        const color = vec3(0).toVar(), gradient = vec3(0).toVar();
        // Millimetre grain becomes roughness at distance; its albedo and
        // roughness remain filtered normally, without extra slope samples.
        const strength = nearDetail ? positionView.z.negate().smoothstep(4, 16).oneMinus() : float(1);
        // Derivatives select mip levels only. Relief comes from texture-space
        // slopes blended in world space, then projected onto the smooth normal.
        // Explicit gradients also make skipping negligible projections safe.
        for (const [axis, uv] of [['x', 'yz'], ['y', 'zx'], ['z', 'xy']]) {
          If(blend[axis].greaterThan(0), () => {
            color.addAssign(texture(grain, p[uv]).grad(dx[uv], dy[uv]).rgb.mul(blend[axis]));
            const sampleSlope = () => {
              const slopes = texture(rockGradient, p[uv]).grad(dx[uv], dy[uv]).mul(255).sub(128)
                .mul(vec4(grain.image.width, grain.image.height, grain.image.width, grain.image.height).div(510)).toVar();
              const g = slopes.xy.mul(height).add(slopes.zw.mul(fracture)).mul(scale);
              const world = axis === 'x' ? vec3(0, g.x, g.y) : axis === 'y' ? vec3(g.y, 0, g.x) : vec3(g.x, g.y, 0);
              gradient.addAssign(world.mul(blend[axis]).mul(strength));
            };
            if (nearDetail) If(strength.greaterThan(0), sampleSlope); else sampleSlope();
          });
        }
        return mat3(color, gradient, vec3(0));
      })().toVar();
      return { color: fields.element(0), gradient: fields.element(1) };
    }
    const broad = surface(.009, .45, .085 / .35), medium = surface(.085, .06), detail = surface(.85, .0045, 0, true);
    const macro = broad.color, mineral = medium.color, fine = detail.color;
    // Color follows the same irregular beds as the actual eroded surface.
    const bed = weathered ? texture(bedTexture, attribute('strata', 'vec2')) : null;
    const bedding = weathered ? bed.g : mineral.g;
    const oxide = smoothstep(.2, .8, macro.g);
    // Earthy brown sandstone, burnt-orange oxide and peach carbonate beds. These
    // broad mineral changes remain visible from the basin, beneath fine grain.
    const mineralBase = mix(vec3(.245, .175, .12), vec3(.39, .185, .08), oxide);
    const base = mix(mineralBase, vec3(.46, .32, .20), bedding.smoothstep(.32, .82).mul(.28));
    const fracture = macro.b.oneMinus().div(.35);
    const pigment = base.mul(mineral.r.sub(.5).mul(.32).add(1)).mul(mix(.95, 1.045, bedding))
      .mul(fracture.mul(.16).oneMinus()).mul(mix(.93, 1, mineral.b)).mul(fine.r.sub(.5).mul(.22).add(1));
    // Geometry, rather than unrelated color noise, determines where stone
    // is exposed by abrasion and where iron-rich deposits remain sheltered.
    const curvature = attribute('curvature', 'float');
    const exposed = curvature.smoothstep(.065, .48).mul(mineral.g.mul(.25).add(.75));
    const sheltered = curvature.negate().smoothstep(.045, .42);
    const worn = mix(pigment, vec3(.43, .30, .19), exposed.mul(.3));
    const stained = mix(worn, vec3(.20, .13, .08), sheltered.mul(.25));
    const dust = normalWorld.y.smoothstep(.6, .96).mul(.16);
    m.colorNode = mix(stained, vec3(.48, .34, .21), dust).mul(rockAltitudeTint(macro.g));
    // Sediment beds already shape the mesh. Their interpolated atlas UVs are
    // for pigment only: height derivatives across eroded/LOD triangles made
    // dark sawtooth bands. Keep spalling, joints and grain in world space.
    const gradient = broad.gradient.add(medium.gradient).add(detail.gradient);
    const tangentGradient = gradient.sub(normalWorld.mul(gradient.dot(normalWorld)));
    m.normalNode = cameraViewMatrix.mul(vec4(normalWorld.sub(tangentGradient.mul(relief)), 0)).xyz.normalize();
    m.roughnessNode = fine.g.mul(.17).add(.79);
    if (weathered) m.aoNode = attribute('weathering', 'float').mul(mix(1, .9, sheltered));
    return m;
  }
  const rock = stone(true);
  // Carved sandstone has subtle mineral grain, not the large oxide stains
  // and eroded bedding used by exposed cliff faces.
  const masonry = new MeshStandardNodeMaterial({ roughness: .9 });
  const masonryGrain = triplanar(.9).toVar(), masonryFine = triplanar(3.7).toVar(), masonryMineral = triplanar(.027).toVar();
  // Broad mineral variation stays visible from the basin; fine grain remains
  // restrained so carved faces don't become mottled or dirty at close range.
  masonry.colorNode = mix(vec3(.405, .28, .17), vec3(.465, .335, .215), masonryMineral.g.smoothstep(.18, .82))
    .mul(masonryGrain.g.mul(.09).add(.955)).mul(masonryFine.r.sub(.5).mul(.055).add(1));
  masonry.normalNode = perturb(masonryGrain.r.mul(.006).add(masonryFine.r.mul(.0007)), relief);
  const distantRock = new MeshStandardNodeMaterial({ roughness: 1 });
  const distantGrain = triplanar(.004), distantBeds = texture(bedTexture, attribute('strata', 'vec2'));
  const distantBase = mix(vec3(.245, .175, .12), vec3(.39, .185, .08), distantGrain.g.smoothstep(.2, .8));
  distantRock.colorNode = mix(distantBase, vec3(.46, .32, .20), distantBeds.g.smoothstep(.32, .82).mul(.28)).mul(distantBeds.g.mul(.2).add(.89))
    .mul(attribute('curvature', 'float').mul(.12).add(1)).mul(rockAltitudeTint(distantGrain.g));
  distantRock.aoNode = attribute('weathering', 'float');
  const sand = new MeshStandardNodeMaterial({ roughness: 1 });
  // A mirage belongs to the level playa; the sloping faces of dunes stay dry.
  sand.mrtNode = mrt({ diffuse: vec4(diffuseColor.rgb, normalWorld.y.smoothstep(.985, .999)) });
  const p = positionWorld, big = texture(grain, p.xz.mul(.009));
  const phase = p.z.mul(9.5).add(p.x.mul(2.3)).add(big.g.mul(14)).add(sin(p.x.mul(.13)).mul(2));
  // Derivative filtering stops subpixel ripples sparkling in the distance.
  const footprint = phase.dFdx().abs().add(phase.dFdy().abs());
  const visible = smoothstep(.75, 2, footprint.mul(pixelRatio)).oneMinus();
  const ripple = sin(phase).mul(.5).add(.5).pow(2).mul(visible);
  // Real anisotropic texture filtering preserves oblique grain. Separate
  // metre-scale drifts remain readable after centimetre grain is subpixel.
  const driftPhase = p.z.mul(1.45).add(p.x.mul(.29)).add(big.g.mul(6));
  const driftVisible = driftPhase.dFdx().abs().add(driftPhase.dFdy().abs()).smoothstep(.8, 2.5).oneMinus();
  const sandDrift = sin(driftPhase).mul(driftVisible);
  const broadPhase = p.z.mul(.24).add(p.x.mul(.055)).add(big.g.mul(4));
  const broadVisible = broadPhase.dFdx().abs().add(broadPhase.dFdy().abs()).smoothstep(.8, 2.5).oneMinus();
  const sandWave = sin(broadPhase).mul(broadVisible);
  const streaks = texture(grain, p.xz.mul(vec2(.002, .025))).g;
  const channel = sin(p.z.mul(.007)).mul(21).add(sin(p.z.mul(.019)).mul(5));
  const width = p.z.negate().max(0).mul(.09).add(150).add(p.z.add(220).div(400).pow2().negate().exp().mul(95));
  const apron = p.x.sub(channel).abs().div(width).smoothstep(.42, .85);
  const outcrop = p.xz.sub(vec2(48, 68)).length().smoothstep(8, 25).oneMinus();
  const crust = apron.max(outcrop).mul(big.g.mul(.65).add(.35));
  const grit = texture(grain, p.xz.mul(.11));
  const duneColor = mix(vec3(.46, .335, .225), vec3(.64, .465, .315), big.g.mul(.65).add(.25)).mul(ripple.mul(.045).add(.975));
  const crustColor = mix(vec3(.29, .13, .055), vec3(.56, .32, .15), grit.r).mul(grit.b.mul(.15).add(.85));
  const desertColor = mix(duneColor.mul(sandDrift.mul(.032).add(sandWave.mul(.035)).add(streaks.sub(.5).mul(.16)).add(1)), crustColor, crust);
  // The distant mountain chains expose darker bedrock; covering every height
  // with bright dune sand erased their relief before the atmospheric fade.
  const mountain = p.y.smoothstep(80, 420);
  const geology = texture(grain, p.xz.mul(.00075));
  const slope = normalWorld.y.abs().smoothstep(.50, .86);
  const strataPhase = p.y.mul(.055).add(p.x.mul(.012)).add(p.z.mul(.007)).add(geology.r.mul(4));
  const strataFilter = strataPhase.dFdx().abs().add(strataPhase.dFdy().abs()).smoothstep(.8, 3).oneMinus();
  const beds = sin(strataPhase).mul(strataFilter);
  const bedrockColor = mix(vec3(.18, .14, .12), vec3(.26, .21, .17), geology.g).mul(beds.mul(.08).add(1));
  const screeColor = mix(vec3(.36, .27, .18), vec3(.50, .38, .26), geology.r);
  const uplandColor = mix(bedrockColor, screeColor, slope).mul(rockAltitudeTint(geology.g));
  sand.colorNode = mix(desertColor, uplandColor, mountain);
  // Differentiate the physical detail, not the screen-space filter, altitude
  // mask or interpolated slope. Derivatives of those masks produced diagonal
  // dark bands at grazing angles and across large terrain triangles.
  const grainSlope = scale => {
    const gradient = texture(rockGradient, p.xz.mul(scale)).xy.mul(255).sub(128).mul(1024 / 510 * scale);
    return vec3(gradient.x, 0, gradient.y);
  };
  const waveSlope = vec3(.055, 0, .24).mul(cos(broadPhase)).mul(broadVisible);
  const driftSlope = vec3(.29, 0, 1.45).mul(cos(driftPhase)).mul(driftVisible);
  const rippleSlope = vec3(cos(p.x.mul(.13)).mul(.26).add(2.3), 0, 9.5)
    .mul(sin(phase).mul(.5).add(.5)).mul(cos(phase)).mul(visible);
  const sandGradient = rippleSlope.mul(.014).add(driftSlope.mul(.025)).add(waveSlope.mul(.07))
    .mul(crust.mul(.85).oneMinus()).add(grainSlope(.11).mul(crust).mul(.07)).add(grainSlope(.8).mul(.002));
  const strataSlope = vec3(.012, .055, .007).mul(cos(strataPhase)).mul(strataFilter);
  const geologySlope = grainSlope(.00075);
  const uplandGradient = mix(strataSlope.mul(.3).add(geologySlope.mul(1.5)), waveSlope.mul(.18).add(geologySlope.mul(.65)), slope);
  const sandNormal = Fn(() => {
    const gradient = mix(sandGradient, uplandGradient, mountain).toVar();
    const tangent = gradient.sub(normalWorld.mul(gradient.dot(normalWorld)));
    return cameraViewMatrix.mul(vec4(normalWorld.sub(tangent).normalize(), 0)).xyz;
  });
  sand.normalNode = sandNormal();
  const dark = new MeshStandardNodeMaterial({ color: '#4e3726', roughness: 1 });
  const inlay = new MeshStandardNodeMaterial({ roughness: .82 });
  inlay.colorNode = mix(vec3(.038, .095, .105), vec3(.14, .24, .25), texture(grain, positionWorld.xy.mul(.28)).g);
  // Polished serpentine-green stone: cloudy mineral masses and folded pale
  // veins share world coordinates across each slab, with filtered thin seams.
  const marble = new MeshPhysicalNodeMaterial({ roughness: .28, metalness: 0, clearcoat: .22, clearcoatRoughness: .24 });
  marble.name = 'Sanctuary / green marble';
  const marbleCloud = triplanar(.035).toVar(), marbleFold = triplanar(.16).toVar();
  const veinPhase = positionWorld.dot(vec3(.75, .55, .65)).add(marbleCloud.g.mul(11)).add(marbleFold.g.mul(2.3)).toVar();
  const veinWidth = veinPhase.dFdx().abs().add(veinPhase.dFdy().abs()).mul(.7).max(.025);
  const vein = sin(veinPhase).abs().smoothstep(float(.055).sub(veinWidth), float(.055).add(veinWidth)).oneMinus();
  marble.colorNode = mix(mix(vec3(.012, .042, .029), vec3(.045, .145, .091), marbleCloud.g), vec3(.42, .49, .37), vein.mul(.78));
  marble.roughnessNode = marbleFold.g.mul(.1).add(.22);
  const orangeMarble = new MeshPhysicalNodeMaterial({ roughness: .32, metalness: 0, clearcoat: .18, clearcoatRoughness: .28 });
  orangeMarble.name = 'Sanctuary / orange marble';
  const orangePhase = positionWorld.dot(vec3(.44, .83, -.58)).add(marbleCloud.g.mul(15)).add(marbleFold.g.mul(3.5)).toVar();
  const orangeWidth = orangePhase.dFdx().abs().add(orangePhase.dFdy().abs()).mul(.7).max(.025);
  const orangeVein = sin(orangePhase).abs().smoothstep(float(.035).sub(orangeWidth), float(.035).add(orangeWidth)).oneMinus()
    .mul(marbleFold.g.smoothstep(.2, .75));
  orangeMarble.colorNode = mix(mix(vec3(.18, .058, .019), vec3(.38, .155, .05), marbleCloud.g), vec3(.60, .36, .17), orangeVein.mul(.62));
  orangeMarble.roughnessNode = marbleFold.g.mul(.08).add(.28);
  const gold = new MeshStandardNodeMaterial({ metalness: 1, roughness: .3 });
  gold.name = 'Sanctuary / satin gold';
  const goldGrain = triplanar(.8).toVar();
  // Conductive gold reflectance in linear RGB. Fine variation changes polish,
  // not the rock-like relief or dark dirt that obscured the earlier facade.
  gold.colorNode = vec3(1, .766, .336).mul(goldGrain.g.mul(.06).add(.94));
  gold.roughnessNode = goldGrain.g.mul(.12).add(.24);
  return { rock, distantRock, masonry, sand, dark, inlay, marble, orangeMarble, gold, relief, pixelRatio, grain, registerRock, dispose() { rock.dispose(); distantRock.dispose(); masonry.dispose(); sand.dispose(); dark.dispose(); inlay.dispose(); marble.dispose(); orangeMarble.dispose(); gold.dispose(); grain.dispose(); rockGradient.dispose(); bedTexture.dispose(); } };
}
