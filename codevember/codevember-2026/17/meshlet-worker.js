// Builds meshlets off the main thread. Workers do not see the page's import
// map, so the page sends the resolved meshoptimizer module URLs first.
import { buildMeshletData } from './meshlet-build.js';

let modules=null;
// Tells the page this thread is running; it can then start its long tasks.
self.postMessage({type:'started'});
self.onmessage=async({data})=>{
  if(data.type==='init'){
    modules=Promise.all([import(data.clusterizer),import(data.simplifier)]).then(async([c,s])=>{
      await Promise.all([c.MeshoptClusterizer.ready,s.MeshoptSimplifier.ready]);
      return [c.MeshoptClusterizer,s.MeshoptSimplifier];
    });
    return;
  }
  try {
    const [clusterizer,simplifier]=await modules;
    const result=buildMeshletData(data.input,clusterizer,simplifier);
    self.postMessage({id:data.id,result},[result.vertexArray.buffer,result.indexArray.buffer,result.chunkArray.buffer]);
  } catch(error) {
    self.postMessage({id:data.id,error:String(error?.stack??error)});
  }
};
