import * as THREE from 'three/webgpu';
import { Fn, If, Loop, float, int, mix, step, uniform, uniformArray, vec2, vec3, vec4, instanceIndex, vertexIndex, positionLocal, varyingProperty, storage, refract, texture, uv } from 'three/tsl';
import { SUN, SURFACE } from './materials.js';
import { IOR } from './water-optics.js';

// One periodic 12 m sea shared by the visible surface, the photon maps and
// the volume. Wave vectors lie on the 12 m lattice so every receiver tiles.
const EXTENT=12,LATTICE=2*Math.PI/EXTENT,GRAVITY=9.81;
// The local wind sea travels roughly away from the sun; two longer swell
// trains arrive from a nearby direction. Slower than deep-water dispersion
// so the light moves at the pace of the surge in the footage.
const WIND=Math.atan2(-.55,.84),SPEED=.75;
export const WAVES=(()=>{
  const list=[],used=new Set();
  function add(length,angle,slope,phase){
    const n=EXTENT/length;
    for(let attempt=0;attempt<16;attempt++){
      const a=angle+attempt*.17*(attempt%2?1:-1);
      const x=Math.round(Math.cos(a)*n),z=Math.round(Math.sin(a)*n);
      if((x||z)&&!used.has(`${x},${z}`)&&!used.has(`${-x},${-z}`)){
        used.add(`${x},${z}`);
        const kx=x*LATTICE,kz=z*LATTICE,k=Math.hypot(kx,kz);
        list.push({kx,kz,k,amplitude:slope/k,omega:Math.sqrt(GRAVITY*k)*SPEED,phase});
        return;
      }
    }
  }
  add(12,WIND+.45,.026,.7);add(6,WIND+.32,.03,2.1);
  // Equal slope per log-spaced band (a Phillips-like k^-4 height spectrum),
  // tapered below 1.5 m where the floating canopy damps the short chop.
  // Shorter waves spread over more directions. Their curvature focuses the
  // sharp network a few metres down; longer waves focus deeper and broader.
  const count=26,longest=4.5,shortest=.3;
  for(let i=0;i<count;i++){
    const t=i/(count-1),length=longest*(shortest/longest)**t;
    const u=((i*.6180339887+.31)%1)*2-1,angle=WIND+(.3+1.25*t)*u;
    const canopy=Math.min(1,Math.max(0,(length-.35)/1.15)),damping=.42+.58*canopy*canopy*(3-2*canopy);
    add(length,angle,.042*damping*(.55+.45*Math.cos(angle-WIND)**2),i*2.3999632+.7);
  }
  return list;
})();

// Day 10's refracted photon sheets and rasterized area-ratio reconstruction,
// now at eight receiver depths. Each sheet covers its 12 m tile plus the
// largest lateral refraction offset at that depth, so few photons are lost.
export function createCaustics(current){
  const strength=uniform(.65),amplitude=uniform(1),time=current.time;
  const depths=[1,2.5,4.5,7.5,11.5,16.5,23.5,33.5],layers=depths.length,columns=4,rows=2,tileSize=512;
  const texelsPerMetre=tileSize/EXTENT;
  const sourceExtents=depths.map(d=>EXTENT+2*(.3+.075*d));
  // A wave displaces refracted rays sideways by about 0.6 d times its slope.
  // Well past its focus the sheet folds over repeatedly: the fine pattern is
  // incoherent and finer than the photon grid, so a sheet drops that wave and
  // applies the same displacement variance as blur. The two deepest sheets,
  // blurred most by the sun disk, keep only waves that have not yet focused
  // (focus is at a displacement of about 1/(2 pi) wavelengths).
  const displacement=WAVES.map(w=>.6*w.amplitude*w.k**2/(2*Math.PI));
  const foldStart=depths.map((d,i)=>i<6?.3:.04),foldWidth=depths.map((d,i)=>i<6?.45:.12);
  const coherence=(layer,i)=>{
    const x=Math.min(1,Math.max(0,(depths[layer]*displacement[i]-foldStart[layer])/foldWidth[layer]));
    return 1-x*x*(3-2*x);
  };
  // Shallow sheets resolve the 0.3 m waves; deeper sheets keep only longer
  // ones (see coherence below) and need fewer photons.
  const groupLayout=[{first:0,count:5,segments:224},{first:5,count:1,segments:160},{first:6,count:2,segments:96,unfolded:true}];
  const segmentsAt=layer=>groupLayout.find(g=>layer>=g.first&&layer<g.first+g.count).segments;
  // Sun-disk blur: the 0.53 degree sun subtends about 0.4 degrees in water,
  // spreading each focus by roughly 0.0021 d m. Reconstruction blur grows
  // with the photon cell and with folding, hiding flat-shaded triangle edges.
  const sigmas=depths.map((d,layer)=>{
    const scrambled=WAVES.reduce((sum,w,i)=>sum+(.6*d*w.amplitude*w.k)**2*(1-coherence(layer,i)**2)/4,0);
    const cell=sourceExtents[layer]/segmentsAt(layer)*texelsPerMetre,reconstruction=.4*cell*(1+d/15);
    return Math.sqrt(reconstruction**2+(.0021*d*texelsPerMetre)**2+scrambled*texelsPerMetre**2);
  });
  const receiverDepths=uniformArray(depths),sources=uniformArray(sourceExtents),blur=uniformArray(sigmas);
  const folds=uniformArray(foldStart),foldWidths=uniformArray(foldWidth);
  const airSun=new THREE.Vector3(SUN.x*IOR,Math.sqrt(1-IOR**2*(1-SUN.y**2)),SUN.z*IOR);

  // (dh/dx, dh/dz, height, unresolved slope variance). A footprint in metres
  // removes waves shorter than a pixel and returns their slope variance; a
  // receiver layer keeps only the waves that are still coherent there.
  function waves(p,footprint=null,layer=null,count=WAVES.length){
    const field=vec4(0).toVar();
    WAVES.slice(0,count).forEach((w,i)=>{
      const phase=p.x.mul(w.kx).add(p.y.mul(w.kz)).sub(time.mul(w.omega)).add(w.phase);
      let a=amplitude.mul(w.amplitude),residual=float(0);
      if(footprint){
        const kept=footprint.mul(w.k).pow2().mul(-.5).exp();
        residual=kept.pow2().oneMinus().mul(amplitude.pow2().mul((w.amplitude*w.k)**2*.5));
        a=a.mul(kept);
      }
      if(layer!==null)a=a.mul(float(1).sub(receiverDepths.element(layer).mul(displacement[i]).sub(folds.element(layer)).div(foldWidths.element(layer)).clamp().smoothstep(0,1)));
      const c=phase.cos();
      field.addAssign(vec4(c.mul(a.mul(w.kx)),c.mul(a.mul(w.kz)),phase.sin().mul(a),residual));
    });
    return field;
  }

  // One-channel target: add photon density without reading source alpha.
  const material=()=>new THREE.MeshBasicNodeMaterial({side:THREE.DoubleSide,forceSinglePass:true,transparent:true,blending:THREE.CustomBlending,
    blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor,blendSrcAlpha:THREE.OneFactor,blendDstAlpha:THREE.OneFactor,
    depthTest:false,depthWrite:false,toneMapped:false,fog:false});
  const scene=new THREE.Scene();
  const groups=groupLayout.map(({first,count:layerCount,segments,unfolded=false})=>{
    const count=(segments+1)**2;
    const positions=new THREE.StorageBufferAttribute(count*layerCount,4);
    const writable=storage(positions,'vec4'),readable=storage(positions,'vec4').toReadOnly();
    const compute=Fn(()=>{
      const index=instanceIndex,layer=index.div(count).add(first),local=index.mod(count);
      const d=receiverDepths.element(layer);
      const grid=vec2(local.mod(segments+1).toFloat().div(segments).sub(.5),float(.5).sub(local.div(segments+1).toFloat().div(segments)));
      // Shift each source patch to cover its receiver along the mean solar ray.
      const surfaceXZ=grid.mul(sources.element(layer)).add(vec2(SUN.x,SUN.z).mul(d.div(SUN.y))),wave=waves(surfaceXZ,null,layer);
      const normal=vec3(wave.x.negate(),1,wave.y.negate()).normalize();
      const ray=refract(vec3(airSun).negate(),normal,float(1/IOR));
      const origin=vec3(surfaceXZ.x,wave.z,surfaceXZ.y);
      const hit=origin.add(ray.mul(d.negate().sub(origin.y).div(ray.y.min(-.05))));
      writable.element(index).assign(vec4(hit,1));
    })().compute(count*layerCount).setName('Caustic photons');
    const sourceV=varyingProperty('vec3','photonSource'),targetV=varyingProperty('vec3','photonTarget'),densityV=varyingProperty('float','photonDensity');
    const photons=material(),n=segments+1;
    photons.vertexNode=Fn(()=>{
      const layer=instanceIndex.add(first),base=instanceIndex.mul(count),i=vertexIndex;
      const hit=readable.element(base.add(i)).xyz;
      sourceV.assign(vec3(positionLocal.x,0,positionLocal.y).mul(sources.element(layer)));targetV.assign(hit);
      if(unfolded){
        // An unfolded sheet has a smooth refraction map. Its inverse area
        // scale, from central differences with neighbouring photons, varies
        // smoothly; flat per-triangle values would print the photon grid
        // through the wide, strided blur these deep sheets receive.
        const at=j=>readable.element(base.add(j)).xz,ix=i.mod(n),iy=i.div(n),spacing=sources.element(layer).div(segments);
        const left=ix.greaterThan(0).select(i.sub(1),i),right=ix.lessThan(segments).select(i.add(1),i);
        const up=iy.greaterThan(0).select(i.sub(n),i),down=iy.lessThan(segments).select(i.add(n),i);
        const du=at(right).sub(at(left)).div(right.sub(left).toFloat().mul(spacing));
        const dv=at(down).sub(at(up)).div(down.sub(up).div(n).toFloat().mul(spacing));
        densityV.assign(float(1).div(du.x.mul(dv.y).sub(du.y.mul(dv.x)).abs().max(1/48)));
      }
      const cell=vec2(layer.mod(columns).toFloat(),layer.div(columns).toFloat());
      const atlas=hit.xz.div(EXTENT).add(.5).add(cell).div(vec2(columns,rows));
      return vec4(atlas.x.mul(2).sub(1),atlas.y.mul(-2).add(1),0,1);
    })();
    photons.fragmentNode=Fn(()=>{
      // Derivatives precede discard, as in Day 10, to avoid invalid quads.
      // Each triangle's area ratio conserves the energy of its photons.
      const before=sourceV.dFdx().cross(sourceV.dFdy()).length().toVar();
      const after=targetV.dFdx().cross(targetV.dFdy()).length().max(1e-8).toVar();
      targetV.x.abs().greaterThan(EXTENT*.5).or(targetV.z.abs().greaterThan(EXTENT*.5)).discard();
      return vec4(unfolded?densityV:before.div(after).min(48),0,0,1);
    })();
    const geometry=new THREE.PlaneGeometry(1,1,segments,segments),mesh=new THREE.InstancedMesh(geometry,photons,layerCount);
    mesh.frustumCulled=false;scene.add(mesh);
    return {compute,positions,mesh,segments,first,count:layerCount};
  });
  const makeTarget=()=>new THREE.RenderTarget(columns*tileSize,rows*tileSize,{type:THREE.HalfFloatType,format:THREE.RedFormat,depthBuffer:false});
  const raw=makeTarget(),scratch=makeTarget(),map=makeTarget();
  map.texture.generateMipmaps=true;
  map.texture.minFilter=THREE.LinearMipmapLinearFilter;
  raw.texture.name='Caustic photon density';map.texture.name='Caustics at eight water depths';
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const atlasSize=vec2(columns,rows);
  function filter(source,axis){
    const m=new THREE.MeshBasicNodeMaterial({depthTest:false,depthWrite:false,toneMapped:false,fog:false});
    m.fragmentNode=Fn(()=>{
      const grid=uv().mul(atlasSize),cell=grid.floor(),at=grid.fract();
      const sigma=blur.element(cell.y.mul(columns).add(cell.x).toInt()),radius=sigma.mul(2.2).ceil().min(12).toInt();
      const sum=float(0).toVar(),total=float(0).toVar();
      // Normalized Gaussian taps wrap within the periodic tile, preserving
      // flat-water irradiance and tile continuity.
      const tap=(x,weight)=>{
        const at2=at.add(axis.mul(x.div(tileSize))).fract().clamp(.5/tileSize,1-.5/tileSize);
        sum.addAssign(texture(source).sample(at2.add(cell).div(atlasSize)).level(0).r.mul(weight));
        total.addAssign(weight);
      };
      const gauss=x=>x.mul(x).div(sigma.mul(sigma).mul(-2)).exp();
      If(sigma.mul(2.2).lessThanEqual(12),()=>{
        // Dense kernels: one bilinear fetch covers two adjacent texels.
        tap(float(0),float(1));
        Loop({start:0,end:radius.add(1).div(2),type:'int'},({i})=>{
          const x1=float(i).mul(2).add(1),x2=x1.add(1),w1=gauss(x1),w2=x2.lessThanEqual(float(radius)).select(gauss(x2),float(0));
          const weight=w1.add(w2),offset=x1.mul(w1).add(x2.mul(w2)).div(weight);
          tap(offset,weight);tap(offset.negate(),weight);
        });
      }).Else(()=>{
        // Wide kernels (deep sheets) space their taps; those sheets are smooth
        // and contain only long waves, so the strided taps stay well sampled.
        const stride=sigma.mul(2.2).div(float(radius));
        Loop({start:radius.negate(),end:radius,type:'int',condition:'<='},({i})=>{
          const x=float(i).mul(stride);tap(x,gauss(x));
        });
      });
      return vec4(sum.div(total),0,0,1);
    })();
    return new THREE.QuadMesh(m);
  }
  const horizontal=filter(raw.texture,vec2(1,0)),vertical=filter(scratch.texture,vec2(0,1));
  const sampleIrradiance=Fn(([p,level])=>{
    const d=float(SURFACE).sub(p.y).max(0);
    let lowerIndex=float(0);
    for(let i=1;i<layers-1;i++)lowerIndex=lowerIndex.add(step(depths[i],d));
    const lower=lowerIndex.toInt();
    const sample=layer=>{
      const plane=receiverDepths.element(layer),q=p.xz.add(vec2(SUN.x,SUN.z).mul(d.sub(plane)).div(SUN.y));
      const cell=vec2(layer.mod(columns).toFloat(),layer.div(columns).toFloat());
      const margin=level.ceil().exp2().mul(.5/tileSize);
      const at=q.div(EXTENT).add(.5).fract().clamp(margin,margin.oneMinus()).add(cell).div(atlasSize);
      return texture(map.texture).sample(at).level(level).r;
    };
    const next=lower.add(1);
    const weight=d.sub(receiverDepths.element(lower)).div(receiverDepths.element(next).sub(receiverDepths.element(lower))).clamp();
    // TSL's chained t.mix(a,b) puts the factor first. Use explicit mix(a,b,t)
    // so both depth interpolation and the surface fade preserve the pattern.
    const irradiance=mix(sample(lower),sample(next),weight);
    return mix(float(1),irradiance,d.div(depths[0]).clamp());
  });
  const causticIrradiance=p=>vec3(sampleIrradiance(p,float(0)));
  return {time,amplitude,strength,waves,spectrum:WAVES,depths,tileSize,extent:EXTENT,columns,rows,sigmas,groups,scene,map,raw,causticIrradiance,
    modulation:(p,level=float(0))=>vec3(mix(float(1),sampleIrradiance(p,level),strength)),
    scalarModulation:(p,level=float(0))=>mix(float(1),sampleIrradiance(p,level),strength),
    render(renderer){
      const target=renderer.getRenderTarget(),autoClear=renderer.autoClear,color=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha();
      try{
        renderer.autoClear=false;renderer.setClearColor(0,0);for(const group of groups)renderer.compute(group.compute);
        renderer.setRenderTarget(raw);renderer.clear();renderer.render(scene,camera);
        renderer.setRenderTarget(scratch);horizontal.render(renderer);
        renderer.setRenderTarget(map);vertical.render(renderer);
      }finally{renderer.setRenderTarget(target);renderer.autoClear=autoClear;renderer.setClearColor(color,alpha);}
    },
    dispose(){for(const g of groups){g.mesh.geometry.dispose();g.mesh.material.dispose();g.mesh.dispose();g.positions.dispose();g.compute.dispose();}raw.dispose();scratch.dispose();map.dispose();horizontal.material.dispose();vertical.material.dispose();}
  };
}
