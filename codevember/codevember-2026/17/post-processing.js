import { pass,renderOutput,rtt,screenUV,uniform,vec3,vec4 } from 'three/tsl';
import { HalfFloatType, RenderPipeline } from 'three/webgpu';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { createWater } from './water.js';
import { createMarineSnow } from './marine-snow.js';
import { filmicHDR } from './display-transform.js';

export function createPostProcessing(renderer,scene,camera,sunlight,caustics,optics,current,displayOutput=null) {
  const scenePass=pass(scene,camera,{samples:0});
  const lit=scenePass.getTextureNode('output'),depth=scenePass.getTextureNode('depth');
  const water=createWater(lit,depth,camera,sunlight,caustics,optics),exposure=uniform(.65),adaptation=uniform(1);
  // Marine snow in its own pass after the water, attenuated by its own
  // distance and hidden behind the scene's surfaces (marine-snow.js).
  const snow=current?createMarineSnow({camera,current,sunlight,caustics,optics,depth}):null;
  const snowPass=snow?pass(snow.scene,camera,{samples:0,depthBuffer:false}):null;
  const inWater=snowPass?water.result.add(snowPass.getTextureNode('output').rgb):water.result;
  const underwater=rtt(vec4(inWater,1),null,null,{depthBuffer:false});
  // Color grading controls; zero temperature and tint, unit saturation,
  // contrast and vignette reproduce the fitted look. The defaults warm it a
  // little, add contrast and double the vignette (settings.js matches).
  const grading={temperature:uniform(.35),tint:uniform(0),saturation:uniform(1),contrast:uniform(1.15),vignette:uniform(2)};
  const vignette=screenUV.sub(.5).length().smoothstep(.25,.8).mul(grading.vignette.mul(.25)).oneMinus();
  // Fixed dive-camera white balance, applied after both paths through water.
  // A slightly brighter, greener balance than the footage fit gives the
  // turquoise water and chartreuse kelp of the close-up references.
  // Temperature trades red against blue and tint shifts green, around it.
  const balance=vec3(2.68,1.26,1.08).mul(vec3(grading.temperature.mul(.5).exp(),grading.tint.mul(.3).exp(),grading.temperature.mul(-.5).exp()));
  const radiance=inWater.mul(exposure).mul(adaptation).mul(vignette).mul(balance);
  // The filmic curve and display-space grade, with HDR highlight headroom
  // on HDR displays (display-transform.js, display-output.js). The target
  // holds sRGB-encoded values; half float keeps those above white for FXAA.
  const headroom=uniform(1);
  const graded=filmicHDR(radiance,grading.saturation,grading.contrast,headroom,exposure);
  const display=rtt(renderOutput(vec4(graded,1)),null,null,{depthBuffer:false,type:HalfFloatType});
  const pipeline=new RenderPipeline(renderer,fxaa(display));
  pipeline.outputColorTransform=false;
  return {pipeline,scenePass,water,snow,exposure,adaptation,grading,headroom,
    renderHDR(){underwater.updateBefore({renderer});return underwater.renderTarget;},
    render(){headroom.value=displayOutput?displayOutput.headroom:1;pipeline.render();}};
}
