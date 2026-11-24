import { RenderPipeline } from "three/webgpu";
import {
  pass,
  mrt,
  output,
  normalView,
  vec4,
  screenUV,
  uniform,
  mix,
  renderOutput,
  rtt,
} from "three/tsl";
import { ao } from "three/addons/tsl/display/GTAONode.js";
import { denoise } from "three/addons/tsl/display/DenoiseNode.js";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { smaa } from "three/addons/tsl/display/SMAANode.js";
import { dof } from "three/addons/tsl/display/DepthOfFieldNode.js";
import { createColorGrading } from "./color-grading.js";

export function createPostProcessing(renderer, scene, camera, dustScene) {
  const scenePass = pass(scene, camera);
  scenePass.setMRT(mrt({ output, normal: normalView }));
  const beauty = scenePass.getTextureNode("output");
  const depth = scenePass.getTextureNode("depth"),
    normals = scenePass.getTextureNode("normal");
  const occlusion = ao(depth, normals, camera);
  occlusion.radius.value = 0.22;
  occlusion.thickness.value = 0.32;
  occlusion.samples.value = 16;
  occlusion.resolutionScale = 0.5;
  const smooth = denoise(occlusion.getTextureNode(), {
    depth,
    normal: normals,
    camera,
  });
  const strength = uniform(0.65),
    vignette = uniform(0.55);
  const grading = createColorGrading();
  const lit = beauty.rgb.mul(mix(1, smooth.r, strength));
  const focus = uniform(6),
    focusRange = uniform(1.7),
    lensBlur = uniform(1.4);
  const lens = dof(
    vec4(lit, 1),
    scenePass.getViewZNode(),
    focus,
    focusRange,
    lensBlur,
  );
  const dustPass = pass(dustScene, camera);
  const composite = rtt(
    vec4(lens.rgb.add(dustPass.getTextureNode().rgb), 1),
    null,
    null,
    { depthBuffer: false },
  );
  const glow = bloom(composite, 0.18, 0.35, 1.1);
  const shade = screenUV.sub(0.5).length().pow2().mul(vignette).oneMinus();
  const mapped = renderOutput(
    vec4(composite.rgb.add(glow.rgb).mul(shade), 1),
    renderer.toneMapping,
    renderer.outputColorSpace,
  );
  const rgb = grading.apply(mapped.rgb);
  const pipeline = new RenderPipeline(renderer, smaa(vec4(rgb.max(0), 1)));
  pipeline.outputColorTransform = false;
  return {
    pipeline,
    scenePass,
    dustDepth: scenePass.getViewZNode(),
    particlesPass: dustPass,
    vignette,
    grading,
    glow,
    focus,
    focusRange,
    lensBlur,
    render() {
      pipeline.render();
    },
    dispose() {
      pipeline.dispose();
      dustPass.dispose();
      composite.dispose();
      lens.dispose();
      scenePass.dispose();
      occlusion.dispose();
      smooth.dispose();
      glow.dispose();
    },
  };
}
