import { Fn, If, float, mix, vec2, vec3, vec4 } from 'three/tsl';
import { IOR, SKY_HORIZON, SKY_ZENITH, SUN, SURFACE } from './water-optics.js';

// Capillary ripples, 5 to 22 cm. They focus light within a metre, so they
// only matter for the surface seen from below, where their steep facets
// break Snell's window into glitter and dark streaks. Capillary-gravity
// dispersion (surface tension 7.3e-5 m^3/s^2), slowed like the swell.
// Jittered lengths and directions keep the sum from tiling visibly.
const RIPPLES=Array.from({length:16},(_,i)=>{
  const t=(i+.5*Math.sin(i*12.9898)**2)/16,length=.22*(.05/.22)**t,k=2*Math.PI/length;
  const angle=i*2.399963+.9+.35*Math.sin(i*4.1);
  return {x:Math.cos(angle)*k,z:Math.sin(angle)*k,k,slope:.042,omega:Math.sqrt(9.81*k+7.3e-5*k**3)*.45,phase:i*1.731};
});

// Footprints per ripple wavelength before a ripple counts as resolved: it is
// half kept at about 21 pixels per wavelength across the view.
const RESOLVE=4;

// Air/water boundary viewed from below. The wave slope drives both Fresnel
// reflection and Snell refraction; facets beyond the critical angle reflect
// the underwater environment instead of showing sky. Waves shorter than the
// pixel footprint are filtered out, and their slope variance spreads the
// Fresnel, refraction and sun glint instead of aliasing.
export function createOceanSurface(waves,upwelling,pixelAngle,time){
  const eta=IOR;
  const airSun=vec3(SUN.x*eta,Math.sqrt(1-eta*eta*(1-SUN.y*SUN.y)),SUN.z*eta);
  // The sky seen through the surface. A clear sky brightens and whitens
  // toward the horizon, and forward scattering in the air surrounds the sun
  // with a bright aureole. Refraction compresses the whole sky into Snell's
  // window, so this aureole is what fills the window around the sun with
  // glitter. The water's diffuse-light solve keeps its simpler sky.
  const sky=refracted=>{
    const elevation=refracted.y.max(0);
    const gradient=mix(vec3(...SKY_HORIZON),vec3(...SKY_ZENITH),elevation);
    const haze=vec3(.30,.33,.33).mul(elevation.oneMinus().pow(4));
    const angle=refracted.dot(airSun).clamp(-1,1).acos();
    const aureole=vec3(1,.94,.82).mul(angle.div(-.12).exp().mul(2.6).add(angle.div(-.55).exp().mul(.35)));
    return gradient.add(haze).add(aureole);
  };
  const critical=Math.sqrt(1-1/(eta*eta));
  // soft: the spread of incidence cosines a facet stands for. Reflectance
  // climbs to total reflection within a few degrees of the critical angle,
  // so averaging a few facets that switch abruptly leaves flat bands with
  // hard edges. Blurring the switch over each facet's share of the spread
  // keeps the average smooth; a resolved facet switches exactly.
  const facet=(direction,normal,soft=null)=>{
    const incidence=direction.dot(normal).clamp(.001,1);
    const ci=soft?incidence.max(critical+1e-3):incidence,k=float(1).sub(ci.pow2().oneMinus().mul(eta*eta));
    const ct=k.max(0).sqrt();
    const rs=ci.mul(eta).sub(ct).div(ci.mul(eta).add(ct));
    const rp=ci.sub(ct.mul(eta)).div(ci.add(ct.mul(eta)));
    const partial=rs.pow2().add(rp.pow2()).mul(.5);
    const fresnel=soft?mix(float(1),partial,incidence.smoothstep(soft.negate().add(critical),soft.add(critical))):k.lessThan(0).select(1,partial);
    const refracted=direction.mul(eta).add(normal.mul(ct.sub(ci.mul(eta)))).normalize();
    return {fresnel,refracted,radiance:sky(refracted).mul(eta*eta).mul(fresnel.oneMinus()).add(upwelling(direction.reflect(normal)).mul(fresnel))};
  };
  // Ripple slopes and the variance of those finer than the footprint. Wind
  // ripples gather on the crests and forward faces of the longer waves.
  // A pixel's footprint is `across` wide and 1/rise times longer along the
  // view, so each ripple is filtered by the footprint along its own wave
  // vector. An isotropic average let ripples running along the view alias
  // into dashes at grazing angles. These are long-crested sines, while real
  // capillary ripples are short-crested; resolved a few pixels across they
  // read as ruled lines, so a ripple is kept only once it spans a few dozen
  // pixels (near the surface). Until then its slopes become variance, which
  // spreads the reflection and sun glint into soft glitter.
  const ripples=(p,across,view,stretch,crest)=>{
    const field=vec3(0).toVar(),patch=crest.smoothstep(-.03,.06).mul(.85).add(.15);
    for(const r of RIPPLES){
      const along=view.x.mul(r.x/r.k).add(view.y.mul(r.z/r.k));
      const kept=across.mul(r.k*RESOLVE).pow2().mul(along.pow2().mul(stretch).add(1)).mul(-.5).exp();
      const phase=p.x.mul(r.x).add(p.y.mul(r.z)).sub(time.mul(r.omega)).add(r.phase);
      const slope=phase.cos().mul(kept.mul(r.slope/r.k));
      field.addAssign(vec3(slope.mul(r.x),slope.mul(r.z),kept.pow2().oneMinus().mul(r.slope**2*.5)));
    }
    return field.mul(vec3(patch,patch,patch.pow2()));
  };
  const radiance=Fn(([direction,origin])=>{
    const rise=direction.y.max(.001);
    const flatDistance=float(SURFACE).sub(origin.y).div(rise);
    // Pixel footprint on the surface, stretched by the grazing view.
    const footprint=flatDistance.mul(pixelAngle).div(rise.sqrt()).toVar();
    // Only the longer waves move the surface by more than a few millimetres.
    const height=waves(origin.add(direction.mul(flatDistance)).xz,footprint,null,10).z;
    const distance=float(SURFACE).add(height).sub(origin.y).div(rise).max(0).toVar();
    const at=origin.add(direction.mul(distance)).xz;
    const horizontal=vec2(direction.x,direction.z),view=horizontal.div(horizontal.length().max(1e-4));
    const across=flatDistance.mul(pixelAngle),stretch=rise.pow2().reciprocal().sub(1);
    const swell=waves(at,footprint).toVar(),ripple=ripples(at,across,view,stretch,swell.z);
    const w=swell.add(vec4(ripple.xy,0,ripple.z)).toVar();
    // The sun is far brighter than the sky, so its glint uses the mean facet
    // with a lobe widened by the unresolved slopes, preserving its energy.
    const mean=facet(direction,vec3(w.x.negate(),1,w.y.negate()).normalize());
    const result=mean.radiance.toVar();
    // Where waves fall below a pixel, four sigma points reproduce their slope
    // covariance; nearby, the resolved facet alone is exact.
    const spread=w.w.sqrt();
    If(spread.greaterThan(.004),()=>{
      result.assign(vec3(0));
      // Each point stands for slopes about one spread wide; the cosine
      // changes with slope by the horizontal part of the view direction.
      const soft=spread.mul(direction.y.pow2().oneMinus().max(0).sqrt()).max(.002);
      for(const [x,z] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const normal=vec3(w.x.add(spread.mul(x)).negate(),1,w.y.add(spread.mul(z)).negate()).normalize();
        result.addAssign(facet(direction,normal,soft).radiance.mul(.25));
      }
    });
    const sunWidth=w.w.mul(.77).add(3.6e-5);
    const glint=mean.refracted.dot(airSun).oneMinus().div(sunWidth).negate().exp().mul(float(3.6e-5).div(sunWidth));
    result.addAssign(vec3(42,38,30).mul(glint).mul(mean.fresnel.oneMinus()).mul(eta*eta));
    return vec4(result,distance);
  });
  return {radiance};
}
