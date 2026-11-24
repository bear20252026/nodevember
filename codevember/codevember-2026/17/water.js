import { ClampToEdgeWrapping, HalfFloatType, LinearFilter, Node, NodeUpdateType, RepeatWrapping, StorageTexture, Vector3, Vector4 } from 'three/webgpu';
import { Fn, If, Loop, atan, float, getViewPosition, instanceIndex, mix, texture, textureStore, uniform, uv, uvec2, vec2, vec3, vec4 } from 'three/tsl';
import { SUN, SURFACE, WATER } from './water-optics.js';
import { createWaterColumn } from './water-column.js';
import { createOceanSurface } from './ocean-surface.js';
import { createCameraScattering } from './camera-scattering.js';

// Runs a task when the graph that references it renders, after the nodes
// built before it (here: the scene pass and its shadow cascades).
class RenderTask extends Node {
  constructor(task){super('float');this.task=task;this.updateBeforeType=NodeUpdateType.RENDER;}
  updateBefore({renderer}){this.task(renderer);}
  generate(){return '0.0';}
}

export function createWater(lit,depth,camera,sunlight,caustics,optics){
  const {density,extinction,transmittance}=optics;
  const rays=uniform(1),projection=uniform(camera.projectionMatrixInverse),world=uniform(camera.matrixWorld);
  const pixelAngle=uniform(.001);
  const column=createWaterColumn();
  const cameraPosition=world.element(3).xyz;
  const cameraDepth=float(SURFACE).sub(cameraPosition.y).max(0);

  function viewRay(at){
    const bufferDepth=depth.sample(at).r;
    const view=getViewPosition(at,bufferDepth,projection).toVar();
    const direction=world.mul(vec4(view.normalize(),0)).xyz.toVar();
    const boundary=cameraDepth.div(direction.y.max(.00001));
    const geometry=bufferDepth.lessThan(1).select(view.length(),1e5);
    return {direction,boundary,geometry};
  }

  // The characteristic relation cancels the radiance arriving from beyond
  // the endpoint. Both terms come from the same solved diffuse light field.
  const field=texture(column.map);
  const sampleDiffuse=Fn(([direction,depthInMetres])=>{
    const angleUV=direction.y.mul(.5).add(.5);
    const depthUV=depthInMetres.mul(density).div(column.spacing).add(.5).div(column.height);
    return field.sample(vec2(angleUV,depthUV)).level(0).rgb;
  });
  const surface=createOceanSurface(caustics.waves,direction=>density.greaterThan(0).select(sampleDiffuse(direction,float(0)),vec3(0)),pixelAngle,caustics.time);
  const forward=createCameraScattering(lit,viewRay,optics,camera,
    (direction,distance)=>sampleDiffuse(direction,cameraDepth.sub(direction.y.mul(distance)).max(0)));
  const diffuse=Fn(([direction,length])=>{
    const endpointDepth=cameraDepth.sub(direction.y.mul(length)).max(0);
    const incoming=sampleDiffuse(direction,cameraDepth);
    const beyond=sampleDiffuse(direction,endpointDepth).mul(transmittance(length));
    return incoming.sub(beyond).max(0);
  });

  const scatterCoefficient=Fn(([direction])=>{
    const cosTheta=direction.dot(vec3(SUN)).clamp(-1,1);
    const hg=g=>float(1-g*g).div(float(1+g*g).sub(cosTheta.mul(2*g)).pow(1.5).mul(4*Math.PI));
    const front=mix(hg(WATER.forward),hg(WATER.broad),WATER.broadWeight);
    const phase=mix(front,hg(WATER.backward),WATER.backwardWeight);
    const molecularPhase=cosTheta.pow2().add(1).mul(3/(16*Math.PI));
    return vec3(...WATER.molecules).mul(molecularPhase).add(vec3(...WATER.particles).mul(phase)).mul(density);
  });
  const solarSlope=direction=>extinction.mul(float(1).sub(direction.y.div(SUN.y)));
  const clearSolarIntegral=Fn(([direction,length])=>{
    const opticalLength=solarSlope(direction).mul(length);
    const average=x=>{
      const small=x.abs().lessThan(.002);
      const exact=x.negate().exp().oneMinus().div(small.select(1,x));
      return small.select(x.mul(x.div(6).sub(.5)).add(1),exact);
    };
    return vec3(average(opticalLength.r),average(opticalLength.g),average(opticalLength.b))
      .mul(length).mul(transmittance(cameraDepth.div(SUN.y)));
  });

  // Sun shafts are caustic filaments and canopy shadows stretched along the
  // refracted solar ray. Seen from the camera, every such line converges on
  // the sun's vanishing point, so a ray's illumination changes slowly along
  // a screen line through that point and quickly across it. March 1024 of
  // these epipolar lines with 64 rays each, rather than a uniform grid.
  // Each ray stores the transmittance-weighted mean sunlit fraction (with and
  // without caustic focusing) at sixteen logarithmic ranges up to 100 m, so a
  // blade or fish reads the volume in front of its own depth.
  const angles=1024,radial=64,ranges=16,blocks=ranges/2,maxRange=100,logRange=Math.log2(maxRange+1);
  const shafts=new StorageTexture(angles,radial*blocks);
  shafts.type=HalfFloatType;shafts.name='Epipolar sun shafts';
  shafts.wrapS=RepeatWrapping;shafts.wrapT=ClampToEdgeWrapping;shafts.minFilter=shafts.magFilter=LinearFilter;
  // Screen units: height 1, width = aspect, origin at the top left.
  const epipole=uniform(new Vector4()),view=uniform(new Vector4(1,1,1,0));
  const sunView=new Vector3(),clip=new Vector4();
  function updateEpipole(){
    const aspect=camera.aspect;
    sunView.copy(SUN).transformDirection(camera.matrixWorldInverse);
    clip.set(sunView.x,sunView.y,sunView.z,0).applyMatrix4(camera.projectionMatrix);
    // Behind the camera this is the antisolar point: the same pencil of lines.
    const w=Math.abs(clip.w)<1e-6?(clip.w<0?-1e-6:1e-6):clip.w;
    let x=(clip.x/w*.5+.5)*aspect,y=.5-clip.y/w*.5;
    const dx=x-aspect/2,dy=y-.5,distance=Math.hypot(dx,dy),limit=200;
    if(distance>limit){x=aspect/2+dx/distance*limit;y=.5+dy/distance*limit;}
    const inside=x>=0&&x<=aspect&&y>=0&&y<=1;
    let start=-Math.PI,span=2*Math.PI;
    if(!inside){
      // Only the wedge of lines that crosses the screen, with one spare line
      // on each side for bilinear reconstruction.
      const centre=Math.atan2(.5-y,aspect/2-x);let low=0,high=0;
      for(const [px,py] of [[0,0],[aspect,0],[0,1],[aspect,1]]){
        const a=Math.atan2(py-y,px-x)-centre,wrapped=Math.atan2(Math.sin(a),Math.cos(a));
        low=Math.min(low,wrapped);high=Math.max(high,wrapped);
      }
      const pad=(high-low)/(angles-2);start=centre+low-pad;span=high-low+2*pad;
    }
    epipole.value.set(x,y,start,span);
    view.value.set(aspect,inside?1:0,2*Math.tan(camera.fov*Math.PI/360)/camera.zoom,0);
  }
  // Entry and exit distances of a screen line through the epipole.
  const screenSpan=(origin,line)=>{
    const sign=vec2(line.x.greaterThanEqual(0).select(float(1),float(-1)),line.y.greaterThanEqual(0).select(float(1),float(-1)));
    const safe=line.abs().max(1e-6).mul(sign);
    const t0=origin.negate().div(safe),t1=vec2(view.x,1).sub(origin).div(safe);
    const near=t0.min(t1),far=t0.max(t1);
    const entry=near.x.max(near.y).max(0);
    return vec2(entry,far.x.min(far.y).max(entry));
  };
  const lightAt=(point,mip)=>{
    const gap=sunlight.visibilityLoad(point);
    return vec2(gap.mul(caustics.scalarModulation(point,mip)),gap);
  };
  const march=Fn(()=>{
    const angle=instanceIndex.mod(angles),sample=instanceIndex.div(angles);
    const theta=epipole.z.add(angle.toFloat().add(.5).div(angles).mul(epipole.w));
    const line=vec2(theta.cos(),theta.sin()).toVar();
    const span=screenSpan(epipole.xy,line);
    const r=mix(span.x,span.y,sample.toFloat().add(.5).div(radial)).toVar();
    const point=epipole.xy.add(line.mul(r));
    const far=getViewPosition(vec2(point.x.div(view.x),point.y),float(1),projection);
    const direction=world.mul(vec4(far.normalize(),0)).xyz.normalize().toVar();
    const boundary=cameraDepth.div(direction.y.max(.00001)).toVar();
    // Caustic prefilter: how far the receiver coordinate moves along one step,
    // and the spacing to the neighbouring epipolar line at that distance.
    const receiverMotion=direction.xz.sub(vec2(SUN.x,SUN.z).mul(direction.y.div(SUN.y))).length().toVar();
    const lineSpacing=r.mul(epipole.w.div(angles)).mul(view.z).toVar();
    const first=lightAt(cameraPosition,float(0)).toVar();
    const previous=first.toVar(),sum=vec2(0).toVar(),total=float(0).toVar();
    Loop({start:1,end:ranges,type:'int'},({i:k})=>{
      const a=float(k).sub(1).mul(logRange/(ranges-1)).exp2().sub(1).toVar();
      const b=float(k).mul(logRange/(ranges-1)).exp2().sub(1).min(boundary).toVar();
      const width=b.sub(a).max(0).toVar(),middle=a.add(b).mul(.5);
      // Steps of about 0.1 m near the camera, growing with range; beyond
      // 35 m the sunlit path contributes a few percent of the total.
      const wanted=width.div(middle.mul(.04).add(.1)).ceil().clamp(2,middle.greaterThan(35).select(float(3),float(7)));
      const steps=width.greaterThan(0).select(wanted,0).toInt().toVar();
      const ds=width.div(float(steps).max(1)).toVar();
      Loop({start:0,end:steps,type:'int'},({i:s})=>{
        const t=a.add(float(s).add(.5).mul(ds));
        const p=cameraPosition.add(direction.mul(t)).toVar();
        const sunDistance=float(SURFACE).sub(p.y).max(0).div(SUN.y);
        const weight=transmittance(t.add(sunDistance)).g.mul(ds).toVar();
        const footprint=receiverMotion.mul(ds).max(t.mul(lineSpacing));
        const mip=footprint.mul(caustics.tileSize/caustics.extent).max(1).log2().clamp(0,5);
        sum.addAssign(lightAt(p,mip).mul(weight));total.addAssign(weight);
      });
      const value=total.greaterThan(1e-12).select(sum.div(total.max(1e-12)),first).toVar();
      If(k.mod(2).equal(1),()=>{
        textureStore(shafts,uvec2(angle,sample.add(k.sub(1).div(2).toUint().mul(radial))),vec4(previous,value));
      }).Else(()=>{previous.assign(value);});
    });
  })().compute(angles*radial,[64]).setName('Epipolar sun shafts');
  const volume=new RenderTask(renderer=>{updateEpipole();renderer.compute(march);});

  const shaftMap=texture(shafts);
  const illumination=Fn(([screenUV,length])=>{
    const offset=vec2(screenUV.x.mul(view.x),screenUV.y).sub(epipole.xy).toVar();
    const r=offset.length().toVar();
    const u=atan(offset.y,offset.x).sub(epipole.z).div(epipole.w);
    const column=view.y.greaterThan(.5).select(u.fract(),u.clamp(.5/angles,1-.5/angles));
    const span=screenSpan(epipole.xy,offset.div(r.max(1e-6)));
    const v=r.sub(span.x).div(span.y.sub(span.x).max(1e-6)).mul(radial).clamp(.5,radial-.5).toVar();
    const z=length.add(volume).clamp(0,maxRange).add(1).log2().mul((ranges-1)/logRange);
    const lower=z.floor().min(ranges-2),f=z.sub(lower);
    const read=index=>{
      const block=index.mul(.5).floor(),odd=index.sub(block.mul(2));
      const texel=shaftMap.sample(vec2(column,block.mul(radial).add(v).div(radial*blocks))).level(0);
      return mix(texel.xy,texel.zw,odd);
    };
    return mix(read(lower),read(lower.add(1)),f);
  });

  const result=Fn(()=>{
    const {direction,geometry,boundary}=viewRay(uv());
    const length=geometry.min(boundary).min(100).toVar();
    const radiance=lit.rgb.mul(transmittance(geometry)).toVar();
    const diffuseLength=geometry.toVar();
    If(direction.y.greaterThan(0).and(geometry.greaterThan(boundary.sub(.15))),()=>{
      const hit=surface.radiance(direction,cameraPosition).toVar();
      If(hit.a.lessThan(geometry),()=>{
        diffuseLength.assign(hit.a);
        radiance.assign(hit.rgb.mul(transmittance(hit.a)));
      });
    });
    const energy=illumination(uv(),length).toVar();
    // A diffuse skylight component persists inside canopy shadows. Only its
    // directional share responds to local occlusion along the camera path.
    radiance.addAssign(diffuse(direction,diffuseLength.min(1e4)).mul(energy.y.mul(.22).add(.78)));
    radiance.addAssign(forward.received(diffuseLength));
    radiance.addAssign(clearSolarIntegral(direction,length).mul(scatterCoefficient(direction))
      .mul(sunlight.irradiance).mul(energy.x).mul(rays));
    return radiance.max(0);
  })();

  return {density,rays,result,shafts,volume,march,column,forward,transmittance,layout:{angles,radial,ranges,blocks,maxRange},
    resize(pixelRatio,width,height){
      pixelAngle.value=2*Math.tan(camera.fov*Math.PI/360)/Math.max(1,height*pixelRatio);
      forward.resize(pixelRatio);
    },
    dispose(){shafts.dispose();march.dispose();column.map.dispose();forward.dispose();}};
}
