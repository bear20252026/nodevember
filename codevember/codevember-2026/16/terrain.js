import { randomSeed, noise } from './random.js';

const colonyRandom=randomSeed(160016);
export const cushions=Array.from({length:96},()=>{
  const a=colonyRandom()*Math.PI*2,r=2.7*Math.sqrt(colonyRandom());
  return {x:Math.cos(a)*r,z:Math.sin(a)*r,radius:.16+colonyRandom()*.19,height:.07+colonyRandom()*.12};
});

export function mossHeight(x,z){
  let h=0;
  for(const c of cushions){
    const d2=((x-c.x)**2+(z-c.z)**2)/(c.radius*c.radius);
    if(d2<4)h=Math.max(h,c.height*Math.exp(-d2*1.5));
  }
  return h;
}

// Shared by the terrain, plant placement and the buried mushroom bases.
export function groundHeight(x,z){
  return -.10+.14*Math.exp(-(x*x+z*z)*.55)+.035*Math.sin(x*3+z)*Math.cos(z*4)+.025*noise(x*10,2,z*10)+mossHeight(x,z);
}
