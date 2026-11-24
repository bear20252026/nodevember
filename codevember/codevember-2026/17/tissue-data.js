// The blade surface tile, computed without Three.js so a worker can run it.
import { randomSeed } from './random.js';

// One periodic tile of blade surface, in metres along and across the blade.
export const TISSUE_TILE=[.8,.4];
export const WIDTH=1024,HEIGHT=512;
const TEXEL=TISSUE_TILE[0]/WIDTH;
// Corrugation spacing and fold height, read from the backlit references:
// about ten dark folds across a 13 cm blade, a millimetre or so in relief.
const RIDGE_SPACING=.0135,RIDGE_HEIGHT=.00095;
export const SLOPE_RANGE=1.25;

function periodicNoise(columns,rows,random){
  const grid=Float32Array.from({length:columns*rows},()=>random()*2-1);
  const cell=(x,y)=>grid[(y%rows)*columns+(x%columns)];
  const ease=x=>x*x*(3-2*x);
  const lerp=(x,y,t)=>(1-t)*x+t*y; // Same as MathUtils.lerp.
  return (u,v)=>{
    const x=u*columns,y=v*rows,i=Math.floor(x),j=Math.floor(y);
    const a=ease(x-i),b=ease(y-j);
    return lerp(lerp(cell(i,j),cell(i+1,j),a),lerp(cell(i,j+1),cell(i+1,j+1),a),b);
  };
}

// Phasor noise (Tricard et al. 2019): the phase of a sum of Gabor kernels.
// Unlike stripes bent by a warp, its ridges merge and split at phase
// singularities, giving the labyrinthine corrugation of Macrocystis blades.
// The kernels follow a slowly swirling direction field around the blade axis.
function corrugationPhase(random){
  const period=RIDGE_SPACING/TEXEL,frequency=2*Math.PI/period;
  const sigma=.6*period,reach=2.6*sigma,cellSize=1.4*sigma;
  const columns=Math.round(WIDTH/cellSize),rows=Math.round(HEIGHT/cellSize),cw=WIDTH/columns,ch=HEIGHT/rows;
  const swirl=periodicNoise(5,3,random),twist=periodicNoise(13,7,random);
  const impulses=new Float32Array(columns*rows*5);
  for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){
    const x=(i+random())*cw,y=(j+random())*ch,u=x/WIDTH,v=y/HEIGHT;
    // Wave vectors point across the blade, so the folds run along it, with
    // broad herringbone swings and smaller kinks.
    const angle=Math.PI/2+swirl(u,v)*.7+twist(u,v)*.35;
    impulses.set([x,y,Math.cos(angle)*frequency,Math.sin(angle)*frequency,random()*Math.PI*2],(j*columns+i)*5);
  }
  const phase=new Float32Array(WIDTH*HEIGHT),inverse=-1/(2*sigma*sigma),span=Math.ceil(reach/Math.min(cw,ch));
  const wrap=(d,size)=>d>size/2?d-size:d<-size/2?d+size:d;
  for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
    const cx=Math.floor(x/cw),cy=Math.floor(y/ch);let re=0,im=0;
    for(let dj=-span;dj<=span;dj++)for(let di=-span;di<=span;di++){
      const at=(((cy+dj)%rows+rows)%rows*columns+((cx+di)%columns+columns)%columns)*5;
      const dx=wrap(x-impulses[at],WIDTH),dy=wrap(y-impulses[at+1],HEIGHT),r2=dx*dx+dy*dy;
      if(r2>reach*reach)continue;
      const w=Math.exp(r2*inverse),p=impulses[at+2]*dx+impulses[at+3]*dy+impulses[at+4];
      re+=w*Math.cos(p);im+=w*Math.sin(p);
    }
    phase[y*WIDTH+x]=Math.atan2(im,re);
  }
  return phase;
}

// RGBA8 tile: surface slope along and across the blade (R, G), the mean squared
// slope (B, so mipmaps keep the variance of filtered folds), and optical
// density relative to the blade's mean thickness (A).
export function generateTissueData(seed=160326){
  const random=randomSeed(seed),phase=corrugationPhase(random);
  const relief=periodicNoise(4,2,random),mottle=periodicNoise(9,5,random),blotch=periodicNoise(23,11,random);
  const height=new Float32Array(WIDTH*HEIGHT),density=new Float32Array(WIDTH*HEIGHT);
  for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
    const i=y*WIDTH+x,u=x/WIDTH,v=y/HEIGHT,s=Math.sin(phase[i]);
    // Folds are rounded troughs with slightly pinched crests; their height
    // varies over the blade.
    const fold=Math.sign(s)*Math.abs(s)**.8*(.8+.3*relief(u,v));
    height[i]=RIDGE_HEIGHT*fold;
    // Tissue gathers at the crests, which read as dark wavy lines against
    // the light; mottling and faint blotches vary pigment density.
    const crest=((.5+.5*s)**6);
    density[i]=.64+1.7*crest+.17*mottle(u,v)+.1*blotch(u,v);
  }
  const data=new Uint8Array(WIDTH*HEIGHT*4),encode=x=>Math.round(255*Math.min(1,Math.max(0,x)));
  for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
    const i=y*WIDTH+x;
    const gx=(height[y*WIDTH+(x+1)%WIDTH]-height[y*WIDTH+(x+WIDTH-1)%WIDTH])/(2*TEXEL);
    const gy=(height[((y+1)%HEIGHT)*WIDTH+x]-height[((y+HEIGHT-1)%HEIGHT)*WIDTH+x])/(2*TEXEL);
    data[i*4]=encode(.5+.5*gx/SLOPE_RANGE);data[i*4+1]=encode(.5+.5*gy/SLOPE_RANGE);
    data[i*4+2]=encode((gx*gx+gy*gy)/SLOPE_RANGE**2);data[i*4+3]=encode(density[i]/3);
  }
  return {data,width:WIDTH,height:HEIGHT};
}
