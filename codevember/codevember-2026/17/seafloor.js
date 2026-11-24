import * as THREE from 'three/webgpu';
import { Fn, Loop, attribute, cameraViewMatrix, float, hash, instanceIndex, ivec2, mix, mx_noise_float, normalViewGeometry, positionLocal, positionView, positionWorld, texture, textureStore, uniformArray, uvec2, vec2, vec3, vec4 } from 'three/tsl';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { fbm, randomSeed, smoothstep } from './random.js';
import { SURFACE } from './water-optics.js';
import { applyCausticLighting } from './caustic-lighting.js';

export const SEABED=-3.1;
const SIZE=150,CELLS=300;

// A rocky reef, about 70% rock: giant kelp needs hard substrate. Ridged
// outcrops and rubble, with sand channels and a gentle swell between them.
const reefAt=(x,z)=>smoothstep(.31,.45,fbm(x*.045+11,z*.045-7,.5,3));
function groundRelief(x,z){
  const swell=(fbm(x*.018,z*.018,9.1,3)-.5)*1.1;
  const n=fbm(x*.16,z*.16,3.3,4),ridge=(1-Math.abs(n*2-1))**2;
  const rubble=fbm(x*.7,z*.7,1.7,3)-.5;
  return swell+reefAt(x,z)*(ridge*1.5+rubble*.3);
}
// Relief fades out toward the edge of the detailed patch, where a flat skirt
// takes over beyond the reach of the water's visibility.
export function groundHeight(x,z){
  return SEABED+groundRelief(x,z)*smoothstep(74,66,Math.hypot(x,z));
}

// The terrain and its skirt read normals, rock cover and occlusion from a
// texture baked from the heightfield, so their shading does not depend on
// the meshlet level of detail. Boulders and cobbles carry the same data
// per vertex.
function seabedMaterial(caustics,optics,ambientDepth,shade,terrainMap=null){
  const material=new THREE.MeshStandardNodeMaterial({roughness:.95,metalness:0}),p=positionWorld;
  let rockiness,occlusion,base;
  if(terrainMap){
    const t=texture(terrainMap,p.xz.add(SIZE/2).div(SIZE)),slope=t.xy.mul(2).sub(1);
    rockiness=t.z;occlusion=t.w;
    base=cameraViewMatrix.mul(vec4(slope.x,slope.dot(slope).oneMinus().max(0).sqrt(),slope.y,0)).xyz.normalize();
  }else{
    const data=attribute('seabed','vec4');rockiness=data.x;occlusion=data.y;base=normalViewGeometry;
  }
  // Broad patches of crustose coralline (pink-mauve) and red turf on the
  // rock; pale sand with shell grit in the channels.
  const patches=mx_noise_float(p.xz.mul(.32)),turfPatches=mx_noise_float(p.xz.mul(.21).add(17));
  const grain=mx_noise_float(p.mul(2.3)),fine=mx_noise_float(p.mul(11));
  const sand=vec3(.38,.35,.29).mul(grain.mul(.07).add(fine.mul(.06)).add(.96));
  const rock=mix(vec3(.15,.14,.12),vec3(.27,.24,.20),grain.mul(.5).add(.5));
  const crust=mix(rock,vec3(.52,.29,.38),patches.smoothstep(.05,.45).mul(.8));
  const reef=mix(crust,vec3(.31,.19,.12),turfPatches.smoothstep(.15,.55).mul(.7));
  material.colorNode=mix(sand,reef,rockiness);
  // The ambient light (scene environment and fill) is computed for one
  // reference depth. Below it, diffuse light loses energy at about the
  // water's extinction along a slightly slanted mean path.
  const below=float(SURFACE).sub(p.y).sub(ambientDepth).mul(1.15);
  material.aoNode=occlusion.mul(optics.extinction.g.mul(below).negate().exp().min(1.5));
  // Pitted rock and rippled sand. The relief fades with distance before it
  // could alias.
  const ripples=p.x.mul(.8).add(p.z.mul(.6)).mul(9).add(grain.mul(2.2)).sin().mul(.004);
  // Rock: metre-scale pits and ledges, pocked by smaller holes.
  const ledges=mx_noise_float(p.mul(.9)).abs().oneMinus().pow2().mul(.12);
  const height=mix(ripples.add(fine.mul(.0015)),ledges.add(grain.mul(.05)).add(fine.mul(.008)),rockiness);
  const detail=positionView.z.negate().smoothstep(32,6);
  material.normalNode=Fn(()=>{
    const sx=positionView.dFdx(),sy=positionView.dFdy(),n=base;
    const r1=sy.cross(n),r2=n.cross(sx),det=sx.dot(r1);
    const gradient=r1.mul(height.dFdx()).add(r2.mul(height.dFdy())).mul(det.sign());
    return n.mul(det.abs().max(1e-10)).sub(gradient.mul(detail)).normalize();
  })();
  applyCausticLighting(material,caustics,undefined,optics.sunlightAt(p.y).mul(shade(p)));
  return material;
}

// Displaced, slightly flattened rocks. Their own occlusion darkens the
// undersides that rest on the sand.
function rockGeometry(seed,detail=2){
  const source=new THREE.IcosahedronGeometry(1,detail);source.deleteAttribute('normal');source.deleteAttribute('uv');
  const geometry=mergeVertices(source),position=geometry.getAttribute('position'),v=new THREE.Vector3();source.dispose();
  for(let i=0;i<position.count;i++){
    v.fromBufferAttribute(position,i);
    const lumps=1+(fbm(v.x*1.3+seed,v.y*1.3,v.z*1.3,3)-.5)*.75;
    v.multiplyScalar(lumps);v.y=v.y<0?v.y*.45:v.y*.8;
    position.setXYZ(i,v.x,v.y,v.z);
  }
  geometry.computeVertexNormals();
  const data=new Float32Array(position.count*4);
  for(let i=0;i<position.count;i++){data[i*4]=1;data[i*4+1]=.45+.55*smoothstep(-.35,.55,position.getY(i));}
  geometry.setAttribute('seabed',new THREE.Float32BufferAttribute(data,4));
  return geometry;
}

// Understory, as on Californian reefs below the kelp canopy: bushy red
// algae on the rock and purple urchins gathered in patches. Both use the
// floor's lighting; the algae sway with the surge near the bottom.
function tuftGeometry(seed){
  const random=randomSeed(seed),positions=[],data=[],indices=[];
  for(let r=0;r<18;r++){
    const angle=r*2.399963+random()*.5,lean=.3+random()*.6,length=.2+random()*.25,width=.016+random()*.02;
    const out=new THREE.Vector3(Math.cos(angle),0,Math.sin(angle)),side=new THREE.Vector3(-out.z,0,out.x),start=positions.length/3;
    for(let j=0;j<=5;j++){
      const t=j/5,p=out.clone().multiplyScalar(lean*length*t*t).setY(length*Math.sin(t*1.3)/Math.sin(1.3)),w=width*(1-t*.8);
      for(const sign of [-1,1]){
        const q=p.clone().addScaledVector(side,sign*w);positions.push(q.x,q.y,q.z);
        data.push(.55,.35+.65*t,t,0);
      }
    }
    for(let j=0;j<5;j++){const a=start+j*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('seabed',new THREE.Float32BufferAttribute(data,4));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  return geometry;
}
function urchinGeometry(){
  const body=mergeVertices(Object.assign(new THREE.IcosahedronGeometry(.035,1),{}).deleteAttribute('normal').deleteAttribute('uv'));
  const positions=[...body.getAttribute('position').array],indices=[...body.index.array],v=new THREE.Vector3();
  for(let i=0;i<positions.length;i+=3)positions[i+1]*=.7;
  const spines=Array.from({length:70},(_,i)=>{const y=1-2*(i+.5)/70,r=Math.sqrt(1-y*y),a=i*2.399963;return new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r);}).filter(d=>d.y>-.35);
  for(const d of spines){
    const base=d.clone().multiplyScalar(.03).setY(d.y*.021),tip=d.clone().multiplyScalar(.06).setY(d.y*.05),side=new THREE.Vector3().crossVectors(d,new THREE.Vector3(0,1,0.01)).normalize().multiplyScalar(.004);
    const up=new THREE.Vector3().crossVectors(d,side).normalize().multiplyScalar(.004),start=positions.length/3;
    for(const q of [base.clone().add(side),base.clone().add(up),base.clone().sub(side),base.clone().sub(up),tip])positions.push(q.x,q.y,q.z);
    for(let k=0;k<4;k++)indices.push(start+k,start+(k+1)%4,start+4);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  const data=new Float32Array(positions.length/3*4);
  for(let i=0;i<positions.length/3;i++){data[i*4]=.9;data[i*4+1]=.6+.4*smoothstep(-.02,.04,positions[i*3+1]);data[i*4+3]=1;}
  geometry.setAttribute('seabed',new THREE.Float32BufferAttribute(data,4));
  geometry.setIndex(indices);geometry.computeVertexNormals();body.dispose();
  return geometry;
}
function understoryMaterial(caustics,optics,ambientDepth,time,shade){
  const material=new THREE.MeshStandardNodeMaterial({roughness:.7,metalness:0,side:THREE.DoubleSide});
  const data=attribute('seabed','vec4'),occlusion=data.y,height=data.z,urchin=data.w,tint=hash(instanceIndex);
  // Deep red, brownish and mauve algae; violet-purple urchins.
  const algae=mix(mix(vec3(.42,.10,.13),vec3(.36,.17,.10),tint.smoothstep(0,.6)),vec3(.50,.22,.32),tint.smoothstep(.6,1));
  material.colorNode=mix(algae,mix(vec3(.17,.05,.20),vec3(.24,.08,.25),tint),urchin);
  const below=float(SURFACE).sub(positionWorld.y).sub(ambientDepth).mul(1.15);
  material.aoNode=occlusion.mul(optics.extinction.g.mul(below).negate().exp().min(1.5));
  // Near the bottom the surge is a slow back-and-forth of a few centimetres.
  const phase=time.mul(.9).add(tint.mul(6.28));
  material.positionNode=positionLocal.add(vec3(phase.sin().mul(.05),0,phase.mul(.73).cos().mul(.035)).mul(height.pow2()));
  applyCausticLighting(material,caustics,undefined,optics.sunlightAt(positionWorld.y).mul(shade(positionWorld)));
  return material;
}

export function createSeafloor({caustics,optics,plants,ambientDepth,time,sunlight}){
  // Soft kelp shade on the floor. The canopy is 5-30 m overhead, so the
  // sun's disk and forward scattering in the water blur its shadow by tens
  // of centimetres; the hard shadow-map lookup drew the coarse shadow-pass
  // blades as sharp polygons. Each frame a compute pass averages the
  // cascades over a 0.45 m disk at every 0.6 m cell, using the previous
  // frame's shadow map, and the floor, rocks and understory read it.
  const SHADE=256,shadeMap=new THREE.StorageTexture(SHADE,SHADE);
  shadeMap.type=THREE.HalfFloatType;shadeMap.name='Soft kelp shade on the reef';
  const floorHeights=new Float32Array(SHADE*SHADE);
  for(let j=0;j<SHADE;j++)for(let i=0;i<SHADE;i++)floorHeights[j*SHADE+i]=groundHeight((i+.5)*SIZE/SHADE-SIZE/2,(j+.5)*SIZE/SHADE-SIZE/2);
  const heightMap=new THREE.DataTexture(floorHeights,SHADE,SHADE,THREE.RedFormat,THREE.FloatType);heightMap.needsUpdate=true;
  const disk=uniformArray(Array.from({length:12},(_,k)=>{const r=.45*Math.sqrt((k+.5)/12),a=k*2.399963;return new THREE.Vector2(Math.cos(a)*r,Math.sin(a)*r);}),'vec2');
  const updateShade=Fn(()=>{
    const i=instanceIndex.mod(SHADE),j=instanceIndex.div(SHADE);
    const centre=vec2(float(i),float(j)).add(.5).mul(SIZE/SHADE).sub(SIZE/2),y=texture(heightMap).load(ivec2(i,j)).x.add(.05);
    const sum=float(0).toVar();
    Loop({start:0,end:12,type:'int'},({i:k})=>{const o=disk.element(k);sum.addAssign(sunlight.visibilityLoad(vec3(centre.x.add(o.x),y,centre.y.add(o.y))));});
    textureStore(shadeMap,uvec2(i,j),vec4(sum.div(12)));
  })().compute(SHADE*SHADE).setName('Soft reef shade');
  const shadeTexture=texture(shadeMap);
  const shade=p=>shadeTexture.sample(p.xz.add(SIZE/2).div(SIZE)).x;
  const group=new THREE.Group(),material=seabedMaterial(caustics,optics,ambientDepth,shade),random=randomSeed(3110);group.name='Seafloor';
  const holdfastClear=(x,z,r)=>plants.every(p=>Math.hypot(p.x-x,p.z-z)>r+.7);
  // Boulders on the reef and cobbles across it, clear of the holdfasts.
  const boulders=[],cobbles=[];
  for(let tries=0;tries<9000&&boulders.length<260;tries++){
    const a=random()*Math.PI*2,r=Math.sqrt(random())*64,x=Math.cos(a)*r,z=Math.sin(a)*r,size=.35+random()**2*1.6;
    if(random()>reefAt(x,z)*.9+.1||!holdfastClear(x,z,size))continue;
    boulders.push({x,z,size,turn:random()*Math.PI*2,stretch:.75+random()*.5,variant:boulders.length%3});
  }
  for(let tries=0;tries<9000&&cobbles.length<700;tries++){
    const a=random()*Math.PI*2,r=Math.sqrt(random())*58,x=Math.cos(a)*r,z=Math.sin(a)*r,size=.07+random()*.2;
    if(random()>reefAt(x,z)*.7+.3||!holdfastClear(x,z,size))continue;
    cobbles.push({x,z,size,turn:random()*Math.PI*2,stretch:.7+random()*.6,variant:3});
  }
  const cell=8,shelter=new Map();
  for(const b of boulders){const k=`${Math.floor(b.x/cell)},${Math.floor(b.z/cell)}`;if(!shelter.has(k))shelter.set(k,[]);shelter.get(k).push(b);}
  // The terrain map: slope (RG), rock cover (B) and occlusion (A) at 0.29 m.
  // Occlusion comes from local concavity (heights against their 1.5 m box
  // average) and from the boulders resting nearby.
  const T=512,texel=SIZE/T,H=new Float32Array(T*T),blur=new Float32Array(T*T),line=new Float32Array(T*T),pixels=new Uint8Array(T*T*4);
  for(let j=0;j<T;j++)for(let i=0;i<T;i++)H[j*T+i]=groundHeight(-SIZE/2+(i+.5)*texel,-SIZE/2+(j+.5)*texel);
  const R=5;
  for(let j=0;j<T;j++)for(let i=0;i<T;i++){let sum=0;for(let k=-R;k<=R;k++)sum+=H[j*T+Math.min(T-1,Math.max(0,i+k))];line[j*T+i]=sum/(2*R+1);}
  for(let j=0;j<T;j++)for(let i=0;i<T;i++){let sum=0;for(let k=-R;k<=R;k++)sum+=line[Math.min(T-1,Math.max(0,j+k))*T+i];blur[j*T+i]=sum/(2*R+1);}
  const at=(i,j)=>H[Math.min(T-1,Math.max(0,j))*T+Math.min(T-1,Math.max(0,i))];
  for(let j=0;j<T;j++)for(let i=0;i<T;i++){
    const x=-SIZE/2+(i+.5)*texel,z=-SIZE/2+(j+.5)*texel;
    const nx=-(at(i+1,j)-at(i-1,j))/(2*texel),nz=-(at(i,j+1)-at(i,j-1))/(2*texel),length=Math.hypot(nx,1,nz);
    let under=0;
    for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++)for(const b of shelter.get(`${Math.floor(x/cell)+di},${Math.floor(z/cell)+dj}`)??[]){
      const d=Math.hypot(b.x-x,b.z-z)/(b.size*1.25);under=Math.max(under,smoothstep(1.6,.6,d));
    }
    const cavity=Math.max(0,blur[j*T+i]-H[j*T+i]),occlusion=Math.max(.35,1-Math.min(.5,cavity*.9)-under*.45),o=(j*T+i)*4;
    pixels[o]=Math.round(255*(.5+.5*nx/length));pixels[o+1]=Math.round(255*(.5+.5*nz/length));
    pixels[o+2]=Math.round(255*reefAt(x,z));pixels[o+3]=Math.round(255*occlusion);
  }
  const terrainMap=new THREE.DataTexture(pixels,T,T);
  terrainMap.name='Reef slope, rock cover and occlusion';
  terrainMap.magFilter=THREE.LinearFilter;terrainMap.minFilter=THREE.LinearMipmapLinearFilter;terrainMap.generateMipmaps=true;terrainMap.needsUpdate=true;
  const terrainMaterial=seabedMaterial(caustics,optics,ambientDepth,shade,terrainMap);
  // The mesh only carries positions (and the normals meshlets require).
  const n=CELLS+1,step=SIZE/CELLS,positions=new Float32Array(n*n*3);
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){const x=-SIZE/2+i*step,z=-SIZE/2+j*step;positions.set([x,groundHeight(x,z),z],(j*n+i)*3);}
  const indices=[];
  for(let j=0;j<CELLS;j++)for(let i=0;i<CELLS;i++){const a=j*n+i,b=a+1,c=a+n,d=c+1;indices.push(a,c,b,b,c,d);}
  const terrain=new THREE.BufferGeometry();
  terrain.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  terrain.setIndex(indices);terrain.computeVertexNormals();
  const ground=new THREE.Mesh(terrain,terrainMaterial);ground.name='Reef';group.add(ground);
  // A flat skirt continues the floor out of sight.
  // Slightly lower than the flat corners of the patch, so the two never fight.
  const skirtGeometry=new THREE.RingGeometry(72,140,96,1);skirtGeometry.rotateX(-Math.PI/2);skirtGeometry.translate(0,SEABED-.03,0);
  const skirt=new THREE.Mesh(skirtGeometry,terrainMaterial);skirt.name='Sand beyond the reef';group.add(skirt);
  // Instanced rocks, each seated on the terrain under its centre.
  const shapes=[rockGeometry(1.7),rockGeometry(5.3),rockGeometry(9.1),rockGeometry(2.9,1)],dummy=new THREE.Object3D();
  for(let v=0;v<shapes.length;v++){
    const items=[...boulders,...cobbles].filter(b=>b.variant===v);
    if(!items.length)continue;
    const mesh=new THREE.InstancedMesh(shapes[v],material,items.length);
    items.forEach((b,i)=>{
      b.y=groundHeight(b.x,b.z)+b.size*.12;
      dummy.position.set(b.x,b.y,b.z);dummy.rotation.set(0,b.turn,0);dummy.scale.set(b.size*b.stretch,b.size,b.size/b.stretch);dummy.updateMatrix();
      mesh.setMatrixAt(i,dummy.matrix);
    });
    mesh.frustumCulled=false;mesh.name=v<3?'Boulders':'Cobbles';group.add(mesh);
  }
  // Algae tufts on the rock and urchins in patches, clear of holdfasts and
  // boulders. Each is seated on the terrain under it.
  const life=randomSeed(7777),onBoulder=(x,z)=>(shelter.get(`${Math.floor(x/cell)},${Math.floor(z/cell)}`)??[]).some(b=>Math.hypot(b.x-x,b.z-z)<b.size*1.05);
  const scatter=(count,radius,accept)=>{
    const items=[];
    for(let tries=0;tries<count*12&&items.length<count;tries++){
      const a=life()*Math.PI*2,r=Math.sqrt(life())*radius,x=Math.cos(a)*r,z=Math.sin(a)*r;
      if(accept(x,z)&&holdfastClear(x,z,-.35)&&!onBoulder(x,z))items.push({x,z,turn:life()*Math.PI*2,size:.8+life()*.8});
    }
    return items;
  };
  const tufts=scatter(3200,46,(x,z)=>life()<reefAt(x,z)*.9);
  const barrens=(x,z)=>smoothstep(.5,.62,fbm(x*.09-4,z*.09+8,2.2,3));
  const urchins=scatter(1100,40,(x,z)=>reefAt(x,z)>.5&&life()<barrens(x,z));
  const understory=understoryMaterial(caustics,optics,ambientDepth,time,shade);
  const lifeShapes=[[tuftGeometry(11),tufts.filter((_,i)=>i%2===0)],[tuftGeometry(23),tufts.filter((_,i)=>i%2===1)],[urchinGeometry(),urchins]];
  for(const [geometry,items] of lifeShapes){
    if(!items.length)continue;
    const mesh=new THREE.InstancedMesh(geometry,understory,items.length);
    items.forEach((item,i)=>{
      dummy.position.set(item.x,groundHeight(item.x,item.z)-.01,item.z);dummy.rotation.set(0,item.turn,0);dummy.scale.setScalar(item.size);dummy.updateMatrix();
      mesh.setMatrixAt(i,dummy.matrix);
    });
    mesh.frustumCulled=false;mesh.name=geometry===lifeShapes[2][0]?'Urchins':'Red algae';group.add(mesh);
  }
  // Height of the floor or of a boulder top, for keeping the camera clear.
  function surfaceHeight(x,z){
    let h=groundHeight(x,z);
    for(const b of shelter.get(`${Math.floor(x/cell)},${Math.floor(z/cell)}`)??[]){
      const d=Math.hypot(b.x-x,b.z-z)/(b.size*Math.max(b.stretch,1/b.stretch));
      if(d<1)h=Math.max(h,b.y+b.size*.8*Math.sqrt(1-d*d));
    }
    return h;
  }
  return {group,material,boulders,cobbles,tufts,urchins,surfaceHeight,shadeMap,
    // Before the scene pass: uses the previous frame's shadow cascades.
    update(renderer){if(sunlight.target)renderer.compute(updateShade);},stats:{boulders:boulders.length,cobbles:cobbles.length,tufts:tufts.length,urchins:urchins.length,triangles:indices.length/3},
    dispose(){terrain.dispose();skirtGeometry.dispose();terrainMap.dispose();shadeMap.dispose();heightMap.dispose();updateShade.dispose();for(const s of shapes)s.dispose();for(const [g] of lifeShapes)g.dispose();material.dispose();terrainMaterial.dispose();understory.dispose();}};
}
