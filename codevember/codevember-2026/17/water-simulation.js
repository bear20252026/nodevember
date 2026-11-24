import { StorageBufferAttribute } from 'three/webgpu';
import {
  Break, Fn, If, Loop, atomicAdd, atomicExchange, atomicLoad, atomicStore,
  float, instanceIndex, int, uint, storage, uniform, vec3, vec4
} from 'three/tsl';

import { createSwimKernel } from './fish-swimming.js';
import { BLADE_LINKS, BLADE_REST_FLOATS, BLADE_STATE_ROWS, bladeRod } from './blade-rod.js';
export { BLADE_REST_FLOATS, BLADE_STATE_ROWS } from './blade-rod.js';
export const MAX_STEP=1/50;
const CELL=2.25, GRID_X=32, GRID_Y=10, GRID_Z=32;
const CELLS=GRID_X*GRID_Y*GRID_Z;
const FORCE_SCALE=1024;

function buffer(data,type,itemSize=4){
  const attribute=new StorageBufferAttribute(data,itemSize);
  return {attribute,read:storage(attribute,type).toReadOnly(),write:storage(attribute,type)};
}
const cellAt=point=>point.sub(vec3(-36,6,-36)).div(CELL).floor()
  .clamp(vec3(0),vec3(GRID_X-1,GRID_Y-1,GRID_Z-1)).toIVec3();
const cellIndex=(x,y,z)=>x.add(z.mul(GRID_X)).add(y.mul(GRID_X*GRID_Z));

export function createWaterSimulation(renderer,current,rest,fishSeeds,camera,swimmer=null){
  const bladeCount=rest.length/BLADE_REST_FLOATS,fishCount=fishSeeds.state.length/8;
  const skin=new Float32Array(bladeCount*BLADE_STATE_ROWS*4);
  let plantCount=0;
  for(let i=0;i<bladeCount;i++){
    plantCount=Math.max(plantCount,rest[i*BLADE_REST_FLOATS+7]+1);
    for(let n=0;n<=BLADE_LINKS;n++)skin[(i*BLADE_STATE_ROWS+2*n)*4+3]=1;
  }
  const blades=buffer(skin,'vec4'),bladeRest=buffer(rest,'vec4');
  const dynamics=buffer(new Float32Array(bladeCount*BLADE_LINKS*8),'vec4');
  const bounds=buffer(new Uint32Array(plantCount*2),'uint',1);
  const boundMax=storage(bounds.attribute,'uint').toAtomic();
  const fish=buffer(fishSeeds.state,'vec4'),homes=buffer(fishSeeds.homes,'vec4'),stipes=buffer(fishSeeds.stipes??new Float32Array(4),'vec4');
  const snapshot=buffer(fishSeeds.state.slice(),'vec4');
  const orientation=new Float32Array(fishCount*4),stroke=new Float32Array(fishCount*4);
  for(let i=0;i<fishCount;i++){
    const at=i*8,v=fishSeeds.state.subarray(at+4,at+7),speed=Math.hypot(...v);
    orientation.set(speed>1e-5?[v[0]/speed,v[1]/speed,v[2]/speed,0]:[1,0,0,0],i*4);
    const phase=fishSeeds.state[at+7];stroke.set([phase,.48,0,phase*1.31],i*4);
  }
  const attitude=buffer(orientation,'vec4'),motor=buffer(stroke,'vec4');
  const interactions=new StorageBufferAttribute(new Int32Array(CELLS+fishCount*4),1);
  const links=storage(interactions,'int').toAtomic();
  const nextAt=index=>int(CELLS).add(int(index));
  const reactionAt=index=>int(CELLS+fishCount).add(int(index).mul(3));
  const dt=uniform(MAX_STEP),eye=uniform(camera.position);

  const clear=Fn(()=>{
    If(instanceIndex.lessThan(interactions.count),()=>{atomicStore(links.element(instanceIndex),int(0));});
    If(instanceIndex.lessThan(plantCount*2),()=>{atomicStore(boundMax.element(instanceIndex),uint(0));});
  })()
    .compute(Math.max(interactions.count,plantCount*2),[128]).setName('Water physics: clear contacts');

  // A linked list per cell keeps every fish even if a whole school crowds
  // into one bin. Each fish owns its next pointer.
  const binFish=Fn(()=>{
    const i=instanceIndex,cell=cellAt(fish.read.element(i.mul(2)).xyz);
    snapshot.write.element(i.mul(2)).assign(fish.read.element(i.mul(2)));
    snapshot.write.element(i.mul(2).add(1)).assign(fish.read.element(i.mul(2).add(1)));
    const link=atomicExchange(links.element(cellIndex(cell.x,cell.y,cell.z)),i.toInt().add(1)).toVar();
    atomicStore(links.element(nextAt(i)),link);
  })().compute(fishCount,[64]).setName('Water physics: bin fish');

  const integrateBlades=Fn(()=>{
    const rod=bladeRod(instanceIndex,bladeRest,dynamics,current,dt,swimmer);
    const contacts=float(0).toVar(),radius=rod.width.mul(.72).add(.75);
    const low=cellAt(rod.low.sub(radius)).toVar(),high=cellAt(rod.high.add(radius)).toVar();
    Loop({name:'gy',start:low.y,end:high.y.add(1),type:'int'},({gy})=>{
      Loop({name:'gz',start:low.z,end:high.z.add(1),type:'int'},({gz})=>{
        Loop({name:'gx',start:low.x,end:high.x.add(1),type:'int'},({gx})=>{
          const link=atomicLoad(links.element(cellIndex(gx,gy,gz))).toVar();
          Loop({name:'member',start:0,end:fishCount,type:'int'},()=>{
            If(link.lessThanEqual(0),()=>{Break();});
            const fishIndex=link.sub(1).toUint().toVar();
            const animal=fish.read.element(fishIndex.mul(2)).toVar();
            const swimming=fish.read.element(fishIndex.mul(2).add(1)).xyz;
            const {reaction,hit}=rod.contact(animal,swimming);
            If(hit,()=>{
              const quantized=reaction.mul(-FORCE_SCALE).toIVec3();
              const target=reactionAt(fishIndex);
              atomicAdd(links.element(target),quantized.x);
              atomicAdd(links.element(target.add(1)),quantized.y);
              atomicAdd(links.element(target.add(2)),quantized.z);
              contacts.addAssign(1);
            });
            link.assign(atomicLoad(links.element(nextAt(fishIndex))));
          });
        });
      });
    });

    rod.integrate(blades,boundMax,contacts);
  })().compute(bladeCount,[64]).setName('Water physics: bend blades and exchange forces');

  const integrateFish=createSwimKernel({fish,snapshot,homes,attitude,motor,links,nextAt,reactionAt,
    cellAt,cellIndex,forceScale:FORCE_SCALE,current,dt,eye,fishCount,stipes:stipes.read,stipeCount:fishSeeds.stipeCount??0});

  const kernels=[clear,binFish,integrateBlades,integrateFish];
  return {blades,dynamics,bounds,fish,attitude,motor,interactions,bladeCount,fishCount,swimmer,steps:0,
    step(seconds){
      dt.value=seconds;
      renderer.compute(kernels);
      this.steps++;
    },
    dispose(){
      for(const kernel of kernels)kernel.dispose();
      for(const data of [blades,bladeRest,dynamics,bounds,fish,homes,stipes,snapshot,attitude,motor])data.attribute.dispose();
      interactions.dispose();
    }
  };
}
