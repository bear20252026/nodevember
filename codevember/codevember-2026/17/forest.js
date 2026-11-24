import * as THREE from 'three/webgpu';
import { createKelpGeometry } from './kelp-geometry.js';
import { randomSeed } from './random.js';
import { splitGeometry } from './geometry-chunks.js';
import { SUN, SURFACE } from './materials.js';
import { sampleCurrent } from './current.js';
import { BLADE_REST_FLOATS } from './blade-rod.js';
import { groundHeight } from './seafloor.js';

// Each stipe's centreline at evenly spaced heights, for fish to steer
// around: per stipe [first height, spacing, 0, 0] then x, z per sample.
export const STIPE_SAMPLES=8;

// onChunks receives each group of split geometries as soon as it exists, so
// meshlet workers can start before the rest of the forest is generated.
export function createForest(materials,onChunks=()=>{}) {
  const random=randomSeed(17026),group=new THREE.Group(),variants=4,placements=[];
  // A wide forest wraps a clear, meandering camera passage. The circular path
  // stays inside it; no recycling columns or popping at the horizon.
  for(let i=0;i<185;i++) {
    const a=random()*Math.PI*2,r=2+Math.sqrt(random())*46;
    const x=Math.cos(a)*r,z=Math.sin(a)*r;
    if(r>8&&r<16)continue;
    placements.push({x,z,rotation:random()*Math.PI*2,scale:.8+random()*.42,height:.78+random()*.50});
  }
  // Uneven, close columns frame the initial view.
  placements.push({hero:true,x:-6,z:5,rotation:.2,scale:1.15,height:1.1},{x:5.3,z:2,rotation:1.5,scale:1.1,height:1.25},{x:-4.5,z:-2.5,rotation:2.4,scale:1.0,height:.96},{x:10,z:-14,rotation:4,scale:1.0});
  // Each holdfast grips the reef at its own height.
  for(const item of placements)item.y=groundHeight(item.x,item.z)-.03;
  const dummy=new THREE.Object3D(),geometries=[],shadowMeshes=[],bladeRest=[],stipeLines=[];
  function addStipes(organs,count,place){
    const curve=[[0,0,0],...organs.map(organ=>organ.stemBase)],point=new THREE.Vector3();
    for(let i=0;i<count;i++){
      place(i);
      const world=curve.map(q=>point.fromArray(q).applyMatrix4(dummy.matrix).toArray()).sort((a,b)=>a[1]-b[1]);
      const first=world[0][1],spacing=(world.at(-1)[1]-first)/(STIPE_SAMPLES-1);
      stipeLines.push(first,spacing,0,0);
      for(let k=0,j=1;k<STIPE_SAMPLES;k++){
        const y=first+k*spacing;
        while(j<world.length-1&&world[j][1]<y)j++;
        const a=world[j-1],b=world[j],t=Math.min(1,Math.max(0,(y-a[1])/Math.max(b[1]-a[1],1e-6)));
        stipeLines.push(a[0]+(b[0]-a[0])*t,a[2]+(b[2]-a[2])*t,0,0);
      }
    }
  }
  const addChunks=chunks=>{geometries.push(...chunks);onChunks(chunks);};
  let plantCount=0;
  function addBladeInstances(organs,count,place){
    const binding={offset:bladeRest.length/BLADE_REST_FLOATS,stride:organs.length,plant:plantCount,scale:0};
    plantCount+=count;
    const base=new THREE.Vector3(),arm=new THREE.Vector3(),previous=new THREE.Vector3(),linear=new THREE.Matrix3();
    for(let i=0;i<count;i++){
      place(i);linear.setFromMatrix4(dummy.matrix);binding.scale=Math.max(binding.scale,...dummy.scale.toArray());
      for(const organ of organs){
        base.fromArray(organ.base).applyMatrix4(dummy.matrix);
        arm.fromArray(organ.across).applyMatrix3(linear).normalize();
        bladeRest.push(base.x,base.y,base.z,organ.width*dummy.scale.x,arm.x,arm.y,arm.z,binding.plant+i);
        previous.set(0,0,0);
        for(const point of organ.spine){
          arm.fromArray(point).applyMatrix3(linear);
          bladeRest.push(arm.x,arm.y,arm.z,arm.distanceTo(previous));
          previous.copy(arm);
        }
      }
    }
    return binding;
  }
  // Sample the same organs more sparsely for the shadow pass,
  // retaining their attachment points, instance transforms and current field.
  function addShadowMeshes(geometry,axis,count,instanceMatrix,binding){
    // The meshlet format requires positions/normals and our UV batch marker.
    // Tissue color and optical properties are unused in the shadow pass, so
    // omit those two vec4 streams (40% of its packed vertex bandwidth).
    for(const name of ['pigment','tissue'])geometry.deleteAttribute(name);
    const shadowBinding={...binding,radius:geometry.userData.skinRadius*binding.scale};
    const chunks=splitGeometry(geometry,axis,axis==='y'?7:5);addChunks(chunks);
    for(const chunk of chunks){
      const mesh=new THREE.InstancedMesh(chunk,materials.kelp,count);
      mesh.instanceMatrix=instanceMatrix;mesh.userData.blades=shadowBinding;
      mesh.frustumCulled=false;shadowMeshes.push(mesh);
    }
    geometry.dispose();
  }
  // Backdrop holdfasts fill the mid-distance where the water still shows
  // kelp. Like real giant kelp, each holds two or three fronds, drawn as
  // extra instances of the low-detail plants, so they add no geometry. They
  // sway with the current field but skip the blade solver and shadow casting,
  // which dominate the per-plant cost; from six metres or more off the camera
  // path neither is visible. Fish neither home on nor collide with them.
  const extra=randomSeed(5150),backdrop=[],fronds=[],inner=18,outer=44;
  const clear=(x,z)=>placements.every(p=>Math.hypot(p.x-x,p.z-z)>2.2)&&backdrop.every(p=>Math.hypot(p.x-x,p.z-z)>2.6);
  for(let tries=0;backdrop.length<96&&tries<4000;tries++){
    const a=extra()*Math.PI*2,r=Math.sqrt(inner*inner+extra()*(outer*outer-inner*inner));
    const x=Math.cos(a)*r,z=Math.sin(a)*r,scale=.85+extra()*.35,height=.8+extra()*.45,count=2+(extra()<.55?1:0);
    if(!clear(x,z))continue;
    backdrop.push({x,z,scale,height,fronds:count});
    for(let k=0;k<count;k++){
      const spread=k?.3+extra()*.45:0,angle=extra()*Math.PI*2;
      fronds.push({x:x+Math.cos(angle)*spread,z:z+Math.sin(angle)*spread,rotation:extra()*Math.PI*2,
        scale:scale*(.9+extra()*.2),height:height*(.82+extra()*.3),variant:(backdrop.length+k)%variants});
    }
  }
  const backdropStats={plants:backdrop.length,stipes:fronds.length,leaves:0,triangles:0};
  let leaves=0,stipes=0,triangles=0,specimen=null;
  // The flight stays on a 12 m radius and inspection is inside it. Groves
  // beyond 25 m from the centre can use a lighter starting mesh at all times.
  const distant=item=>Math.hypot(item.x,item.z)>25;
  for(let v=0;v<variants;v++) {
    const seed=171+v*31,geometry=createKelpGeometry(seed,1);
    const grove=placements.filter((_,i)=>i%variants===v),near=grove.filter(item=>!distant(item)),far=grove.filter(distant);
    const p=[...near,...far];
    for(const item of p)item.height=Math.min(item.height??1,(SURFACE-.35-item.y)/geometry.boundingBox.max.y);
    const featured=p.find(item=>item.hero);
    if(featured){
      dummy.position.set(featured.x,featured.y,featured.z);dummy.rotation.y=featured.rotation;dummy.scale.set(featured.scale,featured.height,featured.scale);dummy.updateMatrix();
      let score=-1;
      for(const organ of geometry.userData.organs){
        const base=new THREE.Vector3().fromArray(organ.base),middle=new THREE.Vector3().fromArray(organ.middle);
        const y=base.y*featured.height+featured.y;if(y<18||y>22)continue;
        const tangent=middle.clone().sub(base).normalize(),across=new THREE.Vector3(-tangent.z,0,tangent.x).normalize();
        const normal=across.cross(tangent).transformDirection(dummy.matrix);if(normal.dot(SUN)<0)normal.negate();
        const alignment=normal.dot(SUN);
        if(alignment>score){score=alignment;specimen={organ,matrix:dummy.matrix.clone(),normal};}
      }
    }
    const place=i=>{
      const item=p[i];
      dummy.position.set(item.x,item.y,item.z);dummy.rotation.y=item.rotation;
      dummy.scale.set(item.scale,item.height??1,item.scale);dummy.updateMatrix();
    };
    const binding=addBladeInstances(geometry.userData.organs,p.length,place);
    addStipes(geometry.userData.organs,p.length,place);
    function instances(start,count){
      const matrix=new THREE.InstancedBufferAttribute(new Float32Array(count*16),16);
      for(let i=0;i<count;i++){place(start+i);dummy.matrix.toArray(matrix.array,i*16);}
      return matrix;
    }
    function drawGrove(source,start,count){
      const chunks=splitGeometry(source,'y',7),matrix=instances(start,count);
      const range={...binding,offset:binding.offset+start*binding.stride,plant:binding.plant+start,radius:source.userData.skinRadius*binding.scale};
      addChunks(chunks);
      for(const chunk of chunks){
        const mesh=new THREE.InstancedMesh(chunk,materials.kelp,count);
        mesh.instanceMatrix=matrix;mesh.userData.blades=range;mesh.frustumCulled=false;
        mesh.name=`Kelp grove ${v+1}`;group.add(mesh);
      }
      triangles+=source.userData.triangles*count;
      return chunks;
    }
    if(near.length)drawGrove(geometry,0,near.length);
    const own=fronds.filter(item=>item.variant===v);
    if(far.length||own.length){
      const distantGeometry=createKelpGeometry(seed,1,false,false,true);
      let chunks=null;
      if(far.length)chunks=drawGrove(distantGeometry,near.length,far.length);
      if(own.length){
        if(!chunks){chunks=splitGeometry(distantGeometry,'y',7);addChunks(chunks);}
        const matrix=new THREE.InstancedBufferAttribute(new Float32Array(own.length*16),16);
        own.forEach((item,i)=>{
          item.y=groundHeight(item.x,item.z)-.03;item.height=Math.min(item.height,(SURFACE-.35-item.y)/geometry.boundingBox.max.y);
          dummy.position.set(item.x,item.y,item.z);dummy.rotation.y=item.rotation;dummy.scale.set(item.scale,item.height,item.scale);dummy.updateMatrix();
          dummy.matrix.toArray(matrix.array,i*16);
        });
        // The base kelp material: current-field sway, no solver rows.
        for(const chunk of chunks){
          const mesh=new THREE.InstancedMesh(chunk,materials.kelp,own.length);
          mesh.instanceMatrix=matrix;mesh.frustumCulled=false;mesh.name=`Kelp backdrop ${v+1}`;group.add(mesh);
        }
        backdropStats.leaves+=geometry.userData.leaves*own.length;backdropStats.triangles+=distantGeometry.userData.triangles*own.length;
      }
      distantGeometry.dispose();
    }
    addShadowMeshes(createKelpGeometry(seed,1,false,true),'y',p.length,instances(0,p.length),binding);
    leaves+=geometry.userData.leaves*p.length;stipes+=geometry.userData.stipes*p.length;geometry.dispose();
  }
  // Mature floating fronds form an irregular canopy around a central opening.
  // Their real geometry also casts the shadows that define the sun shafts.
  const canopy=createKelpGeometry(819,1,true);
  const canopyOffset=SURFACE-.35-canopy.boundingBox.max.y;
  canopy.translate(0,canopyOffset,0);
  const floating=[[-13,4,.3,.85],[-12,-12,1.1,.9],[12,1,-.4,.85],[10,-14,.8,.9],[0,-24,.3,1],[-23,-19,1.6,.9],[23,-24,-.7,1]];
  const placeFloating=i=>{
    const [x,z,rotation,scale]=floating[i];
    dummy.position.set(x,0,z);dummy.rotation.y=rotation;dummy.scale.set(scale,1,scale);dummy.updateMatrix();
  };
  const binding=addBladeInstances(canopy.userData.organs.map(organ=>({
    ...organ,base:[organ.base[0],organ.base[1]+canopyOffset,organ.base[2]],
    middle:[organ.middle[0],organ.middle[1]+canopyOffset,organ.middle[2]],
    tip:[organ.tip[0],organ.tip[1]+canopyOffset,organ.tip[2]]
  })),floating.length,placeFloating);
  binding.radius=canopy.userData.skinRadius*binding.scale;
  const canopyChunks=splitGeometry(canopy,'x',5);addChunks(canopyChunks);
  let canopySource;
  for(const chunk of canopyChunks){
    const mesh=new THREE.InstancedMesh(chunk,materials.kelp,floating.length);
    floating.forEach((_,i)=>{placeFloating(i);mesh.setMatrixAt(i,dummy.matrix);});
    mesh.userData.blades=binding;
    mesh.instanceMatrix.needsUpdate=true;mesh.frustumCulled=false;mesh.name='Floating canopy';group.add(mesh);canopySource=mesh;
  }
  const canopyShadow=createKelpGeometry(819,1,true,true);canopyShadow.translate(0,canopyOffset,0);
  addShadowMeshes(canopyShadow,'x',floating.length,canopySource.instanceMatrix,binding);
  leaves+=canopy.userData.leaves*floating.length;stipes+=floating.length;triangles+=canopy.userData.triangles*floating.length;canopy.dispose();
  function inspectionPose(time,strength=1){
    const anchor=new THREE.Vector3().fromArray(specimen.organ.bladderTip).applyMatrix4(specimen.matrix);
    // Instancing places the frond in the grove before the current bends it.
    const target=sampleCurrent(anchor,time,strength);
    return {target,position:target.clone().addScaledVector(SUN,-1.61).add(new THREE.Vector3(.60,.85,.23))};
  }
  return {group,geometries,shadowMeshes,placements,backdrop,fronds,specimen,inspectionPose,bladeRest:new Float32Array(bladeRest),stipeLines:new Float32Array(stipeLines),stats:{plants:placements.length,stipes,leaves,triangles,backdrop:backdropStats}};
}
