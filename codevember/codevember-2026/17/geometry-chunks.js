import * as THREE from 'three/webgpu';

// A whole 30 m plant forces its close LOD on far-away foliage. Small spatial
// groups retain shared geometry/instances but let the GPU choose local detail.
// Groups and vertices keep their order of first use. Typed arrays keep this
// to a few tens of milliseconds for the whole forest.
export function splitGeometry(geometry,axis='y',size=4) {
  const position=geometry.getAttribute('position').array,index=geometry.index.array;
  const component={x:0,y:1,z:2}[axis],triangles=index.length/3;
  const groupOf=new Int32Array(triangles),ids=new Map(),counts=[];
  for(let t=0;t<triangles;t++) {
    const i=t*3,mean=(position[index[i]*3+component]+position[index[i+1]*3+component]+position[index[i+2]*3+component])/3;
    const key=Math.floor(mean/size);let id=ids.get(key);
    if(id===undefined){id=counts.length;ids.set(key,id);counts.push(0);}
    groupOf[t]=id;counts[id]++;
  }
  const members=counts.map(count=>new Uint32Array(count)),filled=new Uint32Array(counts.length);
  for(let t=0;t<triangles;t++)members[groupOf[t]][filled[groupOf[t]]++]=t;
  const remap=new Int32Array(geometry.getAttribute('position').count).fill(-1),attributes=Object.entries(geometry.attributes);
  return members.map(list=>{
    const result=new THREE.BufferGeometry(),old=new Uint32Array(list.length*3),local=new Uint32Array(list.length*3);
    let vertices=0;
    for(let n=0;n<list.length;n++)for(let k=0;k<3;k++){
      const i=index[list[n]*3+k];
      if(remap[i]<0){remap[i]=vertices;old[vertices++]=i;}
      local[n*3+k]=remap[i];
    }
    for(let v=0;v<vertices;v++)remap[old[v]]=-1;
    for(const [name,attr] of attributes) {
      const size=attr.itemSize,source=attr.array,array=new Float32Array(vertices*size);
      for(let v=0;v<vertices;v++)for(let j=0;j<size;j++)array[v*size+j]=source[old[v]*size+j];
      result.setAttribute(name,new THREE.BufferAttribute(array,size));
    }
    // Same index type as setIndex() picks for a plain array.
    result.setIndex(new THREE.BufferAttribute(vertices>65535?local:Uint16Array.from(local),1));
    result.computeBoundingSphere();return result;
  });
}
