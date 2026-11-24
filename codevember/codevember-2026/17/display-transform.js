import { Fn, float, mix, vec3 } from 'three/tsl';

// HDR gain: scene luminance up to KNEE (the open water and shaded kelp) keeps
// the SDR output; above it the gain rises smoothly over SPAN stops to the
// display's peak, so sun shafts and the bright surface gain range, not only
// the sun itself.
export const KNEE=.3,SPAN=5;
const REC709=vec3(.2126,.7152,.0722);

// Scene-linear radiance in, linear display values out (renderOutput applies
// the sRGB encoding afterwards):
// - Narkowicz's fit of the ACES filmic curve, per channel;
// - saturation that favours warm hues, so sunlit kelp reaches the chartreuse
//   of the references while the water, already close in hue and saturation,
//   moves less; and contrast pivoting on mid-grey. Both work in display
//   space and are clipped at SDR white, as the 8-bit output used to be;
// - on an HDR display, that SDR result times one gain per pixel:
//   1 + (peak - 1) smoothstep(log2(L / KNEE) / SPAN), with L the scene
//   luminance before the artistic exposure, so which parts of the scene count
//   as highlights does not change with the look. One gain for all three
//   channels keeps every color's SDR chromaticity.
// Headroom 1 reproduces the SDR transform exactly.
export const filmicHDR=Fn(([radiance,saturation,contrast,headroom,exposure])=>{
  const mapped=radiance.mul(2.51).add(.03).mul(radiance).div(radiance.mul(2.43).add(.59).mul(radiance).add(.14)).clamp().toVar();
  const luminance=mapped.dot(REC709);
  const warmth=mapped.r.add(mapped.g).mul(.5).sub(mapped.b).div(mapped.r.max(mapped.g).max(mapped.b).max(1e-4)).smoothstep(0,.6);
  const graded=mix(vec3(luminance),mapped,mix(float(1.06),float(1.3),warmth).mul(saturation)).max(0).pow(1.04)
    .div(.18).pow(contrast).mul(.18);
  const stops=radiance.max(0).dot(REC709).div(exposure).div(KNEE).max(1e-6).log2().div(SPAN).clamp().toVar();
  const gain=stops.mul(stops).mul(stops.mul(-2).add(3)).mul(headroom.sub(1)).add(1);
  return graded.min(1).mul(gain);
});
