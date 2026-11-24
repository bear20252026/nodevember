import { PerspectiveCamera } from 'three/webgpu';
import { uniform,vec3 } from 'three/tsl';
import { BLADE_LINKS,BLADE_REST_FLOATS,BLADE_STATE_ROWS } from '../blade-rod.js';
import { createWaterSimulation,MAX_STEP } from '../water-simulation.js';

export async function validateWaterSimulation(){
  const s=window.kelp,r=s.renderer,wasManual=s.manual;
  const checks=[],samples={};
  function check(name,pass){checks.push({name,pass:!!pass});if(!pass)throw new Error(name+' '+JSON.stringify(samples));}
  const read=async data=>new Float32Array(await r.getArrayBufferAsync(data.attribute));
  const tip=(pose,axis)=>pose[(BLADE_LINKS-1)*8+axis];
  const extent=(v)=>Math.hypot(...v);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  // The shader's joint transform: rotate by the quaternion, then translate.
  const transform=(skin,q,p)=>{const axis=skin.subarray(q,q+3),c=cross(axis,p),rot=cross(axis,c.map((x,k)=>x+p[k]*skin[q+3]));
    return p.map((x,k)=>x+2*rot[k]+skin[q+4+k]);};
  try{
    s.manual=true;
    const camera=new PerspectiveCamera();camera.position.set(15,17,15);
    // In the translating frame the water and collar can be advanced
    // together. This independently exercises the subtraction in the kernel.
    async function strip({offset=8,carrier=0,water=0,reverse=false,steps=1}={}){
      const time=uniform(0),speed=uniform(water);
      const field={time,displace:p=>p.add(vec3(0,0,time.mul(carrier))),velocity:()=>vec3(0,0,speed),
        acceleration:()=>vec3(0),stipeVelocity:()=>vec3(0,0,carrier),stipeAcceleration:()=>vec3(0)};
      const rest=new Float32Array(BLADE_REST_FLOATS);
      rest.set([offset,12,0,.22,0,1,0,0]);
      const span=1.5/BLADE_LINKS;
      for(let n=1;n<=BLADE_LINKS;n++)rest.set([n*span,0,0,span],(n+1)*4);
      const seed={state:new Float32Array([.85,12,.28,.85,.45,0,0,0]),homes:new Float32Array([.85,12,-2.92,.85,0,.14,0,0])};
      const sim=createWaterSimulation(r,field,rest,seed,camera),chords=[];
      try{
        for(let k=0;k<steps;k++){
          time.value=(k+1)*MAX_STEP;
          if(reverse&&k===Math.floor(steps/2))speed.value=-water;
          sim.step(MAX_STEP);
          if(k%10===9){
            const pose=await read(sim.dynamics);
            chords.push(extent([1.5+tip(pose,0),tip(pose,1),tip(pose,2)]));
          }
        }
        return {pose:[...await read(sim.dynamics)],draw:[...await read(sim.blades)],fish:[...await read(sim.fish)],chords};
      }finally{sim.dispose();}
    }
    const near=await strip({offset:0}),far=await strip();
    const touched=(Math.round(.85*BLADE_LINKS/1.5)-1)*8+2; // z of the joint nearest the fish
    samples.contact={contacts:near.draw[7],fishDelta:near.fish[6]-far.fish[6],bladeDelta:near.pose[touched]-far.pose[touched]};
    check('Contact pushes the blade away and applies the opposite impulse to the fish',
      near.draw[7]===1&&far.draw[7]===0&&samples.contact.fishDelta>.002&&samples.contact.bladeDelta<-.00001);
    const still=await strip({steps:30}),carried=await strip({water:.8,carrier:.8,steps:30});
    const passing=await strip({water:.8,steps:30});
    samples.entrainment={carried:tip(carried.pose,2),still:tip(still.pose,2),passing:tip(passing.pose,2)};
    check('Co-moving water and bladder give the still-water response',Math.abs(samples.entrainment.carried-samples.entrainment.still)<1e-5);
    check('Flow past the bladder bends the same blade',samples.entrainment.passing>.08);
    // A limp blade with its entrained water takes a few seconds to turn over.
    const reversal=await strip({water:1.05,reverse:true,steps:480});
    samples.reversal={chords:reversal.chords};
    const midpoint=reversal.chords.length/2,compressed=Math.min(...reversal.chords.slice(midpoint));
    check('The tip folds inward and unfurls after the surge reverses',
      compressed<1.48&&reversal.chords.slice(midpoint+1).some((v,i)=>v>Math.min(...reversal.chords.slice(midpoint,midpoint+i+1))+.02));

    const poses=await read(s.simulation.dynamics),skin=await read(s.simulation.blades),fish=await read(s.simulation.fish);
    let maxLengthError=0,maxSkinError=0,maxRoll=0,moving=0,shorter=0,longer=0,contacts=0,minFishDistance=Infinity,minClearanceMargin=Infinity;
    for(let i=0;i<s.simulation.bladeCount;i++){
      const at=i*BLADE_REST_FLOATS,draw=i*BLADE_STATE_ROWS*4;
      const rest=s.forest.bladeRest;
      let previous=[0,0,0];
      for(let n=1;n<=BLADE_LINKS;n++){
        const j=at+(n+1)*4,b=(i*BLADE_LINKS+n-1)*8,q=draw+n*8;
        const position=[0,1,2].map(k=>rest[j+k]+poses[b+k]);
        maxLengthError=Math.max(maxLengthError,Math.abs(extent(position.map((x,k)=>x-previous[k]))-rest[j+3]));
        // Apply the exact shader transform to this rest station; the result
        // must coincide with the point used in the contact solver.
        const p=[0,1,2].map(k=>rest[at+k]+rest[j+k]);
        // Joint 0 carries half the neck bend about the collar, so the
        // bladder's translation is its translation plus that rotated collar.
        const collar=rest.subarray(at,at+3),moved=transform(skin,draw,collar);
        const expected=[0,1,2].map(k=>moved[k]+rest[j+k]+poses[b+k]);
        maxSkinError=Math.max(maxSkinError,extent(transform(skin,q,p).map((x,k)=>x-expected[k])));
        maxRoll=Math.max(maxRoll,Math.abs(poses[b+3]));
        if(n===BLADE_LINKS){
          const delta=extent(position)-extent(rest.subarray(j,j+3));
          shorter+=delta<-.03;longer+=delta>.03;moving+=extent(poses.subarray(b,b+3))>1e-5;
        }
        previous=position;
      }
      contacts+=skin[draw+7];
    }
    for(let i=0;i<fish.length;i+=8){
      const distance=Math.hypot(fish[i]-s.camera.position.x,fish[i+1]-s.camera.position.y,fish[i+2]-s.camera.position.z);
      minFishDistance=Math.min(minFishDistance,distance);minClearanceMargin=Math.min(minClearanceMargin,distance-(.53+1.5*fish[i+3]));
    }
    samples.forest={bladeCount:s.simulation.bladeCount,fishCount:s.simulation.fishCount,moving,shorter,longer,contacts,maxLengthError,maxSkinError,maxRoll,minFishDistance,minClearanceMargin};
    check('Every blade and fish has finite GPU state',moving===s.forest.stats.leaves&&fish.length/8===s.fish.count&&poses.every(Number.isFinite)&&skin.every(Number.isFinite)&&fish.every(Number.isFinite));
    check('Every span keeps its length while tip reach varies',maxLengthError<2e-5&&shorter>0&&longer>0);
    check('Draw transforms follow the contact joints',maxSkinError<.0001);
    check('Blades roll and exchange forces with swimming fish',maxRoll>.02&&contacts>0&&minClearanceMargin>=-.001);
    return {date:new Date().toISOString(),checks,samples};
  }finally{s.manual=wasManual;}
}
