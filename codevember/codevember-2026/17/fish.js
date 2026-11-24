import * as THREE from 'three/webgpu';
import { Fn, If, Loop, attribute, diffuseColor, float, instanceIndex, mix, normalLocal, normalView, positionViewDirection, cameraWorldMatrix, positionWorld, positionLocal, storage, texture, uint, uniform, uv, varying, vec2, vec3, vec4 } from 'three/tsl';
import { IOR, SKY_ZENITH, SURFACE } from './water-optics.js';
import { randomSeed } from './random.js';
import { flightPose } from './journey.js';
import { PART, createFishGeometry } from './fish-geometry.js';
import { STIPE_SAMPLES } from './forest.js';
import { createFishSkin } from './fish-skin.js';

// Species ids follow this order (homes .w). Garibaldi are solitary and
// territorial, each holding a station low over the reef by a holdfast.
const SCHOOLS=[{count:1050,species:'blacksmith'},{count:240,species:'senorita'},{count:24,species:'garibaldi'}];
// Flight times (s) when a school waits a few metres along the camera's gaze,
// so the long middle of the route meets fish too; they part around the
// camera like the rest (fish-swimming.js). Señoritas then drift to a stalk.
const ROUTE_SCHOOLS={blacksmith:[30,55,80,105,125,150,172,214],senorita:[65,115,160]};
const SLOTS=2*SCHOOLS.length; // a near and a far draw per species
// Señorita groups forage around real stipes; stipeLines comes from the forest.
export function createFishSeeds(stipeLines=new Float32Array(0)){
  const random=randomSeed(1781),state=[],homes=[],stride=4*(STIPE_SAMPLES+1),stipeCount=stipeLines.length/stride;
  const stipeAt=(index,y)=>{
    const at=index*stride,t=Math.min(STIPE_SAMPLES-1.001,Math.max(0,(y-stipeLines[at])/stipeLines[at+1])),k=Math.floor(t),w=t-k;
    const a=at+4+4*k,b=a+4;return [stipeLines[a]+(stipeLines[b]-stipeLines[a])*w,stipeLines[a+1]+(stipeLines[b+1]-stipeLines[a+1])*w];
  };
  for(const [id,{count,species}] of SCHOOLS.entries()){
    const wrasse=species==='senorita',garibaldi=species==='garibaldi';
    let left=count,groupIndex=0;
    while(left>0){
      const group=garibaldi?1:Math.min(left,Math.floor(wrasse?5+random()*10:15+random()*23));
      let x=(random()-.5)*44,y=10.7+random()*13.7,z=(random()-.5)*42;
      const route=random()*Math.PI*2,turn=(random()>.5?1:-1)*(.069+random()*.075);
      // Two loose groups cross the opening of the flight, as in the dive.
      if(garibaldi&&stipeCount){
        // A metre or two from a holdfast, half a metre to two above the reef.
        const s=Math.floor(random()*stipeCount),base=stipeLines[s*stride],around=random()*Math.PI*2,gap=1+random()*1.2;
        const [sx,sz]=stipeAt(s,base);
        x=sx+Math.cos(around)*gap;z=sz+Math.sin(around)*gap;y=base+.5+random()*1.5;
      }else if(groupIndex===0){
        x=(wrasse?2.7:-2.1)-Math.sin(route)*3.5;y=wrasse?20.6:18.5;z=(wrasse?4.9:7.2)-Math.cos(route)*2.7;
      }else if(groupIndex<=(ROUTE_SCHOOLS[species]?.length??0)){
        const {position,target}=flightPose(ROUTE_SCHOOLS[species][groupIndex-1]),ahead=target.sub(position).normalize().multiplyScalar(wrasse?5:7);
        x=position.x+ahead.x;y=position.y+ahead.y;z=position.z+ahead.z;
      }else if(wrasse&&stipeCount){
        const [sx,sz]=stipeAt(Math.floor(random()*stipeCount),y),around=random()*Math.PI*2,gap=1.2+random()*.8;
        x=sx+Math.cos(around)*gap;z=sz+Math.sin(around)*gap;
      }
      groupIndex++;
      for(let i=0;i<group;i++){
        const length=garibaldi?.24+random()*.08:wrasse?.14+random()*.108:.175+random()*.14;
        const spread=garibaldi?0:wrasse?1.6:3.1,ox=(random()+random()-1)*spread,oz=(random()+random()-1)*spread;
        const oy=(random()+random()-1)*(garibaldi?0:wrasse?1:1.8),phase=random()*2*Math.PI;
        const gait=route+.19*Math.sin(phase),speed=.34+.17*random();
        homes.push(x+ox,y+oy,z+oz,length,route,turn,phase,id);
        state.push(x+ox+Math.sin(route)*3.5,y+oy,z+oz+Math.cos(route)*2.7,length,
          Math.cos(gait)*Math.sign(turn)*speed,.045*Math.sin(phase),-Math.sin(gait)*Math.sign(turn)*speed,phase);
      }
      left-=group;
    }
  }
  return {state:new Float32Array(state),homes:new Float32Array(homes),stipes:stipeCount?stipeLines:new Float32Array(stride),stipeCount};
}

// Treat the narrow fins as thin tissue. This direct term receives the same
// spectral attenuation, caustic irradiance and shadow as reflected sunlight.
class FishMaterial extends THREE.MeshStandardNodeMaterial {
  setupLightingModel(builder){
    const model=super.setupLightingModel(builder),direct=model.direct;
    model.direct=function(input,b){
      direct.call(this,input,b);
      const membrane=attribute('finMotion','vec4').z;
      const through=normalView.dot(input.lightDirection).negate().max(0).mul(membrane).mul(.19/Math.PI);
      input.reflectedLight.directDiffuse.addAssign(input.lightColor.mul(diffuseColor.rgb).mul(through));
    };
    return model;
  }
}

// Kinematics in body lengths. Both species are labriform swimmers: they
// cruise by rowing the pectoral fins and add body and tail strokes (motor.y,
// the body-caudal share) to go faster. The travelling wave follows the
// amplitude envelope measured on swimming fish (Videler & Hess 1984).
const NOSE=.45,BODY=.84,WAVELENGTH=.95;
function skinFish(material,drawList,base,simulation,species){
  const wrasse=species==='senorita';
  const fin=attribute('finMotion','vec4'),part=attribute('part','float'),coord=uv();
  const id=drawList.element(instanceIndex.add(base)),animal=simulation.fish.read.element(id.mul(2));
  const attitude=simulation.attitude.read.element(id),motor=simulation.motor.read.element(id);
  const skin=createFishSkin(species,varying(float(id).mul(1.618).fract()));
  material.colorNode=skin.color;material.roughnessNode=skin.roughness;
  material.metalnessNode=skin.metalness;material.normalNode=skin.normal;
  material.positionNode=Fn(()=>{
    const f=attitude.xyz.toVar(),right=f.cross(vec3(0,1,0)).normalize().toVar(),up=right.cross(f).toVar();
    const bank=attitude.w,side=right.mul(bank.cos()).add(up.mul(bank.sin())).toVar();
    const dorsal=up.mul(bank.cos()).sub(right.mul(bank.sin())).toVar();
    const rotate=p=>f.mul(p.x).add(dorsal.mul(p.y)).add(side.mul(p.z));
    const is=k=>part.sub(k).abs().lessThan(.5);
    const p=positionLocal.toVar(),n=normalLocal.toVar();
    const thrust=motor.y.clamp(0,1).toVar(),breath=motor.w.mul(.45).add(float(id).mul(2.4)).toVar();
    // Gill covers flare and the mouth opens as the fish ventilates.
    If(is(PART.body),()=>{
      const gill=coord.x.sub(.27).div(.05).pow2().negate().exp().mul(coord.y.smoothstep(.15,.35)).mul(coord.y.smoothstep(.65,.85).oneMinus());
      const jaw=coord.x.smoothstep(0,.07).oneMinus().mul(coord.y.smoothstep(.35,.48).oneMinus());
      const pump=breath.sin().mul(.5).add(.5);
      p.z.addAssign(p.z.sign().mul(gill).mul(pump).mul(.004));
      p.y.subAssign(jaw.mul(pump).mul(.004));
    });
    // Median fins lower as the body-caudal stroke takes over.
    If(is(PART.dorsal).or(is(PART.anal)),()=>{
      const hinge=attribute('finAnchor','vec3');
      p.assign(hinge.add(p.sub(hinge).mul(thrust.mul(-.35).add(1))));
    });
    If(fin.x.notEqual(0),()=>{
      // Labriform stroke: row about the shoulder on the power stroke,
      // feather on recovery; lag across the membrane curves the trailing
      // edge. In a burst the pectorals fold back against the flank.
      const hinge=attribute('finAnchor','vec3'),paddle=thrust.mul(-.75).add(1);
      const stroke=motor.w.sub(fin.y.mul(.80)).add(fin.x.mul(motor.z).mul(.95));
      const yaw=stroke.sin().mul(wrasse?.72:.48).mul(paddle).sub(thrust.mul(.75)).mul(fin.x);
      const roll=stroke.cos().mul(wrasse?.49:.34).mul(paddle).add(.10).mul(fin.x);
      const cy=yaw.cos(),sy=yaw.sin(),cr=roll.cos(),sr=roll.sin();
      const rotateFin=v=>{
        const x=cy.mul(v.x).add(sy.mul(v.z)),z=cy.mul(v.z).sub(sy.mul(v.x));
        return vec3(x,cr.mul(v.y).sub(sr.mul(z)),sr.mul(v.y).add(cr.mul(z)));
      };
      p.assign(hinge.add(rotateFin(p.sub(hinge))));n.assign(rotateFin(n));
    });
    // Travelling wave h(s,t) = A e(s) sin(phase - k s) with
    // e(s) = .2 - .8 s + 1.6 s^2 (1 at the caudal base), plus the turn.
    // The caudal fin continues the wave and its rays trail behind.
    const s=float(NOSE).sub(p.x).div(BODY).max(0).toVar(),k=2*Math.PI/WAVELENGTH;
    const amplitude=thrust.mul(.088).add(.008),curvature=motor.z.mul(.19);
    const lag=is(PART.caudal).select(fin.y.mul(.55),float(0));
    const phase=motor.x.sub(s.mul(k)).sub(lag).toVar();
    const envelope=s.mul(1.6).sub(.8).mul(s).add(.2),growth=s.mul(3.2).sub(.8);
    const lateral=amplitude.mul(envelope).mul(phase.sin()).add(curvature.mul(s.pow2())).toVar();
    const slope=amplitude.mul(growth.mul(phase.sin()).sub(envelope.mul(k).mul(phase.cos()))).add(curvature.mul(s).mul(2)).div(-BODY).toVar();
    // Rotate each cross-section about the bent centreline.
    const cos=slope.pow2().add(1).inverseSqrt(),sin=slope.mul(cos);
    p.x.subAssign(p.z.mul(sin));
    p.z.assign(p.z.mul(cos).add(lateral));
    const nx=n.x.mul(cos).sub(n.z.mul(sin)).toVar();
    n.z.assign(n.x.mul(sin).add(n.z.mul(cos)));n.x.assign(nx);
    normalLocal.assign(rotate(n).normalize());
    return animal.xyz.add(rotate(p).mul(animal.w));
  })();
  return skin;
}

export function createFish(simulation,camera,optics,column){
  const field=texture(column.map);
  const waterLight=Fn(([direction,rough])=>{
    const depth=float(SURFACE).sub(positionWorld.y).max(0),mu=direction.y;
    const depthUV=depth.mul(optics.density).div(column.spacing).add(.5).div(column.height);
    const ambient=field.sample(vec2(mu.mul(.5).add(.5),depthUV)).level(0).rgb;
    // Rough scales and diffuse skin see a broad hemisphere. Polished eyes
    // also resolve the bright surface inside the refracted sky window.
    const sky=vec3(...SKY_ZENITH).mul(IOR*IOR).mul(optics.transmittance(depth.div(.85)));
    const window=mu.smoothstep(.65,.74),hemisphere=mu.mul(.43).add(.50);
    return ambient.add(sky.mul(mix(window,hemisphere,rough)));
  });
  const mesh=new THREE.Group(),count=simulation.fishCount;
  const packed=new THREE.StorageBufferAttribute(new Uint32Array(count*2),1);
  const list=storage(packed,'uint'),drawList=storage(packed,'uint').toReadOnly();
  const commands=new THREE.IndirectStorageBufferAttribute(new Uint32Array(5*SLOTS),1);
  const args=storage(commands,'uint'),offsets=[];
  const tags=new THREE.StorageBufferAttribute(new Uint32Array(count),1);
  const tagOut=storage(tags,'uint'),tagIn=storage(tags,'uint').toReadOnly();
  let offset=0;
  for(const [index,{count:population,species}] of SCHOOLS.entries()){
    for(const [detail,near] of [true,false].entries()){
      const slot=2*index+detail,base=2*offset+detail*population;
      const geometry=createFishGeometry(species,near);
      commands.array[slot*5]=geometry.index.count;geometry.setIndirect(commands,slot*20);
      const material=new FishMaterial({side:THREE.DoubleSide,vertexColors:true,roughness:.46,metalness:.10});
      const skin=skinFish(material,drawList,base,simulation,species);
      // The membrane transmits diffuse background water radiance between
      // the fin rays. The opaque rays and their roots transmit less.
      material.emissiveNode=waterLight(positionViewDirection.negate().transformDirection(cameraWorldMatrix),float(.35)).mul(skin.clarity.mul(.51));
      const batch=new THREE.InstancedMesh(geometry,material,population);
      batch.frustumCulled=false;batch.name={blacksmith:'Blacksmith',senorita:'Señorita',garibaldi:'Garibaldi'}[species]+(near?' / near':' / far');
      mesh.add(batch);offsets.push(base);
    }
    offset+=population;
  }
  const view=uniform(camera.matrixWorldInverse),projection=uniform(camera.projectionMatrix);
  const height=uniform(720);
  const classify=Fn(()=>{
    const i=instanceIndex,animal=simulation.fish.read.element(i.mul(2)),p=view.mul(vec4(animal.xyz,1));
    const depth=p.z.negate(),r=animal.w.mul(.70);
    const visible=depth.add(r).greaterThan(camera.near).and(depth.sub(r).lessThan(camera.far))
      .and(p.x.abs().sub(r).mul(projection.element(0).x).lessThan(depth.add(r)))
      .and(p.y.abs().sub(r).mul(projection.element(1).y).lessThan(depth.add(r)));
    const close=animal.w.mul(projection.element(1).y).mul(height).greaterThan(depth.mul(36));
    // Species by index range, then near or far; SLOTS marks a culled fish.
    let species=uint(0);
    for(let k=1,first=SCHOOLS[0].count;k<SCHOOLS.length;first+=SCHOOLS[k].count,k++)species=i.greaterThanEqual(first).select(uint(k),species);
    const slot=species.mul(2).add(close.select(uint(0),uint(1)));
    tagOut.element(i).assign(visible.select(slot,uint(SLOTS)));
  })().compute(count,[64]);

  // Stable draw order matters on grazing fins. Each block counts its own
  // tags, then scatters into a disjoint range following all earlier blocks.
  const blockSize=32,blocks=Math.ceil(count/blockSize);
  const counts=new THREE.StorageBufferAttribute(new Uint32Array(blocks*SLOTS),1);
  const countOut=storage(counts,'uint'),countIn=storage(counts,'uint').toReadOnly();
  function blockRange(id){const begin=id.div(SLOTS).mul(blockSize);return {begin,end:begin.add(blockSize).min(count)};}
  const tally=Fn(()=>{
    const id=instanceIndex,slot=id.mod(SLOTS),{begin,end}=blockRange(id),hits=uint(0).toVar();
    Loop({start:begin,end,type:'uint'},({i})=>{hits.addAssign(tagIn.element(i).equal(slot).select(uint(1),uint(0)));});
    countOut.element(id).assign(hits);
  })().compute(blocks*SLOTS,[64]);
  const pack=Fn(()=>{
    const id=instanceIndex,slot=id.mod(SLOTS),{begin,end}=blockRange(id);
    let start=uint(offsets[0]);
    for(let k=1;k<SLOTS;k++)start=slot.equal(k).select(uint(offsets[k]),start);
    const dest=uint(0).toVar();
    Loop({start:slot,end:id,update:SLOTS,type:'uint'},({i})=>{dest.addAssign(countIn.element(i));});
    Loop({start:begin,end,type:'uint'},({i})=>{
      If(tagIn.element(i).equal(slot),()=>{list.element(start.add(dest)).assign(i);dest.addAssign(1);});
    });
    If(id.div(SLOTS).equal(blocks-1),()=>{args.element(slot.mul(5).add(1)).assign(dest);});
  })().compute(blocks*SLOTS,[64]);
  return {mesh,count,commands,prepare(renderer){height.value=renderer.domElement.height;renderer.compute([classify,tally,pack]);}};
}
