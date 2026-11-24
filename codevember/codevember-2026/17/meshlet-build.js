// The CPU half of MeshletGeometryUtils.createMeshlets() at the pinned Three.js
// revision: weld, simplify the LOD chain, cluster and pack. It has no imports,
// so a worker can run it; the main thread wraps the arrays in TSL buffers.
// tests/meshlets.test.mjs checks that both produce identical arrays.

export const MESHLET_SIZE=64;
const LOD_TARGETS=[
  {ratio:1.0,error:0.0,weights:[0.25,0.25,0.25,0.5,0.5],flags:[]},
  {ratio:0.55,error:0.004,weights:[0.2,0.2,0.2,0.35,0.35],flags:['RegularizeLight','Permissive','Prune']},
  {ratio:0.25,error:0.015,weights:[0.12,0.12,0.12,0.2,0.2],flags:['RegularizeLight','Permissive','Prune']},
  {ratio:0.1,error:0.05,weights:[0.08,0.08,0.08,0.12,0.12],flags:['RegularizeLight','Permissive','Prune']},
  {ratio:0.04,error:0.14,weights:[0.04,0.04,0.04,0.06,0.06],flags:['Regularize','Permissive','Prune']},
  {ratio:0.015,error:0.3,weights:[0.02,0.02,0.02,0.03,0.03],flags:['Regularize','Permissive','Prune']}
];
export const MAX_LODS=LOD_TARGETS.length;
const MIN_LOD_REDUCTION=0.85,SLOPPY_ERROR_SCALE=4,MAX_MESHLET_VERTICES=MESHLET_SIZE*3;

// Plain, non-interleaved, unnormalized attributes as {array,itemSize}.
// extras: the other vertex attributes in geometry order, as {name,array,itemSize}.
export function buildMeshletData({position,normal,uv=null,extras,index},Clusterizer,Simplifier){
  const sourceCount=position.array.length/3,count=index?index.length:sourceCount;
  const keyAttributes=[position,normal];if(uv)keyAttributes.push(uv);
  for(const attribute of extras)keyAttributes.push(attribute);
  const keySize=keyAttributes.reduce((size,attribute)=>size+attribute.itemSize,0);
  const keys=new Float32Array(sourceCount*keySize),keyBits=new Uint32Array(keys.buffer);
  const tableSize=2**Math.ceil(Math.log2(sourceCount*2+1)),table=new Int32Array(tableSize).fill(-1);
  const remap=new Uint32Array(sourceCount),sources=[];
  for(let i=0;i<sourceCount;i++){
    const offset=i*keySize;let k=offset;
    for(const {array,itemSize} of keyAttributes)for(let c=0;c<itemSize;c++)keys[k++]=array[i*itemSize+c]+0;
    let hash=2166136261;
    for(let c=offset;c<k;c++)hash=Math.imul(hash^keyBits[c],16777619);
    let slot=(hash>>>0)&(tableSize-1),found=-1;
    while(table[slot]!==-1){
      const other=sources[table[slot]]*keySize;let c=0;
      while(c<keySize&&keys[other+c]===keys[offset+c])c++;
      if(c===keySize){found=table[slot];break;}
      slot=(slot+1)&(tableSize-1);
    }
    if(found===-1){found=sources.length;sources.push(i);table[slot]=found;}
    remap[i]=found;
  }
  const vertexCount=sources.length,stride=2+extras.length;
  const positions=new Float32Array(vertexCount*3),simplifierAttributes=new Float32Array(vertexCount*5);
  const vertexArray=new Float32Array(vertexCount*stride*4);
  for(let i=0;i<vertexCount;i++){
    const source=sources[i];
    for(let e=0;e<extras.length;e++){
      const {array,itemSize}=extras[e];
      for(let c=0;c<itemSize;c++)vertexArray[(i*stride+2+e)*4+c]=array[source*itemSize+c];
    }
    const x=position.array[source*3],y=position.array[source*3+1],z=position.array[source*3+2];
    const nx=normal.array[source*3],ny=normal.array[source*3+1],nz=normal.array[source*3+2];
    const u=uv?uv.array[source*2]:0,v=uv?uv.array[source*2+1]:0;
    positions[i*3]=x;positions[i*3+1]=y;positions[i*3+2]=z;
    simplifierAttributes.set([nx,ny,nz,u,v],i*5);
    vertexArray.set([x,y,z,u,nx,ny,nz,v],i*stride*4);
  }
  const sourceIndices=new Uint32Array(count);
  for(let i=0;i<count;i++)sourceIndices[i]=remap[index?index[i]:i];
  const sourceScale=Simplifier.getScale(positions,3),lods=[];
  let indices=sourceIndices,previousError=0,totalChunks=0;
  for(let i=0;i<LOD_TARGETS.length;i++){
    let error=0;
    if(i>0){
      const target=LOD_TARGETS[i];
      const targetIndexCount=Math.min(indices.length,Math.max(3,Math.floor(sourceIndices.length*target.ratio/3)*3));
      let simplified=Simplifier.simplifyWithAttributes(indices,positions,3,simplifierAttributes,5,target.weights,null,targetIndexCount,target.error,target.flags);
      if(indices.length>targetIndexCount&&simplified[0].length>indices.length*MIN_LOD_REDUCTION){
        const sloppy=Simplifier.simplifySloppy(indices,positions,3,null,targetIndexCount,target.error*SLOPPY_ERROR_SCALE);
        if(sloppy[0].length>=3&&sloppy[0].length<simplified[0].length)simplified=sloppy;
      }
      if(simplified[0].length>=3){indices=simplified[0];error=previousError+simplified[1]*sourceScale;}
      else error=previousError;
    }
    previousError=error;
    const meshlets=Clusterizer.buildMeshlets(indices,positions,3,MAX_MESHLET_VERTICES,MESHLET_SIZE,0.25);
    const bounds=Clusterizer.computeMeshletBounds(meshlets,positions,3);
    lods.push({meshlets,bounds,error,numChunks:meshlets.meshletCount,numTriangles:meshlets.meshletCount*MESHLET_SIZE});
    totalChunks+=meshlets.meshletCount;
  }
  const indexArray=new Uint32Array(totalChunks*MESHLET_SIZE*3),chunkArray=new Float32Array(totalChunks*8);
  let chunkOffset=0,triangleOffset=0;
  for(const lod of lods){
    lod.chunkStart=chunkOffset;lod.triangleStart=triangleOffset;
    for(let m=0;m<lod.numChunks;m++){
      const meshlet=Clusterizer.extractMeshlet(lod.meshlets,m),meshletTriangles=meshlet.triangles.length/3;
      // Pad to exactly 64 triangles with degenerate triangles.
      for(let t=0;t<MESHLET_SIZE;t++){
        const triangle=triangleOffset+m*MESHLET_SIZE+t;
        for(let k=0;k<3;k++)indexArray[triangle*3+k]=t<meshletTriangles?meshlet.vertices[meshlet.triangles[t*3+k]]:meshlet.vertices[0];
      }
      const b=lod.bounds[m];
      chunkArray.set([b.centerX,b.centerY,b.centerZ,b.radius,b.coneAxisX,b.coneAxisY,b.coneAxisZ,b.coneCutoff],chunkOffset*8);
      chunkOffset++;
    }
    triangleOffset+=lod.numTriangles;
  }
  return {
    vertexArray,indexArray,chunkArray,stride,chunkCount:totalChunks,maxChunks:lods[0].numChunks,
    lods:lods.map(({triangleStart,numTriangles,chunkStart,error})=>({triangleStart,numTriangles,chunkStart,error}))
  };
}
