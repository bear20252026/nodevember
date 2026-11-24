import { BufferGeometry, Float32BufferAttribute, Vector3, Color } from 'three/webgpu';

// Nose to caudal base. Each station gives x, upper and lower silhouette and
// half-width, in fractions of total length. The blacksmith (Chromis
// punctipinnis) is deep and oval with a blunt head and a deep peduncle; the
// señorita (Oxyjulis californica) is a slender cigar with a pointed snout.
// The garibaldi (Hypsypops rubicundus), another damselfish, is built like
// the blacksmith but deeper still.
const BLACKSMITH=[
  [.450,.012,-.012,.010],[.430,.040,-.036,.034],[.400,.071,-.062,.056],[.350,.106,-.091,.077],
  [.280,.141,-.121,.093],[.200,.166,-.143,.103],[.100,.180,-.156,.107],[.000,.182,-.156,.103],
  [-.100,.170,-.145,.093],[-.200,.139,-.117,.073],[-.280,.099,-.082,.051],[-.330,.068,-.056,.035],
  [-.370,.052,-.044,.024],[-.390,.046,-.040,.019]
];
const SENORITA=[
  [.480,.006,-.008,.007],[.460,.020,-.016,.017],[.420,.040,-.030,.033],[.360,.062,-.046,.047],
  [.280,.080,-.060,.057],[.180,.090,-.070,.062],[.060,.093,-.074,.063],[-.060,.090,-.071,.060],
  [-.170,.080,-.063,.052],[-.260,.064,-.050,.040],[-.330,.047,-.037,.028],[-.370,.038,-.030,.021],
  [-.390,.035,-.028,.018]
];
const GARIBALDI=BLACKSMITH.map(([x,top,bottom,width])=>[x,top*1.12,bottom*1.12,width*1.04]);
// Mesh parts, read by the skin and the swimming kinematics.
export const PART={body:0,caudal:1,dorsal:2,anal:3,pectoral:4,pelvic:5,eye:6,mouth:7};
const white=[1,1,1],swatch=[.98,.98];
const point=(x,y,z)=>new Vector3(x,y,z);
const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};

// species: 'blacksmith', 'senorita' or 'garibaldi'.
export function createFishGeometry(species,near){
  const wrasse=species==='senorita',garibaldi=species==='garibaldi';
  const profile=wrasse?SENORITA:garibaldi?GARIBALDI:BLACKSMITH,p=[],uv=[],color=[],motion=[],anchors=[],parts=[],indices=[];
  function vertex(v,coord,part,tint=white,pectoral=0,span=0,membrane=0,roughness=.40,hinge=null){
    const i=p.length/3;p.push(v.x,v.y,v.z);uv.push(...coord);color.push(...tint);parts.push(part);
    motion.push(pectoral,span,membrane,roughness);anchors.push(hinge?.x??0,hinge?.y??0,hinge?.z??0);return i;
  }
  // Catmull-Rom between stations keeps the outline smooth at close range.
  const sections=[],steps=near?4:1;
  for(let i=0;i<profile.length-1;i++){
    const l=profile[Math.max(i-1,0)],a=profile[i],b=profile[i+1],r=profile[Math.min(i+2,profile.length-1)];
    for(let s=0;s<steps;s++){
      const t=s/steps,t2=t*t,t3=t2*t;
      sections.push(a.map((_,j)=>.5*(2*a[j]+(b[j]-l[j])*t+(2*l[j]-5*a[j]+4*b[j]-r[j])*t2+(3*a[j]-l[j]-3*b[j]+r[j])*t3)));
    }
  }
  sections.push(profile.at(-1));
  const sides=near?28:8,firstX=profile[0][0],lastX=profile.at(-1)[0];
  // Superelliptic sections give full shoulders and a narrow keel below.
  for(const [x,top,bottom,width] of sections){
    const along=(firstX-x)/(firstX-lastX),fullness=2.5-.6*along;
    for(let k=0;k<sides;k++){
      const a=k/sides*Math.PI*2,c=Math.cos(a),s=Math.sin(a);
      const vertical=Math.sign(c)*Math.abs(c)**(2/fullness),lateral=Math.sign(s)*Math.abs(s)**(2/fullness);
      const y=(top+bottom)/2+(top-bottom)/2*vertical,h=(y-bottom)/(top-bottom);
      vertex(point(x,y,lateral*width*(.86+.14*h)),[along,h],PART.body);
    }
  }
  for(let j=0;j<sections.length-1;j++)for(let k=0;k<sides;k++){
    const a=j*sides+k,b=j*sides+(k+1)%sides;indices.push(a,a+sides,b,b,a+sides,b+sides);
  }
  for(const [j,x] of [[0,firstX+.004],[sections.length-1,lastX-.006]]){
    const cap=vertex(point(x,0,0),[j?1:0,.5],PART.body);
    for(let k=0;k<sides;k++){
      const a=j*sides+k,b=j*sides+(k+1)%sides;
      if(j)indices.push(cap,b,a);else indices.push(cap,a,b);
    }
  }
  function envelope(x,slot){
    const j=profile.findIndex(st=>st[0]<=x);if(j<=0)return profile[j===0?0:profile.length-1][slot];
    const a=profile[j-1],b=profile[j],t=(x-a[0])/(b[0]-a[0]);return a[slot]+(b[slot]-a[slot])*t;
  }
  // Each fin is a cambered membrane between rays. uv: (position across the
  // fin from its leading ray, distance along the rays from the base). The
  // hinge of every vertex is its ray's base.
  function fan(part,rays,base,edge,side=0,tint=white){
    const start=p.length/3,rows=near?5:2;
    for(let j=0;j<=rays;j++){
      const u=j/rays,root=base(u),tip=edge(u);
      for(let k=0;k<rows;k++){
        const v=k/(rows-1),q=root.clone().lerp(tip,v);
        const arch=Math.sin(Math.PI*v)*Math.sin(Math.PI*u);
        q.z+=side?.024*side*arch:.007*arch;
        vertex(q,[u,v],part,tint,side,v,1,.55,root);
      }
    }
    for(let j=0;j<rays;j++)for(let k=0;k<rows-1;k++){
      const a=start+j*rows+k;indices.push(a,a+rows,a+1,a+1,a+rows,a+rows+1);
    }
  }
  // Caudal fin: the blacksmith's is deeply forked with pointed lobes, the
  // garibaldi's shallowly forked with rounded lobes, the señorita's nearly
  // square. Rays fan out from the peduncle.
  const peduncle=envelope(lastX,1)*.92;
  fan(PART.caudal,near?24:8,u=>point(lastX+.004,peduncle*(2*u-1),0),u=>{
    const n=2*u-1,spread=wrasse?.42:garibaldi?.52:.60,angle=spread*n;
    const length=wrasse?.104-.012*n*n:garibaldi?.098+.036*Math.abs(n)**1.4-.03*Math.abs(n)**6:.074+.148*Math.abs(n)**1.45;
    return point(lastX+.004-length*Math.cos(angle),peduncle*n+length*Math.sin(angle),0);
  });
  // Dorsal and anal fins. The blacksmith's dorsal has fourteen spines with
  // the membrane cut between them, then a taller rounded soft part.
  const finRays=near?(wrasse?40:60):(wrasse?10:12);
  function median(lower,front,back,height,spines,spineShare){
    const sign=lower?-1:1;
    const base=u=>{const x=front+(back-front)*u;return point(x,envelope(x,lower?2:1)-sign*.006,0);};
    fan(lower?PART.anal:PART.dorsal,finRays,base,u=>{
      const q=base(u);let h=height(u);
      if(near&&spines&&u<spineShare){const k=u/spineShare*spines;h*=1-.38*(1-Math.abs(Math.cos(Math.PI*k)))**1.5;}
      q.y+=sign*h;q.x-=h*.55+.012*u;return q;
    });
  }
  if(wrasse){
    median(false,.30,-.335,u=>(.026+.012*Math.sin(Math.PI*u))*smooth(0,.05,u)*(1-.5*smooth(.94,1,u)),9,.42);
    median(true,-.02,-.335,u=>(.024+.010*Math.sin(Math.PI*u))*smooth(0,.08,u)*(1-.5*smooth(.92,1,u)),3,.15);
  }else{
    median(false,.17,-.335,u=>{
      const spiny=.024+.044*smooth(0,.16,u)-.010*smooth(.30,.55,u);
      const soft=.058+.032*Math.sin(Math.PI*Math.min(1,(u-.55)/.45*1.1))-.030*smooth(.85,1,u);
      return u<.55?spiny:soft;
    },14,.55);
    median(true,-.04,-.335,u=>(.026+.054*Math.sin(Math.PI*Math.min(1,u*1.15))**.8)*smooth(0,.10,u)*(1-.45*smooth(.9,1,u)),2,.14);
  }
  // Pectoral fins: the paddles of labriform swimming, high on the flank
  // behind the gill cover. Pelvic fins sit below them; the blacksmith's
  // leading pelvic ray is drawn out into a filament.
  for(const s of [-1,1]){
    const height=wrasse?.06:.09,width=wrasse?.055:.096,reach=wrasse?.12:.19;
    fan(PART.pectoral,near?14:5,u=>point(.20-.042*u,height*(.24-.45*u),s*width),u=>{
      const arc=Math.sin(Math.PI*u);
      return point(.20-.042*u-reach*(.55+.45*arc)-.03*u,height*(.30-1.10*u),s*(width+.050+.075*arc));
    },s,[.90,.94,.97]);
    fan(PART.pelvic,near?6:2,u=>point(.115-.04*u,-height*1.24,s*width*.39),u=>{
      const filament=wrasse||garibaldi?0:.05*(1-u)**3;
      return point(.016-.046*Math.sin(Math.PI*u)-filament,-height*(1.56+.52*u)-filament*.5,s*(width*.58+.022*u));
    });
  }
  if(near){
    // The mouth wraps around the snout. A narrow, soft lower lip breaks
    // the outline in profile.
    const jawStart=p.length/3;
    for(let j=0;j<=12;j++){
      const a=Math.PI*(j/12-.5),front=Math.cos(a),x=firstX-.080+.086*front;
      const z=(wrasse?.032:.047)*Math.sin(a),y=-.014-.009*(1-front);
      const tint=new Color(wrasse?'#c49a72':garibaldi?'#e2702a':'#6f7486').toArray();
      for(let k=0;k<5;k++){
        const b=k*2*Math.PI/5,r=.002+.005*front;
        vertex(point(x+r*front*Math.cos(b),y+r*Math.sin(b),z+r*Math.sin(a)*Math.cos(b)),swatch,PART.mouth,tint,0,0,0,.36);
      }
    }
    for(let j=0;j<12;j++)for(let k=0;k<5;k++){
      const a=jawStart+j*5+k,b=jawStart+j*5+(k+1)%5;indices.push(a,b,a+5,b,b+5,a+5);
    }
    // A shallow dome follows the flank; iris and pupil rings keep it round.
    const x=wrasse?.375:.345,y=wrasse?.020:.046,r=wrasse?.020:.034;
    const top=envelope(x,1),bottom=envelope(x,2);
    const h=(y-bottom)/(top-bottom)*2-1,z=envelope(x,3)*Math.sqrt(1-h*h);
    for(const s of [-1,1]){
      const axis=point(.27,.19,s).normalize(),horizontal=point(1,0,-s*.27).normalize(),vertical=axis.clone().cross(horizontal).multiplyScalar(s);
      const centre=point(x,y,s*z),offset=p.length/3,n=16;
      for(const [radius,lift,hex] of [[1.17,-.001,wrasse?'#7a5f40':'#3d4152'],[1,.003,wrasse?'#8a6a45':'#5b5c62'],[.83,.008,wrasse?'#c08a48':'#8d8a7c'],[.69,.012,'#10161e'],[.09,.019,'#070b10']]){
        const pigment=new Color(hex);
        for(let k=0;k<n;k++){const a=2*Math.PI*k/n;
          const tint=pigment.clone().multiplyScalar(1-.18*Math.sin(a)+.075*Math.cos(k*2.9)).toArray();
          vertex(centre.clone().addScaledVector(horizontal,Math.cos(a)*r*radius).addScaledVector(vertical,Math.sin(a)*r*radius).addScaledVector(axis,lift),swatch,PART.eye,tint,0,0,0,.12);}
      }
      const pupil=vertex(centre.clone().addScaledVector(axis,.0192),swatch,PART.eye,new Color('#0a1015').toArray(),0,0,0,.12);
      for(let j=0;j<5;j++)for(let k=0;k<n;k++){
        const a=offset+j*n+k,b=offset+j*n+(k+1)%n,c=a+n,d=b+n;
        const tri=(i,l,m)=>s>0?indices.push(i,l,m):indices.push(i,m,l);
        if(j<4){tri(a,b,c);tri(b,d,c);}else tri(a,b,pupil);
      }
    }
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));
  g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.setAttribute('color',new Float32BufferAttribute(color,3));
  g.setAttribute('finMotion',new Float32BufferAttribute(motion,4));g.setAttribute('finAnchor',new Float32BufferAttribute(anchors,3));
  g.setAttribute('part',new Float32BufferAttribute(parts,1));
  g.setIndex(indices);g.computeVertexNormals();return g;
}
