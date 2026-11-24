import { StorageBufferAttribute, Vector4 } from 'three/webgpu';
import { storage, uniform, uniformArray, vec2 } from 'three/tsl';
import { MeshletDrawingPipeline } from 'three/addons/pipelines/MeshletDrawingPipeline.js';
import { MAX_LODS } from './meshlet-build.js';

const swizzle=(node,itemSize)=>itemSize===1?node.x:itemSize===2?node.xy:itemSize===3?node.xyz:node;
const extraAttributes=geometry=>Object.keys(geometry.attributes)
  .filter(name=>name!=='position'&&name!=='normal'&&name!=='uv'&&geometry.attributes[name].isInstancedBufferAttribute!==true&&geometry.attributes[name].itemSize<=4)
  .map(name=>({name,attribute:geometry.attributes[name]}));

// Typed arrays for meshlet-build.js, or null when an attribute needs
// BufferAttribute accessors (interleaved or normalized data).
export function meshletInput(geometry){
  const plain=attribute=>attribute!==undefined&&attribute.isInterleavedBufferAttribute!==true&&attribute.normalized!==true;
  const {position,normal,uv}=geometry.attributes,extras=extraAttributes(geometry);
  if(!plain(position)||!plain(normal)||(uv!==undefined&&!plain(uv))||!extras.every(({attribute})=>plain(attribute)))return null;
  const data=attribute=>({array:attribute.array,itemSize:attribute.itemSize});
  return {position:data(position),normal:data(normal),uv:uv?data(uv):null,
    extras:extras.map(({name,attribute})=>({name,...data(attribute)})),index:geometry.index?.array??null};
}

// The object createMeshlets(geometry) returns, around arrays built elsewhere.
export function wrapMeshletData(geometry,data){
  const extras=extraAttributes(geometry);
  if(geometry.boundingSphere===null)geometry.computeBoundingSphere();
  if(geometry.boundingBox===null)geometry.computeBoundingBox();
  const vertexBuffer=storage(new StorageBufferAttribute(data.vertexArray,4),'vec4').toReadOnly();
  const strideNode=uniform(data.stride,'uint');
  const element=(vertex,offset)=>vertexBuffer.element(vertex.mul(strideNode).add(offset));
  const chunkBuffer=storage(new StorageBufferAttribute(data.chunkArray,4),'vec4').toReadOnly();
  const lodOffsets=Array.from({length:MAX_LODS},(_,i)=>{
    const lod=data.lods[i];
    return lod!==undefined?new Vector4(lod.triangleStart,lod.numTriangles,lod.chunkStart,lod.error):new Vector4();
  });
  const attributes=new Map(extras.map(({name,attribute},e)=>[name,{offset:2+e,itemSize:attribute.itemSize}]));
  const instancedAttributes=Object.keys(geometry.attributes)
    .filter(name=>geometry.attributes[name].isInstancedBufferAttribute===true&&geometry.attributes[name].itemSize<=4)
    .map(name=>({name,itemSize:geometry.attributes[name].itemSize}));
  const layoutKey=extras.map(({name,attribute})=>name+':'+attribute.itemSize).join(',')+'|'+
    instancedAttributes.map(({name,itemSize})=>name+':'+itemSize).join(',');
  return {
    position:vertex=>element(vertex,0).xyz,
    normal:vertex=>element(vertex,1).xyz,
    uv:vertex=>vec2(element(vertex,0).w,element(vertex,1).w),
    hasAttribute:name=>attributes.has(name),
    attribute:(name,vertex)=>swizzle(element(vertex,attributes.get(name).offset),attributes.get(name).itemSize),
    indexBuffer:storage(new StorageBufferAttribute(data.indexArray,1),'uint').toReadOnly(),
    chunkBounds:chunk=>chunkBuffer.element(chunk.mul(2)),
    chunkCone:chunk=>chunkBuffer.element(chunk.mul(2).add(1)),
    chunkArray:data.chunkArray,
    chunkCount:data.chunkCount,
    lodOffsets:uniformArray(lodOffsets,'vec4'),
    lodOffsetValues:lodOffsets,
    lodTriangleEnds:data.lods.map(lod=>lod.triangleStart+lod.numTriangles),
    lodCount:data.lods.length,
    maxChunks:data.maxChunks,
    instancedAttributes,
    vertexArray:data.vertexArray,
    stride:data.stride,
    indexArray:data.indexArray,
    attributeLayout:attributes,
    layoutKey,
    geometry,
    boundingSphere:geometry.boundingSphere.clone(),
    boundingBox:geometry.boundingBox.clone()
  };
}

// Clustering ~1.8 million source triangles took 3.4 s on the main thread of
// an M1. A small pool builds them while the page creates the rest of the
// scene. Jobs go to a worker as soon as they exist: the main thread is busy
// generating geometry, so it cannot hand out work as workers become free.
class MeshletWorkers {
  constructor(size){
    const init={type:'init',
      clusterizer:import.meta.resolve('three/addons/libs/meshopt_clusterizer.module.js'),
      simplifier:import.meta.resolve('three/addons/libs/meshopt_simplifier.module.js')};
    this.jobs=new Map();this.next=0;const started=[];
    this.workers=Array.from({length:size},()=>{
      const worker=new Worker(new URL('./meshlet-worker.js',import.meta.url),{type:'module'});
      worker.postMessage(init);worker.load=0;
      started.push(new Promise(resolve=>worker.started=resolve));
      worker.onmessage=({data})=>{
        if(data.type==='started')return worker.started();
        const job=this.jobs.get(data.id);this.jobs.delete(data.id);worker.load-=job.cost;
        data.error?job.reject(new Error(data.error)):job.resolve(data.result);
      };
      worker.onerror=event=>{
        // A worker that cannot load leaves its jobs to the main thread.
        event.preventDefault();worker.failed=true;worker.started();
        for(const [id,job] of this.jobs)if(job.worker===worker){this.jobs.delete(id);job.reject(new Error(event.message||'Meshlet worker failed'));}
      };
      return worker;
    });
    this.started=Promise.all(started);
  }
  run(input){
    // Balance by triangle count, which dominates simplification and clustering.
    const cost=input.index?input.index.length:input.position.array.length/3;
    const worker=this.workers.filter(w=>!w.failed).reduce((a,b)=>b.load<a.load?b:a,{load:Infinity});
    if(worker.load===Infinity)return Promise.reject(new Error('No meshlet workers'));
    return new Promise((resolve,reject)=>{
      const id=this.next++;this.jobs.set(id,{worker,cost,resolve,reject});worker.load+=cost;
      worker.postMessage({id,input});
    });
  }
  terminate(){for(const worker of this.workers)worker.terminate();this.workers=[];}
}

const startWorkers=()=>typeof Worker==='undefined'?null:new MeshletWorkers(Math.max(1,Math.min(6,(navigator.hardwareConcurrency||4)-1)));
// Started when this module loads. A dedicated worker only boots once the
// page's main thread is free, and forest generation then keeps it busy for
// over a second, so module evaluation waits briefly until they run.
let earlyWorkers=startWorkers();
if(earlyWorkers)await Promise.race([earlyWorkers.started,new Promise(resolve=>setTimeout(resolve,250))]);

export class KelpDrawingPipeline extends MeshletDrawingPipeline {
  constructor(parameters){
    super(parameters);
    this._workers=earlyWorkers??startWorkers();earlyWorkers=null;
  }
  _getBatchKey(clusters){return clusters.hasAttribute('bladeUV')?clusters:super._getBatchKey(clusters);}
  _getCullingCapacity(entries,capacities,occlusion,shadow,clusterBudget=0){
    for(let i=0;i<entries.length;i++)if(entries[i].clusters.hasAttribute('bladeUV')){
      if(capacities[i]*entries[i].maxChunks>2**20)throw new Error('Split this kelp batch before increasing forest density.');
      // Full queues prevent dropped leaves after rapid camera turns.
      entries[i].queueBudget=Infinity;entries[i].queueMeasured=true;
    }
    return super._getCullingCapacity(entries,capacities,occlusion,shadow,clusterBudget);
  }
  // Starts building the meshlets of whole (ungrouped) geometries in workers.
  // Await whenPrebuilt() before compileAsync(); anything that failed is
  // clustered on the main thread by prepareAsync() as before.
  prebuild(geometries){
    if(!this._workers)return;
    this._prebuilds??=[];
    for(const geometry of geometries){
      const input=meshletInput(geometry);
      if(input===null||this._hasClusters(geometry,null))continue;
      this._prebuilds.push(this._workers.run(input).then(data=>{
        if(this._hasClusters(geometry,null))return;
        this._clusters.set(geometry,wrapMeshletData(geometry,data));
        if(geometry.hasEventListener('dispose',this._onGeometryDispose)===false)geometry.addEventListener('dispose',this._onGeometryDispose);
      },error=>console.warn('Meshlets fall back to the main thread:',error.message)));
    }
  }
  async whenPrebuilt(){
    await Promise.all(this._prebuilds??[]);
    this._prebuilds=[];this._workers?.terminate();this._workers=null;
  }
}
