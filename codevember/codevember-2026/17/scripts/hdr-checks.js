// HDR and color checks on the GPU, adapted from day 16. Run in the page:
//   await (await import('./scripts/hdr-checks.js')).checkHDR();
// They verify the HDR data path, not the luminance of a physical display.
// The frame checks need the float canvas: on an SDR display, load with ?hdr.
import * as THREE from 'three/webgpu';
import { float, mix, screenUV, uint, uniform, uniformArray, vec3, vec4 } from 'three/tsl';
import { KNEE, filmicHDR } from '../display-transform.js';
import { createDisplayOutput } from '../display-output.js';

// The SDR display transform as it was before HDR support, clipped at white
// by its 8-bit target: the reference that headroom 1 must reproduce.
function previousSDR(radiance,saturation,contrast){
  const mapped=radiance.mul(2.51).add(.03).mul(radiance).div(radiance.mul(2.43).add(.59).mul(radiance).add(.14)).clamp();
  const luminance=mapped.dot(vec3(.2126,.7152,.0722));
  const warmth=mapped.r.add(mapped.g).mul(.5).sub(mapped.b).div(mapped.r.max(mapped.g).max(mapped.b).max(1e-4)).smoothstep(0,.6);
  return mix(vec3(luminance),mapped,mix(float(1.06),float(1.3),warmth).mul(saturation)).max(0).pow(1.04).div(.18).pow(contrast).mul(.18).clamp();
}

export async function checkHDR(s=window.kelp){
  const renderer=s.renderer,device=renderer.backend.device;
  const saved={manual:s.manual,target:renderer.getRenderTarget(),mrt:renderer.getMRT()};
  const checks=[],check=(name,pass,detail)=>{checks.push({name,pass,detail});if(!pass)throw new Error(name+': '+JSON.stringify(detail));};
  const levels=[0,.00001,.001,.01,.05,.18,.3,.6,1,2,4,8,16,64,256,4096];
  const samples=levels.map(v=>new THREE.Vector3(v,v,v)),neutral=levels.length;
  // Below-white colors (water, kelp, a dim sand tone), then bright ones.
  for(const color of [[.05,.32,.36],[.4,.55,.08],[.9,.75,.5],[.2,.9,1]])samples.push(new THREE.Vector3(...color));
  const dim=samples.length;
  for(const color of [[8,0,0],[0,8,0],[0,0,8],[4,2,.1],[1.5,3,2.8],[128,1,30]])samples.push(new THREE.Vector3(...color));
  const target=new THREE.RenderTarget(samples.length,1,{type:THREE.FloatType,depthBuffer:false});
  const pipeline=new THREE.RenderPipeline(renderer);pipeline.outputColorTransform=false;
  const source=uniformArray(samples).element(uint(screenUV.x.mul(samples.length).floor()));
  const saturation=uniform(1),contrast=uniform(1.15);
  const read=async node=>{
    pipeline.outputNode=vec4(node,1);pipeline.needsUpdate=true;
    await new Promise(requestAnimationFrame);renderer.setRenderTarget(target);renderer.setMRT(null);pipeline.render();
    return await renderer.readRenderTargetPixelsAsync(target,0,0,samples.length,1);
  };
  const difference=(a,b,from=0,to=samples.length)=>{let m=0;for(let i=from*4;i<to*4;i++)if(i%4<3)m=Math.max(m,Math.abs(a[i]-b[i]));return m;};
  let failure,report;
  s.manual=true;device.pushErrorScope('validation');
  try{
    // The transform on its own.
    for(const [sat,con] of [[1,1.15],[1,1],[1.5,1.3],[0,.8]]){
      saturation.value=sat;contrast.value=con;
      const before=await read(previousSDR(source,saturation,contrast)),sdr=await read(filmicHDR(source,saturation,contrast,float(1),float(1)));
      check(`headroom 1 reproduces the previous SDR transform (saturation ${sat}, contrast ${con})`,difference(before,sdr)<1e-5,{maximumError:difference(before,sdr)});
    }
    saturation.value=1;contrast.value=1.15;
    const sdr=await read(filmicHDR(source,saturation,contrast,float(1),float(1))),hdr=await read(filmicHDR(source,saturation,contrast,float(4),float(1)));
    const below=samples.map((v,i)=>.2126*v.x+.7152*v.y+.0722*v.z<=KNEE?i:-1).filter(i=>i>=0);
    const belowError=Math.max(...below.map(i=>difference(sdr,hdr,i,i+1)));
    check(`HDR leaves scene luminance up to the ${KNEE} knee unchanged`,below.length>=8&&belowError<1e-6,{samples:below.length,maximumError:belowError});
    const at=v=>hdr[levels.indexOf(v)*4];
    check('HDR highlights exceed SDR white in brightness order',at(2)>1&&at(4)>at(2)&&at(8)>at(4)&&at(16)>at(8)&&at(4096)>=at(256),{2:at(2),4:at(4),8:at(8),16:at(16),4096:at(4096)});
    check('HDR output is finite, nonnegative and within the peak',hdr.every(x=>Number.isFinite(x)&&x>=0&&x<=4+1e-6));
    check('SDR output stays within white',sdr.every((x,i)=>i%4===3||(x>=0&&x<=1)));
    check('the neutral ramp stays neutral and monotonic',levels.every((_,i)=>Math.abs(hdr[i*4]-hdr[i*4+1])<1e-6&&Math.abs(hdr[i*4+1]-hdr[i*4+2])<1e-6&&(i===0||hdr[i*4]>=hdr[(i-1)*4])));
    // One gain per pixel: every HDR color is its SDR color times a factor >= 1.
    const gains=samples.map((_,i)=>{const c=[0,1,2].filter(c=>sdr[i*4+c]>1e-4);return c.map(c=>hdr[i*4+c]/sdr[i*4+c]);});
    const spread=Math.max(...gains.map(g=>g.length?Math.max(...g)-Math.min(...g):0)),least=Math.min(...gains.flat());
    check('HDR keeps every SDR chromaticity and only brightens',spread<1e-4&&least>=1-1e-6,{spread,least});
    check('saturated highlights exceed white with their SDR hue',hdr[dim*4]>1&&hdr[dim*4+1]===0&&hdr[(dim+4)*4+1]>1,
      {red:Array.from(hdr.slice(dim*4,dim*4+3)),shaft:Array.from(hdr.slice((dim+4)*4,(dim+4)*4+3))});

    // The real frame through the whole chain (sRGB encoding, half-float
    // target, FXAA) into the floating-point canvas, at headroom 1 and 4.
    const context=renderer.backend.context,size=renderer.getDrawingBufferSize(new THREE.Vector2());
    const width=size.x,height=size.y,row=Math.ceil(width*8/256)*256;
    const frame=async peak=>{
      renderer.setRenderTarget(null);renderer.setMRT(null);
      await new Promise(requestAnimationFrame);
      s.post.headroom.value=peak;s.post.pipeline.render();
      const buffer=device.createBuffer({size:row*height,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
      try{
        const encoder=device.createCommandEncoder();
        encoder.copyTextureToBuffer({texture:context.getCurrentTexture()},{buffer,bytesPerRow:row},[width,height,1]);
        device.queue.submit([encoder.finish()]);await buffer.mapAsync(GPUMapMode.READ);
        const halves=new Uint16Array(buffer.getMappedRange()),out=new Float32Array(width*height*3);
        for(let y=0;y<height;y++)for(let x=0;x<width;x++)for(let c=0;c<3;c++)out[(y*width+x)*3+c]=THREE.DataUtils.fromHalfFloat(halves[y*row/2+x*4+c]);
        return out;
      }finally{buffer.destroy();}
    };
    const format=context.getConfiguration().format;
    const frameSDR=await frame(1),frameHDR=await frame(4);
    // Dark and mid tones (encoded below 0.55 in every channel, under the
    // knee for these grades) must match; the rest may only brighten.
    let peakSDR=0,peakHDR=0,above=0,dark=0,changed=0,darker=0;
    for(let p=0;p<frameSDR.length;p+=3){
      const sdrMax=Math.max(frameSDR[p],frameSDR[p+1],frameSDR[p+2]),hdrMax=Math.max(frameHDR[p],frameHDR[p+1],frameHDR[p+2]);
      peakSDR=Math.max(peakSDR,sdrMax);peakHDR=Math.max(peakHDR,hdrMax);if(hdrMax>1)above++;if(hdrMax<sdrMax-.002)darker++;
      if(sdrMax<.55){dark++;if(Math.abs(hdrMax-sdrMax)>.002)changed++;}
    }
    const pixels=frameSDR.length/3;
    const detail={format,peakSDR,peakHDR,aboveWhite:above/pixels,changedDark:changed/Math.max(1,dark),darker:darker/pixels};
    check('the canvas is floating point (on an SDR display, load with ?hdr)',format==='rgba16float',detail);
    check('the SDR frame stays within white',peakSDR<=1+1e-3,detail);
    check('the HDR frame carries highlights above white to the canvas',peakHDR>1&&above>0,detail);
    check('dark and mid tones match the SDR frame',detail.changedDark<.001,detail);
    check('no pixel is darker in HDR, beyond antialiasing',detail.darker<.001,detail);
    report={frame:detail};

    // Automatic display selection on a separate canvas.
    const probe=document.createElement('canvas'),probeContext=probe.getContext('webgpu');
    const query=new EventTarget();query.matches=false;
    probeContext.configure({device,format:'rgba16float',toneMapping:{mode:'extended'}});
    const display=createDisplayOutput({backend:{context:probeContext}},query);
    try{
      const presentation=()=>probeContext.getConfiguration().toneMapping.mode;
      check('an SDR display gets headroom 1 with the presentation unchanged',!display.active&&display.headroom===1&&presentation()==='extended');
      query.matches=true;query.dispatchEvent(new Event('change'));
      check('a display change enables HDR without reconfiguring the canvas',display.active&&display.headroom===4&&presentation()==='extended');
      display.setMode('sdr');check('the SDR override lowers the headroom to 1 and keeps extended presentation',!display.active&&display.headroom===1&&presentation()==='extended');
    }finally{display.dispose();probeContext.unconfigure();}
    report={date:new Date().toISOString(),display:s.displayOutput.inspect(),...report,checks:checks.map(c=>c.name),
      ramp:levels.map((input,i)=>({input,sdr:sdr[i*4],hdr:hdr[i*4]}))};
  }catch(error){failure=error;}
  finally{
    const validation=await device.popErrorScope();if(validation)failure||=new Error(validation.message);
    renderer.setRenderTarget(saved.target);renderer.setMRT(saved.mrt);
    pipeline.dispose();target.dispose();await new Promise(requestAnimationFrame);s.render();s.manual=saved.manual;
  }
  if(failure)throw failure;return report;
}
