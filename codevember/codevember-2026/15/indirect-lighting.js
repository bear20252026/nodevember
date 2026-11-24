import { UnsignedByteType, RGFormat } from 'three/webgpu';
import { mrt, output, diffuseColor, normalView, velocity, packNormalToRGB, unpackRGBToNormal, sample, vec4, rtt, uniform, mix } from 'three/tsl';
import { ssgi } from 'three/addons/tsl/display/SSGINode.js';
import { temporalDenoise } from 'three/addons/tsl/display/DenoiseNode.js';

export function createIndirectLighting(scenePass, camera, aoStrength) {
  // Diffuse alpha is a terrain mask, avoiding another G-buffer attachment.
  // Only the sand material overrides it, with a slope-aware playa mask.
  scenePass.setMRT(mrt({ output, diffuse: vec4(diffuseColor.rgb, 0), normal: packNormalToRGB(normalView), velocity }));
  scenePass.getTexture('diffuse').type = UnsignedByteType;
  scenePass.getTexture('normal').type = UnsignedByteType;
  scenePass.getTexture('velocity').format = RGFormat;
  const beauty = scenePass.getTextureNode('output'), depth = scenePass.getTextureNode('depth');
  const diffuse = scenePass.getTextureNode('diffuse'), packed = scenePass.getTextureNode('normal');
  const normals = sample(uv => unpackRGBToNormal(packed.sample(uv)));
  const gi = ssgi(beauty, depth, normals, camera);
  gi.resolutionScale = .5; gi.sliceCount.value = 2; gi.stepCount.value = 8;
  gi.radius.value = 18; gi.thickness.value = 2.5; gi.useScreenSpaceSampling.value = false;
  gi.giIntensity.value = 1; gi.aoIntensity.value = 1.6; gi.backfaceLighting.value = 0;
  const input = rtt(vec4(gi.getGINode().rgb, gi.getAONode().r), null, null, { resolutionScale: .5, depthBuffer: false });
  // Filter the indirect signal, not the final image: no camera jitter and no
  // temporal smearing of moving clouds or the heat-refraction pass.
  const filtered = temporalDenoise(input, { depth, normal: normals, camera, velocity: scenePass.getTextureNode('velocity'), alpha: true, quality: 'fast' });
  filtered.maxFrames.value = 8;
  const result = filtered.getTextureNode(), strength = uniform(4);
  const color = beauty.rgb.mul(mix(1, result.a.clamp(0, 1), aoStrength)).add(diffuse.rgb.mul(result.rgb.max(0)).mul(strength));
  return { gi, input, filtered, result, strength, normals, color,
    reset() { filtered.reset(); },
    dispose() { filtered.dispose(); input.dispose(); gi.dispose(); }
  };
}
