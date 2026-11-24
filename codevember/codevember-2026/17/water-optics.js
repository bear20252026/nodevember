import { Color, Vector3 } from 'three/webgpu';
import { float, uniform, vec3 } from 'three/tsl';

export const SURFACE=30;
export const SUN=new Vector3(.05,.74,-.67).normalize();
export const SUN_TINT='#fff5d8';
export const SUN_IRRADIANCE=4.2;
export const IOR=1.333;

// Appearance fit for the deeper California flight. Extinction is in m^-1.
// A narrow particle lobe spreads silhouettes, a broader one lights the water
// around the sun, and the backward component fixes the hemispheric fraction.
const forward=.952,broad=.72,broadWeight=.28,backward=-.42,backscatter=.038;
const backscatterFraction=g=>(1-g*g)/(2*g)*(1/Math.sqrt(1+g*g)-1/(1+g));
const frontBackscatter=(1-broadWeight)*backscatterFraction(forward)+broadWeight*backscatterFraction(broad);
const backwardWeight=(backscatter-frontBackscatter)/(backscatterFraction(backward)-frontBackscatter);
export const WATER={absorption:[.144,.041,.027],particles:[.053,.074,.078],molecules:[.0014,.0027,.0058],
  forward,broad,broadWeight,backward,backwardWeight,backscatter};
export const EXTINCTION=WATER.absorption.map((a,i)=>a+WATER.particles[i]+WATER.molecules[i]);
export const SKY_HORIZON=[.105,.24,.29];
export const SKY_ZENITH=[.16,.34,.47];

export function fresnelWater(mu){
  const discriminant=1-IOR**2*(1-mu**2);
  if(discriminant<=0)return 1;
  const transmitted=Math.sqrt(discriminant);
  const s=(IOR*mu-transmitted)/(IOR*mu+transmitted);
  const p=(mu-IOR*transmitted)/(mu+IOR*transmitted);
  return .5*(s*s+p*p);
}

export function sunColor(){
  return new Color(SUN_TINT).multiplyScalar(SUN_IRRADIANCE*(1-fresnelWater(SUN.y)));
}

export function createWaterOptics(){
  const density=uniform(.8);
  const extinction=vec3(...EXTINCTION).mul(density);
  const transmittance=distance=>extinction.mul(distance).negate().exp();
  return {
    density,extinction,transmittance,
    sunlightAt:height=>transmittance(float(SURFACE).sub(height).max(0).div(SUN.y))
  };
}
