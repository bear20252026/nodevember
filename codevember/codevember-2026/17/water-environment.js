import * as THREE from 'three/webgpu';
import { Fn, float, mix, positionLocal, texture, uniform, vec2, vec3 } from 'three/tsl';
import { EXTINCTION, IOR, SKY_HORIZON, SKY_ZENITH, SURFACE } from './water-optics.js';

// The light arriving from every direction at one depth, rendered once into a
// cube map that Three.js prefilters into a PMREM for scene.environment. The
// water column is horizontally uniform, so one map, rendered for the
// opening depth, serves the whole scene; it does not follow the flight down
// to the reef. The
// post-processing pass adds the water to the view, so a render of the scene
// itself would show unlit kelp on black.
export function createWaterEnvironment(column,density,{size=128}={}){
  const depth=uniform(0),field=texture(column.map);
  const radiance=Fn(()=>{
    const direction=positionLocal.normalize(),mu=direction.y;
    // Diffuse in-scatter from the water-column solve, as in the water pass.
    const row=depth.mul(density).div(column.spacing).add(.5).div(column.height);
    const scattered=field.sample(vec2(mu.mul(.5).add(.5),row)).level(0).rgb;
    // Skylight inside the Snell window: the solver's surface boundary
    // (refracted sky through the Fresnel transmittance), attenuated along
    // the slant path up to the surface.
    const air=float(1).sub(mu.mul(mu).oneMinus().mul(IOR*IOR)),cosine=air.max(0).sqrt();
    const s=mu.mul(IOR).sub(cosine).div(mu.mul(IOR).add(cosine)),p=mu.sub(cosine.mul(IOR)).div(mu.add(cosine.mul(IOR)));
    const transmitted=s.mul(s).add(p.mul(p)).mul(.5).oneMinus();
    const sky=mix(vec3(...SKY_HORIZON),vec3(...SKY_ZENITH),cosine).mul(transmitted).mul(IOR*IOR);
    const path=vec3(...EXTINCTION).mul(density).mul(depth).div(mu.max(1e-3));
    return scattered.add(mu.greaterThan(0).and(air.greaterThan(0)).select(sky.mul(path.negate().exp()),vec3(0)));
  })();
  const material=new THREE.MeshBasicNodeMaterial({side:THREE.BackSide,depthTest:false,depthWrite:false});
  material.colorNode=radiance;material.fog=false;
  const scene=new THREE.Scene();scene.add(new THREE.Mesh(new THREE.SphereGeometry(1,64,32),material));
  const target=new THREE.CubeRenderTarget(size,{type:THREE.HalfFloatType});
  target.texture.name='Water radiance';
  const camera=new THREE.CubeCamera(.1,10,target);
  return {
    texture:target.texture,depth,
    // Renders the map for the depth of `view`; the PMREM follows on first use.
    render(renderer,view){
      depth.value=Math.max(0,SURFACE-view.position.y);
      camera.update(renderer,scene);
      target.texture.needsPMREMUpdate=true;
    }
  };
}
