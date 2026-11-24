import { DataTexture, FloatType, RGBAFormat, Vector3, Vector4 } from 'three/webgpu';
import { float, int, ivec2, mix, texture, uint, uniformArray, uniform, vec3 } from 'three/tsl';
import { STIPE_SAMPLES } from './forest.js';
import { sampleCurrent } from './current.js';

// The swimmer is a soft sphere of RADIUS around the camera that pushes the
// kelp aside. Blades meet it in their simulation (blade-rod.js). Each upright
// stalk is a chain of NODES sideways offsets from its swaying rest line,
// simulated here only while it is touched or still moving: a damped string
// under tension, pinned at the holdfast and free at the top, pulled back
// toward rest by the buoyant fronds and the current,
//   D'' = c^2 D_yy - w0^2 D - 2 zeta w0 D'.
// Tension carries a push along the stalk as a broad bend; the pull back
// returns the stalk in a few seconds. The sphere is a cushion: from CUSHION
// outside its surface a spring pushes nodes horizontally away from its
// centre, harder the deeper they are. While the swimmer moves, the push
// leans away from its path (SLIDE), so stalks slide around the sphere's sides
// and open a passage instead of being carried along ahead of it.
export const SWIMMER_RADIUS=2,NODES=64;
// Softness: a wide bend (c/w0 = 7 m), a slow, calm return, a cushion that
// starts CUSHION outside the sphere and pushes with PUSH (1/s^2) per metre of
// depth, and a hard limit at INNER of the radius that keeps stalks off the lens.
const WAVE_SPEED=10,PERIOD=4.5,DAMPING=.7,SUBSTEP=1/100,MAX_SPEED=6,REST=1e-4;
const CUSHION=1,PUSH=8,INNER=.45,SLIDE=.8;

export function createSwimmer(camera,stipeLines){
  const stride=4*(STIPE_SAMPLES+1),count=stipeLines.length/stride,rows=Math.max(count,1);
  const right=new Vector3(),point=new Vector3(),previous=new Vector3().copy(camera.position),motion=new Vector3();
  const center=uniform(camera.position),radius=uniform(SWIMMER_RADIUS);
  // Per plant: lowest node height, node spacing, largest offset (for culling).
  const plantData=Array.from({length:rows},(_,s)=>{
    const first=count?stipeLines[s*stride]:0,spacing=count?stipeLines[s*stride+1]:1;
    return new Vector4(first,spacing*(STIPE_SAMPLES-1)/(NODES-1),0,0);
  });
  const plants=uniformArray(plantData,'vec4');
  // Offsets x, z per node, one row per plant; the rest line per node.
  const offsets=new Float32Array(NODES*rows*4),velocity=new Float32Array(NODES*rows*2),rest=new Float32Array(NODES*rows*2);
  const map=new DataTexture(offsets,NODES,rows,RGBAFormat,FloatType);map.needsUpdate=true;
  for(let s=0;s<count;s++){
    const at=s*stride;
    for(let i=0;i<NODES;i++){
      const t=Math.min(i*(STIPE_SAMPLES-1)/(NODES-1),STIPE_SAMPLES-1),k=Math.min(STIPE_SAMPLES-2,Math.floor(t)),w=t-k,a=at+4*(k+1),b=a+4;
      rest[(s*NODES+i)*2]=stipeLines[a]+(stipeLines[b]-stipeLines[a])*w;
      rest[(s*NODES+i)*2+1]=stipeLines[a+1]+(stipeLines[b+1]-stipeLines[a+1])*w;
    }
  }
  const active=new Set(),omega=2*Math.PI/PERIOD;

  // A node's horizontal offset from the sphere's centre, its distance from
  // the centre, and the direction to push it: away from the centre, leaning
  // away from the swimmer's path while it moves (to the camera's right for a
  // node dead ahead).
  function relative(s,i,x,z,time,strength,touch){
    const {x:first,y:h}=plantData[s],v=(s*NODES+i)*2,y=first+i*h;
    point.set(rest[v],y,rest[v+1]);
    const swayed=sampleCurrent(point,time,strength);
    const ox=swayed.x+x-touch.x,oz=swayed.z+z-touch.z,flat=Math.hypot(ox,oz);
    let dx=flat>1e-4?ox/flat:touch.rx,dz=flat>1e-4?oz/flat:touch.rz;
    if(touch.moving){
      const along=ox*touch.mx+oz*touch.mz;
      let lx=ox-touch.mx*along,lz=oz-touch.mz*along;
      const lateral=Math.hypot(lx,lz);
      if(lateral>1e-3){lx/=lateral;lz/=lateral;}else{lx=touch.rx;lz=touch.rz;}
      dx=dx*(1-SLIDE)+lx*SLIDE;dz=dz*(1-SLIDE)+lz*SLIDE;
      const n=Math.hypot(dx,dz)||1;dx/=n;dz/=n;
    }
    return {flat,distance:Math.hypot(flat,y-touch.y),dx,dz,dy:y-touch.y};
  }

  function stepPlant(s,dt,time,strength,touch){
    const {x:first,y:h}=plantData[s],c2=WAVE_SPEED*WAVE_SPEED/(h*h),row=s*NODES;
    const cushion=touch?touch.r+CUSHION:0,inner=touch?touch.r*INNER:0;
    for(let i=1;i<NODES;i++){
      const o=(row+i)*4,v=(row+i)*2;
      // Tension, pull to rest and damping, semi-implicit; the top is free.
      for(let c=0;c<2;c++){
        const here=offsets[o+c],below=offsets[o-4+c],above=i<NODES-1?offsets[o+4+c]:here;
        velocity[v+c]+=(c2*(below-2*here+above)-omega*omega*here-2*DAMPING*omega*velocity[v+c])*dt;
      }
      // The cushion pushes horizontally, harder the deeper the node is.
      if(touch&&Math.abs(first+i*h-touch.y)<cushion){
        const {distance,dx,dz}=relative(s,i,offsets[o],offsets[o+1],time,strength,touch);
        if(distance<cushion){
          const push=PUSH*(cushion-distance)*dt;
          velocity[v]+=dx*push;velocity[v+1]+=dz*push;
        }
      }
    }
    let reach=0;
    for(let i=1;i<NODES;i++){
      const o=(row+i)*4,v=(row+i)*2;
      let x=offsets[o]+velocity[v]*dt,z=offsets[o+1]+velocity[v+1]*dt;
      // The hard limit: out to the inner sphere, horizontally.
      if(touch&&Math.abs(first+i*h-touch.y)<inner){
        const {flat,dx,dz,dy}=relative(s,i,x,z,time,strength,touch),needed=Math.sqrt(Math.max(inner*inner-dy*dy,0));
        if(flat<needed){
          x+=dx*(needed-flat);z+=dz*(needed-flat);
          let vx=(x-offsets[o])/dt,vz=(z-offsets[o+1])/dt;
          const speed=Math.hypot(vx,vz);if(speed>MAX_SPEED){vx*=MAX_SPEED/speed;vz*=MAX_SPEED/speed;}
          velocity[v]=vx;velocity[v+1]=vz;
        }
      }
      offsets[o]=x;offsets[o+1]=z;
      reach=Math.max(reach,Math.hypot(x,z));
    }
    plantData[s].z=reach;
    let energy=0;
    for(let i=1;i<NODES;i++)energy+=Math.abs(offsets[(row+i)*4])+Math.abs(offsets[(row+i)*4+1])+Math.abs(velocity[(row+i)*2])+Math.abs(velocity[(row+i)*2+1]);
    return energy>REST*NODES;
  }

  // dt: simulated seconds; time and strength: the current's.
  function update(dt,time,strength){
    if(!(dt>0))return;
    const r=radius.value,{x,y,z}=camera.position;
    right.setFromMatrixColumn(camera.matrixWorld,0);right.y=0;
    if(right.lengthSq()<1e-6)right.set(1,0,0);
    right.normalize();
    motion.set(x-previous.x,0,z-previous.z).divideScalar(dt);previous.set(x,y,z);
    const speed=motion.length(),moving=speed>.05;
    if(moving)motion.divideScalar(speed);
    const touch=r>0?{x,y,z,r,rx:right.x,rz:right.z,moving,mx:motion.x,mz:motion.z}:null;
    // Stalks whose rest line passes near the sphere join the active set.
    if(touch)for(let s=0;s<count;s++){
      const {x:first,y:h}=plantData[s],reachY=(r+CUSHION)/h,t=(y-first)/h;
      if(t<-reachY||t>NODES-1+reachY)continue;
      const i=Math.max(0,Math.min(NODES-1,Math.round(t))),v=(s*NODES+i)*2;
      if(Math.hypot(rest[v]-x,rest[v+1]-z)<r+CUSHION+3)active.add(s);
    }
    if(!active.size)return;
    const steps=Math.ceil(dt/SUBSTEP),h=dt/steps;
    for(const s of active){
      let moving=false;
      for(let n=0;n<steps;n++)moving=stepPlant(s,h,time,strength,touch);
      if(!moving){
        for(let i=0;i<NODES;i++){offsets[(s*NODES+i)*4]=offsets[(s*NODES+i)*4+1]=0;velocity[(s*NODES+i)*2]=velocity[(s*NODES+i)*2+1]=0;}
        plantData[s].z=0;active.delete(s);
      }
    }
    map.needsUpdate=true;
  }

  // World offset of a stalk point of `plant` (uint) at rest height y.
  const last=uint(rows-1),stalks=uint(count),field=texture(map);
  const bend=(plant,y)=>{
    const p=plants.element(plant.min(last)).toVar();
    const t=y.sub(p.x).div(p.y).clamp(0,NODES-1).toVar(),i=t.floor().min(NODES-2).toVar(),w=t.sub(i);
    const row=int(plant.min(last));
    const a=field.load(ivec2(int(i),row)).xy,b=field.load(ivec2(int(i).add(1),row)).xy;
    const offset=mix(a,b,w); // not a.mix(b,w): chained mix takes the factor first
    return plant.lessThan(stalks).select(vec3(offset.x,0,offset.y),vec3(0));
  };
  // The largest offset of a plant's stalk, for the culling margins.
  const reach=plant=>plant.lessThan(stalks).select(plants.element(plant.min(last)).z,float(0));
  // The sphere's centre, for the blade constraint.
  const nearest=()=>center;
  // CPU view of a stalk's offset at height y, for tests.
  const offsetAt=(s,y)=>{
    const {x:first,y:h}=plantData[s],t=Math.min(Math.max((y-first)/h,0),NODES-1),i=Math.min(Math.floor(t),NODES-2),w=t-i,o=(s*NODES+i)*4;
    return [offsets[o]+(offsets[o+4]-offsets[o])*w,offsets[o+1]+(offsets[o+5]-offsets[o+1])*w];
  };
  return {center,radius,count,map,update,bend,reach,nearest,offsetAt,active};
}
