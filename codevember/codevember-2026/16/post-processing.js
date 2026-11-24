import * as THREE from 'three/webgpu';
import { Fn, Loop, float, mix, mrt, output, pass, perspectiveDepthToViewZ, rtt, screenUV, uniform, uv, vec2, vec3, vec4, velocity } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { traa } from 'three/addons/tsl/display/TRAANode.js';
import { createDiffusion } from './diffusion.js';
import { SporeRasterNode } from './spore-raster.js';
import { createToneMapping } from './tone-mapping.js';
export function createPostProcessing(renderer,scene,camera,spores,materials,displayOutput){
  const useTemporal=renderer.backend.device.limits.maxColorAttachmentBytesPerSample>=32;
  const scenePass=pass(scene,camera,{samples:useTemporal?0:4});
  scenePass.setMRT(mrt({output,scatter:vec4(0),tissue:vec4(0),...(useTemporal?{velocity}:{})}));
  scenePass.getTexture('tissue').type=THREE.UnsignedByteType;
  if(useTemporal)scenePass.getTexture('velocity').format=THREE.RGFormat;
  const beauty=scenePass.getTextureNode('output');
  const focus=spores.focus,aperture=uniform(5),inverseSize=uniform(new THREE.Vector2()),blurSize=uniform(new THREE.Vector2());
  const depth=scenePass.getTextureNode('depth');
  const depthAt=at=>perspectiveDepthToViewZ(depth.sample(at),camera.near,camera.far).negate();
  const tissue=scenePass.getTextureNode('tissue'),scatter=scenePass.getTextureNode('scatter');
  const diffusion=createDiffusion(scatter,tissue,depthAt,camera);
  const diffused=diffusion.filtered;
  const valid=diffused.a.sub(tissue.a).abs().lessThan(.005);
  const strength=materials.sss.mul(.85).clamp(0,1).mul(valid);
  const transported=beauty.rgb.add(diffused.rgb.sub(scatter.rgb).mul(tissue.rgb).mul(strength)).max(0);
  const lit=rtt(vec4(transported,1),null,null,{depthBuffer:false});
  const distance=depthAt(screenUV).sub(focus).abs().sub(.65).max(0);
  const gather=Fn(()=>{
    const at=uv(),z=depthAt(at),coc=z.sub(focus).abs().sub(.65).max(0).smoothstep(0,1.3);
    const total=lit.sample(at).rgb.toVar(),weight=float(1).toVar();
    Loop(24,({i})=>{
      const angle=float(i).mul(2.399963),radius=float(i).add(.5).div(24).sqrt();
      const tap=at.add(vec2(angle.cos(),angle.sin()).mul(radius).mul(coc).mul(aperture).mul(inverseSize));
      const tz=depthAt(tap);
      const w=tz.sub(z).abs().smoothstep(.2,.8).oneMinus();
      total.addAssign(lit.sample(tap).rgb.mul(w));weight.addAssign(w);
    });
    return vec4(total.div(weight),z);
  });
  const blurred=rtt(gather(),null,null,{resolutionScale:.5,depthBuffer:false});
  // Resolve the low-resolution blur only across matching depth. A linear
  // upscale mixes unrelated foreground and background at leaf/cap silhouettes.
  const resolveBlur=Fn(()=>{
    const pixel=screenUV.mul(blurSize).sub(.5),base=pixel.floor(),fraction=pixel.fract();
    const z=depthAt(screenUV),tolerance=z.mul(.025).max(.025);
    const total=vec3(0).toVar(),weight=float(0).toVar();
    Loop(4,({i})=>{
      const offset=vec2(i.mod(2),i.div(2).floor());
      const at=base.add(offset).add(.5).div(blurSize);
      const sample=blurred.sample(at);
      const spatial=mix(fraction.oneMinus(),fraction,offset);
      const w=spatial.x.mul(spatial.y).mul(sample.a.sub(z).abs().div(tolerance).negate().exp());
      total.addAssign(sample.rgb.mul(w));weight.addAssign(w);
    });
    return total.add(lit.rgb.mul(weight.clamp().oneMinus()));
  });
  const defocused=rtt(vec4(mix(lit.rgb,resolveBlur(),distance.smoothstep(0,.9)),1),null,null,{depthBuffer:false});
  // Color and depth now share the same scene jitter. TRAA also stabilizes the
  // depth-of-field edges, instead of blurring an already unjittered image.
  const temporal=useTemporal?traa(defocused,depth,scenePass.getTextureNode('velocity'),camera):null;
  const opaque=temporal?temporal.getTextureNode().rgb:defocused.rgb;
  const particleScene=new THREE.Scene();particleScene.add(spores.mesh);
  spores.points.visible=false;
  const sporeRaster=new SporeRasterNode(spores,scenePass,camera);
  spores.setDepth(perspectiveDepthToViewZ(depth.sample(screenUV),camera.near,camera.far));
  const particlePass=pass(particleScene,camera,{samples:0,depthBuffer:false});
  // Broad lens footprints tolerate a smaller target. Sharp spore cores still
  // accumulate at the full selected DPR in the compute rasterizer.
  particlePass.setResolutionScale(.5);
  const combined=rtt(vec4(opaque.add(particlePass.getTextureNode('output').rgb).add(sporeRaster),1),null,null,{depthBuffer:false});
  const glow=bloom(combined,.30,.45,.65);
  const vignette=screenUV.sub(.5).length().smoothstep(.3,.78).mul(.30).oneMinus();
  const pipeline=new THREE.RenderPipeline(renderer);
  const tone=createToneMapping();
  // Grade and map once, after light transport, bloom, and particle composition.
  // RenderPipeline then applies the sRGB transfer function, including values > 1.
  const radiance=combined.rgb.add(glow.rgb).mul(vignette);
  pipeline.outputNode=vec4(tone.apply(radiance),1);
  return {pipeline,scenePass,particlePass,particleScene,sporeRaster,temporal,glow,aperture,diffusion,tone,radiance,
    render(){tone.exposure.value=renderer.toneMappingExposure;tone.headroom.value=displayOutput.headroom;renderer.getDrawingBufferSize(inverseSize.value);blurSize.value.set(Math.floor(inverseSize.value.x*.5),Math.floor(inverseSize.value.y*.5));inverseSize.value.set(1/inverseSize.value.x,1/inverseSize.value.y);aperture.value=5*renderer.getPixelRatio();diffusion.update();pipeline.render();},
    dispose(){pipeline.dispose();scenePass.dispose();particlePass.dispose();sporeRaster.dispose();temporal?.dispose();diffusion.dispose();lit.dispose();blurred.dispose();defocused.dispose();combined.dispose();glow.dispose();}};
}
