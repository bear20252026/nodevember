import * as THREE from 'three/webgpu';
import { Fn, If, float, ivec2, mix, smoothstep, step, texture, uniform, vec2, vec3, vec4 } from 'three/tsl';
import { SunLight } from 'three/addons/lights/SunLight.js';
import { SunLightNode } from 'three/addons/lights/SunLightNode.js';
import { SunShadowNode } from 'three/addons/lights/SunShadowNode.js';
import { SUN, sunColor } from './water-optics.js';
import { bladePosition } from './blade-motion.js';

SunLight.registerNode(SunLightNode);

// Keep Three.js's atlas rendering, cascade fitting, texel snapping, blending
// and frame scheduling. Only substitute the lower-detail caster scene.
class ForestSunShadowNode extends SunShadowNode {
  constructor(light,scene){super(light);this.casterScene=scene;}
  updateShadow(frame){super.updateShadow({renderer:frame.renderer,scene:this.casterScene,camera:frame.camera});}
}

export function createSunlight(current,viewCamera){
  const size=4096,scene=new THREE.Scene(),light=new SunLight(sunColor(),1);
  const lightColor=new THREE.Color();
  const irradiance=uniform(lightColor).onRenderUpdate(()=>lightColor.copy(light.color).multiplyScalar(light.intensity));
  light.name='Underwater sun';light.position.copy(SUN);light.castShadow=true;
  const shadow=light.shadow;
  shadow.mapSize.setScalar(size);shadow.camera.far=75;shadow.bias=-.0001;
  shadow.normalBias=0;shadow.radius=2.1;shadow.intensity=.91;shadow.autoUpdate=true;
  // Deterministic PCF: four hardware-filtered taps on a rotated grid, about
  // as wide as the default filter. Three.js rotates its taps per pixel with
  // screen-space noise that expects temporal accumulation; without TAA that
  // noise stayed visible as fixed hatching across soft shadow edges.
  shadow.filterNode=Fn(({depthTexture,shadowCoord})=>{
    const step=vec2(shadow.radius*.5/depthTexture.image.width,shadow.radius*.5/depthTexture.image.height);
    const tap=(x,y)=>texture(depthTexture,shadowCoord.xy.add(step.mul(vec2(x,y)))).compare(shadowCoord.z);
    return tap(-1,-.35).add(tap(1,.35)).add(tap(-.35,1)).add(tap(.35,-1)).mul(.25);
  });
  const node=new ForestSunShadowNode(light,scene);shadow.shadowNode=node;
  const material=new THREE.MeshBasicNodeMaterial({color:0xffffff});material.positionNode=current.position;
  material.shadowSide=THREE.DoubleSide;
  const viewMatrix=uniform(viewCamera.matrixWorldInverse);
  const matrices=[0,1].map(i=>uniform('mat4').onRenderUpdate(()=>shadow.getMatrix(i)));
  const cascades=[0,1].map(i=>uniform('vec4').onRenderUpdate(()=>shadow._cascadeData[i]));
  // Sample the same atlas at each volumetric integration point. The main scene
  // compiles SunShadowNode before this function builds, and renders the atlas
  // before the water pass. This sampler never schedules an extra shadow render.
  const visibility=Fn(([p])=>{
    const depth=texture(shadow.map.depthTexture),viewDepth=viewMatrix.mul(vec4(p,1)).z.negate();
    const visible=float(1).toVar();
    for(let i=1;i>=0;i--){
      const cascade=cascades[i];
      If(viewDepth.greaterThanEqual(cascade.x).and(viewDepth.lessThan(cascade.y)),()=>{
        const projected=matrices[i].mul(vec4(p,1)),q=projected.xyz.div(projected.w);
        const uv=vec3(q.x,q.y.oneMinus(),q.z.add(shadow.bias));
        const inside=uv.x.greaterThanEqual(0).and(uv.x.lessThanEqual(1)).and(uv.y.greaterThanEqual(0)).and(uv.y.lessThanEqual(1)).and(uv.z.lessThanEqual(1));
        const value=inside.select(depth.sample(uv.xy).compare(uv.z),float(1));
        visible.assign(mix(value,visible,smoothstep(cascade.z,cascade.y,viewDepth)));
      });
    }
    return visible;
  });
  // The same cascades for compute shaders, which cannot use comparison
  // samplers: four texel loads reproduce the hardware's bilinear PCF.
  const visibilityLoad=Fn(([p])=>{
    const map=shadow.map,depth=texture(map.depthTexture),size=vec2(map.width,map.height);
    const viewDepth=viewMatrix.mul(vec4(p,1)).z.negate();
    const visible=float(1).toVar();
    for(let i=1;i>=0;i--){
      const cascade=cascades[i];
      If(viewDepth.greaterThanEqual(cascade.x).and(viewDepth.lessThan(cascade.y)),()=>{
        const projected=matrices[i].mul(vec4(p,1)),q=projected.xyz.div(projected.w);
        const uv=vec2(q.x,q.y.oneMinus()),reference=q.z.add(shadow.bias);
        const inside=uv.x.greaterThanEqual(0).and(uv.x.lessThanEqual(1)).and(uv.y.greaterThanEqual(0)).and(uv.y.lessThanEqual(1)).and(reference.lessThanEqual(1));
        const texel=uv.mul(size).sub(.5),base=texel.floor(),f=texel.sub(base);
        const lit=(x,y)=>step(reference,depth.load(ivec2(base.add(vec2(x,y)).clamp(vec2(0),size.sub(1)))).x);
        const value=mix(mix(lit(0,0),lit(1,0),f.x),mix(lit(0,1),lit(1,1),f.x),f.y);
        visible.assign(mix(inside.select(value,float(1)),visible,smoothstep(cascade.z,cascade.y,viewDepth)));
      });
    }
    return visible;
  });
  function setForest(forest,simulation){
    const variants=new Map();
    for(const object of forest.shadowMeshes){
      const binding=object.userData.blades;
      if(!variants.has(binding)){
        const shadowMaterial=material.clone();
        shadowMaterial.positionNode=bladePosition(current,simulation,binding,false);
        variants.set(binding,shadowMaterial);
      }
      const clone=new THREE.InstancedMesh(object.geometry,variants.get(binding),object.count);
      clone.instanceMatrix=object.instanceMatrix;clone.frustumCulled=false;clone.castShadow=true;scene.add(clone);
    }
    scene.updateMatrixWorld(true);
    forest.group.traverse(object=>{if(object.isMesh)object.receiveShadow=true;});
  }
  return {light,node,scene,size,irradiance,visibility,visibilityLoad,setForest,get target(){return shadow.map;},
    dispose(){light.dispose();material.dispose();}};
}
