import { RenderPipeline, NoToneMapping, LinearSRGBColorSpace, Vector2, Vector3 } from 'three/webgpu';
import { pass, uniform, float, vec2, vec3, vec4, screenUV, mix, sin, exp, smoothstep, renderOutput, rtt, getViewPosition, isBackgroundDepth } from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { createIndirectLighting } from './indirect-lighting.js';
import { miragePlaneHeight, groundHeatAt } from './mirage-conditions.js';
import { createMirageReflector } from './mirage-reflector.js';

export function createPostProcessing(renderer, scene, camera, atmosphere, dust) {
  const reflectedScene = createMirageReflector(renderer, scene, camera, atmosphere);
  const scenePass = pass(scene, camera, { samples: 4, storeMultisampledColorBuffer: false });
  const beauty = scenePass.getTextureNode('output'), depth = scenePass.getTextureNode('depth');
  dust.connectDepth(depth);
  const dustPass = pass(dust.scene, camera, { samples: 0, depthBuffer: false });
  const dustImage = dustPass.getTextureNode('output');
  let occlusion = null;
  function getOcclusion() {
    if (occlusion === null) {
      occlusion = ao(depth, null, camera);
      occlusion.radius.value = 3; occlusion.thickness.value = 2; occlusion.samples.value = 16; occlusion.resolutionScale = .5;
    }
    return occlusion;
  }
  const aoStrength = uniform(.55);
  const indirect = createIndirectLighting(scenePass, camera, aoStrength);
  const clock = uniform(0), heat = uniform(1.6), mirage = uniform(.78), floor = uniform(0), groundHeat = uniform(1);
  const mirageScale = uniform(5), mirageNear = uniform(25);
  // Camera matrices are explicit: this graph is evaluated by the fullscreen
  // pass's orthographic camera, not by the scene camera.
  const inverse = uniform(camera.projectionMatrixInverse), worldMatrix = uniform(camera.matrixWorld);
  const view = getViewPosition(screenUV, depth, inverse).toVar();
  const world = worldMatrix.mul(vec4(view, 1)).xyz.toVar();
  // MSAA color includes partially covered terrain even when the resolved
  // depth sample is sky. Recover a neighboring distant depth for aerial
  // perspective at that edge, avoiding an unfogged brown horizon outline.
  const bufferSize = uniform(new Vector2(1, 1));
  let adjacentDepth = depth.r;
  for (const [x, y] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    adjacentDepth = adjacentDepth.min(depth.sample(screenUV.add(vec2(x, y).div(bufferSize)).clamp(0, 1)).r);
  }
  adjacentDepth = adjacentDepth.toVar();
  const adjacentView = getViewPosition(screenUV, adjacentDepth, inverse);
  const distantCoverage = isBackgroundDepth(depth.r).and(isBackgroundDepth(adjacentDepth).not()).and(adjacentView.z.negate().greaterThan(5000));
  const hazeDepth = distantCoverage.select(adjacentDepth, depth.r);
  const hazeView = getViewPosition(screenUV, hazeDepth, inverse).toVar();
  const hazeWorld = worldMatrix.mul(vec4(hazeView, 1)).xyz.toVar();
  const distance = view.length().toVar(), eye = worldMatrix.element(3).xyz.toVar();
  const viewRay = getViewPosition(screenUV, float(.5), inverse).normalize();
  const ray = worldMatrix.mul(vec4(viewRay, 0)).xyz.normalize().toVar(), eyeHeight = eye.y.sub(floor).max(.05).toVar();
  // Integrate the warm-air fraction along the sightline, rather than using
  // only the target's height. Even upper towers are seen through some hot air.
  // A shared air layer supplies the displacement on both sides of a distant
  // silhouette. Using each pixel's surface depth gave the sky and masonry
  // unrelated phases/amplitudes, tearing off strips of the roof and columns.
  const pathLength = float(1600), endHeight = eyeHeight.add(ray.y.mul(pathLength)).max(0).toVar();
  const heightChange = endHeight.sub(eyeHeight).toVar();
  const integral = exp(eyeHeight.div(-18)).sub(exp(endHeight.div(-18))).mul(18)
    .div(heightChange.abs().max(.001)).mul(heightChange.sign());
  const warmFraction = mix(exp(eyeHeight.add(endHeight).div(-36)), integral, heightChange.abs().smoothstep(.01, .1));
  const hotAir = warmFraction.mul(pathLength).div(650).clamp(0, 1).sqrt();
  const phase = clock.mul(1.4).toVar(), field = eye.add(ray.mul(pathLength)).xz.mul(.02).toVar();
  const wave = sin(field.x.add(phase.mul(.6)).add(sin(field.y.mul(1.31).sub(phase.mul(.4)))));
  const wave2 = sin(field.y.mul(1.73).sub(phase.mul(.75)).add(sin(field.x.mul(.73).add(phase))));
  const fineWave = sin(field.x.mul(2.1).add(field.y.mul(2.43)).sub(phase.mul(2.2)));
  const border = screenUV.min(screenUV.oneMinus());
  const edgeFade = border.x.min(border.y).smoothstep(0, .012);
  const distortion = vec2(wave.mul(.0028).add(fineWave.mul(.0006)), wave2.mul(.002).add(fineWave.mul(.0007)))
    .mul(hotAir).mul(heat).mul(edgeFade).toVar();
  const candidateUV = screenUV.add(distortion).clamp(0, 1);
  const candidateView = getViewPosition(candidateUV, depth.sample(candidateUV).r, inverse);
  // Distant silhouettes should waver too. Reject depth crossings only when
  // either side is nearby, preserving the rover and foreground rock edges.
  const foreground = view.z.negate().min(candidateView.z.negate()).smoothstep(40, 100);
  const sameSurface = mix(candidateView.z.sub(view.z).abs().smoothstep(1, 5).oneMinus(), 1, foreground).mul(foreground);
  const sampleUV = mix(screenUV, candidateUV, sameSurface);
  // Intersect the viewing ray with the hot-ground plane, then sample the
  // real planar Reflector capture. The grazing mask supplies the mirage band.
  const down = ray.y.negate().div(ray.xz.length().max(.0001));
  const groundMask = scenePass.getTextureNode('diffuse').a;
  const planeDistance = eye.y.sub(floor).div(ray.y.negate().max(.0001)).clamp(0, 200000);
  const planePoint = eye.add(ray.mul(planeDistance)).toVar();
  // Dry-air refractivity is approximately 77.6e-6 * pressure(hPa) / T(K).
  // A hot surface (80 C) under 30 C air admits turning rays only at grazing
  // angles: n(observer) cos(theta) >= n(surface), from stratified Snell's law.
  // This constrains a planar-capture approximation; it is not a curved-ray
  // scene intersection solver. No arbitrary vertical image compression.
  const thermalCells = sin(planePoint.x.mul(.009).add(sin(planePoint.z.mul(.013))).add(phase.mul(.07)));
  const surfaceTemperature = float(303.15).add(float(50).add(thermalCells.mul(8).mul(heat)).mul(groundHeat)).toVar();
  const observerTemperature = float(303.15).add(surfaceTemperature.sub(303.15).mul(eyeHeight.div(-.8).exp()));
  const surfaceIndex = float(.0786252).div(surfaceTemperature).add(1);
  const observerIndex = float(.0786252).div(observerTemperature).add(1);
  const criticalSlope = observerIndex.div(surfaceIndex).pow2().sub(1).max(0).sqrt().toVar();
  // Art direction: expand the thermal grazing band, rather than extrapolate
  // the color blend past 100%. Scale 1 restores the temperature-based cutoff.
  const bandSlope = criticalSlope.mul(mirageScale).max(.00001);
  const grazing = down.smoothstep(bandSlope.mul(.82), bandSlope.mul(1.05)).oneMinus()
    .mul(down.smoothstep(.00035, .0012));
  // Let the near edge approach without reflecting directly beneath the rover.
  // Grazing angle and level-ground masks still determine where it can appear.
  const farGround = smoothstep(mirageNear, mirageNear.mul(2.6), distance).mul(smoothstep(10000, 24000, distance).oneMinus());
  const levelGround = world.y.sub(floor).abs().smoothstep(2, 10).oneMinus();
  const projected = reflectedScene.project(planePoint);
  const reflectedRaw = projected.uv;
  const reflectedUV = reflectedRaw.clamp(.001, .999);
  const edge = reflectedRaw.min(reflectedRaw.oneMinus());
  const inFrame = edge.x.min(edge.y).smoothstep(.003, .025).mul(projected.facing);
  const mirageAmount = groundMask.mul(levelGround).mul(farGround).mul(grazing).mul(inFrame).mul(mirage).mul(reflectedScene.available);
  const vignette = uniform(.4), saturation = uniform(.95), contrast = uniform(1.06);
  const shade = screenUV.sub(.5).length().pow2().mul(vignette).oneMinus();
  function createBranch(ssgi) {
    const lit = ssgi ? indirect.color : beauty.rgb.mul(mix(1, getOcclusion(), aoStrength));
    const inverted = reflectedScene.sample(reflectedUV);
    const refracted = mix(atmosphere.applyHaze(lit, hazeView, hazeWorld, hazeDepth), inverted, mirageAmount);
    // Normal alpha blending into a clear target produces premultiplied RGB.
    // Keep fast particles outside temporal GI and the planar mirage capture.
    const dusty = refracted.mul(dustImage.a.oneMinus()).add(dustImage.rgb);
    const reflectionImage = rtt(vec4(dusty, 1), null, null, { depthBuffer: false });
    // Refract the complete image through one air field. Distorting only the
    // opaque scene left the reflection unnaturally steady at its boundary.
    // The existing depth guard keeps nearby tires and rock edges intact.
    const mirageImage = rtt(vec4(reflectionImage.sample(sampleUV).rgb, 1), null, null, { depthBuffer: false });
    const glow = bloom(mirageImage, .12, .55, 1.2);
    const mapped = renderOutput(vec4(mirageImage.rgb.add(glow.rgb).mul(shade), 1), renderer.toneMapping, renderer.outputColorSpace);
    const luminance = mapped.rgb.dot(vec3(.2126, .7152, .0722));
    const graded = mix(vec3(luminance), mapped.rgb, saturation).sub(.5).mul(contrast).add(.5);
    return { reflectionImage, mirageImage, glow, outputNode: vec4(graded.clamp(0, 1), 1) };
  }
  const branches = new Map([[true, createBranch(true)]]);
  let enabled = true, active = branches.get(true), settling = 8, lastView = null, lastLight = '', currentSettings;
  const pipeline = new RenderPipeline(renderer, active.outputNode); pipeline.outputColorTransform = false;
  const anchor = new Vector3();
  return { pipeline, scenePass, dustPass, indirect, reflectedScene, clock, heat, heatUV: sampleUV, mirage, groundHeat, mirageScale, mirageNear, aoStrength, vignette, saturation, contrast, mirageFrame: { anchor, floor },
    get occlusion() { return occlusion; }, get reflectionImage() { return active.reflectionImage; }, get mirageImage() { return active.mirageImage; }, get glow() { return active.glow; },
    get needsFrame() { return enabled && settling > 0; },
    requestFrames() { settling = 8; },
    invalidate() { indirect.reset(); settling = 8; },
    update(time, settings) {
      currentSettings = settings;
      renderer.getDrawingBufferSize(bufferSize.value);
      if (enabled !== settings.ssgi) {
        enabled = settings.ssgi;
        if (!branches.has(enabled)) branches.set(enabled, createBranch(enabled));
        active = branches.get(enabled); pipeline.outputNode = active.outputNode; pipeline.needsUpdate = true;
        indirect.reset(); settling = 8;
      }
      const light = `${settings.timeOfDay}/${settings.sun}/${settings.ambient}/${settings.relief}/${settings.giRadius}/${settings.cloudShadows}/${settings.clouds}/${settings.cloudDensity}`;
      if (lastView !== settings.view || lastLight !== light) { indirect.reset(); settling = 8; lastView = settings.view; lastLight = light; }
      indirect.strength.value = settings.gi; indirect.gi.radius.value = settings.giRadius;
      // Art-directed ground heating follows solar elevation. This is not a
      // weather simulation: real ground can retain heat after sunset.
      groundHeat.value = groundHeatAt(atmosphere.sun.position.y);
      clock.value = time; heat.value = settings.heat * groundHeat.value; mirage.value = settings.mirage * groundHeat.value; mirageScale.value = settings.mirageScale ?? 5;
      mirageNear.value = settings.mirageNear ?? 25;
      vignette.value = settings.vignette; saturation.value = settings.saturation; contrast.value = settings.contrast;
      aoStrength.value = settings.ao; active.glow.strength.value = settings.bloom;
      // Surrounding dunes must not lift the reflective plane out of the
      // distant playa. Heading changes never move the reflected city.
      anchor.copy(camera.position); anchor.y = miragePlaneHeight(anchor.x, anchor.z);
      floor.value = anchor.y;
    },
    async compile() {
      const tone = renderer.toneMapping, space = renderer.outputColorSpace;
      try { renderer.toneMapping = NoToneMapping; renderer.outputColorSpace = LinearSRGBColorSpace; await scenePass.compileAsync(renderer); }
      finally { renderer.toneMapping = tone; renderer.outputColorSpace = space; }
    },
    render() { reflectedScene.render(currentSettings, anchor); pipeline.render(); settling = Math.max(0, settling - 1); },
    dispose() { reflectedScene.dispose(); pipeline.dispose(); scenePass.dispose(); dustPass.dispose(); indirect.dispose(); if (occlusion !== null) occlusion.dispose(); for (const branch of branches.values()) { branch.reflectionImage.dispose(); branch.mirageImage.dispose(); branch.glow.dispose(); } }
  };
}
