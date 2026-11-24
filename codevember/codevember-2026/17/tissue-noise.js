import * as THREE from 'three/webgpu';
import { texture, vec2 } from 'three/tsl';
import { HEIGHT, SLOPE_RANGE, TISSUE_TILE, WIDTH, generateTissueData } from './tissue-data.js';
export { SLOPE_RANGE, TISSUE_TILE, generateTissueData };

// The phasor noise takes 0.3 s on an M1. A worker starts on it when this
// module loads, so it runs alongside forest generation on the main thread.
// If the worker fails, the page computes the tile itself.
const generated=typeof Worker==='undefined'?null:new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./tissue-worker.js',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{worker.terminate();resolve(data);};
  worker.onerror=event=>{event.preventDefault();worker.terminate();reject(new Error(event.message));};
});
const pending=[];
export const tissueReady=()=>Promise.all(pending);

export function createTissueTexture(){
  // The data arrives before the first render; main.js awaits tissueReady().
  const map=new THREE.DataTexture(null,WIDTH,HEIGHT);
  map.name='Kelp blade corrugation slopes and optical density';
  map.wrapS=map.wrapT=THREE.RepeatWrapping;
  map.magFilter=THREE.LinearFilter;
  map.minFilter=THREE.LinearMipmapLinearFilter;
  map.generateMipmaps=true;map.anisotropy=4;
  const fill=data=>{map.image.data=data;map.needsUpdate=true;};
  if(generated)pending.push(generated.catch(()=>generateTissueData().data).then(fill));
  else fill(generateTissueData().data);
  const node=texture(map);
  // Metric blade coordinates in, decoded (slope x, slope y, mean squared
  // slope, relative density) out.
  return at=>{
    const t=node.sample(at.div(vec2(...TISSUE_TILE)));
    return {slope:t.xy.mul(2).sub(1).mul(SLOPE_RANGE),slopeSquared:t.z.mul(SLOPE_RANGE**2),density:t.w.mul(3)};
  };
}
