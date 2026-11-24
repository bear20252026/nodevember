import { DataTexture, HalfFloatType, LinearFilter, DataUtils } from 'three/webgpu';
import { EXTINCTION, IOR, SKY_HORIZON, SKY_ZENITH, SUN, WATER, fresnelWater, sunColor } from './water-optics.js';

const directions=96,azimuths=192,spacing=.5,rows=145;
const opticalDepth=spacing*(rows-1);

function phaseHG(cosine,g){
  return (1-g*g)/(4*Math.PI*(1+g*g-2*g*cosine)**1.5);
}

export function waterPhase(cosine){
  const {forward,broad,broadWeight,backward,backwardWeight}=WATER;
  const front=(1-broadWeight)*phaseHG(cosine,forward)+broadWeight*phaseHG(cosine,broad);
  return front*(1-backwardWeight)+phaseHG(cosine,backward)*backwardWeight;
}
export const molecularPhase=cosine=>3*(1+cosine*cosine)/(16*Math.PI);

// A horizontally uniform water column. Solve for the angular light field,
// including Fresnel reflection and repeated scattering. The direct solar
// beam is azimuth-averaged for this solve only. Camera rays evaluate its
// directional first scatter separately with the actual moving kelp shadows.
export function solveWaterColumn(){
  const angle=Array.from({length:directions},(_,i)=>2*(i+.5)/directions-1);
  const sin=angle.map(mu=>Math.sqrt(1-mu*mu));
  const azimuth=Array.from({length:azimuths},(_,i)=>Math.cos(2*Math.PI*(i+.5)/azimuths));
  const quadrature=(phase,cosine,amplitude)=>{
    let sum=0;
    for(const cosPhi of azimuth)sum+=phase(cosine+amplitude*cosPhi);
    return sum/azimuths;
  };
  const weights=phase=>angle.map((mu,i)=>{
    const row=Float64Array.from(angle,(m,j)=>quadrature(phase,mu*m,sin[i]*sin[j]));
    const sum=row.reduce((a,b)=>a+b,0);
    return row.map(w=>w/sum);
  });
  const particleWeights=weights(waterPhase),molecularWeights=weights(molecularPhase);
  const solar=phase=>angle.map((mu,i)=>quadrature(phase,mu*SUN.y,sin[i]*Math.sqrt(1-SUN.y**2)));
  const particleSun=solar(waterPhase),molecularSun=solar(molecularPhase);
  const reflection=angle.map(mu=>fresnelWater(Math.abs(mu)));
  const airElevation=angle.map(mu=>Math.sqrt(Math.max(0,1-IOR**2*(1-mu*mu))));
  const sun=sunColor().toArray();
  const packed=new Float32Array(rows*directions*4);
  for(let channel=0;channel<3;channel++){
    const extinction=EXTINCTION[channel];
    const particles=WATER.particles[channel]/extinction,molecules=WATER.molecules[channel]/extinction;
    const coupling=particleWeights.map((row,i)=>row.map((w,j)=>w*particles+molecularWeights[i][j]*molecules));
    const segments=angle.map(mu=>{
      const opticalLength=spacing*extinction/Math.abs(mu);
      const transmission=Math.exp(-opticalLength);
      const average=-Math.expm1(-opticalLength)/opticalLength;
      return {transmission,entry:average-transmission,exit:1-average};
    });
    const sky=airElevation.map((mu,i)=>IOR**2*(1-reflection[i])*
      (SKY_HORIZON[channel]+(SKY_ZENITH[channel]-SKY_HORIZON[channel])*mu));
    const beam=Array.from({length:rows},(_,y)=>sun[channel]*Math.exp(-extinction*y*spacing/SUN.y));
    let field=new Float64Array(rows*directions),next=field.slice();
    const source=field.slice();
    function scatter(){
      for(let y=0;y<rows;y++){
        const base=y*directions;
        for(let i=0;i<directions;i++){
          const weights=coupling[i];let result=0;
          for(let j=0;j<directions;j++)result+=weights[j]*field[base+j];
          source[base+i]=result;
        }
      }
    }
    function sweep(includeBoundary,includeDirectSun){
      for(let i=0;i<directions;i++){
        const down=angle[i]>0,first=down?0:rows-1,step=down?1:-1;
        const boundary=includeBoundary&&down?sky[i]+reflection[i]*field[directions-i-1]:0;
        const direct=includeDirectSun?particleSun[i]*particles+molecularSun[i]*molecules:0;
        const {transmission,entry,exit}=segments[i];
        let light=boundary,previous=first;
        next[first*directions+i]=light;
        for(let y=first+step;y>=0&&y<rows;y+=step){
          const incoming=source[previous*directions+i]+direct*beam[previous];
          const outgoing=source[y*directions+i]+direct*beam[y];
          // Exact attenuation and in-scatter for a linear source in the cell.
          light=light*transmission+incoming*entry+outgoing*exit;
          next[y*directions+i]=light;previous=y;
        }
      }
    }
    // Source iteration converges quickly for this clear-water single
    // scattering albedo. The finite slab uses a dark bottom boundary.
    for(let order=0;order<24;order++){
      scatter();sweep(true,true);
      [field,next]=[next,field];
    }
    // Store only the diffuse in-scatter along each characteristic. The sky
    // boundary and first solar scatter will be evaluated along the actual ray.
    scatter();sweep(false,false);
    for(let i=0;i<next.length;i++)packed[i*4+channel]=next[i];
  }
  return {width:directions,height:rows,spacing,opticalDepth,data:packed};
}

export function createWaterColumn(){
  const column=solveWaterColumn();
  const pixels=Uint16Array.from(column.data,DataUtils.toHalfFloat);
  const map=new DataTexture(pixels,column.width,column.height,undefined,HalfFloatType);
  map.name='Diffuse water column radiance';
  map.minFilter=map.magFilter=LinearFilter;
  map.needsUpdate=true;
  return {...column,map};
}
