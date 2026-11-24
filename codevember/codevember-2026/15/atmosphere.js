import { Vector3, Quaternion, Scene, CubeCamera, CubeRenderTarget, HalfFloatType, LinearFilter, NoToneMapping, LinearSRGBColorSpace } from 'three/webgpu';
import { SkyMesh } from './vendor/CloudShadowSkyMesh.js';
import { createCloudShadows } from './cloud-shadows.js';
import { SunLight } from 'three/addons/lights/SunLight.js';
import { MirageSunLightShadow } from './vendor/MirageSunLightShadow.js';
import { MirageSunLightNode } from './vendor/MirageSunLightNode.js';
import { aerosolState, sunlightTransmission, RAYLEIGH, RAYLEIGH_HEIGHT, AEROSOL_HEIGHT } from './atmosphere-model.js';
import { uniform, vec2, vec3, exp, mix, float, cubeTexture, pass, screenUV, isBackgroundDepth } from 'three/tsl';

SunLight.registerNode(MirageSunLightNode);

export function createAtmosphere(scene, camera, renderer) {
  // One direction controls direct lighting, shadows and the visible solar disc.
  const direction = new Vector3(-.62, .56, .55).normalize();
  const sky = new SkyMesh(); sky.name = 'Desert sky and drifting clouds'; sky.scale.setScalar(12000);
  sky.sunPosition.value.copy(direction); sky.turbidity.value = 7.2; sky.rayleigh.value = 1.8;
  sky.mieCoefficient.value = .008; sky.mieDirectionalG.value = .82;
  sky.cloudCoverage.value = .43; sky.cloudDensity.value = .6; sky.cloudElevation.value = .9;
  sky.cloudSpeed.value = .000006; sky.cloudScale.value = .00036;
  const cloudPhase = uniform(0);
  sky.cloudTime = uniform(0);
  // SkyMesh's default horizon fade ends within about one degree. Through
  // this dusty landscape, low clouds lose contrast over a much longer path.
  const cloudCoverage = sky.cloudCoverage, cloudDensity = sky.cloudDensity;
  const cloudAltitude = sky.cloudViewDirection.y;
  const cloudVisibility = cloudAltitude.smoothstep(.025, .24);
  sky.cloudCoverage = cloudCoverage.mul(cloudVisibility.sqrt());
  sky.cloudDensity = cloudDensity.mul(cloudVisibility);
  const skyEnergy = uniform(.1);
  const radiance = node => { const energy = node.mul(skyEnergy); return energy.div(energy.mul(.18).add(1)); };
  sky.material.colorNode = mix(radiance(sky.material.colorNode), sky.material.colorNode, sky.cloudShadowCapture);
  // Fog samples clear atmospheric radiance. Keep clouds out of this cube so
  // their shapes never appear painted onto distant ground or mountain faces.
  const clearSky = new SkyMesh(); clearSky.scale.setScalar(12000);
  for (const name of ['sunPosition', 'turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) clearSky[name] = sky[name];
  clearSky.cloudCoverage = float(0); clearSky.showSunDisc.value = false;
  clearSky.material.colorNode = radiance(clearSky.material.colorNode);
  const clearScene = new Scene(); clearScene.add(clearSky);
  const skyCube = new CubeRenderTarget(128, { type: HalfFloatType, depthBuffer: false, minFilter: LinearFilter, generateMipmaps: false });
  skyCube.texture.name = 'Clear atmosphere / fog';
  const skyCamera = new CubeCamera(1, 20000, skyCube);
  const skyScene = new Scene(); skyScene.add(sky);
  // Capture the visible sky itself, including its cloud field and horizon
  // fade. WebGPU's environment node generates/caches PMREM from this cube.
  const environmentCube = new CubeRenderTarget(256, { type: HalfFloatType, depthBuffer: false, minFilter: LinearFilter, generateMipmaps: false });
  environmentCube.texture.name = 'Sky and clouds / IBL';
  const environmentCamera = new CubeCamera(1, 20000, environmentCube);
  scene.environment = environmentCube.texture;
  let skyKey = '', environmentKey = '', environmentTime = -Infinity;
  const environmentEye = new Vector3(Infinity, Infinity, Infinity);
  const skyPass = pass(skyScene, camera, { samples: 0 }); skyPass.setResolutionScale(.5);
  const skyColor = skyPass.getTextureNode('output').sample(screenUV).rgb;
  const horizon = uniform(.5), horizonPoint = new Vector3(), horizonDirection = new Vector3();
  const horizonColor = skyPass.getTextureNode('output').sample(vec2(screenUV.x, horizon)).rgb;
  scene.backgroundNode = skyColor;
  const sun = new SunLight(0xffffff, 4.3); sun.position.copy(direction);
  const cloudShadows = createCloudShadows(renderer, sky, skyScene, camera, sun);
  sun.cloudShadowNode = cloudShadows.node;
  sun.shadow.dispose(); sun.shadow = new MirageSunLightShadow();
  // Two horizontal tiles must fit the device's texture limit (8192 here).
  // Use spare atlas height for 25% more samples without enlarging its width.
  const maxMap = renderer.backend.device.limits.maxTextureDimension2D;
  sun.castShadow = true; sun.shadow.mapSize.set(Math.min(4096, maxMap / 2), Math.min(5120, maxMap));
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 1500;
  // MirageSunLightNode applies a slope/texel-sized bias per cascade.
  sun.shadow.normalBias = 0; sun.shadow.bias = 0;
  sun.shadow.autoUpdate = false; sun.shadow.needsUpdate = true;
  const shadowEye = new Vector3(Infinity, Infinity, Infinity), shadowRotation = new Quaternion(), shadowSun = new Vector3();
  scene.add(sun); sun.layers.enable(1);
  const haze = uniform(.0003), rayleigh = uniform(1.8), aerosol = uniform(new Vector3()), eyePosition = uniform(camera.position);
  function opticalLength(start, end, distance, height) {
    const difference = end.sub(start);
    const integral = exp(start.div(-height)).sub(exp(end.div(-height))).mul(height).div(difference.abs().max(.001)).mul(difference.sign());
    const level = exp(start.add(end).mul(-.5 / height));
    return mix(level, integral, difference.abs().smoothstep(.01, .1)).mul(distance);
  }
  function applyHaze(color, view, world, depth, eye = eyePosition) {
    const surface = isBackgroundDepth(depth).select(0, 1);
    const distance = view.length();
    const start = eye.y.abs(), end = world.y.max(0);
    const molecular = opticalLength(start, end, distance, RAYLEIGH_HEIGHT).mul(rayleigh);
    const airborne = aerosol.mul(opticalLength(start, end, distance, AEROSOL_HEIGHT));
    // Saltating sand is confined near the ground, separately from the fine
    // aerosols suspended throughout the lower atmosphere.
    const lowDust = opticalLength(start, end, distance, 12).mul(haze.mul(.8));
    const extinction = vec3(...RAYLEIGH).mul(molecular).add(airborne).add(lowDust);
    const transmission = extinction.mul(surface).negate().exp();
    const air = cubeTexture(skyCube.texture, world.sub(eye).normalize()).rgb;
    return color.mul(transmission).add(air.mul(transmission.oneMinus()));
  }
  return { sky, skyPass, sun, skyCube, environmentCube, cloudShadows, cloudPhase, haze, aerosol, direction: sun.position, horizonColor,
    applyHaze,
    update(settings, time = 0) {
      const cloudTime = time + cloudPhase.value;
      sky.cloudTime.value = cloudTime;
      sky.position.copy(camera.position);
      sky.cloudOrigin.value.set(camera.position.x, camera.position.z);
      sky.sunPosition.value.copy(sun.position).normalize();
      if (shadowSun.distanceToSquared(sky.sunPosition.value) > 1e-10) { shadowSun.copy(sky.sunPosition.value); sun.shadow.needsUpdate = true; }
      camera.getWorldDirection(horizonDirection); horizonDirection.y = 0; horizonDirection.normalize();
      horizonPoint.copy(camera.position).addScaledVector(horizonDirection, 10000).project(camera);
      horizon.value = Math.max(.01, Math.min(.99, .5 - horizonPoint.y * .5));
      const air = aerosolState(settings);
      sky.turbidity.value = air.turbidity; sky.rayleigh.value = settings.rayleigh; sky.mieCoefficient.value = settings.mie;
      aerosol.value.fromArray(air.extinction);
      cloudDensity.value = settings.cloudDensity; sky.cloudElevation.value = settings.cloudElevation; sky.cloudScale.value = settings.cloudScale;
      haze.value = settings.haze; rayleigh.value = settings.rayleigh; cloudCoverage.value = settings.clouds;
      sun.intensity = settings.sun; scene.environmentIntensity = settings.ambient; skyEnergy.value = settings.sun * (.1 / 4.3);
      // Aerosols scatter light into the halo and out of the direct beam.
      // Do not brighten the sun independently as the air gets dustier.
      sun.color.fromArray(sunlightTransmission(sky.sunPosition.value.y, settings.rayleigh, air.extinction));
      const key = `${sky.sunPosition.value.toArray()}/${air.turbidity}/${settings.rayleigh}/${settings.mie}/${settings.sun}`;
      if (key !== skyKey) {
        const tone = renderer.toneMapping, space = renderer.outputColorSpace;
        try { renderer.toneMapping = NoToneMapping; renderer.outputColorSpace = LinearSRGBColorSpace; skyCamera.update(renderer, clearScene); skyKey = key; }
        finally { renderer.toneMapping = tone; renderer.outputColorSpace = space; }
      }
      const cloudKey = `${key}/${settings.clouds}/${settings.cloudDensity}/${settings.cloudElevation}/${settings.cloudScale}/${sky.cloudSpeed.value}/${cloudPhase.value}`;
      const movingClouds = settings.clouds > 0 && settings.cloudDensity > 0 && sky.cloudSpeed.value !== 0;
      // Drift is slow: refresh at two-second simulation intervals rather than
      // regenerating six faces and PMREM every frame. Setting edits are immediate.
      if (cloudKey !== environmentKey || cloudTime < environmentTime || camera.position.distanceToSquared(environmentEye) > 16384 || (movingClouds && cloudTime - environmentTime >= 2)) {
        const tone = renderer.toneMapping, space = renderer.outputColorSpace, disc = sky.showSunDisc.value;
        try {
          renderer.toneMapping = NoToneMapping; renderer.outputColorSpace = LinearSRGBColorSpace;
          // Direct sun comes from SunLight; including its disc in IBL would
          // add a second, unshadowed solar contribution to polished surfaces.
          sky.showSunDisc.value = false;
          environmentCamera.position.copy(camera.position);
          environmentCamera.update(renderer, skyScene);
          environmentKey = cloudKey; environmentTime = cloudTime; environmentEye.copy(camera.position);
        } finally { sky.showSunDisc.value = disc; renderer.toneMapping = tone; renderer.outputColorSpace = space; }
      }
      cloudShadows.update(settings, cloudTime);
      const splitLambda = settings.view === 'Rover' ? .95 : settings.view === 'Stone' || settings.view === 'Outcrop' ? .8 : .5;
      if (sun.shadow.splitLambda !== splitLambda) { sun.shadow.splitLambda = splitLambda; sun.shadow.needsUpdate = true; }
      const shadowRange = settings.view === 'Rover' ? 900 : settings.view === 'Stone' || settings.view === 'Outcrop' ? 350 : settings.view === 'Sanctuary' ? 700 : 1500;
      if (sun.shadow.camera.far !== shadowRange) { sun.shadow.camera.far = shadowRange; sun.shadow.needsUpdate = true; }
      // Static casters can reuse fitted cascade maps between meaningful
      // camera changes. Keep both maps together so the transition stays valid.
      if (camera.position.distanceToSquared(shadowEye) > 64 || camera.quaternion.angleTo(shadowRotation) > .02) {
        sun.shadow.needsUpdate = true; shadowEye.copy(camera.position); shadowRotation.copy(camera.quaternion);
      }
    },
    dispose() { scene.remove(sun); skyScene.remove(sky); clearScene.remove(clearSky); scene.backgroundNode = null; scene.environment = null; skyCube.dispose(); environmentCube.dispose(); cloudShadows.dispose(); clearSky.dispose(); skyPass.dispose(); sky.dispose(); sun.dispose(); }
  };
}
