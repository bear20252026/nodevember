import { LinearMipmapLinearFilter } from 'three/webgpu';
import { Fn, Loop, float, ivec2, rtt, textureSize, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import { WATER } from './water-optics.js';
import { waterPhase } from './water-column.js';

// Probability and apparent angular variance of particle scattering between
// two angles. A deflection at a uniformly distributed point of the path
// appears at a third of its mean square angle, split over two screen axes.
export function forwardConeMoments(maxAngle=.095,minAngle=0){
  const samples=512,step=(maxAngle-minAngle)/samples;
  let probability=0,secondMoment=0;
  for(let i=0;i<samples;i++){
    const angle=minAngle+(i+.5)*step;
    const weight=waterPhase(Math.cos(angle))*2*Math.PI*Math.sin(angle)*step;
    probability+=weight;
    secondMoment+=angle*angle*weight;
  }
  return {probability,angularVariance:secondMoment/(6*probability)};
}
// The particle phase function split into three forward lobes: the sharp
// cone near the view ray, a halo out to 20 degrees, and a broad glow to 90.
// Together they hold 96% of particle scattering; the rest heads backward.
export const FORWARD_LOBES=[[0,.095],[.095,.35],[.35,Math.PI/2]].map(([a,b])=>forwardConeMoments(b,a));
const luminance=vec3(.2126,.7152,.0722);

// Small-angle approximation to transport after reflection from a surface.
// The sharp beam is composed separately. Only the radiance redistributed by
// suspended particles enters these low-resolution convolution passes.
export function createCameraScattering(lit,viewRay,optics,camera,background=()=>vec3(0)){
  const [narrow,halo,glow]=FORWARD_LOBES,{probability,angularVariance}=narrow;
  const particles=vec3(...WATER.particles).mul(optics.density);
  const forwardCoefficient=particles.mul(probability);
  const forwardExtinction=optics.extinction.sub(forwardCoefficient);
  // Light whose deflections all fall within a lobe and the narrower ones
  // survives with exp(-(c - b P) d). Differences between nested lobes give
  // the energy that each lobe alone redistributes; they sum to the whole
  // forward-scattered budget, so no light is created or lost.
  const survives=(share,distance)=>optics.extinction.sub(particles.mul(share)).mul(distance).negate().exp();
  const shares=[probability,probability+halo.probability,probability+halo.probability+glow.probability];
  const projection=uniform(camera.projectionMatrix);
  const source=rtt(Fn(()=>{
    const {direction,geometry,boundary}=viewRay(uv());
    const valid=geometry.lessThan(1e4).and(geometry.lessThanEqual(boundary));
    const distance=geometry.min(120).toVar();
    // Sum paths with one or more small deflections. Longer or more turbid
    // paths redistribute more energy, with absorption on all paths.
    const scattered=forwardExtinction.mul(distance).negate().exp().sub(optics.transmittance(distance));
    // An opaque object also removes the water radiance from behind it. Spread
    // this signed change in radiance, including the contrast of dark blades.
    const contrast=lit.rgb.sub(background(direction,distance)).mul(scattered);
    return valid.select(vec4(contrast,contrast.abs().dot(luminance).div(distance.max(.001))),vec4(0));
  })(),null,null,{resolutionScale:.5,depthBuffer:false});

  function filter(input,axis,focalLength,variance=null,level=0,scale=.5){
    return rtt(Fn(()=>{
      const at=uv(),local=input.sample(at).level(level).toVar();
      let sigma;
      if(variance===null){
        const sourceRange=local.rgb.abs().dot(luminance).div(local.a.max(1e-8));
        const range=local.a.greaterThan(1e-8).select(sourceRange,24).clamp(.05,100);
        // Use the green band to set a shared spatial filter footprint.
        const opticalDepth=forwardCoefficient.g.mul(range);
        const orders=opticalDepth.max(.0001).div(opticalDepth.max(.0001).negate().exp().oneMinus());
        sigma=orders.mul(angularVariance).sqrt().mul(focalLength).mul(.5);
      }else{
        // Wide lobes are dominated by a single deflection at these ranges.
        sigma=float(Math.sqrt(variance)).mul(focalLength).mul(.5);
      }
      const sum=vec4(0).toVar(),total=float(0).toVar();
      Loop({start:-4,end:5,type:'int'},({i})=>{
        const offset=float(i).mul(.57);
        const sample=at.add(axis.mul(sigma).mul(offset));
        const weight=offset.pow2().mul(-.5).exp();
        if(variance===null){
          const within=sample.x.greaterThanEqual(0).and(sample.x.lessThanEqual(1))
            .and(sample.y.greaterThanEqual(0)).and(sample.y.lessThanEqual(1));
          sum.addAssign(within.select(input.sample(sample).level(level),vec4(0)).mul(weight));
        }else{
          // Broad lobes reach past the frame; continue the edge rather than
          // assume black water outside it.
          sum.addAssign(input.sample(sample.clamp(0,1)).level(level).mul(weight));
        }
        total.addAssign(weight);
      });
      return sum.div(total);
    })(),null,null,{resolutionScale:scale,depthBuffer:false});
  }
  const horizontal=filter(source,vec2(1,0),projection.element(0).x);
  const vertical=filter(horizontal,vec2(0,1),projection.element(1).y);

  // The narrow source stores each pixel's range implicitly: luminance over
  // alpha. Re-weight 4x4 blocks of it by the energy of a wider lobe relative
  // to the narrow one at that range, then blur at reduced resolution.
  function lobeSource(lower,upper,mipmaps=false){
    const options={resolutionScale:.125,depthBuffer:false};
    if(mipmaps)Object.assign(options,{generateMipmaps:true,minFilter:LinearMipmapLinearFilter});
    return rtt(Fn(()=>{
      const size=textureSize(source,0),origin=ivec2(uv().mul(vec2(size)).sub(2).floor());
      const sum=vec4(0).toVar();
      Loop({start:0,end:16,type:'int'},({i})=>{
        const texel=source.load(origin.add(ivec2(i.mod(4),i.div(4))).clamp(ivec2(0),ivec2(size).sub(1))).toVar();
        const brightness=texel.rgb.abs().dot(luminance);
        const distance=brightness.div(texel.a.max(1e-9)).clamp(.001,120);
        const narrowEnergy=survives(shares[0],distance).sub(optics.transmittance(distance)).max(1e-9);
        const ratio=survives(shares[upper],distance).sub(survives(shares[lower],distance)).div(narrowEnergy);
        const contrast=texel.rgb.mul(ratio);
        sum.addAssign(texel.a.greaterThan(0).select(vec4(contrast,contrast.abs().dot(luminance).div(distance)),vec4(0)));
      });
      return sum.div(16);
    })(),null,null,options);
  }
  const haloSource=lobeSource(0,1),glowSource=lobeSource(1,2,true);
  const haloHorizontal=filter(haloSource,vec2(1,0),projection.element(0).x,halo.angularVariance,0,.125);
  const haloVertical=filter(haloHorizontal,vec2(0,1),projection.element(1).y,halo.angularVariance,0,.125);
  const glowHorizontal=filter(glowSource,vec2(1,0),projection.element(0).x,glow.angularVariance,2,.03125);
  const glowVertical=filter(glowHorizontal,vec2(0,1),projection.element(1).y,glow.angularVariance,0,.03125);

  const receive=(texture,length)=>{
    const filtered=texture.sample(uv()).level(0).toVar();
    const inverseRange=filtered.a.div(filtered.rgb.abs().dot(luminance).max(1e-8));
    // A foreground object ends the receiving ray early. Scattering behind
    // that object cannot get to the camera along this direction.
    return filtered.rgb.mul(inverseRange.mul(length).clamp(0,1));
  };
  const received=length=>receive(vertical,length).add(receive(haloVertical,length)).add(receive(glowVertical,length));
  const targets=[[source,1],[horizontal,1],[vertical,1],[haloSource,.25],[haloHorizontal,.25],[haloVertical,.25],[glowSource,.25],[glowHorizontal,1/16],[glowVertical,1/16]];
  return {received,source,horizontal,vertical,halo:haloVertical,glow:glowVertical,lobes:FORWARD_LOBES,
    resize(pixelRatio){
      const base=Math.min(.5,.55/pixelRatio);
      for(const [target,scale] of targets)target.setResolutionScale(base*scale);
    },
    dispose(){for(const [target] of targets)target.dispose();}};
}
