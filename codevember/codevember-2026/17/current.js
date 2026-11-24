import { Fn, positionLocal, uniform, vec3 } from 'three/tsl';

// Two travelling swells carry the entire frond. Buoyant, flexible fronds
// follow the orbital motion of the water except within a few metres of the
// holdfast, and lag it slightly; the free water continues past them.
const WAVES=[
  {x:.96,z:.28,k:.075,omega:.72,amplitude:1.02,phase:.35},
  {x:-.32,z:.95,k:.115,omega:1.00,amplitude:.46,phase:1.93}
];
const HOLDFAST=3,LAG=.12;
const follows=y=>1-Math.exp(-Math.max(y+3,0)/HOLDFAST);

export function sampleCurrent(p,time,strength=1){
  const result=p.clone(),follow=follows(p.y);
  for(const w of WAVES){
    const phase=w.omega*time-w.k*(p.x*w.x+p.z*w.z)+w.phase-LAG;
    const a=w.amplitude*strength*follow*Math.exp(-w.k*Math.max(28-p.y,0)*.55);
    result.x+=w.x*a*Math.sin(phase);result.z+=w.z*a*Math.sin(phase);
    result.y+=.18*a*Math.cos(phase);
  }
  return result;
}

export function createCurrent(){
  const time=uniform(0),strength=uniform(1);
  function orbital(p,order,tethered){
    const total=vec3(0).toVar();
    for(const w of WAVES){
      const phase=time.mul(w.omega).sub(p.x.mul(w.x).add(p.z.mul(w.z)).mul(w.k))
        .add(w.phase+(tethered?-LAG:0)+order*Math.PI/2).toVar();
      const attenuation=p.y.negate().add(28).max(0).mul(-w.k*.55).exp();
      const compliance=tethered?p.y.add(3).max(0).div(-HOLDFAST).exp().oneMinus():1;
      const a=attenuation.mul(compliance).mul(w.amplitude*w.omega**order);
      const horizontal=phase.sin().mul(a);
      total.addAssign(vec3(horizontal.mul(w.x),phase.cos().mul(a).mul(tethered?.18:.42),horizontal.mul(w.z)));
    }
    return total.mul(strength);
  }
  const displace=Fn(([p])=>p.add(orbital(p,0,true)));
  const stipeVelocity=Fn(([p])=>orbital(p,1,true));
  const stipeAcceleration=Fn(([p])=>orbital(p,2,true));
  const eddyPhase=p=>p.x.mul(.76).add(p.z.mul(.49)).sub(time.mul(.54)).add(p.y.mul(.26));
  const crossPhase=p=>p.x.mul(.32).sub(p.z.mul(.86)).add(time.mul(.83));
  const velocity=Fn(([p])=>{
    const eddy=eddyPhase(p).sin(),cross=crossPhase(p).sin();
    const meanAndEddies=vec3(eddy.mul(.14).add(.42),cross.mul(.095),cross.mul(.17).add(.10));
    return orbital(p,1,false).add(meanAndEddies.mul(strength));
  });
  // Local rate of change of the water velocity.
  const acceleration=Fn(([p])=>{
    const eddy=eddyPhase(p).cos().mul(-.54*.14),cross=crossPhase(p).cos().mul(.83);
    return orbital(p,2,false).add(vec3(eddy,cross.mul(.095),cross.mul(.17)).mul(strength));
  });
  // Orbital displacement of free water (not tethered like the kelp), for
  // anything that drifts with it.
  const waterDisplacement=Fn(([p])=>orbital(p,0,false));
  return {time,strength,displace,velocity,acceleration,stipeVelocity,stipeAcceleration,waterDisplacement,position:displace(positionLocal)};
}
