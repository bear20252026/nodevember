import { HalfFloatType, WebGPURenderer } from 'three/webgpu';

// Adapted from day 16. A floating-point canvas presented in extended mode
// carries HDR highlights; SDR displays keep the 8-bit canvas, because in
// standard mode some browsers color-manage a float canvas differently and
// SDR looked more saturated. The canvas format is chosen at load: reload
// after moving the window between HDR and SDR displays. ?hdr in the URL
// forces the float canvas (for checks on a browser that reports SDR).
export async function createDisplayRenderer(options,mediaQuery=matchMedia('(dynamic-range: high)'),force=new URLSearchParams(location.search).has('hdr')){
  const create=async parameters=>{
    const renderer=new WebGPURenderer(parameters);
    await renderer.init();
    if(!renderer.backend.isWebGPUBackend)throw new Error('A WebGPU adapter is required.');
    return renderer;
  };
  if(!mediaQuery.matches&&!force)return create(options);
  let renderer=await create({...options,outputType:HalfFloatType});
  try{
    // Configure before creating scene resources. Some older browsers reject
    // float presentation; retry their preferred format without losing a scene.
    renderer.backend.context;
  }catch{
    await renderer.dispose();
    renderer=await create(options);
    renderer.backend.context;
  }
  return renderer;
}

// HDR follows the display while the page is open. The float canvas stays in
// extended presentation; SDR (an SDR display, or the SDR override) lowers the
// headroom to 1 rather than switching the canvas to standard presentation.
export function createDisplayOutput(renderer,mediaQuery=matchMedia('(dynamic-range: high)')){
  const context=renderer.backend.context;
  const config=context.getConfiguration?.();
  const supported=config?.format==='rgba16float'&&config?.toneMapping?.mode==='extended';
  let mode='auto',peak=4,active=false,listener=()=>{};
  function refresh(){
    active=Boolean(supported&&mediaQuery.matches&&mode==='auto');
    listener();
  }
  mediaQuery.addEventListener('change',refresh);
  refresh();
  return {
    get supported(){return supported;},get displayCapable(){return mediaQuery.matches;},
    get active(){return active;},get mode(){return mode;},get peak(){return peak;},
    get headroom(){return active?peak:1;},
    setMode(value){if(!['auto','sdr'].includes(value))throw new Error('Unknown display mode');mode=value;refresh();},
    setPeak(value){if(!Number.isFinite(value))throw new Error('Expected finite HDR headroom');peak=Math.max(1,Math.min(8,value));listener();},
    onChange(callback){listener=callback;listener();},
    inspect(){return {mode,active,supported,displayCapable:mediaQuery.matches,peak,headroom:active?peak:1,format:config?.format,presentation:config?.toneMapping?.mode??'standard'};},
    dispose(){mediaQuery.removeEventListener('change',refresh);listener=()=>{};}
  };
}
