import * as THREE from 'three/webgpu';
import { BLADE_LINKS } from './blade-rod.js';
import { randomSeed } from './random.js';

// Metres. Curved petiole -> pear-shaped bladder -> blade at the upper tip.
// Closed shells keep both faces on the FrontSide meshlet path.
export function createKelpGeometry(seed, stipes=1, canopy=false, shadow=false, distant=false) {
  const random=randomSeed(seed),positions=[],pigments=[],tissue=[],bladeUV=[],indices=[],organs=[];
  const up=new THREE.Vector3(0,1,0);let leaves=0,skinRadius=0;
  // Deterministic per-organ variation that draws nothing from the random stream.
  const hash=(a,b)=>{const h=Math.sin(a*12.9898+b*78.233)*43758.5453;return h-Math.floor(h);};
  // Ambient occlusion: sample points (one per blade, bladder or stalk ring)
  // and occluding elements, gathered while building, resolved at the end.
  const samples=[],occluders=[],sampleOf=[];let aoSample=0,owner=0;
  const addSample=p=>{samples.push(p.x,p.y,p.z,owner);return samples.length/4-1;};
  const addOccluder=(p,area)=>occluders.push(p.x,p.y,p.z,area,owner);
  // bladeUV: (u along, v across, blade address, arc length from the blade
  // base in metres). The meshlet pool stores every attribute as a vec4, so
  // the metric coordinate for the surface texture costs no GPU memory.
  function vertex(p,c,thickness,kind,u=0,v=0,phase=0,acrossMetres=0,bladeId=0,alongMetres=0){
    const n=positions.length/3;positions.push(p.x,p.y,p.z);pigments.push(c.r,c.g,c.b,1);sampleOf.push(aoSample);
    tissue.push(thickness,kind,acrossMetres,phase);bladeUV.push(u,v,bladeId,alongMetres);return n;
  }
  // Stalks are not perfect tubes: the cross-section is slightly flattened
  // (flat: minor/major axis ratio at equal area) and twists along the stalk,
  // the radius swells and thins over `wave` metres, three faint ridges run
  // along it, and a flared base can thicken it where it leaves its parent.
  // Everything follows arc length and `seed`, so every tessellation agrees.
  function tube(points,radius,c,taper=.55,{flat=.82,twist=.6,wave=1.6,wobble=.1,flare=0,seed=0}={}){
    const offset=positions.length/3,sides=shadow||distant?4:8;
    const major=1/Math.sqrt(flat),minor=Math.sqrt(flat);
    let arc=0;
    for(let j=0;j<points.length;j++){
      if(j)arc+=points[j].distanceTo(points[j-1]);
      const tangent=points[Math.min(j+1,points.length-1)].clone().sub(points[Math.max(0,j-1)]).normalize();
      const across=new THREE.Vector3(1,0,.3).cross(tangent).normalize(),other=tangent.clone().cross(across);
      const u=j/(points.length-1),swell=1+wobble*(.6*Math.sin(arc*6.283/wave+seed)+.4*Math.sin(arc*16.98/wave+seed*1.7));
      const r=radius*(1-taper*u)*swell*(1+flare*(1-u)**3),turn=seed*2.1+arc*twist;
      aoSample=addSample(points[j]);
      if(j%4===2&&radius>.02)addOccluder(points[j],2*r*points[j].distanceTo(points[j-1])*4);
      for(let k=0;k<sides;k++){
        const a=k/sides*Math.PI*2,ridge=1+.035*Math.sin(3*a+seed+arc*9);
        const x=Math.cos(a)*major*r*ridge,y=Math.sin(a)*minor*r*ridge;
        const ex=x*Math.cos(turn)-y*Math.sin(turn),ey=x*Math.sin(turn)+y*Math.cos(turn);
        // Thickness is the light path for transmission; tissue.z holds the
        // radius, which offsets the shadow lookup past the stalk itself.
        vertex(points[j].clone().addScaledVector(across,ex).addScaledVector(other,ey),c,r*.08,.35,u,k/sides,0,r);
      }
    }
    for(let j=0;j<points.length-1;j++)for(let k=0;k<sides;k++){
      const a=offset+j*sides+k,b=offset+j*sides+(k+1)%sides;indices.push(a,b,a+sides,b,b+sides,a+sides);
    }
  }
  function bladder(origin,direction,length,width,c,phase){
    const offset=positions.length/3,dir=direction.clone().normalize(),across=new THREE.Vector3(1,0,.3).cross(dir).normalize(),other=dir.clone().cross(across);
    const rings=shadow?4:distant?6:20,sides=shadow?6:distant?8:24;
    // Each bladder bows a little to one side and is fuller on another, and
    // faint ridges run along it. Both vanish at the ends, so the stalk and
    // the blade still meet it at the same points.
    const bow=across.clone().multiplyScalar(Math.cos(phase*1.3)).addScaledVector(other,Math.sin(phase*1.3));
    const belly=across.clone().multiplyScalar(Math.cos(phase*2.9)).addScaledVector(other,Math.sin(phase*2.9));
    const bend=length*(.04+.07*hash(phase,4));
    for(let j=0;j<=rings;j++){
      const t=.5-.5*Math.cos(Math.PI*j/rings);
      // A long basal neck, full shoulders and a short, tapered blade collar.
      const body=Math.pow(Math.sin(Math.PI*Math.pow(t,1.56)),.84);
      const radius=THREE.MathUtils.lerp(.010,.005,t)+width*body;
      const center=origin.clone().addScaledVector(dir,length*t).addScaledVector(bow,bend*Math.sin(Math.PI*t)).addScaledVector(belly,width*body*.14);
      const lobe=1+.037*Math.sin(t*7+phase);
      aoSample=addSample(center);
      if(j===Math.round(rings*.55))addOccluder(center,Math.PI*radius*radius);
      for(let k=0;k<sides;k++){
        const a=k/sides*Math.PI*2,ridge=1+body*(.045*Math.sin(3*a+phase*2)+.02*Math.sin(5*a-phase+t*4));
        // A gas-filled shell: light crosses two thin walls, about 1.3 mm of
        // tissue in all at the shoulders. tissue.z holds the radius for the shadow lookup.
        vertex(center.clone().addScaledVector(across,Math.cos(a)*radius*lobe*ridge).addScaledVector(other,Math.sin(a)*radius*.84*ridge),c,.0008+body*.0005,.65,t,k/sides,phase,radius);
      }
    }
    for(let j=0;j<rings;j++)for(let k=0;k<sides;k++){
      const a=offset+j*sides+k,b=offset+j*sides+(k+1)%sides;indices.push(a,b,a+sides,b,b+sides,a+sides);
    }
    return origin.clone().addScaledVector(dir,length);
  }
  function blade(base,angle,length,width,pitch,phase,c){
    const along=new THREE.Vector3(Math.cos(angle),0,Math.sin(angle)),across=new THREE.Vector3(-Math.sin(angle),0,Math.cos(angle));
    const rings=shadow?10:distant?14:36,cols=shadow?3:distant?5:9,offset=positions.length/3;
    const curl=Math.sin(phase*1.71),bend=Math.cos(phase*2.31);
    const notchAt=.45+.32*Math.sin(phase*.77)**2,notchSide=Math.sign(bend);
    function lateral(u,v){
      const profile=Math.pow(Math.sin(Math.PI*Math.pow(u,.92)),.72)*(1+.13*Math.sin(u*8+phase));
      const edgeWave=1+.075*Math.sin(u*31+phase+v*2)+.045*Math.sin(u*61-phase+v);
      const notch=notchSide*v>0&&curl>.33?.20*Math.exp(-(((u-notchAt)/.023)**2)):0;
      return v*(.005*(1-u)**8+width*profile*(edgeWave-notch));
    }
    function point(u,v,face,transverse=lateral(u,v)){
      const profile=Math.sin(Math.PI*u)**.72;
      const taper=u**4;
      const sweep=length*(.14*u+1.12*u*u-.36*u*u*u+.25*curl*taper);
      const lift=length*((1.12+pitch)*u-.52*u*u+(.01+.27*bend)*taper);
      const dx=.14+2.24*u-1.08*u*u+curl*u**3,dy=1.12+pitch-1.04*u+(.04+1.08*bend)*u**3;
      const normal=along.clone().multiplyScalar(-dy).addScaledVector(up,dx).normalize();
      const twist=Math.sin(u*4.8+phase)*.63*u+curl*u*.40;
      const p=base.clone().addScaledVector(along,sweep).addScaledVector(up,lift);
      p.addScaledVector(across,transverse*Math.cos(twist)+Math.sin(u*4+phase)*length*.16*u*u);
      p.addScaledVector(normal,transverse*Math.sin(twist));
      const billow=Math.sin(u*8+phase)*length*.088*u*u;
      const edge=Math.sin(u*28+phase+v*1.9)*width*.17*Math.abs(v)**2.5*profile;
      const cup=(1-v*v)*width*.19*profile*Math.sin(u*4+phase);
      const collar=.0042*Math.exp(-u*70)*Math.sqrt(Math.max(0,1-v*v));
      p.addScaledVector(normal,billow+edge+cup+(face?-1:1)*(.00055*profile+collar));
      return p;
    }
    // A single two-sided casting surface suffices for a millimetre-thick blade.
    const spine=Array.from({length:BLADE_LINKS+1},(_,n)=>n===0?base:point(n/BLADE_LINKS,0,0));
    const faces=shadow?1:2,arc=[0];
    for(let j=1;j<=rings;j++)arc.push(arc[j-1]+point(j/rings,0,0).distanceTo(point((j-1)/rings,0,0)));
    const ringSample=Array.from({length:rings+1},(_,j)=>addSample(point(j/rings,0,0)));
    for(let i=0;i<6;i++){
      const a=point(i/6,0,0),b=point((i+1)/6,0,0);
      addOccluder(a.clone().lerp(b,.5),a.distanceTo(b)*2*Math.abs(lateral((i+.5)/6,1))*.85);
    }
    for(let face=0;face<faces;face++)for(let j=0;j<=rings;j++)for(let k=0;k<cols;k++){
      const u=j/rings,v=k/(cols-1)*2-1;
      const thickness=(.00048+.00034*(1-v*v)+.00022*(1-u))*(.91+.17*Math.sin(phase*.78));
      aoSample=ringSample[j];
      const acrossMetres=lateral(u,v);
      const sample=point(u,v,face,acrossMetres),link=Math.min(BLADE_LINKS-1,Math.floor(u*BLADE_LINKS));
      skinRadius=Math.max(skinRadius,sample.distanceTo(spine[link]),sample.distanceTo(spine[link+1]));
      vertex(sample,c,thickness,1,u,v,phase,acrossMetres,leaves+1,arc[j]);
    }
    const layer=(rings+1)*cols;
    for(let face=0;face<faces;face++)for(let j=0;j<rings;j++)for(let k=0;k<cols-1;k++){
      const a=offset+face*layer+j*cols+k,b=a+1,d=a+cols,c=d+1;
      if(face)indices.push(a,d,b,b,d,c);else indices.push(a,b,d,b,c,d);
    }
    if(!shadow)for(let j=0;j<rings;j++)for(const k of [0,cols-1]){
      const a=offset+j*cols+k,b=a+cols;
      if(k===0)indices.push(a,a+layer,b,b,a+layer,b+layer);
      else indices.push(a,b,a+layer,b,b+layer,a+layer);
    }
    leaves++;return {base:base.toArray(),middle:point(.4,0,0).toArray(),tip:spine.at(-1).toArray(),spine:spine.slice(1).map(p=>p.clone().sub(base).toArray()),across:across.toArray(),length,width};
  }
  // The holdfast: tapered haptera arch out and down from the stipe base
  // and grip the rock, with a few side branches. They stay above y = 0;
  // the forest seats each plant a few centimetres into the reef. Its own random stream
  // leaves every stipe and blade of the plant unchanged.
  if(!canopy){
    const grip=randomSeed(seed*7+3),strands=shadow?9:distant?13:22;owner=-1;
    for(let i=0;i<strands;i++){
      const angle=i*2.399963+grip()*.6,reach=.16+grip()*.32,top=.06+grip()*.34,radius=.010+grip()*.007;
      const out=new THREE.Vector3(Math.cos(angle),0,Math.sin(angle));
      const color=new THREE.Color('#5d4a2a').multiplyScalar(.75+grip()*.4);
      const points=Array.from({length:6},(_,j)=>{
        const t=j/5;
        return out.clone().multiplyScalar(.02+reach*t).setY(.02+top*(1-t)**1.6+.012*Math.sin(t*3+i)*(1-t));
      });
      tube(points,radius,color,.5,{flat:.7,twist:2,wave:.2,wobble:.14,seed:i});
      if(!shadow&&i%3===0){
        const fork=points[3],side=new THREE.Vector3(-out.z,0,out.x).multiplyScalar(grip()<.5?1:-1);
        tube(Array.from({length:4},(_,j)=>{const t=j/3;return fork.clone().addScaledVector(out,.1*t).addScaledVector(side,.08*t).setY(.02+(fork.y-.02)*(1-t));}),radius*.7,color,.5);
      }
    }
  }
  for(let stem=0;stem<stipes;stem++){
    const height=23+random()*10,angle=random()*Math.PI*2,spread=.1+random()*.45,phase=random()*10;
    // Gold to yellow-green, as in the close-up references.
    const color=new THREE.Color().setHSL(.15+random()*.05,.69+random()*.13,.27+random()*.09);
    const stemColor=new THREE.Color('#b29946').multiplyScalar(.8+random()*.2);
    const bladderColor=new THREE.Color('#957d35').multiplyScalar(.85+random()*.2);
    const curve=t=>{
      if(canopy)return new THREE.Vector3((t-.5)*18,Math.sin(t*4+phase)*.6,Math.sin(angle)*2+Math.sin(t*3+phase)*1.5);
      const top=Math.max(0,(t-.84)/.16);
      const side=t*(.27*Math.sin(t*15+phase)+.11*Math.sin(t*34+phase));
      const x=Math.cos(angle)*(spread*t+Math.sin(t*4+phase)*t*.6)+top*top*2.7;
      const z=Math.sin(angle)*(spread*t+Math.sin(t*3+phase)*t*.9)+top*top*1.2;
      return new THREE.Vector3(x+side*Math.sin(angle),height*t-top*top*1.1,z-side*Math.cos(angle));
    };
    const stemSegments=shadow||distant?32:100;owner=-1-stem;
    tube(Array.from({length:stemSegments+1},(_,j)=>curve(j/stemSegments)),.026+random()*.009,stemColor,.55,{flat:.78,twist:.35,wave:1.7,wobble:.09,seed:phase});
    const count=116+Math.floor(random()*24);
    for(let l=0;l<count;l++){
      const t=.035+.955*(l+.29*Math.sin(l*3.7+phase))/count;
      const origin=curve(t),azimuth=angle+(l%2)*Math.PI+l*.028+Math.sin(l*.39)*.41+random()*.32;
      const along=new THREE.Vector3(Math.cos(azimuth),0,Math.sin(azimuth));
      const length=1.04+random()*1.13,width=length*(.103+random()*.060),organPhase=random()*10;
      const reach=.13+random()*.15,rise=.12+random()*.15;
      const petioleSegments=shadow||distant?4:8;owner=leaves+1;
      // Each stalk curves its own way: a sideways sway and a varied rise.
      const sideways=new THREE.Vector3(-along.z,0,along.x).multiplyScalar((hash(organPhase,1)-.5)*.09),lift=1.6+hash(organPhase,2)*.9;
      const petiole=Array.from({length:petioleSegments+1},(_,j)=>{const u=j/petioleSegments;return origin.clone().addScaledVector(along,reach*Math.sin(u*Math.PI*.5)).addScaledVector(up,rise*u**lift).addScaledVector(sideways,Math.sin(Math.PI*u));});
      tube(petiole,.013*(.85+.3*hash(organPhase,3)),stemColor,.3,{flat:.66,twist:3,wave:.14,wobble:.08,flare:.55,seed:organPhase});
      const bladderBase=petiole.at(-1),bladderDirection=up.clone().addScaledVector(along,.12+random()*.21).normalize();
      const bladderLength=.19+random()*.10;
      const bladeBase=bladder(bladderBase,bladderDirection,bladderLength,.052+random()*.028,bladderColor,organPhase);
      const bladeColor=color.clone().offsetHSL(Math.sin(organPhase*2.4)*.021,0,0).multiplyScalar(.74+random()*.45);
      const organ=blade(bladeBase,azimuth,length,width,-.18+random()*.35,organPhase,bladeColor);
      organs.push({...organ,stemBase:origin.toArray(),bladderBase:bladderBase.toArray(),bladderTip:bladeBase.toArray(),phase:organPhase});
    }
  }
  if(!shadow){
    const occlusion=ambientOcclusion(samples,occluders);
    for(let i=0;i<sampleOf.length;i++)pigments[i*4+3]=occlusion[sampleOf[i]];
  }
  const geometry=new THREE.BufferGeometry();
  // pigment.w carries the baked ambient occlusion in the vec4 slot the
  // meshlet pool already reserves for the colour.
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('pigment',new THREE.Float32BufferAttribute(pigments,4));
  geometry.setAttribute('tissue',new THREE.Float32BufferAttribute(tissue,4));geometry.setAttribute('bladeUV',new THREE.Float32BufferAttribute(bladeUV,4));
  geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();geometry.computeBoundingBox();
  geometry.userData={skinRadius,leaves,stipes,triangles:indices.length/3,organs};return geometry;
}

// Occlusion of the ambient light field by neighbouring blades, bladders and
// stalks. Each element is a disc whose solid-angle share A/(A + pi d^2) is
// weighted toward elements overhead, since the light underwater arrives
// mostly from above. Elements of the sample's own organ are skipped.
function ambientOcclusion(samples,occluders,reach=.75){
  const cells=new Map(),cellOf=v=>Math.floor(v/reach),key=(x,y,z)=>((x+4096)*8192+(y+4096))*8192+(z+4096);
  for(let i=0;i<occluders.length;i+=5){
    const k=key(cellOf(occluders[i]),cellOf(occluders[i+1]),cellOf(occluders[i+2]));
    if(!cells.has(k))cells.set(k,[]);cells.get(k).push(i);
  }
  const result=new Float32Array(samples.length/4);
  for(let s=0;s<samples.length;s+=4){
    const x=samples[s],y=samples[s+1],z=samples[s+2],owner=samples[s+3],cx=cellOf(x),cy=cellOf(y),cz=cellOf(z);
    let occlusion=0;
    for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++){
      const list=cells.get(key(cx+i,cy+j,cz+k));if(!list)continue;
      for(const o of list){
        if(occluders[o+4]===owner)continue;
        const dx=occluders[o]-x,dy=occluders[o+1]-y,dz=occluders[o+2]-z,d2=dx*dx+dy*dy+dz*dz;
        if(d2>reach*reach||d2<1e-4)continue;
        const above=dy/Math.sqrt(d2),t=Math.min(1,Math.max(0,(above+.25)/1)),weight=t*t*(3-2*t);
        occlusion+=weight*occluders[o+3]/(occluders[o+3]+Math.PI*d2);
      }
    }
    result[s/4]=Math.max(.45,1/(1+occlusion));
  }
  return result;
}
