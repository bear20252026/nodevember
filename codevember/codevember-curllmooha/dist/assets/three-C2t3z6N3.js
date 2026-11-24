import{bo as Ie,L as Ze,gc as mt,r as gt,f as qt,af as $r,bp as ra,fn as lr,fa as cr,aZ as Qr,bq as ur,B as He,aK as Lt,bE as Jr,A as Nt,$ as en,dg as tn,bn as je,bA as Ge,aL as ht,bC as ei,eK as an,bj as dr,bM as ti,bL as Pt,ay as Je,a8 as Vt,g as Ut,t as Dt,y as vt,az as na,gd as rn,ed as ai,cB as nn,cd as on,v as ea,dy as sn,fr as ln,dx as cn,fq as un,dw as dn,dv as fn,du as pn,dt as mn,e_ as hn,eZ as gn,cn as _n,q as vn,cm as Sn,k as En,p as Mn,ad as Tn,ae as ya,ac as xn,aa as Ra,E as Rt,a9 as da,ab as Rn,Z as zt,dD as An,eG as bn,eE as fr,eU as Cn,ee as pr,eg as Ln,g1 as mr,dM as Pn,Q as wn,dU as Dn,dT as Nn,cv as jt,V as hr,R as Un,i as kt,bb as ma,bi as In,j as Yt,bR as aa,a_ as Zt,h as yt,f4 as oa,bV as Xt,w as ii,cH as yn,X as On,f3 as Wt,bX as $t,cw as We,eP as Fn,u as Aa,fU as Bn,bK as ba,aJ as Ot,gb as Gn,aI as Hn,bl as Vn,dJ as Kt,dd as gr,cI as _r,cG as vr,bS as _a,bU as Sr,bT as Er,dC as zn,eF as Wn,eD as kn,eT as Xn,ef as Kn,g0 as Yn,dL as qn,fd as jn,fg as ri,ff as Zn,dG as ha,s as $n,dQ as ni,cc as oi,n as si,ge as Qn,ca as li,dz as Jn,b1 as Va,gf as Oa,b as Mr,gg as Tr,fo as Fa,eO as xr,bW as eo,bY as to,fC as ao,ct as io,ep as Rr,g2 as ro,cS as no,a$ as oo,cK as Ca,cW as La,cV as Pa,cU as wa,cL as ci,cM as ui,cX as di,cY as fi,cO as pi,cN as mi,cZ as hi,dj as gi,cA as _i,df as Ba,cx as vi,d6 as Si,d5 as Ei,d4 as Mi,d3 as Ti,d2 as xi,d1 as Ri,d0 as Ai,c$ as bi,db as Ci,da as Li,d9 as Pi,dc as wi,d8 as Di,d7 as Ni,c_ as Ui,cQ as Ii,cP as yi,dh as Oi,cy as Fi,di as Ga,cz as Bi,ga as Gi,e2 as Ar,c1 as so,c2 as lo,eH as Hi,eh as co,fc as br,N as Cr,aX as Lr,aH as Pr,fy as wr,cF as Dr,e3 as Nr,eR as Da,eQ as Na,_ as Ur,fm as va,fl as sa,g6 as uo,g4 as fo,dR as po,dP as mo,g9 as ho,dS as go,dV as _o,gh as vo}from"./leva-C0l7872o.js";function Ir(){let e=null,a=!1,t=null,i=null;function c(l,f){i=e.requestAnimationFrame(c),t(l,f)}return{start:function(){a!==!0&&t!==null&&e!==null&&(i=e.requestAnimationFrame(c),a=!0)},stop:function(){e!==null&&e.cancelAnimationFrame(i),a=!1},setAnimationLoop:function(l){t=l},setContext:function(l){e=l}}}function So(e){const a=new WeakMap;function t(g,y){const L=g.array,V=g.usage,F=L.byteLength,v=e.createBuffer();e.bindBuffer(y,v),e.bufferData(y,L,V),g.onUploadCallback();let T;if(L instanceof Float32Array)T=e.FLOAT;else if(typeof Float16Array<"u"&&L instanceof Float16Array)T=e.HALF_FLOAT;else if(L instanceof Uint16Array)g.isFloat16BufferAttribute?T=e.HALF_FLOAT:T=e.UNSIGNED_SHORT;else if(L instanceof Int16Array)T=e.SHORT;else if(L instanceof Uint32Array)T=e.UNSIGNED_INT;else if(L instanceof Int32Array)T=e.INT;else if(L instanceof Int8Array)T=e.BYTE;else if(L instanceof Uint8Array)T=e.UNSIGNED_BYTE;else if(L instanceof Uint8ClampedArray)T=e.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+L);return{buffer:v,type:T,bytesPerElement:L.BYTES_PER_ELEMENT,version:g.version,size:F}}function i(g,y,L){const V=y.array,F=y.updateRanges;if(e.bindBuffer(L,g),F.length===0)e.bufferSubData(L,0,V);else{F.sort((T,w)=>T.start-w.start);let v=0;for(let T=1;T<F.length;T++){const w=F[v],B=F[T];B.start<=w.start+w.count+1?w.count=Math.max(w.count,B.start+B.count-w.start):(++v,F[v]=B)}F.length=v+1;for(let T=0,w=F.length;T<w;T++){const B=F[T];e.bufferSubData(L,B.start*V.BYTES_PER_ELEMENT,V,B.start,B.count)}y.clearUpdateRanges()}y.onUploadCallback()}function c(g){return g.isInterleavedBufferAttribute&&(g=g.data),a.get(g)}function l(g){g.isInterleavedBufferAttribute&&(g=g.data);const y=a.get(g);y&&(e.deleteBuffer(y.buffer),a.delete(g))}function f(g,y){if(g.isInterleavedBufferAttribute&&(g=g.data),g.isGLBufferAttribute){const V=a.get(g);(!V||V.version<g.version)&&a.set(g,{buffer:g.buffer,type:g.type,bytesPerElement:g.elementSize,version:g.version});return}const L=a.get(g);if(L===void 0)a.set(g,t(g,y));else if(L.version<g.version){if(L.size!==g.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");i(L.buffer,g,y),L.version=g.version}}return{get:c,remove:l,update:f}}var Eo=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Mo=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,To=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,xo=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Ro=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,Ao=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,bo=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,Co=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,Lo=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,Po=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,wo=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,Do=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,No=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,Uo=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,Io=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,yo=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,Oo=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Fo=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Bo=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Go=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,Ho=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,Vo=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,zo=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,Wo=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,ko=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif`,Xo=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,Ko=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Yo=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,qo=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,jo="gl_FragColor = linearToOutputTexel( gl_FragColor );",Zo=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,$o=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,Qo=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	uniform samplerCube envMap;
	#ifdef ENVMAP_TYPE_PMREM
		float roughnessToMip( const in float roughness ) {
			float r = clamp( roughness, 0.0, 1.0 );
			return ENVMAP_MAX_LOD * r * ( 2.0 - r );
		}
	#endif
#endif`,Jo=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,es=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,ts=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,as=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,is=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,rs=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,ns=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,os=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,ss=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,ls=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,cs=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,us=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_SUN_LIGHTS > 0
	struct SunLight {
		vec3 direction;
		vec3 color;
	};
	uniform SunLight sunLights[ NUM_SUN_LIGHTS ];
	void getSunLightInfo( const in SunLight sunLight, out IncidentLight light ) {
		light.color = sunLight.color;
		light.direction = sunLight.direction;
		light.visible = true;
	}
#endif
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,ds=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_PMREM
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureLod( envMap, envMapRotation * worldNormal, ENVMAP_MAX_LOD );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_PMREM
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureLod( envMap, envMapRotation * reflectVec, roughnessToMip( roughness ) );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_RETROREFLECTION
		vec3 getIBLRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
			#ifdef ENVMAP_TYPE_PMREM
				vec3 retroVec = normalize( mix( viewDir, normal, pow4( roughness ) ) );
				retroVec = transformDirectionByInverseViewMatrix( retroVec, viewMatrix );
				vec4 envMapColor = textureLod( envMap, envMapRotation * retroVec, roughnessToMip( roughness ) );
				return envMapColor.rgb * envMapIntensity;
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_PMREM
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
		#ifdef USE_RETROREFLECTION
			vec3 getIBLAnisotropyRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
				#ifdef ENVMAP_TYPE_PMREM
					vec3 bentNormal = cross( bitangent, viewDir );
					bentNormal = normalize( cross( bentNormal, bitangent ) );
					bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
					return getIBLRetroRadiance( viewDir, bentNormal, roughness );
				#else
					return vec3( 0.0 );
				#endif
			}
		#endif
	#endif
#endif`,fs=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,ps=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,ms=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,hs=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,gs=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.045 );
material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef USE_DIFFUSE_ROUGHNESS
	float diffuseRoughnessFactor = diffuseRoughness;
	#ifdef USE_DIFFUSE_ROUGHNESSMAP
		diffuseRoughnessFactor *= texture2D( diffuseRoughnessMap, vDiffuseRoughnessMapUv ).r;
	#endif
	material.diffuseRoughness = saturate( diffuseRoughnessFactor );
#endif
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.045 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_RETROREFLECTION
	material.retroreflectivity = retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,_s=`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	vec2 dfg;
	vec3 multiScatteringCompensation;
	#ifdef USE_DIFFUSE_ROUGHNESS
		float diffuseRoughness;
	#endif
	#ifdef USE_RETROREFLECTION
		float retroreflectivity;
	#endif
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0Dielectric;
		vec3 iridescenceF0Metallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
#ifdef USE_DIFFUSE_ROUGHNESS
	const float EON_EPSILON = 1e-7;
	float FON_DirectionalAlbedo( const in float mu, const in float roughness, const in float A ) {
		float muComp = 1.0 - mu;
		float gOverPi = muComp * ( 0.0571085289 + muComp * ( 0.491881867 + muComp * ( - 0.332181442 + muComp * 0.0714429953 ) ) );
		return A * ( 1.0 + roughness * gOverPi );
	}
	vec3 BRDF_EON( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 diffuseColor, const in float roughness ) {
		vec3 rho = saturate( diffuseColor );
		if ( roughness <= EON_EPSILON ) return BRDF_Lambert( rho );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float s = dot( lightDir, viewDir ) - dotNL * dotNV;
		float sOverT = ( s > 0.0 ) ? s / max( max( dotNL, dotNV ), EON_EPSILON ) : s;
		float A = 1.0 / ( 1.0 + ( 0.5 - 2.0 / ( 3.0 * PI ) ) * roughness );
		vec3 singleScatter = rho * RECIPROCAL_PI * A * ( 1.0 + roughness * sOverT );
		float averageAlbedo = A * ( 1.0 + ( 2.0 / 3.0 - 28.0 / ( 15.0 * PI ) ) * roughness );
		float albedoV = FON_DirectionalAlbedo( dotNV, roughness, A );
		float albedoL = FON_DirectionalAlbedo( dotNL, roughness, A );
		vec3 rhoMultiScatter = rho * rho * averageAlbedo / max( vec3( EON_EPSILON ), vec3( 1.0 ) - rho * ( 1.0 - averageAlbedo ) );
		vec3 multiScatter = rhoMultiScatter * RECIPROCAL_PI
			* max( EON_EPSILON, 1.0 - albedoV )
			* max( EON_EPSILON, 1.0 - albedoL )
			/ max( EON_EPSILON, 1.0 - averageAlbedo );
		return singleScatter + multiScatter;
	}
	vec3 EON_DirectionalAlbedo( const in vec3 diffuseColor, const in float roughness, const in float dotNV ) {
		vec3 rho = saturate( diffuseColor );
		if ( roughness <= EON_EPSILON ) return rho;
		float A = 1.0 / ( 1.0 + ( 0.5 - 2.0 / ( 3.0 * PI ) ) * roughness );
		float directionalAlbedo = FON_DirectionalAlbedo( dotNV, roughness, A );
		float averageAlbedo = A * ( 1.0 + ( 2.0 / 3.0 - 28.0 / ( 15.0 * PI ) ) * roughness );
		vec3 rhoMultiScatter = rho * rho * averageAlbedo / max( vec3( EON_EPSILON ), vec3( 1.0 ) - rho * ( 1.0 - averageAlbedo ) );
		return rho * directionalAlbedo + rhoMultiScatter * ( 1.0 - directionalAlbedo );
	}
#endif
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = max( material.clearcoatRoughness, 0.045 );
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = max( material.roughness, 0.045 );
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float alphaT = max( material.alphaT, alpha );
		float V = V_GGX_SmithCorrelated_Anisotropic( alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec2 fab, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec2 fab, const in vec3 specularColor, const in float specularF90, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	vec3 specularBRDF = BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	#ifdef USE_RETROREFLECTION
		vec3 retroViewDir = reflect( - geometryViewDir, geometryNormal );
		vec3 retroSpecularBRDF = BRDF_GGX( directLight.direction, retroViewDir, geometryNormal, material );
		specularBRDF = mix( specularBRDF, retroSpecularBRDF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directSpecular += irradiance * specularBRDF * material.multiScatteringCompensation;
	vec3 halfDir = normalize( directLight.direction + geometryViewDir );
	float dotVH = saturate( dot( geometryViewDir, halfDir ) );
	vec3 F = F_Schlick( material.specularColor, material.specularF90, dotVH );
	#ifdef USE_RETROREFLECTION
		vec3 retroHalfDir = normalize( directLight.direction + retroViewDir );
		float dotRetroVH = saturate( dot( retroViewDir, retroHalfDir ) );
		vec3 retroF = F_Schlick( material.specularColor, material.specularF90, dotRetroVH );
		F = mix( F, retroF, saturate( material.retroreflectivity ) );
	#endif
	#ifdef USE_DIFFUSE_ROUGHNESS
		vec3 diffuseBRDF = BRDF_EON( directLight.direction, geometryViewDir, geometryNormal, material.diffuseColor, material.diffuseRoughness ) * ( 1.0 - material.metalness );
	#else
		vec3 diffuseBRDF = BRDF_Lambert( material.diffuseContribution );
	#endif
	reflectedLight.directDiffuse += irradiance * diffuseBRDF * ( 1.0 - F );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScattering, multiScattering );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScattering, multiScattering );
	#endif
	#ifdef USE_DIFFUSE_ROUGHNESS
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		vec3 diffuseAlbedo = EON_DirectionalAlbedo( material.diffuseColor, material.diffuseRoughness, dotNV ) * ( 1.0 - material.metalness );
		vec3 diffuse = irradiance * RECIPROCAL_PI * diffuseAlbedo * ( 1.0 - singleScattering - multiScattering );
	#else
		vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - singleScattering - multiScattering );
	#endif
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		sheenSpecularIndirect += irradiance * material.sheenColor * sheenAlbedo * RECIPROCAL_PI;
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( material.dfg, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceF0Metallic, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( material.dfg, material.diffuseColor, material.specularF90, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	#ifdef USE_DIFFUSE_ROUGHNESS
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		vec3 diffuse = EON_DirectionalAlbedo( material.diffuseColor, material.diffuseRoughness, dotNV ) * ( 1.0 - material.metalness ) * ( 1.0 - totalScatteringDielectric );
	#else
		vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	#endif
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,vs=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		vec3 iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		vec3 iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( iridescenceFresnelDielectric, iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0Dielectric = Schlick_to_F0( iridescenceFresnelDielectric, 1.0, dotNVi );
		material.iridescenceF0Metallic = Schlick_to_F0( iridescenceFresnelMetallic, 1.0, dotNVi );
	}
#endif
#ifdef STANDARD
	float dotNVms = saturate( dot( geometryNormal, geometryViewDir ) );
	material.dfg = texture2D( dfgLUT, vec2( material.roughness, dotNVms ) ).rg;
	#if ( NUM_SUN_LIGHTS > 0 || NUM_DIR_LIGHTS > 0 || NUM_POINT_LIGHTS > 0 || NUM_SPOT_LIGHTS > 0 )
		float EssMs = material.dfg.x + material.dfg.y;
		material.multiScatteringCompensation = 1.0 + material.specularColorBlended * ( 1.0 / EssMs - 1.0 );
	#endif
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SUN_LIGHTS > 0 ) && defined( RE_Direct )
	SunLight sunLight;
	#if defined( USE_SHADOWMAP ) && NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHTS; i ++ ) {
		sunLight = sunLights[ i ];
		getSunLightInfo( sunLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SUN_LIGHT_SHADOWS )
		sunLightShadow = sunLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getSunShadow( sunShadowMap[ i ], sunLightShadow, UNROLLED_LOOP_INDEX ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_LIGHT_PROBE_GRIDS > 0
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		int probeGrid = - 1;
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_LIGHT_PROBE_GRIDS; i ++ ) {
			if ( isInsideLightProbeGrid( probeWorldPos, probeWorldNormal, probesMin[ i ], probesMax[ i ], probesResolution[ i ] ) ) probeGrid = UNROLLED_LOOP_INDEX;
		}
		#pragma unroll_loop_end
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_LIGHT_PROBE_GRIDS; i ++ ) {
			if ( probeGrid == UNROLLED_LOOP_INDEX ) irradiance += getLightProbeGridIrradiance( probesSH[ i ], probesMin[ i ], probesMax[ i ], probesResolution[ i ], probeWorldPos, probeWorldNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,Ss=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_PMREM )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		vec3 iblRadiance = getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		vec3 iblRadiance = getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_RETROREFLECTION
		#ifdef USE_ANISOTROPY
			vec3 retroIBLRadiance = getIBLAnisotropyRetroRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
		#else
			vec3 retroIBLRadiance = getIBLRetroRadiance( geometryViewDir, geometryNormal, material.roughness );
		#endif
		iblRadiance = mix( iblRadiance, retroIBLRadiance, saturate( material.retroreflectivity ) );
	#endif
	radiance += iblRadiance;
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,Es=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,Ms=`#if NUM_LIGHT_PROBE_GRIDS > 0
uniform highp sampler3D probesSH[ NUM_LIGHT_PROBE_GRIDS ];
uniform vec3 probesMin[ NUM_LIGHT_PROBE_GRIDS ];
uniform vec3 probesMax[ NUM_LIGHT_PROBE_GRIDS ];
uniform vec3 probesResolution[ NUM_LIGHT_PROBE_GRIDS ];
bool isInsideLightProbeGrid( vec3 worldPos, vec3 worldNormal, vec3 probesMin, vec3 probesMax, vec3 probesResolution ) {
	vec3 spacing = ( probesMax - probesMin ) / probesResolution;
	vec3 samplePos = worldPos + worldNormal * spacing * 0.5;
	vec3 margin = spacing * 0.01;
	return all( greaterThanEqual( samplePos, probesMin - margin ) ) && all( lessThanEqual( samplePos, probesMax + margin ) );
}
vec3 getLightProbeGridIrradiance( highp sampler3D probesSH, vec3 probesMin, vec3 probesMax, vec3 probesResolution, vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 probeSpacing = gridRange / res;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.5 / res, 1.0 - 0.5 / res );
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,Ts=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,xs=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Rs=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,As=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,bs=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,Cs=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Ls=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,Ps=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,ws=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Ds=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Ns=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,Us=`#if defined( USE_MORPHCOLORS )
	#if defined( USE_COLOR_ALPHA )
		vColor *= morphTargetBaseInfluence;
	#elif defined( USE_COLOR )
		vColor.rgb *= morphTargetBaseInfluence;
	#endif
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor.rgb += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,Is=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,ys=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,Os=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Fs=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,Bs=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,Gs=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Hs=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Vs=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,zs=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,Ws=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,ks=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,Xs=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,Ks=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,Ys=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,qs=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,js=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,Zs=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,$s=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,Qs=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,Js=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,el=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,tl=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		#define SUN_LIGHT_CASCADES 2
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#else
			uniform sampler2D sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#endif
		uniform mat4 sunShadowMatrix[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		uniform vec4 sunShadowCascade[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
		struct SunLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SunLightShadow sunLightShadows[ NUM_SUN_LIGHT_SHADOWS ];
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				vec2 radius = shadowRadius * texelSize;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_SUN_LIGHT_SHADOWS > 0
		float getSunShadow(
			#if defined( SHADOWMAP_TYPE_PCF )
				sampler2DShadow shadowMap,
			#else
				sampler2D shadowMap,
			#endif
			SunLightShadow sunLightShadow,
			int shadowIndex
		) {
			vec4 shadowWorldPosition = vec4( vSunShadowWorldPosition.xyz + vSunShadowWorldNormal * sunLightShadow.shadowNormalBias, 1.0 );
			float viewDepth = vSunShadowWorldPosition.w;
			int cascadeOffset = shadowIndex * SUN_LIGHT_CASCADES;
			float shadow = 1.0;
			for ( int i = SUN_LIGHT_CASCADES - 1; i >= 0; i -- ) {
				vec4 cascade = sunShadowCascade[ cascadeOffset + i ];
				if ( viewDepth >= cascade.x && viewDepth < cascade.y ) {
					float cascadeShadow = getShadow(
						shadowMap,
						sunLightShadow.shadowMapSize,
						sunLightShadow.shadowIntensity,
						sunLightShadow.shadowBias,
						sunLightShadow.shadowRadius,
						sunShadowMatrix[ cascadeOffset + i ] * shadowWorldPosition
					);
					shadow = mix( cascadeShadow, shadow, smoothstep( cascade.z, cascade.y, viewDepth ) );
				}
			}
			return shadow;
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float lightDistance = length( lightToPosition );
			float depthRange = shadowCameraFar - shadowCameraNear;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float depthA = - shadowCameraNear / depthRange - shadowBias;
				float depthB = shadowCameraNear * shadowCameraFar / ( depthRange * lightDistance );
			#else
				float depthA = shadowCameraFar / depthRange + shadowBias;
				float depthB = - shadowCameraNear * shadowCameraFar / ( depthRange * lightDistance );
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			shadow = 0.0;
			for ( int i = 0; i < 5; i ++ ) {
				vec2 offset = vogelDiskSample( i, 5, phi );
				vec3 direction = bd3D + ( tangent * offset.x + bitangent * offset.y ) * texelSize;
				vec3 absDirection = abs( direction );
				float dp = depthA + depthB / max( max( absDirection.x, absDirection.y ), absDirection.z );
				shadow += texture( shadowMap, vec4( direction, dp ) );
			}
			shadow *= 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,al=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,il=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SUN_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_SUN_LIGHT_SHADOWS > 0
		vSunShadowWorldPosition = vec4( worldPosition.xyz, - mvPosition.z );
		vSunShadowWorldNormal = shadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,rl=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHT_SHADOWS; i ++ ) {
		sunLight = sunLightShadows[ i ];
		shadow *= receiveShadow ? getSunShadow( sunShadowMap[ i ], sunLight, UNROLLED_LOOP_INDEX ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,nl=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,ol=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,sl=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,ll=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,cl=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,ul=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,dl=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,fl=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,pl=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,ml=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,hl=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_DIFFUSE_ROUGHNESSMAP
	varying vec2 vDiffuseRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,gl=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_DIFFUSE_ROUGHNESSMAP
	uniform mat3 diffuseRoughnessMapTransform;
	varying vec2 vDiffuseRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,_l=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DIFFUSE_ROUGHNESSMAP
	vDiffuseRoughnessMapUv = ( diffuseRoughnessMapTransform * vec3( DIFFUSE_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,vl=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const Sl=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,El=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Ml=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Tl=`uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <envmap_common_pars_fragment>
void main() {
	#ifdef ENVMAP_TYPE_PMREM
		vec4 texColor = textureLod( envMap, backgroundRotation * vWorldDirection, roughnessToMip( backgroundBlurriness ) );
	#else
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,xl=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Rl=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Al=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,bl=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,Cl=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,Ll=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,Pl=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,wl=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Dl=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Nl=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Ul=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,Il=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,yl=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Ol=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Fl=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,Bl=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Gl=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,Hl=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,Vl=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,zl=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Wl=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,kl=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DIFFUSE_ROUGHNESS
	uniform float diffuseRoughness;
	#ifdef USE_DIFFUSE_ROUGHNESSMAP
		uniform sampler2D diffuseRoughnessMap;
	#endif
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_RETROREFLECTION
	uniform float retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Xl=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Kl=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Yl=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,ql=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,jl=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Zl=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,$l=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Ql=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Le={alphahash_fragment:Eo,alphahash_pars_fragment:Mo,alphamap_fragment:To,alphamap_pars_fragment:xo,alphatest_fragment:Ro,alphatest_pars_fragment:Ao,aomap_fragment:bo,aomap_pars_fragment:Co,batching_pars_vertex:Lo,batching_vertex:Po,begin_vertex:wo,beginnormal_vertex:Do,bsdfs:No,iridescence_fragment:Uo,bumpmap_pars_fragment:Io,clipping_planes_fragment:yo,clipping_planes_pars_fragment:Oo,clipping_planes_pars_vertex:Fo,clipping_planes_vertex:Bo,color_fragment:Go,color_pars_fragment:Ho,color_pars_vertex:Vo,color_vertex:zo,common:Wo,defaultnormal_vertex:ko,displacementmap_pars_vertex:Xo,displacementmap_vertex:Ko,emissivemap_fragment:Yo,emissivemap_pars_fragment:qo,colorspace_fragment:jo,colorspace_pars_fragment:Zo,envmap_fragment:$o,envmap_common_pars_fragment:Qo,envmap_pars_fragment:Jo,envmap_pars_vertex:es,envmap_physical_pars_fragment:ds,envmap_vertex:ts,fog_vertex:as,fog_pars_vertex:is,fog_fragment:rs,fog_pars_fragment:ns,gradientmap_pars_fragment:os,lightmap_pars_fragment:ss,lights_lambert_fragment:ls,lights_lambert_pars_fragment:cs,lights_pars_begin:us,lights_toon_fragment:fs,lights_toon_pars_fragment:ps,lights_phong_fragment:ms,lights_phong_pars_fragment:hs,lights_physical_fragment:gs,lights_physical_pars_fragment:_s,lights_fragment_begin:vs,lights_fragment_maps:Ss,lights_fragment_end:Es,lightprobes_pars_fragment:Ms,logdepthbuf_fragment:Ts,logdepthbuf_pars_fragment:xs,logdepthbuf_pars_vertex:Rs,logdepthbuf_vertex:As,map_fragment:bs,map_pars_fragment:Cs,map_particle_fragment:Ls,map_particle_pars_fragment:Ps,metalnessmap_fragment:ws,metalnessmap_pars_fragment:Ds,morphinstance_vertex:Ns,morphcolor_vertex:Us,morphnormal_vertex:Is,morphtarget_pars_vertex:ys,morphtarget_vertex:Os,normal_fragment_begin:Fs,normal_fragment_maps:Bs,normal_pars_fragment:Gs,normal_pars_vertex:Hs,normal_vertex:Vs,normalmap_pars_fragment:zs,clearcoat_normal_fragment_begin:Ws,clearcoat_normal_fragment_maps:ks,clearcoat_pars_fragment:Xs,iridescence_pars_fragment:Ks,opaque_fragment:Ys,packing:qs,premultiplied_alpha_fragment:js,project_vertex:Zs,dithering_fragment:$s,dithering_pars_fragment:Qs,roughnessmap_fragment:Js,roughnessmap_pars_fragment:el,shadowmap_pars_fragment:tl,shadowmap_pars_vertex:al,shadowmap_vertex:il,shadowmask_pars_fragment:rl,skinbase_vertex:nl,skinning_pars_vertex:ol,skinning_vertex:sl,skinnormal_vertex:ll,specularmap_fragment:cl,specularmap_pars_fragment:ul,tonemapping_fragment:dl,tonemapping_pars_fragment:fl,transmission_fragment:pl,transmission_pars_fragment:ml,uv_pars_fragment:hl,uv_pars_vertex:gl,uv_vertex:_l,worldpos_vertex:vl,background_vert:Sl,background_frag:El,backgroundCube_vert:Ml,backgroundCube_frag:Tl,cube_vert:xl,cube_frag:Rl,depth_vert:Al,depth_frag:bl,distance_vert:Cl,distance_frag:Ll,equirect_vert:Pl,equirect_frag:wl,linedashed_vert:Dl,linedashed_frag:Nl,meshbasic_vert:Ul,meshbasic_frag:Il,meshlambert_vert:yl,meshlambert_frag:Ol,meshmatcap_vert:Fl,meshmatcap_frag:Bl,meshnormal_vert:Gl,meshnormal_frag:Hl,meshphong_vert:Vl,meshphong_frag:zl,meshphysical_vert:Wl,meshphysical_frag:kl,meshtoon_vert:Xl,meshtoon_frag:Kl,points_vert:Yl,points_frag:ql,shadow_vert:jl,shadow_frag:Zl,sprite_vert:$l,sprite_frag:Ql},de={common:{diffuse:{value:new Ze(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Ie},alphaMap:{value:null},alphaMapTransform:{value:new Ie},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Ie}},envmap:{envMap:{value:null},envMapRotation:{value:new Ie},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Ie}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Ie}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Ie},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Ie},normalScale:{value:new gt(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Ie},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Ie}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Ie}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Ie}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Ze(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},sunLights:{value:[],properties:{direction:{},color:{}}},sunLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},sunShadowMatrix:{value:[]},sunShadowCascade:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:[]},probesMin:{value:[]},probesMax:{value:[]},probesResolution:{value:[]}},points:{diffuse:{value:new Ze(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Ie},alphaTest:{value:0},uvTransform:{value:new Ie}},sprite:{diffuse:{value:new Ze(16777215)},opacity:{value:1},center:{value:new gt(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Ie},alphaMap:{value:null},alphaMapTransform:{value:new Ie},alphaTest:{value:0}}},Ct={basic:{uniforms:mt([de.common,de.specularmap,de.envmap,de.aomap,de.lightmap,de.fog]),vertexShader:Le.meshbasic_vert,fragmentShader:Le.meshbasic_frag},lambert:{uniforms:mt([de.common,de.specularmap,de.envmap,de.aomap,de.lightmap,de.emissivemap,de.bumpmap,de.normalmap,de.displacementmap,de.fog,de.lights,{emissive:{value:new Ze(0)},envMapIntensity:{value:1}}]),vertexShader:Le.meshlambert_vert,fragmentShader:Le.meshlambert_frag},phong:{uniforms:mt([de.common,de.specularmap,de.envmap,de.aomap,de.lightmap,de.emissivemap,de.bumpmap,de.normalmap,de.displacementmap,de.fog,de.lights,{emissive:{value:new Ze(0)},specular:{value:new Ze(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:Le.meshphong_vert,fragmentShader:Le.meshphong_frag},standard:{uniforms:mt([de.common,de.envmap,de.aomap,de.lightmap,de.emissivemap,de.bumpmap,de.normalmap,de.displacementmap,de.roughnessmap,de.metalnessmap,de.fog,de.lights,{emissive:{value:new Ze(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Le.meshphysical_vert,fragmentShader:Le.meshphysical_frag},toon:{uniforms:mt([de.common,de.aomap,de.lightmap,de.emissivemap,de.bumpmap,de.normalmap,de.displacementmap,de.gradientmap,de.fog,de.lights,{emissive:{value:new Ze(0)}}]),vertexShader:Le.meshtoon_vert,fragmentShader:Le.meshtoon_frag},matcap:{uniforms:mt([de.common,de.bumpmap,de.normalmap,de.displacementmap,de.fog,{matcap:{value:null}}]),vertexShader:Le.meshmatcap_vert,fragmentShader:Le.meshmatcap_frag},points:{uniforms:mt([de.points,de.fog]),vertexShader:Le.points_vert,fragmentShader:Le.points_frag},dashed:{uniforms:mt([de.common,de.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Le.linedashed_vert,fragmentShader:Le.linedashed_frag},depth:{uniforms:mt([de.common,de.displacementmap]),vertexShader:Le.depth_vert,fragmentShader:Le.depth_frag},normal:{uniforms:mt([de.common,de.bumpmap,de.normalmap,de.displacementmap,{opacity:{value:1}}]),vertexShader:Le.meshnormal_vert,fragmentShader:Le.meshnormal_frag},sprite:{uniforms:mt([de.sprite,de.fog]),vertexShader:Le.sprite_vert,fragmentShader:Le.sprite_frag},background:{uniforms:{uvTransform:{value:new Ie},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Le.background_vert,fragmentShader:Le.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Ie}},vertexShader:Le.backgroundCube_vert,fragmentShader:Le.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Le.cube_vert,fragmentShader:Le.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Le.equirect_vert,fragmentShader:Le.equirect_frag},distance:{uniforms:mt([de.common,de.displacementmap,{referencePosition:{value:new He},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Le.distance_vert,fragmentShader:Le.distance_frag},shadow:{uniforms:mt([de.lights,de.fog,{color:{value:new Ze(0)},opacity:{value:1}}]),vertexShader:Le.shadow_vert,fragmentShader:Le.shadow_frag}};Ct.physical={uniforms:mt([Ct.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Ie},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Ie},clearcoatNormalScale:{value:new gt(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Ie},diffuseRoughness:{value:0},diffuseRoughnessMap:{value:null},diffuseRoughnessMapTransform:{value:new Ie},dispersion:{value:0},retroreflectivity:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Ie},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Ie},sheen:{value:0},sheenColor:{value:new Ze(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Ie},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Ie},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Ie},transmissionSamplerSize:{value:new gt},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Ie},attenuationDistance:{value:0},attenuationColor:{value:new Ze(0)},specularColor:{value:new Ze(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Ie},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Ie},anisotropyVector:{value:new gt},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Ie}}]),vertexShader:Le.meshphysical_vert,fragmentShader:Le.meshphysical_frag};const fa={r:0,b:0,g:0},Jl=new qt,yr=new Ie;yr.set(-1,0,0,0,1,0,0,0,1);function ec(e,a,t,i,c,l){const f=new Ze(0);let g=c===!0?0:1,y,L,V=null,F=0,v=null;function T(_){let D=_.isScene===!0?_.background:null;if(D&&D.isTexture){const S=_.backgroundBlurriness>0;D=a.get(D,S)}return D}function w(_){let D=!1;const S=T(_);S===null?u(f,g):S&&S.isColor&&(u(S,1),D=!0);const C=e.xr.getEnvironmentBlendMode();C==="additive"?t.buffers.color.setClear(0,0,0,1,l):C==="alpha-blend"&&t.buffers.color.setClear(0,0,0,0,l),(e.autoClear||D)&&(t.buffers.depth.setTest(!0),t.buffers.depth.setMask(!0),t.buffers.color.setMask(!0),e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil))}function B(_,D){const S=T(D);S&&S.isCubeTexture?(L===void 0&&(L=new kt(new Va(1,1,1),new jt({name:"BackgroundCubeMaterial",uniforms:Oa(Ct.backgroundCube.uniforms),vertexShader:Ct.backgroundCube.vertexShader,fragmentShader:Ct.backgroundCube.fragmentShader,side:vt,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),L.geometry.deleteAttribute("normal"),L.geometry.deleteAttribute("uv"),L.onBeforeRender=function(C,x,n){this.matrixWorld.copyPosition(n.matrixWorld)},Object.defineProperty(L.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),i.update(L)),L.material.uniforms.envMap.value=S,L.material.uniforms.backgroundBlurriness.value=D.backgroundBlurriness,L.material.uniforms.backgroundIntensity.value=D.backgroundIntensity,L.material.uniforms.backgroundRotation.value.setFromMatrix4(Jl.makeRotationFromEuler(D.backgroundRotation)).transpose(),S.isRenderTargetTexture===!1&&L.material.uniforms.backgroundRotation.value.premultiply(yr),L.material.toneMapped=Je.getTransfer(S.colorSpace)!==We,(V!==S||F!==S.version||v!==e.toneMapping)&&(L.material.needsUpdate=!0,V=S,F=S.version,v=e.toneMapping),L.layers.enableAll(),_.unshift(L,L.geometry,L.material,0,0,null)):S&&S.isTexture&&(y===void 0&&(y=new kt(new Mr(2,2),new jt({name:"BackgroundMaterial",uniforms:Oa(Ct.background.uniforms),vertexShader:Ct.background.vertexShader,fragmentShader:Ct.background.fragmentShader,side:na,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),y.geometry.deleteAttribute("normal"),Object.defineProperty(y.material,"map",{get:function(){return this.uniforms.t2D.value}}),i.update(y)),y.material.uniforms.t2D.value=S,y.material.uniforms.backgroundIntensity.value=D.backgroundIntensity,y.material.toneMapped=Je.getTransfer(S.colorSpace)!==We,S.matrixAutoUpdate===!0&&S.updateMatrix(),y.material.uniforms.uvTransform.value.copy(S.matrix),(V!==S||F!==S.version||v!==e.toneMapping)&&(y.material.needsUpdate=!0,V=S,F=S.version,v=e.toneMapping),y.layers.enableAll(),_.unshift(y,y.geometry,y.material,0,0,null))}function u(_,D){_.getRGB(fa,Tr(e)),t.buffers.color.setClear(fa.r,fa.g,fa.b,D,l)}function s(){L!==void 0&&(L.geometry.dispose(),L.material.dispose(),L=void 0),y!==void 0&&(y.geometry.dispose(),y.material.dispose(),y=void 0)}return{getClearColor:function(){return f},setClearColor:function(_,D=1){f.set(_),g=D,u(f,g)},getClearAlpha:function(){return g},setClearAlpha:function(_){g=_,u(f,g)},render:w,addToRenderList:B,dispose:s}}function tc(e,a){const t=e.getParameter(e.MAX_VERTEX_ATTRIBS),i={},c=v(null);let l=c,f=!1;function g(O,W,k,R,Q){let q=!1;const H=F(O,R,k,W);l!==H&&(l=H,L(l.object)),q=T(O,R,k,Q),q&&w(O,R,k,Q),Q!==null&&a.update(Q,e.ELEMENT_ARRAY_BUFFER),(q||f)&&(f=!1,S(O,W,k,R),Q!==null&&e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,a.get(Q).buffer))}function y(){return e.createVertexArray()}function L(O){return e.bindVertexArray(O)}function V(O){return e.deleteVertexArray(O)}function F(O,W,k,R){const Q=R.wireframe===!0;let q=i[W.id];q===void 0&&(q={},i[W.id]=q);const H=O.isInstancedMesh===!0?O.id:0;let ae=q[H];ae===void 0&&(ae={},q[H]=ae);let X=ae[k.id];X===void 0&&(X={},ae[k.id]=X);let Z=X[Q];return Z===void 0&&(Z=v(y()),X[Q]=Z),Z}function v(O){const W=[],k=[],R=[];for(let Q=0;Q<t;Q++)W[Q]=0,k[Q]=0,R[Q]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:W,enabledAttributes:k,attributeDivisors:R,object:O,attributes:{},index:null}}function T(O,W,k,R){const Q=l.attributes,q=W.attributes;let H=0;const ae=k.getAttributes();for(const X in ae)if(ae[X].location>=0){const Z=Q[X];let ie=q[X];if(ie===void 0&&(X==="instanceMatrix"&&O.instanceMatrix&&(ie=O.instanceMatrix),X==="instanceColor"&&O.instanceColor&&(ie=O.instanceColor)),Z===void 0||Z.attribute!==ie||ie&&Z.data!==ie.data)return!0;H++}return l.attributesNum!==H||l.index!==R}function w(O,W,k,R){const Q={},q=W.attributes;let H=0;const ae=k.getAttributes();for(const X in ae)if(ae[X].location>=0){let Z=q[X];Z===void 0&&(X==="instanceMatrix"&&O.instanceMatrix&&(Z=O.instanceMatrix),X==="instanceColor"&&O.instanceColor&&(Z=O.instanceColor));const ie={};ie.attribute=Z,Z&&Z.data&&(ie.data=Z.data),Q[X]=ie,H++}l.attributes=Q,l.attributesNum=H,l.index=R}function B(){const O=l.newAttributes;for(let W=0,k=O.length;W<k;W++)O[W]=0}function u(O){s(O,0)}function s(O,W){const k=l.newAttributes,R=l.enabledAttributes,Q=l.attributeDivisors;k[O]=1,R[O]===0&&(e.enableVertexAttribArray(O),R[O]=1),Q[O]!==W&&(e.vertexAttribDivisor(O,W),Q[O]=W)}function _(){const O=l.newAttributes,W=l.enabledAttributes;for(let k=0,R=W.length;k<R;k++)W[k]!==O[k]&&(e.disableVertexAttribArray(k),W[k]=0)}function D(O,W,k,R,Q,q,H){H===!0?e.vertexAttribIPointer(O,W,k,Q,q):e.vertexAttribPointer(O,W,k,R,Q,q)}function S(O,W,k,R){B();const Q=R.attributes,q=k.getAttributes(),H=W.defaultAttributeValues;for(const ae in q){const X=q[ae];if(X.location>=0){let Z=Q[ae];if(Z===void 0&&(ae==="instanceMatrix"&&O.instanceMatrix&&(Z=O.instanceMatrix),ae==="instanceColor"&&O.instanceColor&&(Z=O.instanceColor)),Z!==void 0){const ie=Z.normalized,Pe=Z.itemSize,Ne=a.get(Z);if(Ne===void 0)continue;const z=Ne.buffer,fe=Ne.type,Se=Ne.bytesPerElement,be=fe===e.INT||fe===e.UNSIGNED_INT||Z.gpuType===Rr;if(Z.isInterleavedBufferAttribute){const ge=Z.data,xe=ge.isInterleavedBuffer===!0?ge.stride:ge.itemSize,$e=Z.offset;if(ge.isInstancedInterleavedBuffer||ge.isInstancedBufferAttribute){for(let we=0;we<X.locationSize;we++)s(X.location+we,ge.meshPerAttribute);O.isInstancedMesh!==!0&&R._maxInstanceCount===void 0&&(R._maxInstanceCount=ge.meshPerAttribute*ge.count)}else for(let we=0;we<X.locationSize;we++)u(X.location+we);e.bindBuffer(e.ARRAY_BUFFER,z);for(let we=0;we<X.locationSize;we++)D(X.location+we,Pe/X.locationSize,fe,ie,xe*Se,($e+Pe/X.locationSize*we)*Se,be)}else{if(Z.isInstancedBufferAttribute){for(let ge=0;ge<X.locationSize;ge++)s(X.location+ge,Z.meshPerAttribute);O.isInstancedMesh!==!0&&R._maxInstanceCount===void 0&&(R._maxInstanceCount=Z.meshPerAttribute*Z.count)}else for(let ge=0;ge<X.locationSize;ge++)u(X.location+ge);e.bindBuffer(e.ARRAY_BUFFER,z);for(let ge=0;ge<X.locationSize;ge++)D(X.location+ge,Pe/X.locationSize,fe,ie,Pe*Se,Pe/X.locationSize*ge*Se,be)}}else if(H!==void 0){const ie=H[ae];if(ie!==void 0)switch(ie.length){case 2:e.vertexAttrib2fv(X.location,ie);break;case 3:e.vertexAttrib3fv(X.location,ie);break;case 4:e.vertexAttrib4fv(X.location,ie);break;default:e.vertexAttrib1fv(X.location,ie)}}}}_()}function C(){Y();for(const O in i){const W=i[O];for(const k in W){const R=W[k];for(const Q in R){const q=R[Q];for(const H in q)V(q[H].object),delete q[H];delete R[Q]}}delete i[O]}}function x(O){if(i[O.id]===void 0)return;const W=i[O.id];for(const k in W){const R=W[k];for(const Q in R){const q=R[Q];for(const H in q)V(q[H].object),delete q[H];delete R[Q]}}delete i[O.id]}function n(O){for(const W in i){const k=i[W];for(const R in k){const Q=k[R];if(Q[O.id]===void 0)continue;const q=Q[O.id];for(const H in q)V(q[H].object),delete q[H];delete Q[O.id]}}}function p(O){for(const W in i){const k=i[W],R=O.isInstancedMesh===!0?O.id:0,Q=k[R];if(Q!==void 0){for(const q in Q){const H=Q[q];for(const ae in H)V(H[ae].object),delete H[ae];delete Q[q]}delete k[R],Object.keys(k).length===0&&delete i[W]}}}function Y(){N(),f=!0,l!==c&&(l=c,L(l.object))}function N(){c.geometry=null,c.program=null,c.wireframe=!1}return{setup:g,reset:Y,resetDefaultState:N,dispose:C,releaseStatesOfGeometry:x,releaseStatesOfObject:p,releaseStatesOfProgram:n,initAttributes:B,enableAttribute:u,disableUnusedAttributes:_}}function ac(e,a,t){let i;function c(y){i=y}function l(y,L){e.drawArrays(i,y,L),t.update(L,i,1)}function f(y,L,V){V!==0&&(e.drawArraysInstanced(i,y,L,V),t.update(L,i,V))}function g(y,L,V){if(V===0)return;a.get("WEBGL_multi_draw").multiDrawArraysWEBGL(i,y,0,L,0,V);let F=0;for(let v=0;v<V;v++)F+=L[v];t.update(F,i,1)}this.setMode=c,this.render=l,this.renderInstances=f,this.renderMultiDraw=g}function ic(e,a,t,i){let c;function l(){if(c!==void 0)return c;if(a.has("EXT_texture_filter_anisotropic")===!0){const n=a.get("EXT_texture_filter_anisotropic");c=e.getParameter(n.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else c=0;return c}function f(n){return!(n!==Ot&&i.convert(n)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_FORMAT))}function g(n){const p=n===Ut&&(a.has("EXT_color_buffer_half_float")||a.has("EXT_color_buffer_float"));return!(n!==Lt&&n!==yt&&!p&&i.convert(n)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_TYPE))}function y(n){if(n==="highp"){if(e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.HIGH_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.HIGH_FLOAT).precision>0)return"highp";n="mediump"}return n==="mediump"&&e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.MEDIUM_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let L=t.precision!==void 0?t.precision:"highp";const V=y(L);V!==L&&(Ge("WebGLRenderer:",L,"not supported, using",V,"instead."),L=V);const F=t.reversedDepthBuffer===!0&&a.has("EXT_clip_control"),v=t.logarithmicDepthBuffer===!0&&F===!1;t.reversedDepthBuffer===!0&&F===!1&&Ge("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer."),t.logarithmicDepthBuffer===!0&&F===!0&&Ge("WebGLRenderer: Logarithmic depth buffer is ignored when reversed depth buffer is enabled.");const T=e.getParameter(e.MAX_TEXTURE_IMAGE_UNITS),w=e.getParameter(e.MAX_VERTEX_TEXTURE_IMAGE_UNITS),B=e.getParameter(e.MAX_TEXTURE_SIZE),u=e.getParameter(e.MAX_CUBE_MAP_TEXTURE_SIZE),s=e.getParameter(e.MAX_VERTEX_ATTRIBS),_=e.getParameter(e.MAX_VERTEX_UNIFORM_VECTORS),D=e.getParameter(e.MAX_VARYING_VECTORS),S=e.getParameter(e.MAX_FRAGMENT_UNIFORM_VECTORS),C=e.getParameter(e.MAX_SAMPLES),x=e.getParameter(e.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:l,getMaxPrecision:y,textureFormatReadable:f,textureTypeReadable:g,precision:L,logarithmicDepthBuffer:v,reversedDepthBuffer:F,maxTextures:T,maxVertexTextures:w,maxTextureSize:B,maxCubemapSize:u,maxAttributes:s,maxVertexUniforms:_,maxVaryings:D,maxFragmentUniforms:S,maxSamples:C,samples:x}}function rc(e){const a=this;let t=null,i=0,c=!1,l=!1;const f=new wn,g=new Ie,y={value:null,needsUpdate:!1};this.uniform=y,this.numPlanes=0,this.numIntersection=0,this.init=function(F,v){const T=F.length!==0||v||i!==0||c;return c=v,i=F.length,T},this.beginShadows=function(){l=!0,V(null)},this.endShadows=function(){l=!1},this.setGlobalState=function(F,v){t=V(F,v,0)},this.setState=function(F,v,T){const w=F.clippingPlanes,B=F.clipIntersection,u=F.clipShadows,s=e.get(F);if(!c||w===null||w.length===0||l&&!u)l?V(null):L();else{const _=l?0:i,D=_*4;let S=s.clippingState||null;y.value=S,S=V(w,v,D,T);for(let C=0;C!==D;++C)S[C]=t[C];s.clippingState=S,this.numIntersection=B?this.numPlanes:0,this.numPlanes+=_}};function L(){y.value!==t&&(y.value=t,y.needsUpdate=i>0),a.numPlanes=i,a.numIntersection=0}function V(F,v,T,w){const B=F!==null?F.length:0;let u=null;if(B!==0){if(u=y.value,w!==!0||u===null){const s=T+B*4,_=v.matrixWorldInverse;g.getNormalMatrix(_),(u===null||u.length<s)&&(u=new Float32Array(s));for(let D=0,S=T;D!==B;++D,S+=4)f.copy(F[D]).applyMatrix4(_,g),f.normal.toArray(u,S),u[S+3]=f.constant}y.value=u,y.needsUpdate=!0}return a.numPlanes=B,a.numIntersection=0,u}}class za extends Pt{constructor(a=1,t={}){super(a,a,t),this.isWebGLCubeRenderTarget=!0;const i={width:a,height:a,depth:1},c=[i,i,i,i,i,i];this.texture=new ur(c),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(a,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;const i={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},c=new Va(5,5,5),l=new jt({name:"CubemapFromEquirect",uniforms:Oa(i.uniforms),vertexShader:i.vertexShader,fragmentShader:i.fragmentShader,side:vt,blending:Yt});l.uniforms.tEquirect.value=t;const f=new kt(c,l),g=t.minFilter;return t.minFilter===Vt&&(t.minFilter=Rt),new Fa(1,10,this).update(a,f),t.minFilter=g,f.geometry.dispose(),f.material.dispose(),this}clear(a,t=!0,i=!0,c=!0){const l=a.getRenderTarget();for(let f=0;f<6;f++)a.setRenderTarget(this,f),a.clear(t,i,c);a.setRenderTarget(l)}}const Vi=256,nc=3,oc=20,Or=256,Fr=16,sc=3,lc=new He,cc=new Ze;class Sa{constructor(a){this._renderer=a,this._cubeSize=0,this._sourceTarget=null,this._cubeCamera=new Fa(1,10,null),this._boxMesh=new kt(new Va(5,5,5),null),this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null,this._integrationMaterial=null}fromScene(a,t=0,i=.1,c=100,l={}){const{size:f=256,position:g=lc}=l,y=this._renderer;this._setSize(f);const L=this._allocateTarget(),V=this._getSourceTarget(!0);t>0&&(V.texture.mipmapsAutoUpdate=!1);const F=y.autoClear,v=y.autoClearColor,T=y.autoClearDepth,w=y.autoClearStencil,B=a.background;y.autoClear=!0,y.autoClearColor=!0,y.autoClearDepth=!0,y.autoClearStencil=!0,B===null&&(a.background=y.getClearColor(cc));const u=new Fa(i,c,V);return u.position.copy(g),u.update(y,a),y.autoClear=F,y.autoClearColor=v,y.autoClearDepth=T,y.autoClearStencil=w,a.background=B,t>0&&(V.texture.mipmapsAutoUpdate=!0,this._blur(L,t)),this._applyPMREM(L),L}fromEquirectangular(a,t=null){return this._fromTexture(a,t)}fromCubemap(a,t=null){return this._fromTexture(a,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=ki(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Wi(),this._compileMaterial(this._equirectMaterial))}dispose(){this._sourceTarget!==null&&this._sourceTarget.dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._integrationMaterial!==null&&this._integrationMaterial.dispose(),this._boxMesh.geometry.dispose()}static lodToRoughness(a,t){return t>0?1-Math.sqrt(1-a/t):0}_setSize(a){this._cubeSize=Math.max(Vi,uo(a))}_fromTexture(a,t){a.mapping===va||a.mapping===sa?this._setSize(a.image.length===0?Vi:a.image[0].width||a.image[0].image.width):this._setSize(a.image.width/4);const i=t||this._allocateTarget();return this._textureToCubemap(a),this._applyPMREM(i),i}_allocateTarget(){const a=this._cubeSize,t=zi(a,!1,!1),i=Math.log2(a)-nc;for(let c=0;c<=i;c++)t.texture.mipmaps.push({width:a>>c,height:a>>c});return t.texture.name="PMREM",t.texture.isPMREMTexture=!0,t}_getSourceTarget(a=!1){const t=this._cubeSize,i=this._sourceTarget;return(i===null||i.width!==t||a&&i.depthBuffer===!1)&&(i!==null&&i.dispose(),this._sourceTarget=zi(t,!0,a)),this._sourceTarget}_compileMaterial(a){this._boxMesh.material=a,this._renderer.compile(this._boxMesh,this._cubeCamera.children[0])}_renderCube(a,t,i){const c=this._boxMesh,l=this._cubeCamera;c.material=i,l.renderTarget=a,l.activeMipmapLevel=t;const f=a.width>>t;a.viewport.set(0,0,f,f),l.update(this._renderer,c),a.viewport.set(0,0,a.width,a.height)}_textureToCubemap(a){let t;a.mapping===va||a.mapping===sa?(this._cubemapMaterial===null&&(this._cubemapMaterial=ki()),t=this._cubemapMaterial,t.uniforms.flipEnvMap.value=a.isRenderTargetTexture===!1?-1:1):(this._equirectMaterial===null&&(this._equirectMaterial=Wi()),t=this._equirectMaterial),t.uniforms.envMap.value=a,this._renderCube(this._getSourceTarget(),0,t)}_applyPMREM(a){this._ggxMaterial===null&&(this._ggxMaterial=uc(),this._integrationMaterial=dc());const t=this._cubeSize,i=a.texture.mipmaps.length-1,c=this._ggxMaterial.uniforms;c.envMap.value=this._sourceTarget.texture;const l=this._integrationMaterial.uniforms;l.envMap.value=this._sourceTarget.texture,l.sourceLod.value=Math.log2(t/Fr);for(let f=0;f<=i;f++){const g=Sa.lodToRoughness(f,i);if(f>i-sc)l.roughness.value=g,this._renderCube(a,f,this._integrationMaterial);else{const y=g>0?Math.log2(t)+.5*Math.log2(6/(Or*Math.pow(g,4)))+.5:0;c.roughness.value=g,c.lodBias.value=y,this._renderCube(a,f,this._ggxMaterial)}}}_blur(a,t){this._blurMaterial===null&&(this._blurMaterial=fc());const i=this._blurMaterial,c=i.uniforms,l=this._sourceTarget;c.sigma.value=Math.min(t,Math.PI)/Math.SQRT2,c.envMap.value=l.texture,this._renderCube(a,0,i),c.envMap.value=a.texture,this._renderCube(l,0,i)}}function zi(e,a,t){return new za(e,{minFilter:Vt,generateMipmaps:a,type:Ut,colorSpace:Ur,depthBuffer:t})}function la(e,a,t){return new jt({name:e,uniforms:a,vertexShader:Le.cube_vert,fragmentShader:t,side:vt,blending:Yt,depthTest:!1,depthWrite:!1})}function uc(){return la("PMREMGGXConvolution",{envMap:{value:null},roughness:{value:0},lodBias:{value:0}},`

		#define GGX_SAMPLES ${Or}u

		varying vec3 vWorldDirection;

		uniform samplerCube envMap;
		uniform float roughness;
		uniform float lodBias;

		#include <common>

		// Van der Corput radical inverse
		float radicalInverse_VdC( uint bits ) {

			bits = ( bits << 16u ) | ( bits >> 16u );
			bits = ( ( bits & 0x55555555u ) << 1u ) | ( ( bits & 0xAAAAAAAAu ) >> 1u );
			bits = ( ( bits & 0x33333333u ) << 2u ) | ( ( bits & 0xCCCCCCCCu ) >> 2u );
			bits = ( ( bits & 0x0F0F0F0Fu ) << 4u ) | ( ( bits & 0xF0F0F0F0u ) >> 4u );
			bits = ( ( bits & 0x00FF00FFu ) << 8u ) | ( ( bits & 0xFF00FF00u ) >> 8u );
			return float( bits ) * 2.3283064365386963e-10; // / 0x100000000

		}

		// Hammersley sequence
		vec2 hammersley( uint i, uint N ) {

			return vec2( float( i ) / float( N ), radicalInverse_VdC( i ) );

		}

		void main() {

			vec3 N = normalize( vWorldDirection );

			// For very low roughness, just sample the environment directly
			if ( roughness < 0.001 ) {

				gl_FragColor = vec4( textureLod( envMap, N, 0.0 ).rgb, 1.0 );
				return;

			}

			float alpha = roughness * roughness;
			float alpha2 = alpha * alpha;

			// Tangent space basis for VNDF sampling
			vec3 up = abs( N.z ) < 0.999 ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 );
			vec3 tangent = normalize( cross( up, N ) );
			vec3 bitangent = cross( N, tangent );

			vec3 prefilteredColor = vec3( 0.0 );
			float totalWeight = 0.0;

			for ( uint i = 0u; i < GGX_SAMPLES; i ++ ) {

				vec2 Xi = hammersley( i, GGX_SAMPLES );

				// With V = N, sample the reflected direction directly.
				float invQ = 1.0 / ( 1.0 - Xi.x + alpha2 * Xi.x );
				float NdotL = ( 1.0 - Xi.x - alpha2 * Xi.x ) * invQ;

				if ( NdotL > 0.0 ) {

					float phi = 2.0 * PI * Xi.y;
					float sinTheta = 2.0 * alpha * sqrt( Xi.x * ( 1.0 - Xi.x ) ) * invQ;
					vec3 L = N * NdotL + ( tangent * cos( phi ) + bitangent * sin( phi ) ) * sinTheta;

					// Match the source mip to the sample's solid angle. The terms
					// independent of the sample are precomputed in lodBias.
					float d = alpha2 * invQ;
					float lod = max( log2( d ) + lodBias, 0.0 );

					// Weight by NdotL for the split-sum approximation
					prefilteredColor += textureLod( envMap, L, lod ).rgb * NdotL;
					totalWeight += NdotL;

				}

			}

			gl_FragColor = vec4( prefilteredColor / totalWeight, 1.0 );

		}
	`)}function dc(){return la("PMREMGGXIntegration",{envMap:{value:null},roughness:{value:0},sourceLod:{value:0},sourceSize:{value:Fr}},`

		varying vec3 vWorldDirection;

		uniform samplerCube envMap;
		uniform float roughness;
		uniform float sourceLod;
		uniform int sourceSize;

		void main() {

			vec3 N = normalize( vWorldDirection );

			float alpha = roughness * roughness;
			float alpha2 = alpha * alpha;

			float texelSize = 2.0 / float( sourceSize );

			vec3 prefilteredColor = vec3( 0.0 );
			float totalWeight = 0.0;

			// Pair opposite texels: only the one in N's hemisphere contributes.
			for ( int face = 0; face < 3; face ++ ) {

				for ( int y = 0; y < sourceSize; y ++ ) {

					for ( int x = 0; x < sourceSize; x ++ ) {

						vec2 uv = ( vec2( x, y ) + 0.5 ) * texelSize - 1.0;
						vec3 texelDirection = face == 0 ? vec3( 1.0, uv ) : ( face == 1 ? vec3( uv.x, 1.0, uv.y ) : vec3( uv, 1.0 ) );

						float invDistance = inversesqrt( 1.0 + dot( uv, uv ) );
						float NdotL = dot( N, texelDirection );
						texelDirection *= NdotL < 0.0 ? - 1.0 : 1.0;
						NdotL = abs( NdotL ) * invDistance;

						// With V = N, NdotH squared is ( 1 + NdotL ) / 2. Common factors
						// in the GGX distribution and texel solid angle cancel when normalized.
						float d = 1.0 + alpha2 + ( alpha2 - 1.0 ) * NdotL;
						float weight = NdotL * invDistance * invDistance * invDistance / ( d * d );

						prefilteredColor += textureLod( envMap, texelDirection, sourceLod ).rgb * weight;
						totalWeight += weight;

					}

				}

			}

			gl_FragColor = vec4( prefilteredColor / totalWeight, 1.0 );

		}
	`)}function fc(){return la("PMREMSphericalGaussianBlur",{envMap:{value:null},sigma:{value:0}},`

		#define SAMPLES ${oc}
		#define GOLDEN_ANGLE 2.39996322973

		varying vec3 vWorldDirection;

		uniform samplerCube envMap;
		uniform float sigma;

		#include <common>

		void main() {

			vec3 outputDirection = normalize( vWorldDirection );

			vec3 up = abs( outputDirection.z ) < 0.999 ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 );
			vec3 tangent = normalize( cross( up, outputDirection ) );
			vec3 bitangent = cross( outputDirection, tangent );

			// Truncate the kernel at three standard deviations or at the antipode.
			float thetaMax = min( 3.0 * sigma, PI );
			float truncation = 1.0 - exp( - 0.5 * thetaMax * thetaMax / ( sigma * sigma ) );

			vec3 accumColor = vec3( 0.0 );
			float accumWeight = 0.0;

			for ( int i = 0; i < SAMPLES; i ++ ) {

				// Stratified inverse-CDF sampling of the Gaussian, placed on a golden-angle spiral.
				float stratum = ( float( i ) + 0.5 ) / float( SAMPLES );
				float theta = sigma * sqrt( - 2.0 * log( 1.0 - stratum * truncation ) );
				float phi = float( i ) * GOLDEN_ANGLE;

				vec3 offset = cos( phi ) * tangent + sin( phi ) * bitangent;
				vec3 sampleDirection = cos( theta ) * outputDirection + sin( theta ) * offset;

				// Correct the planar sample density to solid angle.
				float weight = sin( theta ) / theta;

				accumColor += weight * textureLod( envMap, sampleDirection, 0.0 ).rgb;
				accumWeight += weight;

			}

			gl_FragColor = vec4( accumColor / accumWeight, 1.0 );

		}
	`)}function Wi(){return la("PMREMEquirectangularToCubemap",{envMap:{value:null}},`

		varying vec3 vWorldDirection;

		uniform sampler2D envMap;

		#include <common>

		void main() {

			// Average four subpixel samples to preserve small, bright features.
			vec3 direction = normalize( vWorldDirection );
			vec3 dx = dFdx( direction ) * 0.25;
			vec3 dy = dFdy( direction ) * 0.25;

			vec3 color = textureLod( envMap, equirectUv( normalize( direction - dx - dy ) ), 0.0 ).rgb;
			color += textureLod( envMap, equirectUv( normalize( direction + dx - dy ) ), 0.0 ).rgb;
			color += textureLod( envMap, equirectUv( normalize( direction - dx + dy ) ), 0.0 ).rgb;
			color += textureLod( envMap, equirectUv( normalize( direction + dx + dy ) ), 0.0 ).rgb;
			gl_FragColor = vec4( color * 0.25, 1.0 );

		}
	`)}function ki(){return la("PMREMCubemapToCubemap",{envMap:{value:null},flipEnvMap:{value:-1}},`

		varying vec3 vWorldDirection;

		uniform samplerCube envMap;
		uniform float flipEnvMap;

		void main() {

			gl_FragColor = vec4( textureCube( envMap, vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) ).rgb, 1.0 );

		}
	`)}function pc(e){let a=new WeakMap,t=new WeakMap,i=null;function c(v,T=!1){return v==null?null:T?f(v):l(v)}function l(v){if(v&&v.isTexture){const T=v.mapping;if(T===Da||T===Na)if(a.has(v)){const w=a.get(v).texture;return g(w,v.mapping)}else{const w=v.image;if(w&&w.height>0){const B=new za(w.height);return B.fromEquirectangularTexture(e,v),a.set(v,B),v.addEventListener("dispose",L),g(B.texture,v.mapping)}else return null}}return v}function f(v){if(v&&v.isTexture&&v.isPMREMTexture!==!0){const T=v.mapping,w=T===Da||T===Na,B=T===va||T===sa;if(w||B){let u=t.get(v);const s=u!==void 0?u.texture.pmremVersion:0;if(v.isRenderTargetTexture&&v.pmremVersion!==s)return i===null&&(i=new Sa(e)),u=w?i.fromEquirectangular(v,u):i.fromCubemap(v,u),u.texture.pmremVersion=v.pmremVersion,t.set(v,u),u.texture;if(u!==void 0)return u.texture;{const _=v.image;return w&&_&&_.height>0||B&&_&&y(_)?(i===null&&(i=new Sa(e)),u=w?i.fromEquirectangular(v):i.fromCubemap(v),u.texture.pmremVersion=v.pmremVersion,t.set(v,u),v.addEventListener("dispose",V),u.texture):null}}}return v}function g(v,T){return T===Da?v.mapping=va:T===Na&&(v.mapping=sa),v}function y(v){let T=0;const w=6;for(let B=0;B<w;B++)v[B]!==void 0&&T++;return T===w}function L(v){const T=v.target;T.removeEventListener("dispose",L);const w=a.get(T);w!==void 0&&(a.delete(T),w.dispose())}function V(v){const T=v.target;T.removeEventListener("dispose",V);const w=t.get(T);w!==void 0&&(t.delete(T),w.dispose())}function F(){a=new WeakMap,t=new WeakMap,i!==null&&(i.dispose(),i=null)}return{get:c,dispose:F}}function mc(e){const a={};function t(i){if(a[i]!==void 0)return a[i];const c=e.getExtension(i);return a[i]=c,c}return{has:function(i){return t(i)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(i){const c=t(i);return c===null&&Vn("WebGLRenderer: "+i+" extension not supported."),c}}}function hc(e,a,t,i){const c={},l=new WeakMap,f=new FinalizationRegistry(w=>delete c[w]);function g(w){y(w.target)}function y(w){w.index!==null&&a.remove(w.index);for(const u in w.attributes)a.remove(w.attributes[u]);w.removeEventListener("dispose",g),delete c[w.id],f.unregister(w);const B=l.get(w);B&&(a.remove(B),l.delete(w)),i.releaseStatesOfGeometry(w),w.isInstancedBufferGeometry===!0&&delete w._maxInstanceCount,t.memory.geometries--}function L(w,B){return c[B.id]!==void 0||(B.addEventListener("dispose",g),c[B.id]=new WeakRef(B),f.register(B,B.id,B),t.memory.geometries++),B}function V(w){const B=w.attributes;for(const u in B)a.update(B[u],e.ARRAY_BUFFER)}function F(w){const B=w.index,u=w.attributes.position;let s=0;if(u===void 0)return;const _=B!==null?B.array.length:u.array.length/3-1,D=u.count>=65535?so:lo,S=new D(Math.ceil(_/3)*6,1),C=S.array;if(B!==null){const n=B.array;s=B.version;for(let p=0,Y=0;p<_;p+=3){const N=n[p+0],O=n[p+1],W=n[p+2];C[Y++]=N,C[Y++]=O,C[Y++]=O,C[Y++]=W,C[Y++]=W,C[Y++]=N}}else{s=u.version;for(let n=0,p=0;n<_;n+=3){const Y=n+0,N=n+1,O=n+2;C[p++]=Y,C[p++]=N,C[p++]=N,C[p++]=O,C[p++]=O,C[p++]=Y}}S.version=s;const x=l.get(w);x&&a.remove(x),l.set(w,S)}function v(w){const B=l.get(w);if(B){const u=w.index;u!==null&&B.version<u.version&&F(w)}else F(w);return l.get(w)}function T(){for(const w in c){const B=c[w].deref();B!==void 0&&y(B)}}return{get:L,update:V,getWireframeAttribute:v,dispose:T}}function gc(e,a,t){let i;function c(F){i=F}let l,f;function g(F){l=F.type,f=F.bytesPerElement}function y(F,v){e.drawElements(i,v,l,F*f),t.update(v,i,1)}function L(F,v,T){T!==0&&(e.drawElementsInstanced(i,v,l,F*f,T),t.update(v,i,T))}function V(F,v,T){if(T===0)return;a.get("WEBGL_multi_draw").multiDrawElementsWEBGL(i,v,0,l,F,0,T);let w=0;for(let B=0;B<T;B++)w+=v[B];t.update(w,i,1)}this.setMode=c,this.setIndex=g,this.render=y,this.renderInstances=L,this.renderMultiDraw=V}function _c(e){const a={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function i(l,f,g){switch(t.calls++,f){case e.TRIANGLES:t.triangles+=g*(l/3);break;case e.LINES:t.lines+=g*(l/2);break;case e.LINE_STRIP:t.lines+=g*(l-1);break;case e.LINE_LOOP:t.lines+=g*l;break;case e.POINTS:t.points+=g*l;break;default:je("WebGLInfo: Unknown draw mode:",f);break}}function c(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:a,render:t,programs:null,autoReset:!0,reset:c,update:i}}function vc(e,a,t){const i=new WeakMap,c=new ht;function l(f,g,y){const L=f.morphTargetInfluences,V=g.morphAttributes.position||g.morphAttributes.normal||g.morphAttributes.color,F=V!==void 0?V.length:0;let v=i.get(g);if(v===void 0||v.count!==F){let T=function(){p.dispose(),i.delete(g),g.removeEventListener("dispose",T)};v!==void 0&&v.texture.dispose();const w=g.morphAttributes.position!==void 0,B=g.morphAttributes.normal!==void 0,u=g.morphAttributes.color!==void 0,s=g.morphAttributes.position||[],_=g.morphAttributes.normal||[],D=g.morphAttributes.color||[];let S=0;w===!0&&(S=1),B===!0&&(S=2),u===!0&&(S=3);let C=g.attributes.position.count*S,x=1;C>a.maxTextureSize&&(x=Math.ceil(C/a.maxTextureSize),C=a.maxTextureSize);const n=new Float32Array(C*x*4*F),p=new cr(n,C,x,F);p.type=yt,p.needsUpdate=!0;const Y=S*4;for(let N=0;N<F;N++){const O=s[N],W=_[N],k=D[N],R=C*x*4*N;for(let Q=0;Q<O.count;Q++){const q=Q*Y;w===!0&&(c.fromBufferAttribute(O,Q),n[R+q+0]=c.x,n[R+q+1]=c.y,n[R+q+2]=c.z,n[R+q+3]=0),B===!0&&(c.fromBufferAttribute(W,Q),n[R+q+4]=c.x,n[R+q+5]=c.y,n[R+q+6]=c.z,n[R+q+7]=0),u===!0&&(c.fromBufferAttribute(k,Q),n[R+q+8]=c.x,n[R+q+9]=c.y,n[R+q+10]=c.z,n[R+q+11]=k.itemSize===4?c.w:1)}}v={count:F,texture:p,size:new gt(C,x)},i.set(g,v),g.addEventListener("dispose",T)}if(f.isInstancedMesh===!0&&f.morphTexture!==null)y.getUniforms().setValue(e,"morphTexture",f.morphTexture,t);else{let T=0;for(let B=0;B<L.length;B++)T+=L[B];const w=g.morphTargetsRelative?1:1-T;y.getUniforms().setValue(e,"morphTargetBaseInfluence",w),y.getUniforms().setValue(e,"morphTargetInfluences",L)}y.getUniforms().setValue(e,"morphTargetsTexture",v.texture,t),y.getUniforms().setValue(e,"morphTargetsTextureSize",v.size)}return{update:l}}function Sc(e,a,t,i,c){let l=new WeakMap;function f(L){const V=c.render.frame,F=L.geometry,v=a.get(L,F);if(l.get(v)!==V&&(a.update(v),l.set(v,V)),L.isInstancedMesh&&(L.hasEventListener("dispose",y)===!1&&L.addEventListener("dispose",y),l.get(L)!==V&&(t.update(L.instanceMatrix,e.ARRAY_BUFFER),L.instanceColor!==null&&t.update(L.instanceColor,e.ARRAY_BUFFER),l.set(L,V))),L.isSkinnedMesh){const T=L.skeleton;l.get(T)!==V&&(T.update(),l.set(T,V))}return v}function g(){l=new WeakMap}function y(L){const V=L.target;V.removeEventListener("dispose",y),i.releaseStatesOfObject(V),t.remove(V.instanceMatrix),V.instanceColor!==null&&t.remove(V.instanceColor)}return{update:f,dispose:g}}const Ec={[Nr]:"LINEAR_TONE_MAPPING",[Dr]:"REINHARD_TONE_MAPPING",[wr]:"CINEON_TONE_MAPPING",[Pr]:"ACES_FILMIC_TONE_MAPPING",[Lr]:"AGX_TONE_MAPPING",[Cr]:"NEUTRAL_TONE_MAPPING",[br]:"CUSTOM_TONE_MAPPING"};function Mc(e,a,t,i,c,l){const f=new Pt(a,t,{type:e,depthBuffer:c,stencilBuffer:l,samples:i?4:0,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,resolveDepthBuffer:!1,resolveStencilBuffer:!1});let g=null,y=null,L=null;const V=new hr;V.setAttribute("position",new ii([-1,3,0,-1,-1,0,3,-1,0],3)),V.setAttribute("uv",new ii([0,2,0,0,2,0],2));const F=new yn({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),v=new kt(V,F),T=new On(-1,1,1,-1,0,1);let w=null,B=null,u=!1,s,_=null,D=[],S=!1;this.setSize=function(C,x){f.setSize(C,x),g!==null&&g.setSize(C,x),y!==null&&y.setSize(C,x);for(let n=0;n<D.length;n++){const p=D[n];p.setSize&&p.setSize(C,x)}},this.setEffects=function(C){D=C,S=D.length>0&&D[0].isRenderPass===!0;const x=f.width,n=f.height;D.length>0&&g===null&&(g=new Pt(x,n,{type:Ut,depthBuffer:!1,stencilBuffer:!1}),y=new Pt(x,n,{type:Ut,depthBuffer:!1,stencilBuffer:!1}));const p=c===!0&&D.some(Y=>Y.needsDepthTexture===!0);p!==(f.depthTexture!==null)&&(p===!0&&L===null&&(L=new ra(x,n),l===!0&&(L.format=Wt,L.type=$t)),f.dispose(),f.depthTexture=p?L:null,f.resolveDepthBuffer=p,f.storeMultisampledDepthBuffer=p);for(let Y=0;Y<D.length;Y++){const N=D[Y];N.setSize&&N.setSize(x,n),p&&N.needsDepthTexture===!0&&N.setDepthTexture&&N.setDepthTexture(L)}},this.begin=function(C,x){if(u||C.toneMapping===Nt&&D.length===0)return!1;if(_=x,x!==null){const n=x.width,p=x.height;(f.width!==n||f.height!==p)&&this.setSize(n,p)}return S===!1&&C.setRenderTarget(f),s=C.toneMapping,C.toneMapping=Nt,!0},this.hasRenderPass=function(){return S},this.end=function(C,x){C.toneMapping=s,u=!0;let n=f,p=g;for(let Y=0;Y<D.length;Y++){const N=D[Y];N.enabled!==!1&&(N.render(C,p,n,x),N.needsSwap!==!1&&(n=p,p=p===g?y:g))}if(w!==C.outputColorSpace||B!==C.toneMapping){w=C.outputColorSpace,B=C.toneMapping,F.defines={},Je.getTransfer(w)===We&&(F.defines.SRGB_TRANSFER="");const Y=Ec[B];Y&&(F.defines[Y]=""),F.needsUpdate=!0}F.uniforms.tDiffuse.value=n.texture,C.setRenderTarget(_),C.render(v,T),_=null,u=!1},this.isCompositing=function(){return u},this.dispose=function(){f.dispose(),g!==null&&g.dispose(),y!==null&&y.dispose(),V.dispose(),F.dispose()}}const Br=new $r,Gr=new ra(1,1),Hr=new lr(1),Vr=new cr,zr=new Qr,Wr=new ur,Xi=[],Ki=[],Yi=new Float32Array(16),qi=new Float32Array(9),ji=new Float32Array(4);function Qt(e,a,t){const i=e[0];if(i<=0||i>0)return e;const c=a*t;let l=Xi[c];if(l===void 0&&(l=new Float32Array(c),Xi[c]=l),a!==0){i.toArray(l,0);for(let f=1,g=0;f!==a;++f)g+=t,e[f].toArray(l,g)}return l}function nt(e,a){if(e.length!==a.length)return!1;for(let t=0,i=e.length;t<i;t++)if(e[t]!==a[t])return!1;return!0}function ot(e,a){for(let t=0,i=a.length;t<i;t++)e[t]=a[t]}function Ea(e,a){let t=Ki[a];t===void 0&&(t=new Int32Array(a),Ki[a]=t);for(let i=0;i!==a;++i)t[i]=e.allocateTextureUnit();return t}function Tc(e,a){const t=this.cache;t[0]!==a&&(e.uniform1f(this.addr,a),t[0]=a)}function xc(e,a){const t=this.cache;if(a.x!==void 0)(t[0]!==a.x||t[1]!==a.y)&&(e.uniform2f(this.addr,a.x,a.y),t[0]=a.x,t[1]=a.y);else{if(nt(t,a))return;e.uniform2fv(this.addr,a),ot(t,a)}}function Rc(e,a){const t=this.cache;if(a.x!==void 0)(t[0]!==a.x||t[1]!==a.y||t[2]!==a.z)&&(e.uniform3f(this.addr,a.x,a.y,a.z),t[0]=a.x,t[1]=a.y,t[2]=a.z);else if(a.r!==void 0)(t[0]!==a.r||t[1]!==a.g||t[2]!==a.b)&&(e.uniform3f(this.addr,a.r,a.g,a.b),t[0]=a.r,t[1]=a.g,t[2]=a.b);else{if(nt(t,a))return;e.uniform3fv(this.addr,a),ot(t,a)}}function Ac(e,a){const t=this.cache;if(a.x!==void 0)(t[0]!==a.x||t[1]!==a.y||t[2]!==a.z||t[3]!==a.w)&&(e.uniform4f(this.addr,a.x,a.y,a.z,a.w),t[0]=a.x,t[1]=a.y,t[2]=a.z,t[3]=a.w);else{if(nt(t,a))return;e.uniform4fv(this.addr,a),ot(t,a)}}function bc(e,a){const t=this.cache,i=a.elements;if(i===void 0){if(nt(t,a))return;e.uniformMatrix2fv(this.addr,!1,a),ot(t,a)}else{if(nt(t,i))return;ji.set(i),e.uniformMatrix2fv(this.addr,!1,ji),ot(t,i)}}function Cc(e,a){const t=this.cache,i=a.elements;if(i===void 0){if(nt(t,a))return;e.uniformMatrix3fv(this.addr,!1,a),ot(t,a)}else{if(nt(t,i))return;qi.set(i),e.uniformMatrix3fv(this.addr,!1,qi),ot(t,i)}}function Lc(e,a){const t=this.cache,i=a.elements;if(i===void 0){if(nt(t,a))return;e.uniformMatrix4fv(this.addr,!1,a),ot(t,a)}else{if(nt(t,i))return;Yi.set(i),e.uniformMatrix4fv(this.addr,!1,Yi),ot(t,i)}}function Pc(e,a){const t=this.cache;t[0]!==a&&(e.uniform1i(this.addr,a),t[0]=a)}function wc(e,a){const t=this.cache;if(a.x!==void 0)(t[0]!==a.x||t[1]!==a.y)&&(e.uniform2i(this.addr,a.x,a.y),t[0]=a.x,t[1]=a.y);else{if(nt(t,a))return;e.uniform2iv(this.addr,a),ot(t,a)}}function Dc(e,a){const t=this.cache;if(a.x!==void 0)(t[0]!==a.x||t[1]!==a.y||t[2]!==a.z)&&(e.uniform3i(this.addr,a.x,a.y,a.z),t[0]=a.x,t[1]=a.y,t[2]=a.z);else{if(nt(t,a))return;e.uniform3iv(this.addr,a),ot(t,a)}}function Nc(e,a){const t=this.cache;if(a.x!==void 0)(t[0]!==a.x||t[1]!==a.y||t[2]!==a.z||t[3]!==a.w)&&(e.uniform4i(this.addr,a.x,a.y,a.z,a.w),t[0]=a.x,t[1]=a.y,t[2]=a.z,t[3]=a.w);else{if(nt(t,a))return;e.uniform4iv(this.addr,a),ot(t,a)}}function Uc(e,a){const t=this.cache;t[0]!==a&&(e.uniform1ui(this.addr,a),t[0]=a)}function Ic(e,a){const t=this.cache;if(a.x!==void 0)(t[0]!==a.x||t[1]!==a.y)&&(e.uniform2ui(this.addr,a.x,a.y),t[0]=a.x,t[1]=a.y);else{if(nt(t,a))return;e.uniform2uiv(this.addr,a),ot(t,a)}}function yc(e,a){const t=this.cache;if(a.x!==void 0)(t[0]!==a.x||t[1]!==a.y||t[2]!==a.z)&&(e.uniform3ui(this.addr,a.x,a.y,a.z),t[0]=a.x,t[1]=a.y,t[2]=a.z);else{if(nt(t,a))return;e.uniform3uiv(this.addr,a),ot(t,a)}}function Oc(e,a){const t=this.cache;if(a.x!==void 0)(t[0]!==a.x||t[1]!==a.y||t[2]!==a.z||t[3]!==a.w)&&(e.uniform4ui(this.addr,a.x,a.y,a.z,a.w),t[0]=a.x,t[1]=a.y,t[2]=a.z,t[3]=a.w);else{if(nt(t,a))return;e.uniform4uiv(this.addr,a),ot(t,a)}}function Ma(e){return e.version===0&&(e.compareFunction=mr,e.needsUpdate=!0),e}function Fc(e,a,t){const i=this.cache,c=t.allocateTextureUnit();i[0]!==c&&(e.uniform1i(this.addr,c),i[0]=c);let l;this.type===e.SAMPLER_2D_SHADOW?l=Ma(Gr):l=Br,t.setTexture2D(a||l,c)}function Bc(e,a,t){const i=this.cache,c=t.allocateTextureUnit();i[0]!==c&&(e.uniform1i(this.addr,c),i[0]=c),t.setTexture3D(a||zr,c)}function Gc(e,a,t){const i=this.cache,c=t.allocateTextureUnit();i[0]!==c&&(e.uniform1i(this.addr,c),i[0]=c);let l;this.type===e.SAMPLER_CUBE_SHADOW?l=Ma(Hr):l=Wr,t.setTextureCube(a||l,c)}function Hc(e,a,t){const i=this.cache,c=t.allocateTextureUnit();i[0]!==c&&(e.uniform1i(this.addr,c),i[0]=c),t.setTexture2DArray(a||Vr,c)}function Vc(e){switch(e){case 5126:return Tc;case 35664:return xc;case 35665:return Rc;case 35666:return Ac;case 35674:return bc;case 35675:return Cc;case 35676:return Lc;case 5124:case 35670:return Pc;case 35667:case 35671:return wc;case 35668:case 35672:return Dc;case 35669:case 35673:return Nc;case 5125:return Uc;case 36294:return Ic;case 36295:return yc;case 36296:return Oc;case 35678:case 36198:case 36298:case 36306:case 35682:return Fc;case 35679:case 36299:case 36307:return Bc;case 35680:case 36300:case 36308:case 36293:return Gc;case 36289:case 36303:case 36311:case 36292:return Hc}}function zc(e,a){e.uniform1fv(this.addr,a)}function Wc(e,a){const t=Qt(a,this.size,2);e.uniform2fv(this.addr,t)}function kc(e,a){const t=Qt(a,this.size,3);e.uniform3fv(this.addr,t)}function Xc(e,a){const t=Qt(a,this.size,4);e.uniform4fv(this.addr,t)}function Kc(e,a){const t=Qt(a,this.size,4);e.uniformMatrix2fv(this.addr,!1,t)}function Yc(e,a){const t=Qt(a,this.size,9);e.uniformMatrix3fv(this.addr,!1,t)}function qc(e,a){const t=Qt(a,this.size,16);e.uniformMatrix4fv(this.addr,!1,t)}function jc(e,a){e.uniform1iv(this.addr,a)}function Zc(e,a){e.uniform2iv(this.addr,a)}function $c(e,a){e.uniform3iv(this.addr,a)}function Qc(e,a){e.uniform4iv(this.addr,a)}function Jc(e,a){e.uniform1uiv(this.addr,a)}function eu(e,a){e.uniform2uiv(this.addr,a)}function tu(e,a){e.uniform3uiv(this.addr,a)}function au(e,a){e.uniform4uiv(this.addr,a)}function iu(e,a,t){const i=this.cache,c=a.length,l=Ea(t,c);nt(i,l)||(e.uniform1iv(this.addr,l),ot(i,l));let f;this.type===e.SAMPLER_2D_SHADOW?f=Ma(Gr):f=Br;for(let g=0;g!==c;++g)t.setTexture2D(a[g]||f,l[g])}function ru(e,a,t){const i=this.cache,c=a.length,l=Ea(t,c);nt(i,l)||(e.uniform1iv(this.addr,l),ot(i,l));for(let f=0;f!==c;++f)t.setTexture3D(a[f]||zr,l[f])}function nu(e,a,t){const i=this.cache,c=a.length,l=Ea(t,c);nt(i,l)||(e.uniform1iv(this.addr,l),ot(i,l));let f;this.type===e.SAMPLER_CUBE_SHADOW?f=Ma(Hr):f=Wr;for(let g=0;g!==c;++g)t.setTextureCube(a[g]||f,l[g])}function ou(e,a,t){const i=this.cache,c=a.length,l=Ea(t,c);nt(i,l)||(e.uniform1iv(this.addr,l),ot(i,l));for(let f=0;f!==c;++f)t.setTexture2DArray(a[f]||Vr,l[f])}function su(e){switch(e){case 5126:return zc;case 35664:return Wc;case 35665:return kc;case 35666:return Xc;case 35674:return Kc;case 35675:return Yc;case 35676:return qc;case 5124:case 35670:return jc;case 35667:case 35671:return Zc;case 35668:case 35672:return $c;case 35669:case 35673:return Qc;case 5125:return Jc;case 36294:return eu;case 36295:return tu;case 36296:return au;case 35678:case 36198:case 36298:case 36306:case 35682:return iu;case 35679:case 36299:case 36307:return ru;case 35680:case 36300:case 36308:case 36293:return nu;case 36289:case 36303:case 36311:case 36292:return ou}}class lu{constructor(a,t,i){this.id=a,this.addr=i,this.cache=[],this.type=t.type,this.setValue=Vc(t.type)}}class cu{constructor(a,t,i){this.id=a,this.addr=i,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=su(t.type)}}class uu{constructor(a){this.id=a,this.seq=[],this.map={}}setValue(a,t,i){const c=this.seq;for(let l=0,f=c.length;l!==f;++l){const g=c[l];g.setValue(a,t[g.id],i)}}}const Ua=/(\w+)(\])?(\[|\.)?/g;function Zi(e,a){e.seq.push(a),e.map[a.id]=a}function du(e,a,t){const i=e.name,c=i.length;for(Ua.lastIndex=0;;){const l=Ua.exec(i),f=Ua.lastIndex;let g=l[1];const y=l[2]==="]",L=l[3];if(y&&(g=g|0),L===void 0||L==="["&&f+2===c){Zi(t,L===void 0?new lu(g,e,a):new cu(g,e,a));break}else{let V=t.map[g];V===void 0&&(V=new uu(g),Zi(t,V)),t=V}}}class ga{constructor(a,t){this.seq=[],this.map={};const i=a.getProgramParameter(t,a.ACTIVE_UNIFORMS);for(let f=0;f<i;++f){const g=a.getActiveUniform(t,f),y=a.getUniformLocation(t,g.name);du(g,y,this)}const c=[],l=[];for(const f of this.seq)f.type===a.SAMPLER_2D_SHADOW||f.type===a.SAMPLER_CUBE_SHADOW||f.type===a.SAMPLER_2D_ARRAY_SHADOW?c.push(f):l.push(f);c.length>0&&(this.seq=c.concat(l))}setValue(a,t,i,c){const l=this.map[t];l!==void 0&&l.setValue(a,i,c)}setOptional(a,t,i){const c=t[i];c!==void 0&&this.setValue(a,i,c)}static upload(a,t,i,c){for(let l=0,f=t.length;l!==f;++l){const g=t[l],y=i[g.id];y.needsUpdate!==!1&&g.setValue(a,y.value,c)}}static seqWithValue(a,t){const i=[];for(let c=0,l=a.length;c!==l;++c){const f=a[c];f.id in t&&i.push(f)}return i}}function $i(e,a,t){const i=e.createShader(a);return e.shaderSource(i,t),e.compileShader(i),i}const fu=37297;let pu=0;function mu(e,a){const t=e.split(`
`),i=[],c=Math.max(a-6,0),l=Math.min(a+6,t.length);for(let f=c;f<l;f++){const g=f+1;i.push(`${g===a?">":" "} ${g}: ${t[f]}`)}return i.join(`
`)}const Qi=new Ie;function hu(e){Je._getMatrix(Qi,Je.workingColorSpace,e);const a=`mat3( ${Qi.elements.map(t=>t.toFixed(4))} )`;switch(Je.getTransfer(e)){case Ar:return[a,"LinearTransferOETF"];case We:return[a,"sRGBTransferOETF"];default:return Ge("WebGLProgram: Unsupported color space: ",e),[a,"LinearTransferOETF"]}}function Ji(e,a,t){const i=e.getShaderParameter(a,e.COMPILE_STATUS),c=(e.getShaderInfoLog(a)||"").trim();if(i&&c==="")return"";const l=/ERROR: 0:(\d+)/.exec(c);if(l){const f=parseInt(l[1]);return t.toUpperCase()+`

`+c+`

`+mu(e.getShaderSource(a),f)}else return c}function gu(e,a){const t=hu(a);return[`vec4 ${e}( vec4 value ) {`,`	return ${t[1]}( vec4( ${t[0]} * value.rgb, value.a ) );`,"}"].join(`
`)}const _u={[Nr]:"Linear",[Dr]:"Reinhard",[wr]:"Cineon",[Pr]:"ACESFilmic",[Lr]:"AgX",[Cr]:"Neutral",[br]:"Custom"};function vu(e,a){const t=_u[a];return t===void 0?(Ge("WebGLProgram: Unsupported toneMapping:",a),"vec3 "+e+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+e+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}const pa=new He;function Su(){Je.getLuminanceCoefficients(pa);const e=pa.x.toFixed(4),a=pa.y.toFixed(4),t=pa.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${e}, ${a}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function Eu(e){return[e.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",e.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(ia).join(`
`)}function Mu(e){const a=[];for(const t in e){const i=e[t];i!==!1&&a.push("#define "+t+" "+i)}return a.join(`
`)}function Tu(e,a){const t={},i=e.getProgramParameter(a,e.ACTIVE_ATTRIBUTES);for(let c=0;c<i;c++){const l=e.getActiveAttrib(a,c),f=l.name;let g=1;l.type===e.FLOAT_MAT2&&(g=2),l.type===e.FLOAT_MAT3&&(g=3),l.type===e.FLOAT_MAT4&&(g=4),t[f]={type:l.type,location:e.getAttribLocation(a,f),locationSize:g}}return t}function ia(e){return e!==""}function er(e,a){const t=a.numSpotLightShadows+a.numSpotLightMaps-a.numSpotLightShadowsWithMaps;return e.replace(/NUM_SUN_LIGHTS/g,a.numSunLights).replace(/NUM_DIR_LIGHTS/g,a.numDirLights).replace(/NUM_SPOT_LIGHTS/g,a.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,a.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,a.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,a.numPointLights).replace(/NUM_HEMI_LIGHTS/g,a.numHemiLights).replace(/NUM_SUN_LIGHT_SHADOWS/g,a.numSunLightShadows).replace(/NUM_DIR_LIGHT_SHADOWS/g,a.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,a.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,a.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,a.numPointLightShadows).replace(/NUM_LIGHT_PROBE_GRIDS/g,a.numLightProbeGrids)}function tr(e,a){return e.replace(/NUM_CLIPPING_PLANES/g,a.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,a.numClippingPlanes-a.numClipIntersection)}const xu=/^[ \t]*#include +<([\w\d./]+)>/gm;function Ha(e){return e.replace(xu,Ru)}function Ru(e,a){const t=Le[a];if(t===void 0)throw new Error("THREE.WebGLProgram: Can not resolve #include <"+a+">");return Ha(t)}const Au=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function ar(e){return e.replace(Au,bu)}function bu(e,a,t,i){let c="";for(let l=parseInt(a);l<parseInt(t);l++)c+=i.replace(/\[\s*i\s*\]/g,"[ "+l+" ]").replace(/UNROLLED_LOOP_INDEX/g,l);return c}function ir(e){let a=`precision ${e.precision} float;
	precision ${e.precision} int;
	precision ${e.precision} sampler2D;
	precision ${e.precision} samplerCube;
	precision ${e.precision} sampler3D;
	precision ${e.precision} sampler2DArray;
	precision ${e.precision} sampler2DShadow;
	precision ${e.precision} samplerCubeShadow;
	precision ${e.precision} sampler2DArrayShadow;
	precision ${e.precision} isampler2D;
	precision ${e.precision} isampler3D;
	precision ${e.precision} isamplerCube;
	precision ${e.precision} isampler2DArray;
	precision ${e.precision} usampler2D;
	precision ${e.precision} usampler3D;
	precision ${e.precision} usamplerCube;
	precision ${e.precision} usampler2DArray;
	`;return e.precision==="highp"?a+=`
#define HIGH_PRECISION`:e.precision==="mediump"?a+=`
#define MEDIUM_PRECISION`:e.precision==="lowp"&&(a+=`
#define LOW_PRECISION`),a}const Cu={[ma]:"SHADOWMAP_TYPE_PCF",[aa]:"SHADOWMAP_TYPE_VSM"};function Lu(e){return Cu[e.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}const Pu={[sa]:"ENVMAP_MODE_REFRACTION"};function wu(e){return e.envMap===!1?"ENVMAP_MODE_REFLECTION":Pu[e.envMapMode]||"ENVMAP_MODE_REFLECTION"}const Du={[mo]:"ENVMAP_BLENDING_MULTIPLY",[po]:"ENVMAP_BLENDING_MIX",[fo]:"ENVMAP_BLENDING_ADD"};function Nu(e){return e.envMap===!1?"ENVMAP_BLENDING_NONE":Du[e.combine]||"ENVMAP_BLENDING_NONE"}function Uu(e,a,t,i){const c=e.getContext(),l=t.defines;let f=t.vertexShader,g=t.fragmentShader;const y=Lu(t),L=t.envMapPMREM===!0?"ENVMAP_TYPE_PMREM":"ENVMAP_TYPE_CUBE",V=wu(t),F=Nu(t),v=Eu(t),T=Mu(l),w=c.createProgram();let B,u,s=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(B=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,T].filter(ia).join(`
`),B.length>0&&(B+=`
`),u=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,T].filter(ia).join(`
`),u.length>0&&(u+=`
`)):(B=[ir(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,T,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+V:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.diffuseRoughnessMap?"#define USE_DIFFUSE_ROUGHNESSMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.diffuseRoughnessMapUv?"#define DIFFUSE_ROUGHNESSMAP_UV "+t.diffuseRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexNormals?"#define HAS_NORMAL":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+y:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(ia).join(`
`),u=[ir(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,T,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+L:"",t.envMap?"#define "+V:"",t.envMap?"#define "+F:"",t.envMapPMREM?"#define ENVMAP_MAX_LOD "+t.envMapMaxLod+".0":"",t.envMapPMREM?"#define ENVMAP_SIZE "+t.envMapSize+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.diffuseRoughness?"#define USE_DIFFUSE_ROUGHNESS":"",t.diffuseRoughnessMap?"#define USE_DIFFUSE_ROUGHNESSMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.retroreflection?"#define USE_RETROREFLECTION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor?"#define USE_COLOR":"",t.vertexAlphas||t.batchingColor?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+y:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==Nt?"#define TONE_MAPPING":"",t.toneMapping!==Nt?Le.tonemapping_pars_fragment:"",t.toneMapping!==Nt?vu("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",Le.colorspace_pars_fragment,gu("linearToOutputTexel",t.outputColorSpace),Su(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(ia).join(`
`)),f=Ha(f),f=er(f,t),f=tr(f,t),g=Ha(g),g=er(g,t),g=tr(g,t),f=ar(f),g=ar(g),t.isRawShaderMaterial!==!0&&(s=`#version 300 es
`,B=[v,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+B,u=["#define varying in",t.glslVersion===Hi?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===Hi?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+u);const _=s+B+f,D=s+u+g,S=$i(c,c.VERTEX_SHADER,_),C=$i(c,c.FRAGMENT_SHADER,D);c.attachShader(w,S),c.attachShader(w,C),t.index0AttributeName!==void 0?c.bindAttribLocation(w,0,t.index0AttributeName):t.hasPositionAttribute===!0&&c.bindAttribLocation(w,0,"position"),c.linkProgram(w);function x(N){if(e.debug.checkShaderErrors){const O=c.getProgramInfoLog(w)||"",W=c.getShaderInfoLog(S)||"",k=c.getShaderInfoLog(C)||"",R=O.trim(),Q=W.trim(),q=k.trim();let H=!0,ae=!0;if(c.getProgramParameter(w,c.LINK_STATUS)===!1)if(H=!1,typeof e.debug.onShaderError=="function")e.debug.onShaderError(c,w,S,C);else{const X=Ji(c,S,"vertex"),Z=Ji(c,C,"fragment");je("WebGLProgram: Shader Error "+c.getError()+" - VALIDATE_STATUS "+c.getProgramParameter(w,c.VALIDATE_STATUS)+`

Material Name: `+N.name+`
Material Type: `+N.type+`

Program Info Log: `+R+`
`+X+`
`+Z)}else R!==""?Ge("WebGLProgram: Program Info Log:",R):(Q===""||q==="")&&(ae=!1);ae&&(N.diagnostics={runnable:H,programLog:R,vertexShader:{log:Q,prefix:B},fragmentShader:{log:q,prefix:u}})}c.deleteShader(S),c.deleteShader(C),n=new ga(c,w),p=Tu(c,w)}let n;this.getUniforms=function(){return n===void 0&&x(this),n};let p;this.getAttributes=function(){return p===void 0&&x(this),p};let Y=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return Y===!1&&(Y=c.getProgramParameter(w,fu)),Y},this.destroy=function(){i.releaseStatesOfProgram(this),c.deleteProgram(w),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=pu++,this.cacheKey=a,this.usedTimes=1,this.program=w,this.vertexShader=S,this.fragmentShader=C,this}let Iu=0;class yu{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(a,t,i){const c=this._getShaderCacheForMaterial(a);return c.has(t)===!1&&(c.add(t),t.usedTimes++),c.has(i)===!1&&(c.add(i),i.usedTimes++),this}remove(a){const t=this.materialCache.get(a);for(const i of t)i.usedTimes--,i.usedTimes===0&&this.shaderCache.delete(i.code);return this.materialCache.delete(a),this}getVertexShaderStage(a){return this._getShaderStage(a.vertexShader)}getFragmentShaderStage(a){return this._getShaderStage(a.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(a){const t=this.materialCache;let i=t.get(a);return i===void 0&&(i=new Set,t.set(a,i)),i}_getShaderStage(a){const t=this.shaderCache;let i=t.get(a);return i===void 0&&(i=new Ou(a),t.set(a,i)),i}}class Ou{constructor(a){this.id=Iu++,this.code=a,this.usedTimes=0}}function Fu(e){return e===Zt||e===Ba||e===Ga}function Bu(e,a,t,i,c,l){const f=new co,g=new yu,y=new Set,L=[],V=new Map,F=i.logarithmicDepthBuffer,v={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function T(n){return y.add(n),n===0?"uv":`uv${n}`}function w(n,p,Y,N,O,W){const k=N.fog,R=O.geometry,Q=n.isMeshStandardMaterial||n.isMeshLambertMaterial||n.isMeshPhongMaterial?N.environment:null,q=n.isMeshStandardMaterial||n.isMeshLambertMaterial&&!n.envMap||n.isMeshPhongMaterial&&!n.envMap,H=a.get(n.envMap||Q,q),ae=v[n.type];let X=i.precision;n.precision!==null&&(X=i.getMaxPrecision(n.precision),X!==n.precision&&Ge("WebGLProgram.getParameters:",n.precision,"not supported, using",X,"instead."));const Z=R.morphAttributes.position||R.morphAttributes.normal||R.morphAttributes.color,ie=Z!==void 0?Z.length:0;let Pe=0;R.morphAttributes.position!==void 0&&(Pe=1),R.morphAttributes.normal!==void 0&&(Pe=2),R.morphAttributes.color!==void 0&&(Pe=3);let Ne,z,fe,Se;if(ae){const me=Ct[ae];Ne=me.vertexShader,z=me.fragmentShader}else{Ne=n.vertexShader,z=n.fragmentShader;const me=g.getVertexShaderStage(n),ke=g.getFragmentShaderStage(n);g.update(n,me,ke),fe=me.id,Se=ke.id}const be=e.getRenderTarget(),ge=e.state.buffers.depth.getReversed(),xe=O.isInstancedMesh===!0,$e=O.isBatchedMesh===!0,we=!!n.map,ye=!!n.matcap,at=!!H,lt=at&&H.isPMREMTexture===!0,_t=!!n.aoMap,it=!!n.lightMap,pt=!!n.bumpMap&&n.wireframe===!1,Qe=!!n.normalMap,At=!!n.displacementMap,st=!!n.emissiveMap,St=!!n.metalnessMap,Et=!!n.roughnessMap,Mt=n.anisotropy>0,E=n.clearcoat>0,Tt=n.diffuseRoughness>0,Ke=n.dispersion>0,Ye=n.retroreflectivity>0,re=n.iridescence>0,rt=n.sheen>0,Re=n.transmission>0,Ce=Mt&&!!n.anisotropyMap,d=E&&!!n.clearcoatMap,r=E&&!!n.clearcoatNormalMap,P=E&&!!n.clearcoatRoughnessMap,$=Tt&&!!n.diffuseRoughnessMap,G=re&&!!n.iridescenceMap,ce=re&&!!n.iridescenceThicknessMap,ne=rt&&!!n.sheenColorMap,M=rt&&!!n.sheenRoughnessMap,K=!!n.specularMap,pe=!!n.specularColorMap,m=!!n.specularIntensityMap,I=Re&&!!n.transmissionMap,j=Re&&!!n.thicknessMap,ee=!!n.gradientMap,oe=!!n.alphaMap,te=n.alphaTest>0,Me=!!n.alphaHash,se=!!n.extensions;let ve=Nt;n.toneMapped&&(be===null||be.isXRRenderTarget===!0)&&(ve=e.toneMapping);const Ae=lt?H.isCompressedCubeTexture?H.image[0].mipmaps:H.mipmaps:null,Ue={shaderID:ae,shaderType:n.type,shaderName:n.name,vertexShader:Ne,fragmentShader:z,defines:n.defines,customVertexShaderID:fe,customFragmentShaderID:Se,isRawShaderMaterial:n.isRawShaderMaterial===!0,glslVersion:n.glslVersion,precision:X,batching:$e,batchingColor:$e&&O._colorsTexture!==null,instancing:xe,instancingColor:xe&&O.instanceColor!==null,instancingMorph:xe&&O.morphTexture!==null,outputColorSpace:be===null?e.outputColorSpace:be.isXRRenderTarget===!0?be.texture.colorSpace:Je.workingColorSpace,alphaToCoverage:!!n.alphaToCoverage,map:we,matcap:ye,envMap:at,envMapMode:at&&H.mapping,envMapPMREM:lt,envMapMaxLod:lt?Ae.length-1:null,envMapSize:lt?Ae[0].width:null,aoMap:_t,lightMap:it,bumpMap:pt,normalMap:Qe,displacementMap:At,emissiveMap:st,normalMapObjectSpace:Qe&&n.normalMapType===Jn,normalMapTangentSpace:Qe&&n.normalMapType===li,packedNormalMap:Qe&&n.normalMapType===li&&Fu(n.normalMap.format),metalnessMap:St,roughnessMap:Et,anisotropy:Mt,anisotropyMap:Ce,clearcoat:E,clearcoatMap:d,clearcoatNormalMap:r,clearcoatRoughnessMap:P,diffuseRoughness:Tt,diffuseRoughnessMap:$,dispersion:Ke,retroreflection:Ye,iridescence:re,iridescenceMap:G,iridescenceThicknessMap:ce,sheen:rt,sheenColorMap:ne,sheenRoughnessMap:M,specularMap:K,specularColorMap:pe,specularIntensityMap:m,transmission:Re,transmissionMap:I,thicknessMap:j,gradientMap:ee,opaque:n.transparent===!1&&n.blending===ha&&n.alphaToCoverage===!1,alphaMap:oe,alphaTest:te,alphaHash:Me,combine:n.combine,mapUv:we&&T(n.map.channel),aoMapUv:_t&&T(n.aoMap.channel),lightMapUv:it&&T(n.lightMap.channel),bumpMapUv:pt&&T(n.bumpMap.channel),normalMapUv:Qe&&T(n.normalMap.channel),displacementMapUv:At&&T(n.displacementMap.channel),emissiveMapUv:st&&T(n.emissiveMap.channel),metalnessMapUv:St&&T(n.metalnessMap.channel),roughnessMapUv:Et&&T(n.roughnessMap.channel),anisotropyMapUv:Ce&&T(n.anisotropyMap.channel),clearcoatMapUv:d&&T(n.clearcoatMap.channel),clearcoatNormalMapUv:r&&T(n.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:P&&T(n.clearcoatRoughnessMap.channel),diffuseRoughnessMapUv:$&&T(n.diffuseRoughnessMap.channel),iridescenceMapUv:G&&T(n.iridescenceMap.channel),iridescenceThicknessMapUv:ce&&T(n.iridescenceThicknessMap.channel),sheenColorMapUv:ne&&T(n.sheenColorMap.channel),sheenRoughnessMapUv:M&&T(n.sheenRoughnessMap.channel),specularMapUv:K&&T(n.specularMap.channel),specularColorMapUv:pe&&T(n.specularColorMap.channel),specularIntensityMapUv:m&&T(n.specularIntensityMap.channel),transmissionMapUv:I&&T(n.transmissionMap.channel),thicknessMapUv:j&&T(n.thicknessMap.channel),alphaMapUv:oe&&T(n.alphaMap.channel),vertexTangents:!!R.attributes.tangent&&(Qe||Mt),vertexNormals:!!R.attributes.normal,vertexColors:n.vertexColors,vertexAlphas:n.vertexColors===!0&&!!R.attributes.color&&R.attributes.color.itemSize===4,pointsUvs:O.isPoints===!0&&!!R.attributes.uv&&(we||oe),fog:!!k,useFog:n.fog===!0,fogExp2:!!k&&k.isFogExp2,flatShading:n.wireframe===!1&&(n.flatShading===!0||R.attributes.normal===void 0&&Qe===!1&&(n.isMeshLambertMaterial||n.isMeshPhongMaterial||n.isMeshStandardMaterial||n.isMeshPhysicalMaterial)),sizeAttenuation:n.sizeAttenuation===!0,logarithmicDepthBuffer:F,reversedDepthBuffer:ge,skinning:O.isSkinnedMesh===!0,hasPositionAttribute:R.attributes.position!==void 0,morphTargets:R.morphAttributes.position!==void 0,morphNormals:R.morphAttributes.normal!==void 0,morphColors:R.morphAttributes.color!==void 0,morphTargetsCount:ie,morphTextureStride:Pe,numSunLights:p.sun.length,numDirLights:p.directional.length,numPointLights:p.point.length,numSpotLights:p.spot.length,numSpotLightMaps:p.spotLightMap.length,numRectAreaLights:p.rectArea.length,numHemiLights:p.hemi.length,numSunLightShadows:p.sunShadowMap.length,numDirLightShadows:p.directionalShadowMap.length,numPointLightShadows:p.pointShadowMap.length,numSpotLightShadows:p.spotShadowMap.length,numSpotLightShadowsWithMaps:p.numSpotLightShadowsWithMaps,numLightProbes:p.numLightProbes,numLightProbeGrids:W.filter(me=>me.texture!==null).length,numClippingPlanes:l.numPlanes,numClipIntersection:l.numIntersection,dithering:n.dithering,shadowMapEnabled:e.shadowMap.enabled&&Y.length>0,shadowMapType:e.shadowMap.type,toneMapping:ve,decodeVideoTexture:we&&n.map.isVideoTexture===!0&&Je.getTransfer(n.map.colorSpace)===We,decodeVideoTextureEmissive:st&&n.emissiveMap.isVideoTexture===!0&&Je.getTransfer(n.emissiveMap.colorSpace)===We,premultipliedAlpha:n.premultipliedAlpha,doubleSided:n.side===Dt,flipSided:n.side===vt,useDepthPacking:n.depthPacking>=0,depthPacking:n.depthPacking||0,index0AttributeName:n.index0AttributeName,extensionClipCullDistance:se&&n.extensions.clipCullDistance===!0&&t.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(se&&n.extensions.multiDraw===!0||$e)&&t.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:t.has("KHR_parallel_shader_compile"),customProgramCacheKey:n.customProgramCacheKey()};return Ue.vertexUv1s=y.has(1),Ue.vertexUv2s=y.has(2),Ue.vertexUv3s=y.has(3),y.clear(),Ue}function B(n){const p=[];if(n.shaderID?p.push(n.shaderID):(p.push(n.customVertexShaderID),p.push(n.customFragmentShaderID)),n.defines!==void 0)for(const Y in n.defines)p.push(Y),p.push(n.defines[Y]);return n.isRawShaderMaterial===!1&&(u(p,n),s(p,n),p.push(e.outputColorSpace)),p.push(n.customProgramCacheKey),p.join()}function u(n,p){n.push(p.precision),n.push(p.outputColorSpace),n.push(p.envMapMode),n.push(p.envMapPMREM),n.push(p.envMapMaxLod),n.push(p.envMapSize),n.push(p.mapUv),n.push(p.alphaMapUv),n.push(p.lightMapUv),n.push(p.aoMapUv),n.push(p.bumpMapUv),n.push(p.normalMapUv),n.push(p.displacementMapUv),n.push(p.emissiveMapUv),n.push(p.metalnessMapUv),n.push(p.roughnessMapUv),n.push(p.anisotropyMapUv),n.push(p.clearcoatMapUv),n.push(p.clearcoatNormalMapUv),n.push(p.clearcoatRoughnessMapUv),n.push(p.diffuseRoughnessMapUv),n.push(p.iridescenceMapUv),n.push(p.iridescenceThicknessMapUv),n.push(p.sheenColorMapUv),n.push(p.sheenRoughnessMapUv),n.push(p.specularMapUv),n.push(p.specularColorMapUv),n.push(p.specularIntensityMapUv),n.push(p.transmissionMapUv),n.push(p.thicknessMapUv),n.push(p.combine),n.push(p.fogExp2),n.push(p.sizeAttenuation),n.push(p.morphTargetsCount),n.push(p.numSunLights),n.push(p.numDirLights),n.push(p.numPointLights),n.push(p.numSpotLights),n.push(p.numSpotLightMaps),n.push(p.numHemiLights),n.push(p.numRectAreaLights),n.push(p.numSunLightShadows),n.push(p.numDirLightShadows),n.push(p.numPointLightShadows),n.push(p.numSpotLightShadows),n.push(p.numSpotLightShadowsWithMaps),n.push(p.numLightProbes),n.push(p.numLightProbeGrids),n.push(p.shadowMapType),n.push(p.toneMapping),n.push(p.numClippingPlanes),n.push(p.numClipIntersection),n.push(p.depthPacking)}function s(n,p){f.disableAll(),p.instancing&&f.enable(0),p.instancingColor&&f.enable(1),p.instancingMorph&&f.enable(2),p.matcap&&f.enable(3),p.envMap&&f.enable(4),p.normalMapObjectSpace&&f.enable(5),p.normalMapTangentSpace&&f.enable(6),p.clearcoat&&f.enable(7),p.iridescence&&f.enable(8),p.alphaTest&&f.enable(9),p.vertexColors&&f.enable(10),p.vertexAlphas&&f.enable(11),p.vertexUv1s&&f.enable(12),p.vertexUv2s&&f.enable(13),p.vertexUv3s&&f.enable(14),p.vertexTangents&&f.enable(15),p.anisotropy&&f.enable(16),p.alphaHash&&f.enable(17),p.batching&&f.enable(18),p.dispersion&&f.enable(19),p.retroreflection&&f.enable(24),p.diffuseRoughness&&f.enable(25),p.batchingColor&&f.enable(20),p.gradientMap&&f.enable(21),p.packedNormalMap&&f.enable(22),p.vertexNormals&&f.enable(23),n.push(f.mask),f.disableAll(),p.fog&&f.enable(0),p.useFog&&f.enable(1),p.flatShading&&f.enable(2),p.logarithmicDepthBuffer&&f.enable(3),p.reversedDepthBuffer&&f.enable(4),p.skinning&&f.enable(5),p.morphTargets&&f.enable(6),p.morphNormals&&f.enable(7),p.morphColors&&f.enable(8),p.premultipliedAlpha&&f.enable(9),p.shadowMapEnabled&&f.enable(10),p.doubleSided&&f.enable(11),p.flipSided&&f.enable(12),p.useDepthPacking&&f.enable(13),p.dithering&&f.enable(14),p.transmission&&f.enable(15),p.sheen&&f.enable(16),p.opaque&&f.enable(17),p.pointsUvs&&f.enable(18),p.decodeVideoTexture&&f.enable(19),p.decodeVideoTextureEmissive&&f.enable(20),p.alphaToCoverage&&f.enable(21),p.numLightProbeGrids>0&&f.enable(22),p.hasPositionAttribute&&f.enable(23),n.push(f.mask)}function _(n){const p=v[n.type];let Y;if(p){const N=Ct[p];Y=Qn.clone(N.uniforms)}else Y=n.uniforms;return Y}function D(n,p){let Y=V.get(p);return Y!==void 0?++Y.usedTimes:(Y=new Uu(e,p,n,c),L.push(Y),V.set(p,Y)),Y}function S(n){if(--n.usedTimes===0){const p=L.indexOf(n);L[p]=L[L.length-1],L.pop(),V.delete(n.cacheKey),n.destroy()}}function C(n){g.remove(n)}function x(){g.dispose()}return{getParameters:w,getProgramCacheKey:B,getUniforms:_,acquireProgram:D,releaseProgram:S,releaseShaderCache:C,programs:L,dispose:x}}function Gu(){let e=new WeakMap;function a(f){return e.has(f)}function t(f){let g=e.get(f);return g===void 0&&(g={},e.set(f,g)),g}function i(f){e.delete(f)}function c(f,g,y){e.get(f)[g]=y}function l(){e=new WeakMap}return{has:a,get:t,remove:i,update:c,dispose:l}}function Hu(e,a){return e.groupOrder!==a.groupOrder?e.groupOrder-a.groupOrder:e.renderOrder!==a.renderOrder?e.renderOrder-a.renderOrder:e.material.id!==a.material.id?e.material.id-a.material.id:e.materialVariant!==a.materialVariant?e.materialVariant-a.materialVariant:e.z!==a.z?e.z-a.z:e.id-a.id}function rr(e,a){return e.groupOrder!==a.groupOrder?e.groupOrder-a.groupOrder:e.renderOrder!==a.renderOrder?e.renderOrder-a.renderOrder:e.z!==a.z?a.z-e.z:e.id-a.id}function nr(){const e=[];let a=0;const t=[],i=[],c=[];function l(){a=0,t.length=0,i.length=0,c.length=0}function f(v){let T=0;return v.isInstancedMesh&&(T+=2),v.isSkinnedMesh&&(T+=1),T}function g(v,T,w,B,u,s){let _=e[a];return _===void 0?(_={id:v.id,object:v,geometry:T,material:w,materialVariant:f(v),groupOrder:B,renderOrder:v.renderOrder,z:u,group:s},e[a]=_):(_.id=v.id,_.object=v,_.geometry=T,_.material=w,_.materialVariant=f(v),_.groupOrder=B,_.renderOrder=v.renderOrder,_.z=u,_.group=s),a++,_}function y(v,T,w,B,u,s,_){_.reversedDepth===!0&&(u=-u);const D=g(v,T,w,B,u,s);w.transmission>0?i.push(D):w.transparent===!0?c.push(D):t.push(D)}function L(v,T,w,B,u,s){const _=g(v,T,w,B,u,s);w.transmission>0?i.unshift(_):w.transparent===!0?c.unshift(_):t.unshift(_)}function V(v,T){t.length>1&&t.sort(v||Hu),i.length>1&&i.sort(T||rr),c.length>1&&c.sort(T||rr)}function F(){for(let v=a,T=e.length;v<T;v++){const w=e[v];if(w.id===null)break;w.id=null,w.object=null,w.geometry=null,w.material=null,w.group=null}}return{opaque:t,transmissive:i,transparent:c,init:l,push:y,unshift:L,finish:F,sort:V}}function Vu(){let e=new WeakMap;function a(i,c){const l=e.get(i);let f;return l===void 0?(f=new nr,e.set(i,[f])):c>=l.length?(f=new nr,l.push(f)):f=l[c],f}function t(){e=new WeakMap}return{get:a,dispose:t}}function zu(){const e={};return{get:function(a){if(e[a.id]!==void 0)return e[a.id];let t;switch(a.type){case"SunLight":case"DirectionalLight":t={direction:new He,color:new Ze};break;case"SpotLight":t={position:new He,direction:new He,color:new Ze,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new He,color:new Ze,distance:0,decay:0};break;case"HemisphereLight":t={direction:new He,skyColor:new Ze,groundColor:new Ze};break;case"RectAreaLight":t={color:new Ze,position:new He,halfWidth:new He,halfHeight:new He};break}return e[a.id]=t,t}}}function Wu(){const e={};return{get:function(a){if(e[a.id]!==void 0)return e[a.id];let t;switch(a.type){case"SunLight":case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new gt};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new gt};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new gt,shadowCameraNear:1,shadowCameraFar:1e3};break}return e[a.id]=t,t}}}let ku=0;function Xu(e,a){return(a.castShadow?2:0)-(e.castShadow?2:0)+(a.map?1:0)-(e.map?1:0)}function Ku(e){const a=new zu,t=Wu(),i={version:0,hash:{sunLength:-1,directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numSunShadows:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],sun:[],sunShadow:[],sunShadowMap:[],sunShadowMatrix:[],sunShadowCascade:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let L=0;L<9;L++)i.probe.push(new He);const c=new He,l=new qt,f=new qt;function g(L){let V=0,F=0,v=0;for(let W=0;W<9;W++)i.probe[W].set(0,0,0);let T=0,w=0,B=0,u=0,s=0,_=0,D=0,S=0,C=0,x=0,n=0,p=0,Y=0,N=0;L.sort(Xu);for(let W=0,k=L.length;W<k;W++){const R=L[W],Q=R.color,q=R.intensity,H=R.distance;let ae=null;if(R.shadow&&R.shadow.map&&(R.shadow.map.texture.format===Zt?ae=R.shadow.map.texture:ae=R.shadow.map.depthTexture||R.shadow.map.texture),R.isAmbientLight)V+=Q.r*q,F+=Q.g*q,v+=Q.b*q;else if(R.isLightProbe){for(let X=0;X<9;X++)i.probe[X].addScaledVector(R.sh.coefficients[X],q);N++}else if(R.isSunLight){const X=a.get(R);if(X.color.copy(R.color).multiplyScalar(R.intensity),R.castShadow){const Z=R.shadow,ie=t.get(R);ie.shadowIntensity=Z.intensity,ie.shadowBias=Z.bias,ie.shadowNormalBias=Z.normalBias,ie.shadowRadius=Z.radius,ie.shadowMapSize.copy(Z.mapSize).multiply(Z.getFrameExtents()),i.sunShadow[w]=ie,i.sunShadowMap[w]=ae;const Pe=Z.getViewportCount();for(let Ne=0;Ne<Pe;Ne++)i.sunShadowMatrix[B+Ne]=Z.getMatrix(Ne),i.sunShadowCascade[B+Ne]=Z._cascadeData[Ne];B+=Pe,w++}i.sun[T]=X,T++}else if(R.isDirectionalLight){const X=a.get(R);if(X.color.copy(R.color).multiplyScalar(R.intensity),R.castShadow){const Z=R.shadow,ie=t.get(R);ie.shadowIntensity=Z.intensity,ie.shadowBias=Z.bias,ie.shadowNormalBias=Z.normalBias,ie.shadowRadius=Z.radius,ie.shadowMapSize=Z.mapSize,i.directionalShadow[u]=ie,i.directionalShadowMap[u]=ae,i.directionalShadowMatrix[u]=R.shadow.matrix,C++}i.directional[u]=X,u++}else if(R.isSpotLight){const X=a.get(R);X.position.setFromMatrixPosition(R.matrixWorld),X.color.copy(Q).multiplyScalar(q),X.distance=H,X.coneCos=Math.cos(R.angle),X.penumbraCos=Math.cos(R.angle*(1-R.penumbra)),X.decay=R.decay,i.spot[_]=X;const Z=R.shadow;if(R.map&&(i.spotLightMap[p]=R.map,p++,Z.updateMatrices(R),R.castShadow&&Y++),i.spotLightMatrix[_]=Z.matrix,R.castShadow){const ie=t.get(R);ie.shadowIntensity=Z.intensity,ie.shadowBias=Z.bias,ie.shadowNormalBias=Z.normalBias,ie.shadowRadius=Z.radius,ie.shadowMapSize=Z.mapSize,i.spotShadow[_]=ie,i.spotShadowMap[_]=ae,n++}_++}else if(R.isRectAreaLight){const X=a.get(R);X.color.copy(Q).multiplyScalar(q),X.halfWidth.set(R.width*.5,0,0),X.halfHeight.set(0,R.height*.5,0),i.rectArea[D]=X,D++}else if(R.isPointLight){const X=a.get(R);if(X.color.copy(R.color).multiplyScalar(R.intensity),X.distance=R.distance,X.decay=R.decay,R.castShadow){const Z=R.shadow,ie=t.get(R);ie.shadowIntensity=Z.intensity,ie.shadowBias=Z.bias,ie.shadowNormalBias=Z.normalBias,ie.shadowRadius=Z.radius,ie.shadowMapSize=Z.mapSize,ie.shadowCameraNear=Z.camera.near,ie.shadowCameraFar=Z.camera.far,i.pointShadow[s]=ie,i.pointShadowMap[s]=ae,i.pointShadowMatrix[s]=R.shadow.matrix,x++}i.point[s]=X,s++}else if(R.isHemisphereLight){const X=a.get(R);X.skyColor.copy(R.color).multiplyScalar(q),X.groundColor.copy(R.groundColor).multiplyScalar(q),i.hemi[S]=X,S++}}D>0&&(e.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=de.LTC_FLOAT_1,i.rectAreaLTC2=de.LTC_FLOAT_2):(i.rectAreaLTC1=de.LTC_HALF_1,i.rectAreaLTC2=de.LTC_HALF_2)),i.ambient[0]=V,i.ambient[1]=F,i.ambient[2]=v;const O=i.hash;(O.sunLength!==T||O.directionalLength!==u||O.pointLength!==s||O.spotLength!==_||O.rectAreaLength!==D||O.hemiLength!==S||O.numSunShadows!==w||O.numDirectionalShadows!==C||O.numPointShadows!==x||O.numSpotShadows!==n||O.numSpotMaps!==p||O.numLightProbes!==N)&&(i.sun.length=T,i.directional.length=u,i.spot.length=_,i.rectArea.length=D,i.point.length=s,i.hemi.length=S,i.sunShadow.length=w,i.sunShadowMap.length=w,i.sunShadowMatrix.length=B,i.sunShadowCascade.length=B,i.directionalShadow.length=C,i.directionalShadowMap.length=C,i.directionalShadowMatrix.length=C,i.pointShadow.length=x,i.pointShadowMap.length=x,i.pointShadowMatrix.length=x,i.spotShadow.length=n,i.spotShadowMap.length=n,i.spotLightMatrix.length=n+p-Y,i.spotLightMap.length=p,i.numSpotLightShadowsWithMaps=Y,i.numLightProbes=N,O.sunLength=T,O.directionalLength=u,O.pointLength=s,O.spotLength=_,O.rectAreaLength=D,O.hemiLength=S,O.numSunShadows=w,O.numDirectionalShadows=C,O.numPointShadows=x,O.numSpotShadows=n,O.numSpotMaps=p,O.numLightProbes=N,i.version=ku++)}function y(L,V){let F=0,v=0,T=0,w=0,B=0,u=0;const s=V.matrixWorldInverse;for(let _=0,D=L.length;_<D;_++){const S=L[_];if(S.isSunLight){const C=i.sun[F];C.direction.setFromMatrixPosition(S.matrixWorld),C.direction.transformDirection(s),F++}else if(S.isDirectionalLight){const C=i.directional[v];C.direction.setFromMatrixPosition(S.matrixWorld),c.setFromMatrixPosition(S.target.matrixWorld),C.direction.sub(c),C.direction.transformDirection(s),v++}else if(S.isSpotLight){const C=i.spot[w];C.position.setFromMatrixPosition(S.matrixWorld),C.position.applyMatrix4(s),C.direction.setFromMatrixPosition(S.matrixWorld),c.setFromMatrixPosition(S.target.matrixWorld),C.direction.sub(c),C.direction.transformDirection(s),w++}else if(S.isRectAreaLight){const C=i.rectArea[B];C.position.setFromMatrixPosition(S.matrixWorld),C.position.applyMatrix4(s),f.identity(),l.copy(S.matrixWorld),l.premultiply(s),f.extractRotation(l),C.halfWidth.set(S.width*.5,0,0),C.halfHeight.set(0,S.height*.5,0),C.halfWidth.applyMatrix4(f),C.halfHeight.applyMatrix4(f),B++}else if(S.isPointLight){const C=i.point[T];C.position.setFromMatrixPosition(S.matrixWorld),C.position.applyMatrix4(s),T++}else if(S.isHemisphereLight){const C=i.hemi[u];C.direction.setFromMatrixPosition(S.matrixWorld),C.direction.transformDirection(s),u++}}}return{setup:g,setupView:y,state:i}}function or(e){const a=new Ku(e),t=[],i=[],c=[];function l(F){V.camera=F,t.length=0,i.length=0,c.length=0}function f(F){F.isLightProbeGrid?c.push(F):t.push(F)}function g(F){i.push(F)}function y(){a.setup(t),c.sort((F,v)=>F.priority-v.priority||F.id-v.id)}function L(F){a.setupView(t,F)}const V={lightsArray:t,shadowsArray:i,lightProbeGridArray:c,camera:null,lights:a,transmissionRenderTarget:{},textureUnits:0};return{init:l,state:V,setupLights:y,setupLightsView:L,pushLight:f,pushShadow:g}}function Yu(e){let a=new WeakMap;function t(c,l=0){const f=a.get(c);let g;return f===void 0?(g=new or(e),a.set(c,[g])):l>=f.length?(g=new or(e),f.push(g)):g=f[l],g}function i(){a=new WeakMap}return{get:t,dispose:i}}const qu=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,ju=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,Zu=[new He(1,0,0),new He(-1,0,0),new He(0,1,0),new He(0,-1,0),new He(0,0,1),new He(0,0,-1)],$u=[new He(0,-1,0),new He(0,-1,0),new He(0,0,1),new He(0,0,-1),new He(0,-1,0),new He(0,-1,0)],sr=new qt,ta=new He,Ia=new He;function Qu(e,a,t){let i=new dr;const c=new gt,l=new gt,f=new ht,g=new Dn,y=new Nn,L={},V=t.maxTextureSize,F={[na]:vt,[vt]:na,[Dt]:Dt},v=new jt({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new gt},radius:{value:4}},vertexShader:qu,fragmentShader:ju}),T=v.clone();T.defines.HORIZONTAL_PASS=1;const w=new hr;w.setAttribute("position",new Un(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const B=new kt(w,v),u=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=ma;let s=this.type;this.render=function(x,n,p){if(u.enabled===!1||u.autoUpdate===!1&&u.needsUpdate===!1||x.length===0)return;this.type===In&&(Ge("WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead."),this.type=ma);const Y=e.getRenderTarget(),N=e.getActiveCubeFace(),O=e.getActiveMipmapLevel(),W=e.state;W.setBlending(Yt),W.buffers.depth.getReversed()===!0?W.buffers.color.setClear(0,0,0,0):W.buffers.color.setClear(1,1,1,1),W.buffers.depth.setTest(!0),W.setScissorTest(!1);const k=s!==this.type;k&&n.traverse(function(R){R.material&&(Array.isArray(R.material)?R.material.forEach(Q=>Q.needsUpdate=!0):R.material.needsUpdate=!0)});for(let R=0,Q=x.length;R<Q;R++){const q=x[R],H=q.shadow;if(H===void 0){Ge("WebGLShadowMap:",q,"has no shadow.");continue}if(H.autoUpdate===!1&&H.needsUpdate===!1)continue;c.copy(H.mapSize);const ae=H.getFrameExtents();c.multiply(ae),l.copy(H.mapSize),(c.x>V||c.y>V)&&(c.x>V&&(l.x=Math.floor(V/ae.x),c.x=l.x*ae.x,H.mapSize.x=l.x),c.y>V&&(l.y=Math.floor(V/ae.y),c.y=l.y*ae.y,H.mapSize.y=l.y));const X=e.state.buffers.depth.getReversed();if(H.camera._reversedDepth=X,H.map===null||k===!0){if(H.map!==null&&(H.map.depthTexture!==null&&(H.map.depthTexture.dispose(),H.map.depthTexture=null),H.map.dispose()),this.type===aa){if(q.isPointLight){Ge("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}H.map=new Pt(c.x,c.y,{format:Zt,type:Ut,minFilter:Rt,magFilter:Rt,generateMipmaps:!1}),H.map.texture.name=q.name+".shadowMap",H.map.depthTexture=new ra(c.x,c.y,yt),H.map.depthTexture.name=q.name+".shadowMapDepth",H.map.depthTexture.format=oa,H.map.depthTexture.compareFunction=null,H.map.depthTexture.minFilter=zt,H.map.depthTexture.magFilter=zt}else q.isPointLight?(H.map=new za(c.x),H.map.depthTexture=new lr(c.x,Xt)):(H.map=new Pt(c.x,c.y),H.map.depthTexture=new ra(c.x,c.y,Xt)),H.map.depthTexture.name=q.name+".shadowMap",H.map.depthTexture.format=oa,this.type===ma?(H.map.depthTexture.compareFunction=X?fr:pr,H.map.depthTexture.minFilter=Rt,H.map.depthTexture.magFilter=Rt):(H.map.depthTexture.compareFunction=null,H.map.depthTexture.minFilter=zt,H.map.depthTexture.magFilter=zt);H.camera.updateProjectionMatrix()}H.map.isWebGLCubeRenderTarget!==!0&&(H.map.width!==c.x||H.map.height!==c.y)&&H.map.setSize(c.x,c.y);const Z=H.map.isWebGLCubeRenderTarget?6:H.getViewportCount();q.isPointLight!==!0&&H.updateMatrices(q,p);const ie=(H.camera.layers.mask&4294967294)!==0?H.camera.layers:p.layers;for(let Pe=0;Pe<Z;Pe++){const Ne=H.getCamera(Pe);if(q.isPointLight){const z=H.camera,fe=H.matrix,Se=q.distance||z.far;Se!==z.far&&(z.far=Se,z.updateProjectionMatrix()),ta.setFromMatrixPosition(q.matrixWorld),z.position.copy(ta),Ia.copy(z.position),Ia.add(Zu[Pe]),z.up.copy($u[Pe]),z.lookAt(Ia),z.updateMatrixWorld(),fe.makeTranslation(-ta.x,-ta.y,-ta.z),sr.multiplyMatrices(z.projectionMatrix,z.matrixWorldInverse),H._frustum.setFromProjectionMatrix(sr,z.coordinateSystem,z.reversedDepth)}if(H.map.isWebGLCubeRenderTarget)e.setRenderTarget(H.map,Pe),e.clear();else{Pe===0&&(e.setRenderTarget(H.map),e.clear());const z=H.getViewport(Pe);f.set(l.x*z.x,l.y*z.y,l.x*z.z,l.y*z.w),W.viewport(f)}i=H.getFrustum(Pe),S(n,p,Ne,q,ie,this.type)}H.isPointLightShadow!==!0&&this.type===aa&&_(H,p),H.needsUpdate=!1}s=this.type,u.needsUpdate=!1,e.setRenderTarget(Y,N,O)};function _(x,n){const p=a.update(B);v.defines.VSM_SAMPLES!==x.blurSamples&&(v.defines.VSM_SAMPLES=x.blurSamples,T.defines.VSM_SAMPLES=x.blurSamples,v.needsUpdate=!0,T.needsUpdate=!0),x.mapPass===null?x.mapPass=new Pt(c.x,c.y,{format:Zt,type:Ut}):(x.mapPass.width!==x.map.width||x.mapPass.height!==x.map.height)&&x.mapPass.setSize(x.map.width,x.map.height),v.uniforms.shadow_pass.value=x.map.depthTexture,v.uniforms.resolution.value.set(x.map.width,x.map.height),v.uniforms.radius.value=x.radius,e.setRenderTarget(x.mapPass),e.clear(),e.renderBufferDirect(n,null,p,v,B,null),T.uniforms.shadow_pass.value=x.mapPass.texture,T.uniforms.resolution.value.set(x.map.width,x.map.height),T.uniforms.radius.value=x.radius,e.setRenderTarget(x.map),e.clear(),e.renderBufferDirect(n,null,p,T,B,null)}function D(x,n,p,Y){let N=null;const O=p.isPointLight===!0?x.customDistanceMaterial:x.customDepthMaterial;if(O!==void 0)N=O;else if(N=p.isPointLight===!0?y:g,e.localClippingEnabled&&n.clipShadows===!0&&Array.isArray(n.clippingPlanes)&&n.clippingPlanes.length!==0||n.displacementMap&&n.displacementScale!==0||n.alphaMap&&n.alphaTest>0||n.map&&n.alphaTest>0||n.alphaToCoverage===!0){const W=N.uuid,k=n.uuid;let R=L[W];R===void 0&&(R={},L[W]=R);let Q=R[k];Q===void 0&&(Q=N.clone(),R[k]=Q,n.addEventListener("dispose",C)),N=Q}if(N.visible=n.visible,N.wireframe=n.wireframe,Y===aa?N.side=n.shadowSide!==null?n.shadowSide:n.side:N.side=n.shadowSide!==null?n.shadowSide:F[n.side],N.alphaMap=n.alphaMap,N.alphaTest=n.alphaToCoverage===!0?.5:n.alphaTest,N.map=n.map,N.clipShadows=n.clipShadows,N.clippingPlanes=n.clippingPlanes,N.clipIntersection=n.clipIntersection,N.displacementMap=n.displacementMap,N.displacementScale=n.displacementScale,N.displacementBias=n.displacementBias,N.wireframeLinewidth=n.wireframeLinewidth,N.linewidth=n.linewidth,p.isPointLight===!0&&N.isMeshDistanceMaterial===!0){const W=e.properties.get(N);W.light=p}return N}function S(x,n,p,Y,N,O){if(x.visible===!1)return;if(x.layers.test(N)&&(x.isMesh||x.isLine||x.isPoints)&&(x.castShadow||x.receiveShadow&&O===aa)&&(!x.frustumCulled||x.intersectsFrustum(i))){x.modelViewMatrix.multiplyMatrices(p.matrixWorldInverse,x.matrixWorld);const k=a.update(x),R=x.material;if(Array.isArray(R)){const Q=k.groups;for(let q=0,H=Q.length;q<H;q++){const ae=Q[q],X=R[ae.materialIndex];if(X&&X.visible){const Z=D(x,X,Y,O);x.onBeforeShadow(e,x,n,p,k,Z,ae),e.renderBufferDirect(p,null,k,Z,x,ae),x.onAfterShadow(e,x,n,p,k,Z,ae)}}}else if(R.visible){const Q=D(x,R,Y,O);x.onBeforeShadow(e,x,n,p,k,Q,null),e.renderBufferDirect(p,null,k,Q,x,null),x.onAfterShadow(e,x,n,p,k,Q,null)}}const W=x.children;for(let k=0,R=W.length;k<R;k++)S(W[k],n,p,Y,N,O)}function C(x){x.target.removeEventListener("dispose",C);for(const n in L){const p=L[n],Y=x.target.uuid;Y in p&&(p[Y].dispose(),delete p[Y])}}}function Ju(e,a){function t(){let m=!1;const I=new ht;let j=null;const ee=new ht(0,0,0,0);return{setMask:function(oe){j!==oe&&!m&&(e.colorMask(oe,oe,oe,oe),j=oe)},setLocked:function(oe){m=oe},setClear:function(oe,te,Me,se,ve){ve===!0&&(oe*=se,te*=se,Me*=se),I.set(oe,te,Me,se),ee.equals(I)===!1&&(e.clearColor(oe,te,Me,se),ee.copy(I))},reset:function(){m=!1,j=null,ee.set(-1,0,0,0)}}}function i(){let m=!1,I=!1,j=null,ee=null,oe=null;return{setReversed:function(te){if(I!==te){const Me=a.get("EXT_clip_control");te?Me.clipControlEXT(Me.LOWER_LEFT_EXT,Me.ZERO_TO_ONE_EXT):Me.clipControlEXT(Me.LOWER_LEFT_EXT,Me.NEGATIVE_ONE_TO_ONE_EXT),I=te;const se=oe;oe=null,this.setClear(se)}},getReversed:function(){return I},setTest:function(te){te?ge(e.DEPTH_TEST):xe(e.DEPTH_TEST)},setMask:function(te){j!==te&&!m&&(e.depthMask(te),j=te)},setFunc:function(te){if(I&&(te=ho[te]),ee!==te){switch(te){case qn:e.depthFunc(e.NEVER);break;case Yn:e.depthFunc(e.ALWAYS);break;case Kn:e.depthFunc(e.LESS);break;case ai:e.depthFunc(e.LEQUAL);break;case Xn:e.depthFunc(e.EQUAL);break;case kn:e.depthFunc(e.GEQUAL);break;case Wn:e.depthFunc(e.GREATER);break;case zn:e.depthFunc(e.NOTEQUAL);break;default:e.depthFunc(e.LEQUAL)}ee=te}},setLocked:function(te){m=te},setClear:function(te){oe!==te&&(oe=te,I&&(te=1-te),e.clearDepth(te))},reset:function(){m=!1,j=null,ee=null,oe=null,I=!1}}}function c(){let m=!1,I=null,j=null,ee=null,oe=null,te=null,Me=null,se=null,ve=null;return{setTest:function(Ae){m||(Ae?ge(e.STENCIL_TEST):xe(e.STENCIL_TEST))},setMask:function(Ae){I!==Ae&&!m&&(e.stencilMask(Ae),I=Ae)},setFunc:function(Ae,Ue,me){(j!==Ae||ee!==Ue||oe!==me)&&(e.stencilFunc(Ae,Ue,me),j=Ae,ee=Ue,oe=me)},setOp:function(Ae,Ue,me){(te!==Ae||Me!==Ue||se!==me)&&(e.stencilOp(Ae,Ue,me),te=Ae,Me=Ue,se=me)},setLocked:function(Ae){m=Ae},setClear:function(Ae){ve!==Ae&&(e.clearStencil(Ae),ve=Ae)},reset:function(){m=!1,I=null,j=null,ee=null,oe=null,te=null,Me=null,se=null,ve=null}}}const l=new t,f=new i,g=new c;let y={};const L=new WeakMap;let V={},F={},v={},T=new WeakMap,w=[],B=null,u=!1,s=null,_=null,D=null,S=null,C=null,x=null,n=null,p=new Ze(0,0,0),Y=0,N=!1,O=null,W=null,k=null,R=null,Q=null;const q=e.getParameter(e.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let H=!1,ae=0;const X=e.getParameter(e.VERSION);X.indexOf("WebGL")!==-1?(ae=parseFloat(/^WebGL (\d)/.exec(X)[1]),H=ae>=1):X.indexOf("OpenGL ES")!==-1&&(ae=parseFloat(/^OpenGL ES (\d)/.exec(X)[1]),H=ae>=2);let Z=null,ie={};const Pe=e.getParameter(e.SCISSOR_BOX),Ne=e.getParameter(e.VIEWPORT),z=new ht().fromArray(Pe),fe=new ht().fromArray(Ne);function Se(m,I,j,ee){const oe=new Uint8Array(4),te=e.createTexture();e.bindTexture(m,te),e.texParameteri(m,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(m,e.TEXTURE_MAG_FILTER,e.NEAREST);for(let Me=0;Me<j;Me++)m===e.TEXTURE_3D||m===e.TEXTURE_2D_ARRAY?e.texImage3D(I,0,e.RGBA,1,1,ee,0,e.RGBA,e.UNSIGNED_BYTE,oe):e.texImage2D(I+Me,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,oe);return te}const be={};be[e.TEXTURE_2D]=Se(e.TEXTURE_2D,e.TEXTURE_2D,1),be[e.TEXTURE_CUBE_MAP]=Se(e.TEXTURE_CUBE_MAP,e.TEXTURE_CUBE_MAP_POSITIVE_X,6),be[e.TEXTURE_2D_ARRAY]=Se(e.TEXTURE_2D_ARRAY,e.TEXTURE_2D_ARRAY,1,1),be[e.TEXTURE_3D]=Se(e.TEXTURE_3D,e.TEXTURE_3D,1,1),l.setClear(0,0,0,1),f.setClear(1),g.setClear(0),ge(e.DEPTH_TEST),f.setFunc(ai),pt(!1),Qe(ri),ge(e.CULL_FACE),_t(Yt);function ge(m){V[m]!==!0&&(e.enable(m),V[m]=!0)}function xe(m){V[m]!==!1&&(e.disable(m),V[m]=!1)}function $e(m,I){return v[m]!==I?(e.bindFramebuffer(m,I),v[m]=I,m===e.DRAW_FRAMEBUFFER&&(v[e.FRAMEBUFFER]=I),m===e.FRAMEBUFFER&&(v[e.DRAW_FRAMEBUFFER]=I),!0):!1}function we(m,I){let j=w,ee=!1;if(m){j=T.get(I),j===void 0&&(j=[],T.set(I,j));const oe=m.textures;if(j.length!==oe.length||j[0]!==e.COLOR_ATTACHMENT0){for(let te=0,Me=oe.length;te<Me;te++)j[te]=e.COLOR_ATTACHMENT0+te;j.length=oe.length,ee=!0}}else j[0]!==e.BACK&&(j[0]=e.BACK,ee=!0);ee&&e.drawBuffers(j)}function ye(m){return B!==m?(e.useProgram(m),B=m,!0):!1}const at={[ea]:e.FUNC_ADD,[on]:e.FUNC_SUBTRACT,[nn]:e.FUNC_REVERSE_SUBTRACT};at[go]=e.MIN,at[_o]=e.MAX;const lt={[Mn]:e.ZERO,[En]:e.ONE,[Sn]:e.SRC_COLOR,[vn]:e.SRC_ALPHA,[_n]:e.SRC_ALPHA_SATURATE,[gn]:e.DST_COLOR,[hn]:e.DST_ALPHA,[mn]:e.ONE_MINUS_SRC_COLOR,[pn]:e.ONE_MINUS_SRC_ALPHA,[fn]:e.ONE_MINUS_DST_COLOR,[dn]:e.ONE_MINUS_DST_ALPHA,[un]:e.CONSTANT_COLOR,[cn]:e.ONE_MINUS_CONSTANT_COLOR,[ln]:e.CONSTANT_ALPHA,[sn]:e.ONE_MINUS_CONSTANT_ALPHA};function _t(m,I,j,ee,oe,te,Me,se,ve,Ae){if(m===Yt){u===!0&&(xe(e.BLEND),u=!1);return}if(u===!1&&(ge(e.BLEND),u=!0),m!==$n){if(m!==s||Ae!==N){if((_!==ea||C!==ea)&&(e.blendEquation(e.FUNC_ADD),_=ea,C=ea),Ae)switch(m){case ha:e.blendFuncSeparate(e.ONE,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case si:e.blendFunc(e.ONE,e.ONE);break;case oi:e.blendFuncSeparate(e.ZERO,e.ONE_MINUS_SRC_COLOR,e.ZERO,e.ONE);break;case ni:e.blendFuncSeparate(e.DST_COLOR,e.ONE_MINUS_SRC_ALPHA,e.ZERO,e.ONE);break;default:je("WebGLState: Invalid blending: ",m);break}else switch(m){case ha:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case si:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE,e.ONE,e.ONE);break;case oi:je("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case ni:je("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:je("WebGLState: Invalid blending: ",m);break}D=null,S=null,x=null,n=null,p.set(0,0,0),Y=0,s=m,N=Ae}return}oe=oe||I,te=te||j,Me=Me||ee,(I!==_||oe!==C)&&(e.blendEquationSeparate(at[I],at[oe]),_=I,C=oe),(j!==D||ee!==S||te!==x||Me!==n)&&(e.blendFuncSeparate(lt[j],lt[ee],lt[te],lt[Me]),D=j,S=ee,x=te,n=Me),(se.equals(p)===!1||ve!==Y)&&(e.blendColor(se.r,se.g,se.b,ve),p.copy(se),Y=ve),s=m,N=!1}function it(m,I){m.side===Dt?xe(e.CULL_FACE):ge(e.CULL_FACE);let j=m.side===vt;I&&(j=!j),pt(j),m.blending===ha&&m.transparent===!1?_t(Yt):_t(m.blending,m.blendEquation,m.blendSrc,m.blendDst,m.blendEquationAlpha,m.blendSrcAlpha,m.blendDstAlpha,m.blendColor,m.blendAlpha,m.premultipliedAlpha),f.setFunc(m.depthFunc),f.setTest(m.depthTest),f.setMask(m.depthWrite),l.setMask(m.colorWrite);const ee=m.stencilWrite;g.setTest(ee),ee&&(g.setMask(m.stencilWriteMask),g.setFunc(m.stencilFunc,m.stencilRef,m.stencilFuncMask),g.setOp(m.stencilFail,m.stencilZFail,m.stencilZPass)),st(m.polygonOffset,m.polygonOffsetFactor,m.polygonOffsetUnits),m.alphaToCoverage===!0?ge(e.SAMPLE_ALPHA_TO_COVERAGE):xe(e.SAMPLE_ALPHA_TO_COVERAGE)}function pt(m){O!==m&&(m?e.frontFace(e.CW):e.frontFace(e.CCW),O=m)}function Qe(m){m!==jn?(ge(e.CULL_FACE),m!==W&&(m===ri?e.cullFace(e.BACK):m===Zn?e.cullFace(e.FRONT):e.cullFace(e.FRONT_AND_BACK))):xe(e.CULL_FACE),W=m}function At(m){m!==k&&(H&&e.lineWidth(m),k=m)}function st(m,I,j){m?(ge(e.POLYGON_OFFSET_FILL),(R!==I||Q!==j)&&(R=I,Q=j,f.getReversed()&&(I=-I,j=-j),e.polygonOffset(I,j))):xe(e.POLYGON_OFFSET_FILL)}function St(m){m?ge(e.SCISSOR_TEST):xe(e.SCISSOR_TEST)}function Et(m){m===void 0&&(m=e.TEXTURE0+q-1),Z!==m&&(e.activeTexture(m),Z=m)}function Mt(m,I,j){j===void 0&&(Z===null?j=e.TEXTURE0+q-1:j=Z);let ee=ie[j];ee===void 0&&(ee={type:void 0,texture:void 0},ie[j]=ee),(ee.type!==m||ee.texture!==I)&&(Z!==j&&(e.activeTexture(j),Z=j),e.bindTexture(m,I||be[m]),ee.type=m,ee.texture=I)}function E(){const m=ie[Z];m!==void 0&&m.type!==void 0&&(e.bindTexture(m.type,null),m.type=void 0,m.texture=void 0)}function Tt(){try{e.compressedTexImage2D(...arguments)}catch(m){je("WebGLState:",m)}}function Ke(){try{e.compressedTexImage3D(...arguments)}catch(m){je("WebGLState:",m)}}function Ye(){try{e.texSubImage2D(...arguments)}catch(m){je("WebGLState:",m)}}function re(){try{e.texSubImage3D(...arguments)}catch(m){je("WebGLState:",m)}}function rt(){try{e.compressedTexSubImage2D(...arguments)}catch(m){je("WebGLState:",m)}}function Re(){try{e.compressedTexSubImage3D(...arguments)}catch(m){je("WebGLState:",m)}}function Ce(){try{e.texStorage2D(...arguments)}catch(m){je("WebGLState:",m)}}function d(){try{e.texStorage3D(...arguments)}catch(m){je("WebGLState:",m)}}function r(){try{e.texImage2D(...arguments)}catch(m){je("WebGLState:",m)}}function P(){try{e.texImage3D(...arguments)}catch(m){je("WebGLState:",m)}}function $(m){return F[m]!==void 0?F[m]:e.getParameter(m)}function G(m,I){F[m]!==I&&(e.pixelStorei(m,I),F[m]=I)}function ce(m){z.equals(m)===!1&&(e.scissor(m.x,m.y,m.z,m.w),z.copy(m))}function ne(m){fe.equals(m)===!1&&(e.viewport(m.x,m.y,m.z,m.w),fe.copy(m))}function M(m,I){let j=L.get(I);j===void 0&&(j=new WeakMap,L.set(I,j));let ee=j.get(m);ee===void 0&&(ee=e.getUniformBlockIndex(I,m.name),e.uniformBlockBinding(I,ee,ee),j.set(m,ee))}function K(m,I,j){const ee=L.get(I).get(m);y[ee]!==j&&(e.bindBufferBase(e.UNIFORM_BUFFER,ee,j),y[ee]=j)}function pe(){e.disable(e.BLEND),e.disable(e.CULL_FACE),e.disable(e.DEPTH_TEST),e.disable(e.POLYGON_OFFSET_FILL),e.disable(e.SCISSOR_TEST),e.disable(e.STENCIL_TEST),e.disable(e.SAMPLE_ALPHA_TO_COVERAGE),e.blendEquation(e.FUNC_ADD),e.blendFunc(e.ONE,e.ZERO),e.blendFuncSeparate(e.ONE,e.ZERO,e.ONE,e.ZERO),e.blendColor(0,0,0,0),e.colorMask(!0,!0,!0,!0),e.clearColor(0,0,0,0),e.depthMask(!0),e.depthFunc(e.LESS),f.setReversed(!1),e.clearDepth(1),e.stencilMask(4294967295),e.stencilFunc(e.ALWAYS,0,4294967295),e.stencilOp(e.KEEP,e.KEEP,e.KEEP),e.clearStencil(0),e.cullFace(e.BACK),e.frontFace(e.CCW),e.polygonOffset(0,0),e.activeTexture(e.TEXTURE0),e.bindFramebuffer(e.FRAMEBUFFER,null),e.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),e.bindFramebuffer(e.READ_FRAMEBUFFER,null),e.useProgram(null),e.lineWidth(1),e.scissor(0,0,e.canvas.width,e.canvas.height),e.viewport(0,0,e.canvas.width,e.canvas.height),e.pixelStorei(e.PACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,!1),e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),e.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,e.BROWSER_DEFAULT_WEBGL),e.pixelStorei(e.PACK_ROW_LENGTH,0),e.pixelStorei(e.PACK_SKIP_PIXELS,0),e.pixelStorei(e.PACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_ROW_LENGTH,0),e.pixelStorei(e.UNPACK_IMAGE_HEIGHT,0),e.pixelStorei(e.UNPACK_SKIP_PIXELS,0),e.pixelStorei(e.UNPACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_SKIP_IMAGES,0),V={},F={},Z=null,ie={},v={},y={},T=new WeakMap,w=[],B=null,u=!1,s=null,_=null,D=null,S=null,C=null,x=null,n=null,p=new Ze(0,0,0),Y=0,N=!1,O=null,W=null,k=null,R=null,Q=null,z.set(0,0,e.canvas.width,e.canvas.height),fe.set(0,0,e.canvas.width,e.canvas.height),l.reset(),f.reset(),g.reset()}return{buffers:{color:l,depth:f,stencil:g},enable:ge,disable:xe,bindFramebuffer:$e,drawBuffers:we,useProgram:ye,setBlending:_t,setMaterial:it,setFlipSided:pt,setCullFace:Qe,setLineWidth:At,setPolygonOffset:st,setScissorTest:St,activeTexture:Et,bindTexture:Mt,unbindTexture:E,compressedTexImage2D:Tt,compressedTexImage3D:Ke,texImage2D:r,texImage3D:P,pixelStorei:G,getParameter:$,updateUBOMapping:M,uniformBlockBinding:K,texStorage2D:Ce,texStorage3D:d,texSubImage2D:Ye,texSubImage3D:re,compressedTexSubImage2D:rt,compressedTexSubImage3D:Re,scissor:ce,viewport:ne,reset:pe}}function ed(e,a,t,i,c,l,f){const g=a.has("WEBGL_multisampled_render_to_texture")?a.get("WEBGL_multisampled_render_to_texture"):null,y=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),L=new gt,V=new WeakMap,F=new Set;let v;const T=new WeakMap,w=new Set,B=new FinalizationRegistry(d=>w.delete(d));let u=!1;try{u=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function s(d,r){return u?new OffscreenCanvas(d,r):vo("canvas")}function _(d,r,P){let $=1;const G=Ce(d);if((G.width>P||G.height>P)&&($=P/Math.max(G.width,G.height)),$<1)if(typeof HTMLImageElement<"u"&&d instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&d instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&d instanceof ImageBitmap||typeof VideoFrame<"u"&&d instanceof VideoFrame){const ce=Math.floor($*G.width),ne=Math.floor($*G.height);v===void 0&&(v=s(ce,ne));const M=r?s(ce,ne):v;return M.width=ce,M.height=ne,M.getContext("2d").drawImage(d,0,0,ce,ne),Ge("WebGLRenderer: Texture has been resized from ("+G.width+"x"+G.height+") to ("+ce+"x"+ne+")."),M}else return"data"in d&&Ge("WebGLRenderer: Image in DataTexture is too big ("+G.width+"x"+G.height+")."),d;return d}function D(d){return d.generateMipmaps}function S(d){e.generateMipmap(d)}function C(d){return d.isWebGLCubeRenderTarget?e.TEXTURE_CUBE_MAP:d.isWebGL3DRenderTarget?e.TEXTURE_3D:d.isWebGLArrayRenderTarget||d.isCompressedArrayTexture?e.TEXTURE_2D_ARRAY:e.TEXTURE_2D}function x(d,r,P,$,G,ce=!1){if(d!==null){if(e[d]!==void 0)return e[d];Ge("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+d+"'")}let ne;$&&(ne=a.get("EXT_texture_norm16"),ne||Ge("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let M=r;if(r===e.RED&&(P===e.FLOAT&&(M=e.R32F),P===e.HALF_FLOAT&&(M=e.R16F),P===e.UNSIGNED_BYTE&&(M=e.R8),P===e.UNSIGNED_SHORT&&ne&&(M=ne.R16_EXT),P===e.SHORT&&ne&&(M=ne.R16_SNORM_EXT)),r===e.RED_INTEGER&&(P===e.UNSIGNED_BYTE&&(M=e.R8UI),P===e.UNSIGNED_SHORT&&(M=e.R16UI),P===e.UNSIGNED_INT&&(M=e.R32UI),P===e.BYTE&&(M=e.R8I),P===e.SHORT&&(M=e.R16I),P===e.INT&&(M=e.R32I)),r===e.RG&&(P===e.FLOAT&&(M=e.RG32F),P===e.HALF_FLOAT&&(M=e.RG16F),P===e.UNSIGNED_BYTE&&(M=e.RG8),P===e.UNSIGNED_SHORT&&ne&&(M=ne.RG16_EXT),P===e.SHORT&&ne&&(M=ne.RG16_SNORM_EXT)),r===e.RG_INTEGER&&(P===e.UNSIGNED_BYTE&&(M=e.RG8UI),P===e.UNSIGNED_SHORT&&(M=e.RG16UI),P===e.UNSIGNED_INT&&(M=e.RG32UI),P===e.BYTE&&(M=e.RG8I),P===e.SHORT&&(M=e.RG16I),P===e.INT&&(M=e.RG32I)),r===e.RGB_INTEGER&&(P===e.UNSIGNED_BYTE&&(M=e.RGB8UI),P===e.UNSIGNED_SHORT&&(M=e.RGB16UI),P===e.UNSIGNED_INT&&(M=e.RGB32UI),P===e.BYTE&&(M=e.RGB8I),P===e.SHORT&&(M=e.RGB16I),P===e.INT&&(M=e.RGB32I)),r===e.RGBA_INTEGER&&(P===e.UNSIGNED_BYTE&&(M=e.RGBA8UI),P===e.UNSIGNED_SHORT&&(M=e.RGBA16UI),P===e.UNSIGNED_INT&&(M=e.RGBA32UI),P===e.BYTE&&(M=e.RGBA8I),P===e.SHORT&&(M=e.RGBA16I),P===e.INT&&(M=e.RGBA32I)),r===e.RGB&&(P===e.UNSIGNED_SHORT&&ne&&(M=ne.RGB16_EXT),P===e.SHORT&&ne&&(M=ne.RGB16_SNORM_EXT),P===e.UNSIGNED_INT_5_9_9_9_REV&&(M=e.RGB9_E5),P===e.UNSIGNED_INT_10F_11F_11F_REV&&(M=e.R11F_G11F_B10F)),r===e.RGBA){const K=ce?Ar:Je.getTransfer(G);P===e.FLOAT&&(M=e.RGBA32F),P===e.HALF_FLOAT&&(M=e.RGBA16F),P===e.UNSIGNED_BYTE&&(M=K===We?e.SRGB8_ALPHA8:e.RGBA8),P===e.UNSIGNED_SHORT&&ne&&(M=ne.RGBA16_EXT),P===e.SHORT&&ne&&(M=ne.RGBA16_SNORM_EXT),P===e.UNSIGNED_SHORT_4_4_4_4&&(M=e.RGBA4),P===e.UNSIGNED_SHORT_5_5_5_1&&(M=e.RGB5_A1)}return(M===e.R16F||M===e.R32F||M===e.RG16F||M===e.RG32F||M===e.RGBA16F||M===e.RGBA32F)&&a.get("EXT_color_buffer_float"),M}function n(d,r){let P;return d?r===null||r===Xt||r===$t?P=e.DEPTH24_STENCIL8:r===yt?P=e.DEPTH32F_STENCIL8:r===_a&&(P=e.DEPTH24_STENCIL8,Ge("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):r===null||r===Xt||r===$t?P=e.DEPTH_COMPONENT24:r===yt?P=e.DEPTH_COMPONENT32F:r===_a&&(P=e.DEPTH_COMPONENT16),P}function p(d,r){return D(d)===!0||d.isFramebufferTexture&&d.minFilter!==zt&&d.minFilter!==Rt?Math.log2(Math.max(r.width,r.height))+1:d.mipmaps.length>0?d.mipmaps.length:d.isCompressedTexture&&Array.isArray(d.image)?r.mipmaps.length:1}function Y(d){const r=new WeakRef(d);i.get(d).__ref=r,w.add(r),B.register(d,r,r)}function N(d){const r=i.get(d).__ref;r!==void 0&&(w.delete(r),B.unregister(r))}function O(d){k(d.target)}function W(d){R(d.target)}function k(d){d.removeEventListener("dispose",O),N(d),q(d),d.isVideoTexture&&V.delete(d),d.isHTMLTexture&&F.delete(d)}function R(d){d.removeEventListener("dispose",W),N(d),ae(d)}function Q(){for(const d of w){const r=d.deref();r!==void 0&&(r.isRenderTarget===!0?R(r):k(r))}w.clear(),F.clear()}function q(d){const r=i.get(d);if(r.__webglInit===void 0)return;const P=d.source,$=T.get(P);if($){const G=$[r.__cacheKey];G.usedTimes--,G.usedTimes===0&&H(d),Object.keys($).length===0&&T.delete(P)}i.remove(d)}function H(d){const r=i.get(d);e.deleteTexture(r.__webglTexture);const P=d.source,$=T.get(P);delete $[r.__cacheKey],f.memory.textures--}function ae(d){const r=i.get(d);r.__depthDisposeCallback&&r.__depthDisposeCallback();const P=d.depthTexture;if(P&&P.renderTarget===d&&k(P),d.isWebGLCubeRenderTarget)for(let G=0;G<6;G++){if(Array.isArray(r.__webglFramebuffer[G]))for(let ce=0;ce<r.__webglFramebuffer[G].length;ce++)e.deleteFramebuffer(r.__webglFramebuffer[G][ce]);else e.deleteFramebuffer(r.__webglFramebuffer[G]);r.__webglDepthbuffer&&e.deleteRenderbuffer(r.__webglDepthbuffer[G])}else{if(Array.isArray(r.__webglFramebuffer))for(let G=0;G<r.__webglFramebuffer.length;G++)e.deleteFramebuffer(r.__webglFramebuffer[G]);else e.deleteFramebuffer(r.__webglFramebuffer);if(r.__webglDepthbuffer&&e.deleteRenderbuffer(r.__webglDepthbuffer),r.__webglMultisampledFramebuffer&&e.deleteFramebuffer(r.__webglMultisampledFramebuffer),r.__webglColorRenderbuffer)for(let G=0;G<r.__webglColorRenderbuffer.length;G++)r.__webglColorRenderbuffer[G]&&e.deleteRenderbuffer(r.__webglColorRenderbuffer[G]);r.__webglDepthRenderbuffer&&e.deleteRenderbuffer(r.__webglDepthRenderbuffer)}const $=d.textures;for(let G=0,ce=$.length;G<ce;G++){const ne=i.get($[G]);ne.__webglTexture&&(e.deleteTexture(ne.__webglTexture),f.memory.textures--),i.remove($[G])}i.remove(d)}let X=0;function Z(){X=0}function ie(){return X}function Pe(d){X=d}function Ne(){const d=X;return d>=c.maxTextures&&Ge("WebGLTextures: Trying to use "+(d+1)+" texture units while this GPU supports only "+c.maxTextures),X+=1,d}function z(d){const r=[];return r.push(d.wrapS),r.push(d.wrapT),r.push(d.wrapR||0),r.push(d.magFilter),r.push(d.minFilter),r.push(d.anisotropy),r.push(d.internalFormat),r.push(d.format),r.push(d.type),r.push(d.generateMipmaps),r.push(d.mipmapsAutoUpdate),r.push(d.premultiplyAlpha),r.push(d.flipY),r.push(d.unpackAlignment),r.push(d.colorSpace),r.join()}function fe(d,r){const P=i.get(d);if(d.isVideoTexture&&rt(d),d.isRenderTargetTexture===!1&&d.isExternalTexture!==!0&&d.version>0&&P.__version!==d.version){const $=d.image;if($===null)Ge("WebGLRenderer: Texture marked for update but no image data found.");else if($.complete===!1)Ge("WebGLRenderer: Texture marked for update but image is incomplete");else{it(P,d,r);return}}else d.isExternalTexture&&(P.__webglTexture=d.sourceTexture?d.sourceTexture:null);t.bindTexture(e.TEXTURE_2D,P.__webglTexture,e.TEXTURE0+r)}function Se(d,r){const P=i.get(d);if(d.isRenderTargetTexture===!1&&d.version>0&&P.__version!==d.version){it(P,d,r);return}else d.isExternalTexture&&(P.__webglTexture=d.sourceTexture?d.sourceTexture:null);t.bindTexture(e.TEXTURE_2D_ARRAY,P.__webglTexture,e.TEXTURE0+r)}function be(d,r){const P=i.get(d);if(d.isRenderTargetTexture===!1&&d.version>0&&P.__version!==d.version){it(P,d,r);return}t.bindTexture(e.TEXTURE_3D,P.__webglTexture,e.TEXTURE0+r)}function ge(d,r){const P=i.get(d);if(d.version>0&&P.__version!==d.version){pt(P,d,r);return}t.bindTexture(e.TEXTURE_CUBE_MAP,P.__webglTexture,e.TEXTURE0+r)}const xe={[xn]:e.REPEAT,[ya]:e.CLAMP_TO_EDGE,[Tn]:e.MIRRORED_REPEAT},$e={[zt]:e.NEAREST,[Rn]:e.NEAREST_MIPMAP_NEAREST,[da]:e.NEAREST_MIPMAP_LINEAR,[Rt]:e.LINEAR,[Ra]:e.LINEAR_MIPMAP_NEAREST,[Vt]:e.LINEAR_MIPMAP_LINEAR},we={[Pn]:e.NEVER,[mr]:e.ALWAYS,[Ln]:e.LESS,[pr]:e.LEQUAL,[Cn]:e.EQUAL,[fr]:e.GEQUAL,[bn]:e.GREATER,[An]:e.NOTEQUAL};function ye(d,r){if(r.type===yt&&a.has("OES_texture_float_linear")===!1&&(r.magFilter===Rt||r.magFilter===Ra||r.magFilter===da||r.magFilter===Vt||r.minFilter===Rt||r.minFilter===Ra||r.minFilter===da||r.minFilter===Vt)&&Ge("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),e.texParameteri(d,e.TEXTURE_WRAP_S,xe[r.wrapS]),e.texParameteri(d,e.TEXTURE_WRAP_T,xe[r.wrapT]),(d===e.TEXTURE_3D||d===e.TEXTURE_2D_ARRAY)&&e.texParameteri(d,e.TEXTURE_WRAP_R,xe[r.wrapR]),e.texParameteri(d,e.TEXTURE_MAG_FILTER,$e[r.magFilter]),e.texParameteri(d,e.TEXTURE_MIN_FILTER,$e[r.minFilter]),r.compareFunction&&(e.texParameteri(d,e.TEXTURE_COMPARE_MODE,e.COMPARE_REF_TO_TEXTURE),e.texParameteri(d,e.TEXTURE_COMPARE_FUNC,we[r.compareFunction])),a.has("EXT_texture_filter_anisotropic")===!0){if(r.magFilter===zt||r.minFilter!==da&&r.minFilter!==Vt||r.type===yt&&a.has("OES_texture_float_linear")===!1)return;if(r.anisotropy>1||i.get(r).__currentAnisotropy){const P=a.get("EXT_texture_filter_anisotropic");e.texParameterf(d,P.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(r.anisotropy,c.getMaxAnisotropy())),i.get(r).__currentAnisotropy=r.anisotropy}}}function at(d,r){let P=!1;d.__webglInit===void 0&&(d.__webglInit=!0,r.addEventListener("dispose",O),Y(r));const $=r.source;let G=T.get($);G===void 0&&(G={},T.set($,G));const ce=z(r);if(ce!==d.__cacheKey){G[ce]===void 0&&(G[ce]={texture:e.createTexture(),usedTimes:0},f.memory.textures++,P=!0),G[ce].usedTimes++;const ne=G[d.__cacheKey];ne!==void 0&&(G[d.__cacheKey].usedTimes--,ne.usedTimes===0&&H(r)),d.__cacheKey=ce,d.__webglTexture=G[ce].texture}return P}function lt(d,r,P){return Math.floor(Math.floor(d/P)/r)}function _t(d,r,P,$){const G=d.updateRanges;if(G.length===0)t.texSubImage2D(e.TEXTURE_2D,0,0,0,r.width,r.height,P,$,r.data);else{G.sort((pe,m)=>pe.start-m.start);let ce=0;for(let pe=1;pe<G.length;pe++){const m=G[ce],I=G[pe],j=m.start+m.count,ee=lt(I.start,r.width,4),oe=lt(m.start,r.width,4);I.start<=j+1&&ee===oe&&lt(I.start+I.count-1,r.width,4)===ee?m.count=Math.max(m.count,I.start+I.count-m.start):(++ce,G[ce]=I)}G.length=ce+1;const ne=t.getParameter(e.UNPACK_ROW_LENGTH),M=t.getParameter(e.UNPACK_SKIP_PIXELS),K=t.getParameter(e.UNPACK_SKIP_ROWS);t.pixelStorei(e.UNPACK_ROW_LENGTH,r.width);for(let pe=0,m=G.length;pe<m;pe++){const I=G[pe],j=Math.floor(I.start/4),ee=Math.ceil(I.count/4),oe=j%r.width,te=Math.floor(j/r.width),Me=ee;t.pixelStorei(e.UNPACK_SKIP_PIXELS,oe),t.pixelStorei(e.UNPACK_SKIP_ROWS,te),t.texSubImage2D(e.TEXTURE_2D,0,oe,te,Me,1,P,$,r.data)}d.clearUpdateRanges(),t.pixelStorei(e.UNPACK_ROW_LENGTH,ne),t.pixelStorei(e.UNPACK_SKIP_PIXELS,M),t.pixelStorei(e.UNPACK_SKIP_ROWS,K)}}function it(d,r,P){let $=e.TEXTURE_2D;(r.isDataArrayTexture||r.isCompressedArrayTexture)&&($=e.TEXTURE_2D_ARRAY),r.isData3DTexture&&($=e.TEXTURE_3D);const G=at(d,r),ce=r.source;t.bindTexture($,d.__webglTexture,e.TEXTURE0+P);const ne=i.get(ce);if(ce.version!==ne.__version||G===!0){if(t.activeTexture(e.TEXTURE0+P),!(typeof ImageBitmap<"u"&&r.image instanceof ImageBitmap)){const se=Je.getPrimaries(Je.workingColorSpace),ve=r.colorSpace===Kt?null:Je.getPrimaries(r.colorSpace),Ae=r.colorSpace===Kt||se===ve?e.NONE:e.BROWSER_DEFAULT_WEBGL;t.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,r.flipY),t.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,r.premultiplyAlpha),t.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,Ae)}t.pixelStorei(e.UNPACK_ALIGNMENT,r.unpackAlignment);let M=_(r.image,!1,c.maxTextureSize);M=Re(r,M);const K=l.convert(r.format,r.colorSpace),pe=l.convert(r.type);let m=x(r.internalFormat,K,pe,r.normalized,r.colorSpace,r.isVideoTexture);ye($,r);let I;const j=r.mipmaps,ee=r.isVideoTexture!==!0,oe=ne.__version===void 0||G===!0,te=ce.dataReady,Me=p(r,M);if(r.isDepthTexture)m=n(r.format===Wt,r.type),oe&&(ee?t.texStorage2D(e.TEXTURE_2D,1,m,M.width,M.height):t.texImage2D(e.TEXTURE_2D,0,m,M.width,M.height,0,K,pe,null));else if(r.isDataTexture)if(j.length>0){ee&&oe&&t.texStorage2D(e.TEXTURE_2D,Me,m,j[0].width,j[0].height);for(let se=0,ve=j.length;se<ve;se++)I=j[se],ee?te&&t.texSubImage2D(e.TEXTURE_2D,se,0,0,I.width,I.height,K,pe,I.data):t.texImage2D(e.TEXTURE_2D,se,m,I.width,I.height,0,K,pe,I.data);r.generateMipmaps=!1}else ee?(oe&&t.texStorage2D(e.TEXTURE_2D,Me,m,M.width,M.height),te&&_t(r,M,K,pe)):t.texImage2D(e.TEXTURE_2D,0,m,M.width,M.height,0,K,pe,M.data);else if(r.isCompressedTexture)if(r.isCompressedArrayTexture){ee&&oe&&t.texStorage3D(e.TEXTURE_2D_ARRAY,Me,m,j[0].width,j[0].height,M.depth);for(let se=0,ve=j.length;se<ve;se++)if(I=j[se],r.format!==Ot)if(K!==null)if(ee){if(te)if(r.layerUpdates.size>0){const Ae=Gi(I.width,I.height,r.format,r.type);for(const Ue of r.layerUpdates){const me=I.data.subarray(Ue*Ae/I.data.BYTES_PER_ELEMENT,(Ue+1)*Ae/I.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,se,0,0,Ue,I.width,I.height,1,K,me)}}else t.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,se,0,0,0,I.width,I.height,M.depth,K,I.data)}else t.compressedTexImage3D(e.TEXTURE_2D_ARRAY,se,m,I.width,I.height,M.depth,0,I.data,0,0);else Ge("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else ee?te&&t.texSubImage3D(e.TEXTURE_2D_ARRAY,se,0,0,0,I.width,I.height,M.depth,K,pe,I.data):t.texImage3D(e.TEXTURE_2D_ARRAY,se,m,I.width,I.height,M.depth,0,K,pe,I.data);r.layerUpdates.size>0&&r.clearLayerUpdates()}else{ee&&oe&&t.texStorage2D(e.TEXTURE_2D,Me,m,j[0].width,j[0].height);for(let se=0,ve=j.length;se<ve;se++)I=j[se],r.format!==Ot?K!==null?ee?te&&t.compressedTexSubImage2D(e.TEXTURE_2D,se,0,0,I.width,I.height,K,I.data):t.compressedTexImage2D(e.TEXTURE_2D,se,m,I.width,I.height,0,I.data):Ge("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):ee?te&&t.texSubImage2D(e.TEXTURE_2D,se,0,0,I.width,I.height,K,pe,I.data):t.texImage2D(e.TEXTURE_2D,se,m,I.width,I.height,0,K,pe,I.data)}else if(r.isDataArrayTexture)if(ee){if(oe&&t.texStorage3D(e.TEXTURE_2D_ARRAY,Me,m,M.width,M.height,M.depth),te)if(r.layerUpdates.size>0){const se=Gi(M.width,M.height,r.format,r.type);for(const ve of r.layerUpdates){const Ae=M.data.subarray(ve*se/M.data.BYTES_PER_ELEMENT,(ve+1)*se/M.data.BYTES_PER_ELEMENT);t.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,ve,M.width,M.height,1,K,pe,Ae)}r.clearLayerUpdates()}else t.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,0,M.width,M.height,M.depth,K,pe,M.data)}else t.texImage3D(e.TEXTURE_2D_ARRAY,0,m,M.width,M.height,M.depth,0,K,pe,M.data);else if(r.isData3DTexture)ee?(oe&&t.texStorage3D(e.TEXTURE_3D,Me,m,M.width,M.height,M.depth),te&&t.texSubImage3D(e.TEXTURE_3D,0,0,0,0,M.width,M.height,M.depth,K,pe,M.data)):t.texImage3D(e.TEXTURE_3D,0,m,M.width,M.height,M.depth,0,K,pe,M.data);else if(r.isFramebufferTexture){if(oe)if(ee)t.texStorage2D(e.TEXTURE_2D,Me,m,M.width,M.height);else{let se=M.width,ve=M.height;for(let Ae=0;Ae<Me;Ae++)t.texImage2D(e.TEXTURE_2D,Ae,m,se,ve,0,K,pe,null),se>>=1,ve>>=1}}else if(r.isHTMLTexture){if("texElementImage2D"in e){const se=e.canvas;if(se.hasAttribute("layoutsubtree")||se.setAttribute("layoutsubtree","true"),M.parentNode!==se){se.appendChild(M),F.add(r),se.onpaint=ve=>{const Ae=ve.changedElements;for(const Ue of F)Ae.includes(Ue.image)&&(Ue.needsUpdate=!0)},se.requestPaint();return}if(e.texElementImage2D.length===3)e.texElementImage2D(e.TEXTURE_2D,e.RGBA8,M);else{const ve=e.RGBA,Ae=e.RGBA,Ue=e.UNSIGNED_BYTE;e.texElementImage2D(e.TEXTURE_2D,0,ve,Ae,Ue,M)}e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE)}}else if(j.length>0){if(ee&&oe){const se=Ce(j[0]);t.texStorage2D(e.TEXTURE_2D,Me,m,se.width,se.height)}for(let se=0,ve=j.length;se<ve;se++)I=j[se],ee?te&&t.texSubImage2D(e.TEXTURE_2D,se,0,0,K,pe,I):t.texImage2D(e.TEXTURE_2D,se,m,K,pe,I);r.generateMipmaps=!1}else if(ee){if(oe){const se=Ce(M);t.texStorage2D(e.TEXTURE_2D,Me,m,se.width,se.height)}te&&t.texSubImage2D(e.TEXTURE_2D,0,0,0,K,pe,M)}else t.texImage2D(e.TEXTURE_2D,0,m,K,pe,M);D(r)&&r.mipmapsAutoUpdate===!0&&S($),ne.__version=ce.version,r.onUpdate&&r.onUpdate(r)}d.__version=r.version}function pt(d,r,P){if(r.image.length!==6)return;const $=at(d,r),G=r.source;t.bindTexture(e.TEXTURE_CUBE_MAP,d.__webglTexture,e.TEXTURE0+P);const ce=i.get(G);if(G.version!==ce.__version||$===!0){t.activeTexture(e.TEXTURE0+P);const ne=Je.getPrimaries(Je.workingColorSpace),M=r.colorSpace===Kt?null:Je.getPrimaries(r.colorSpace),K=r.colorSpace===Kt||ne===M?e.NONE:e.BROWSER_DEFAULT_WEBGL;t.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,r.flipY),t.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,r.premultiplyAlpha),t.pixelStorei(e.UNPACK_ALIGNMENT,r.unpackAlignment),t.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,K);const pe=r.isCompressedTexture||r.image[0].isCompressedTexture,m=r.image[0]&&r.image[0].isDataTexture,I=[];for(let me=0;me<6;me++)!pe&&!m?I[me]=_(r.image[me],!0,c.maxCubemapSize):I[me]=m?r.image[me].image:r.image[me],I[me]=Re(r,I[me]);const j=I[0],ee=l.convert(r.format,r.colorSpace),oe=l.convert(r.type);let te=x(r.internalFormat,ee,oe,r.normalized,r.colorSpace);const Me=r.isVideoTexture!==!0,se=ce.__version===void 0||$===!0,ve=G.dataReady;let Ae=p(r,j);ye(e.TEXTURE_CUBE_MAP,r);let Ue;if(r.isDepthTexture){if(te=n(r.format===Wt,r.type),se)if(Me)t.texStorage2D(e.TEXTURE_CUBE_MAP,1,te,j.width,j.height);else for(let me=0;me<6;me++)t.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+me,0,te,j.width,j.height,0,ee,oe,null)}else if(pe){Me&&se&&t.texStorage2D(e.TEXTURE_CUBE_MAP,Ae,te,j.width,j.height);for(let me=0;me<6;me++){Ue=I[me].mipmaps;for(let ke=0;ke<Ue.length;ke++){const qe=Ue[ke];r.format!==Ot?ee!==null?Me?ve&&t.compressedTexSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+me,ke,0,0,qe.width,qe.height,ee,qe.data):t.compressedTexImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+me,ke,te,qe.width,qe.height,0,qe.data):Ge("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):Me?ve&&t.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+me,ke,0,0,qe.width,qe.height,ee,oe,qe.data):t.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+me,ke,te,qe.width,qe.height,0,ee,oe,qe.data)}}}else{if(Ue=r.mipmaps,Me&&se){Ue.length>0&&Ae++;const me=Ce(I[0]);t.texStorage2D(e.TEXTURE_CUBE_MAP,Ae,te,me.width,me.height)}for(let me=0;me<6;me++)if(m){Me?ve&&t.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+me,0,0,0,I[me].width,I[me].height,ee,oe,I[me].data):t.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+me,0,te,I[me].width,I[me].height,0,ee,oe,I[me].data);for(let ke=0;ke<Ue.length;ke++){const qe=Ue[ke].image[me].image;Me?ve&&t.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+me,ke+1,0,0,qe.width,qe.height,ee,oe,qe.data):t.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+me,ke+1,te,qe.width,qe.height,0,ee,oe,qe.data)}}else{Me?ve&&t.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+me,0,0,0,ee,oe,I[me]):t.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+me,0,te,ee,oe,I[me]);for(let ke=0;ke<Ue.length;ke++){const qe=Ue[ke];Me?ve&&t.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+me,ke+1,0,0,ee,oe,qe.image[me]):t.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+me,ke+1,te,ee,oe,qe.image[me])}}}D(r)&&r.mipmapsAutoUpdate===!0&&S(e.TEXTURE_CUBE_MAP),ce.__version=G.version,r.onUpdate&&r.onUpdate(r)}d.__version=r.version}function Qe(d,r,P,$,G,ce){const ne=l.convert(P.format,P.colorSpace),M=l.convert(P.type),K=x(P.internalFormat,ne,M,P.normalized,P.colorSpace),pe=i.get(r),m=i.get(P);if(m.__renderTarget=r,!pe.__hasExternalTextures){const I=Math.max(1,r.width>>ce),j=Math.max(1,r.height>>ce);G===e.TEXTURE_3D||G===e.TEXTURE_2D_ARRAY?t.texImage3D(G,ce,K,I,j,r.depth,0,ne,M,null):t.texImage2D(G,ce,K,I,j,0,ne,M,null)}t.bindFramebuffer(e.FRAMEBUFFER,d),re(r)?g.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,$,G,m.__webglTexture,0,Ye(r)):(G===e.TEXTURE_2D||G>=e.TEXTURE_CUBE_MAP_POSITIVE_X&&G<=e.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&e.framebufferTexture2D(e.FRAMEBUFFER,$,G,m.__webglTexture,ce),t.bindFramebuffer(e.FRAMEBUFFER,null)}function At(d,r,P){if(e.bindRenderbuffer(e.RENDERBUFFER,d),r.depthBuffer){const $=r.depthTexture,G=$&&$.isDepthTexture?$.type:null,ce=n(r.stencilBuffer,G),ne=r.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;re(r)?g.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,Ye(r),ce,r.width,r.height):P?e.renderbufferStorageMultisample(e.RENDERBUFFER,Ye(r),ce,r.width,r.height):e.renderbufferStorage(e.RENDERBUFFER,ce,r.width,r.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,ne,e.RENDERBUFFER,d)}else{const $=r.textures;for(let G=0;G<$.length;G++){const ce=$[G],ne=l.convert(ce.format,ce.colorSpace),M=l.convert(ce.type),K=x(ce.internalFormat,ne,M,ce.normalized,ce.colorSpace);re(r)?g.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,Ye(r),K,r.width,r.height):P?e.renderbufferStorageMultisample(e.RENDERBUFFER,Ye(r),K,r.width,r.height):e.renderbufferStorage(e.RENDERBUFFER,K,r.width,r.height)}}e.bindRenderbuffer(e.RENDERBUFFER,null)}function st(d,r,P){const $=r.isWebGLCubeRenderTarget===!0;if(t.bindFramebuffer(e.FRAMEBUFFER,d),!(r.depthTexture&&r.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");const G=i.get(r.depthTexture);G.__renderTarget=r;const ce=$?r.depthTexture.image[0]:r.depthTexture.image;(!G.__webglTexture||ce.width!==r.width||ce.height!==r.height)&&(ce.width=r.width,ce.height=r.height,r.depthTexture.needsUpdate=!0),$?ge(r.depthTexture,0):fe(r.depthTexture,0);const ne=G.__webglTexture,M=Ye(r),K=$?e.TEXTURE_CUBE_MAP_POSITIVE_X+P:e.TEXTURE_2D,pe=r.depthTexture.format===Wt?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;if(r.depthTexture.format===oa)re(r)?g.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,pe,K,ne,0,M):e.framebufferTexture2D(e.FRAMEBUFFER,pe,K,ne,0);else if(r.depthTexture.format===Wt)re(r)?g.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,pe,K,ne,0,M):e.framebufferTexture2D(e.FRAMEBUFFER,pe,K,ne,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function St(d){const r=i.get(d),P=d.isWebGLCubeRenderTarget===!0;if(r.__boundDepthTexture!==d.depthTexture){const $=d.depthTexture;if(r.__depthDisposeCallback&&r.__depthDisposeCallback(),$){const G=()=>{delete r.__boundDepthTexture,delete r.__depthDisposeCallback,$.removeEventListener("dispose",G)};$.addEventListener("dispose",G),r.__depthDisposeCallback=G}r.__boundDepthTexture=$}if(d.depthTexture&&!r.__autoAllocateDepthBuffer)if(P)for(let $=0;$<6;$++)st(r.__webglFramebuffer[$],d,$);else d.texture.mipmaps.length>0?st(r.__webglFramebuffer[0],d,0):st(r.__webglFramebuffer,d,0);else if(P){r.__webglDepthbuffer=[];for(let $=0;$<6;$++)if(t.bindFramebuffer(e.FRAMEBUFFER,r.__webglFramebuffer[$]),r.__webglDepthbuffer[$]===void 0)r.__webglDepthbuffer[$]=e.createRenderbuffer(),At(r.__webglDepthbuffer[$],d,!1);else{const G=d.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,ce=r.__webglDepthbuffer[$];e.bindRenderbuffer(e.RENDERBUFFER,ce),e.framebufferRenderbuffer(e.FRAMEBUFFER,G,e.RENDERBUFFER,ce)}}else if(d.texture.mipmaps.length>0?t.bindFramebuffer(e.FRAMEBUFFER,r.__webglFramebuffer[0]):t.bindFramebuffer(e.FRAMEBUFFER,r.__webglFramebuffer),r.__webglDepthbuffer===void 0)r.__webglDepthbuffer=e.createRenderbuffer(),At(r.__webglDepthbuffer,d,!1);else{const $=d.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,G=r.__webglDepthbuffer;e.bindRenderbuffer(e.RENDERBUFFER,G),e.framebufferRenderbuffer(e.FRAMEBUFFER,$,e.RENDERBUFFER,G)}t.bindFramebuffer(e.FRAMEBUFFER,null)}function Et(d,r,P){const $=i.get(d);r!==void 0&&Qe($.__webglFramebuffer,d,d.texture,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,0),P!==void 0&&St(d)}function Mt(d){const r=d.texture,P=i.get(d),$=i.get(r);d.addEventListener("dispose",W),Y(d);const G=d.textures,ce=d.isWebGLCubeRenderTarget===!0,ne=G.length>1;if(ne||($.__webglTexture===void 0&&($.__webglTexture=e.createTexture()),$.__version=r.version,f.memory.textures++),ce){P.__webglFramebuffer=[];for(let M=0;M<6;M++)if(r.mipmaps.length>0){P.__webglFramebuffer[M]=[];for(let K=0;K<r.mipmaps.length;K++)P.__webglFramebuffer[M][K]=e.createFramebuffer()}else P.__webglFramebuffer[M]=e.createFramebuffer()}else{if(r.mipmaps.length>0){P.__webglFramebuffer=[];for(let M=0;M<r.mipmaps.length;M++)P.__webglFramebuffer[M]=e.createFramebuffer()}else P.__webglFramebuffer=e.createFramebuffer();if(ne)for(let M=0,K=G.length;M<K;M++){const pe=i.get(G[M]);pe.__webglTexture===void 0&&(pe.__webglTexture=e.createTexture(),f.memory.textures++)}if(d.samples>0&&re(d)===!1){P.__webglMultisampledFramebuffer=e.createFramebuffer(),P.__webglColorRenderbuffer=[],t.bindFramebuffer(e.FRAMEBUFFER,P.__webglMultisampledFramebuffer);for(let M=0;M<G.length;M++){const K=G[M];P.__webglColorRenderbuffer[M]=e.createRenderbuffer(),e.bindRenderbuffer(e.RENDERBUFFER,P.__webglColorRenderbuffer[M]);const pe=l.convert(K.format,K.colorSpace),m=l.convert(K.type),I=x(K.internalFormat,pe,m,K.normalized,K.colorSpace,d.isXRRenderTarget===!0),j=Ye(d);e.renderbufferStorageMultisample(e.RENDERBUFFER,j,I,d.width,d.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+M,e.RENDERBUFFER,P.__webglColorRenderbuffer[M])}e.bindRenderbuffer(e.RENDERBUFFER,null),d.depthBuffer&&(P.__webglDepthRenderbuffer=e.createRenderbuffer(),At(P.__webglDepthRenderbuffer,d,!0)),t.bindFramebuffer(e.FRAMEBUFFER,null)}}if(ce){t.bindTexture(e.TEXTURE_CUBE_MAP,$.__webglTexture),ye(e.TEXTURE_CUBE_MAP,r);for(let M=0;M<6;M++)if(r.mipmaps.length>0)for(let K=0;K<r.mipmaps.length;K++)Qe(P.__webglFramebuffer[M][K],d,r,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+M,K);else Qe(P.__webglFramebuffer[M],d,r,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+M,0);D(r)?S(e.TEXTURE_CUBE_MAP):r.mipmaps.length>0&&e.texParameteri(e.TEXTURE_CUBE_MAP,e.TEXTURE_MAX_LEVEL,r.mipmaps.length-1),t.unbindTexture()}else if(ne){for(let M=0,K=G.length;M<K;M++){const pe=G[M],m=i.get(pe);let I=e.TEXTURE_2D;(d.isWebGL3DRenderTarget||d.isWebGLArrayRenderTarget)&&(I=d.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY),t.bindTexture(I,m.__webglTexture),ye(I,pe),Qe(P.__webglFramebuffer,d,pe,e.COLOR_ATTACHMENT0+M,I,0),D(pe)&&S(I)}t.unbindTexture()}else{let M=e.TEXTURE_2D;if((d.isWebGL3DRenderTarget||d.isWebGLArrayRenderTarget)&&(M=d.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY),t.bindTexture(M,$.__webglTexture),ye(M,r),r.mipmaps.length>0)for(let K=0;K<r.mipmaps.length;K++)Qe(P.__webglFramebuffer[K],d,r,e.COLOR_ATTACHMENT0,M,K);else Qe(P.__webglFramebuffer,d,r,e.COLOR_ATTACHMENT0,M,0);D(r)?S(M):r.mipmaps.length>0&&e.texParameteri(M,e.TEXTURE_MAX_LEVEL,r.mipmaps.length-1),t.unbindTexture()}d.depthBuffer&&St(d)}function E(d){const r=d.textures;for(let P=0,$=r.length;P<$;P++){const G=r[P];if(D(G)&&G.mipmapsAutoUpdate===!0){const ce=C(d),ne=i.get(G).__webglTexture;t.bindTexture(ce,ne),S(ce),t.unbindTexture()}}}const Tt=[];function Ke(d){if(d.samples>0){if(re(d)===!1){const r=d.textures,P=d.width,$=d.height;let G=e.COLOR_BUFFER_BIT;const ce=d.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,ne=i.get(d),M=r.length>1;if(M)for(let K=0;K<r.length;K++)t.bindFramebuffer(e.FRAMEBUFFER,ne.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+K,e.RENDERBUFFER,null),t.bindFramebuffer(e.FRAMEBUFFER,ne.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+K,e.TEXTURE_2D,null,0);t.bindFramebuffer(e.READ_FRAMEBUFFER,ne.__webglMultisampledFramebuffer),d.texture.mipmaps.length>0?t.bindFramebuffer(e.DRAW_FRAMEBUFFER,ne.__webglFramebuffer[0]):t.bindFramebuffer(e.DRAW_FRAMEBUFFER,ne.__webglFramebuffer);for(let K=0;K<r.length;K++){if(d.resolveDepthBuffer&&(d.depthBuffer&&(G|=e.DEPTH_BUFFER_BIT),d.stencilBuffer&&d.resolveStencilBuffer&&(G|=e.STENCIL_BUFFER_BIT)),M){e.framebufferRenderbuffer(e.READ_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.RENDERBUFFER,ne.__webglColorRenderbuffer[K]);const pe=i.get(r[K]).__webglTexture;e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,pe,0)}e.blitFramebuffer(0,0,P,$,0,0,P,$,G,e.NEAREST),y===!0&&(Tt.length=0,Tt.push(e.COLOR_ATTACHMENT0+K),d.depthBuffer&&d.storeMultisampledDepthBuffer===!1&&Tt.push(ce),e.invalidateFramebuffer(e.READ_FRAMEBUFFER,Tt))}if(t.bindFramebuffer(e.READ_FRAMEBUFFER,null),t.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),M)for(let K=0;K<r.length;K++){t.bindFramebuffer(e.FRAMEBUFFER,ne.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+K,e.RENDERBUFFER,ne.__webglColorRenderbuffer[K]);const pe=i.get(r[K]).__webglTexture;t.bindFramebuffer(e.FRAMEBUFFER,ne.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+K,e.TEXTURE_2D,pe,0)}t.bindFramebuffer(e.DRAW_FRAMEBUFFER,ne.__webglMultisampledFramebuffer)}else if(d.depthBuffer&&d.storeMultisampledDepthBuffer===!1&&y){const r=d.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,[r])}}}function Ye(d){return Math.min(c.maxSamples,d.samples)}function re(d){const r=i.get(d);return d.samples>0&&a.has("WEBGL_multisampled_render_to_texture")===!0&&r.__useRenderToTexture!==!1}function rt(d){const r=f.render.frame;V.get(d)!==r&&(V.set(d,r),d.update())}function Re(d,r){const P=d.colorSpace,$=d.format,G=d.type;return d.isCompressedTexture===!0||d.isVideoTexture===!0||P!==Ur&&P!==Kt&&(Je.getTransfer(P)===We?($!==Ot||G!==Lt)&&Ge("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):je("WebGLTextures: Unsupported texture color space:",P)),r}function Ce(d){return typeof HTMLImageElement<"u"&&d instanceof HTMLImageElement?(L.width=d.naturalWidth||d.width,L.height=d.naturalHeight||d.height):typeof VideoFrame<"u"&&d instanceof VideoFrame?(L.width=d.displayWidth,L.height=d.displayHeight):(L.width=d.width,L.height=d.height),L}this.allocateTextureUnit=Ne,this.resetTextureUnits=Z,this.getTextureUnits=ie,this.setTextureUnits=Pe,this.setTexture2D=fe,this.setTexture2DArray=Se,this.setTexture3D=be,this.setTextureCube=ge,this.rebindTextures=Et,this.setupRenderTarget=Mt,this.updateRenderTargetMipmap=E,this.updateMultisampleRenderTarget=Ke,this.setupDepthRenderbuffer=St,this.setupFrameBufferTexture=Qe,this.useMultisampledRTT=re,this.dispose=Q}function td(e,a){function t(i,c=Kt){let l;const f=Je.getTransfer(c);if(i===Lt)return e.UNSIGNED_BYTE;if(i===Sr)return e.UNSIGNED_SHORT_4_4_4_4;if(i===Er)return e.UNSIGNED_SHORT_5_5_5_1;if(i===eo)return e.UNSIGNED_INT_5_9_9_9_REV;if(i===to)return e.UNSIGNED_INT_10F_11F_11F_REV;if(i===ao)return e.BYTE;if(i===io)return e.SHORT;if(i===_a)return e.UNSIGNED_SHORT;if(i===Rr)return e.INT;if(i===Xt)return e.UNSIGNED_INT;if(i===yt)return e.FLOAT;if(i===Ut)return e.HALF_FLOAT;if(i===ro)return e.ALPHA;if(i===no)return e.RGB;if(i===Ot)return e.RGBA;if(i===oa)return e.DEPTH_COMPONENT;if(i===Wt)return e.DEPTH_STENCIL;if(i===oo)return e.RED;if(i===vr)return e.RED_INTEGER;if(i===Zt)return e.RG;if(i===_r)return e.RG_INTEGER;if(i===gr)return e.RGBA_INTEGER;if(i===Ca||i===La||i===Pa||i===wa)if(f===We)if(l=a.get("WEBGL_compressed_texture_s3tc_srgb"),l!==null){if(i===Ca)return l.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(i===La)return l.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(i===Pa)return l.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(i===wa)return l.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(l=a.get("WEBGL_compressed_texture_s3tc"),l!==null){if(i===Ca)return l.COMPRESSED_RGB_S3TC_DXT1_EXT;if(i===La)return l.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(i===Pa)return l.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(i===wa)return l.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(i===ci||i===ui||i===di||i===fi)if(l=a.get("WEBGL_compressed_texture_pvrtc"),l!==null){if(i===ci)return l.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(i===ui)return l.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(i===di)return l.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(i===fi)return l.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(i===pi||i===mi||i===hi||i===gi||i===_i||i===Ba||i===vi)if(l=a.get("WEBGL_compressed_texture_etc"),l!==null){if(i===pi||i===mi)return f===We?l.COMPRESSED_SRGB8_ETC2:l.COMPRESSED_RGB8_ETC2;if(i===hi)return f===We?l.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:l.COMPRESSED_RGBA8_ETC2_EAC;if(i===gi)return l.COMPRESSED_R11_EAC;if(i===_i)return l.COMPRESSED_SIGNED_R11_EAC;if(i===Ba)return l.COMPRESSED_RG11_EAC;if(i===vi)return l.COMPRESSED_SIGNED_RG11_EAC}else return null;if(i===Si||i===Ei||i===Mi||i===Ti||i===xi||i===Ri||i===Ai||i===bi||i===Ci||i===Li||i===Pi||i===wi||i===Di||i===Ni)if(l=a.get("WEBGL_compressed_texture_astc"),l!==null){if(i===Si)return f===We?l.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:l.COMPRESSED_RGBA_ASTC_4x4_KHR;if(i===Ei)return f===We?l.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:l.COMPRESSED_RGBA_ASTC_5x4_KHR;if(i===Mi)return f===We?l.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:l.COMPRESSED_RGBA_ASTC_5x5_KHR;if(i===Ti)return f===We?l.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:l.COMPRESSED_RGBA_ASTC_6x5_KHR;if(i===xi)return f===We?l.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:l.COMPRESSED_RGBA_ASTC_6x6_KHR;if(i===Ri)return f===We?l.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:l.COMPRESSED_RGBA_ASTC_8x5_KHR;if(i===Ai)return f===We?l.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:l.COMPRESSED_RGBA_ASTC_8x6_KHR;if(i===bi)return f===We?l.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:l.COMPRESSED_RGBA_ASTC_8x8_KHR;if(i===Ci)return f===We?l.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:l.COMPRESSED_RGBA_ASTC_10x5_KHR;if(i===Li)return f===We?l.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:l.COMPRESSED_RGBA_ASTC_10x6_KHR;if(i===Pi)return f===We?l.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:l.COMPRESSED_RGBA_ASTC_10x8_KHR;if(i===wi)return f===We?l.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:l.COMPRESSED_RGBA_ASTC_10x10_KHR;if(i===Di)return f===We?l.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:l.COMPRESSED_RGBA_ASTC_12x10_KHR;if(i===Ni)return f===We?l.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:l.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(i===Ui||i===Ii||i===yi)if(l=a.get("EXT_texture_compression_bptc"),l!==null){if(i===Ui)return f===We?l.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:l.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(i===Ii)return l.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(i===yi)return l.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(i===Oi||i===Fi||i===Ga||i===Bi)if(l=a.get("EXT_texture_compression_rgtc"),l!==null){if(i===Oi)return l.COMPRESSED_RED_RGTC1_EXT;if(i===Fi)return l.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(i===Ga)return l.COMPRESSED_RED_GREEN_RGTC2_EXT;if(i===Bi)return l.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return i===$t?e.UNSIGNED_INT_24_8:e[i]!==void 0?e[i]:null}return{convert:t}}const ad=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,id=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;class rd{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(a,t){if(this.texture===null){const i=new xr(a.texture);(a.depthNear!==t.depthNear||a.depthFar!==t.depthFar)&&(this.depthNear=a.depthNear,this.depthFar=a.depthFar),this.texture=i}}getMesh(a){if(this.texture!==null&&this.mesh===null){const t=a.cameras[0].viewport,i=new jt({vertexShader:ad,fragmentShader:id,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new kt(new Mr(20,20),i)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class nd extends Fn{constructor(a,t){super();const i=this;let c=null,l=1,f=null,g="local-floor",y=1,L=null,V=null,F=null,v=null,T=null,w=null;const B=typeof XRWebGLBinding<"u",u=new rd,s={},_=t.getContextAttributes();let D=null,S=null;const C=[],x=[],n=new gt;let p=null,Y=null;const N=new Aa;N.viewport=new ht;const O=new Aa;O.viewport=new ht;const W=[N,O],k=new Bn;let R=null,Q=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(z){let fe=C[z];return fe===void 0&&(fe=new ba,C[z]=fe),fe.getTargetRaySpace()},this.getControllerGrip=function(z){let fe=C[z];return fe===void 0&&(fe=new ba,C[z]=fe),fe.getGripSpace()},this.getHand=function(z){let fe=C[z];return fe===void 0&&(fe=new ba,C[z]=fe),fe.getHandSpace()};function q(z){const fe=x.indexOf(z.inputSource);if(fe===-1)return;const Se=C[fe];Se!==void 0&&(Se.update(z.inputSource,z.frame,L||f),Se.dispatchEvent({type:z.type,data:z.inputSource}))}function H(){c.removeEventListener("select",q),c.removeEventListener("selectstart",q),c.removeEventListener("selectend",q),c.removeEventListener("squeeze",q),c.removeEventListener("squeezestart",q),c.removeEventListener("squeezeend",q),c.removeEventListener("end",H),c.removeEventListener("inputsourceschange",ae);for(let z=0;z<C.length;z++){const fe=x[z];fe!==null&&(x[z]=null,C[z].disconnect(fe))}R=null,Q=null,u.reset();for(const z in s)delete s[z];if(a.setRenderTarget(D),T=null,v=null,F=null,c=null,S=null,Ne.stop(),i.isPresenting=!1,a.setPixelRatio(p),a.setSize(n.width,n.height,!1),Y!==null){const z=Y.camera;z.fov=Y.fov,z.zoom=Y.zoom,z.updateProjectionMatrix(),Y=null}i.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(z){l=z,i.isPresenting===!0&&Ge("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(z){g=z,i.isPresenting===!0&&Ge("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return L||f},this.setReferenceSpace=function(z){L=z},this.getBaseLayer=function(){return v!==null?v:T},this.getBinding=function(){return F===null&&B&&(F=new XRWebGLBinding(c,t)),F},this.getFrame=function(){return w},this.getSession=function(){return c},this.setSession=async function(z){if(c=z,c!==null){if(D=a.getRenderTarget(),c.addEventListener("select",q),c.addEventListener("selectstart",q),c.addEventListener("selectend",q),c.addEventListener("squeeze",q),c.addEventListener("squeezestart",q),c.addEventListener("squeezeend",q),c.addEventListener("end",H),c.addEventListener("inputsourceschange",ae),_.xrCompatible!==!0&&await t.makeXRCompatible(),p=a.getPixelRatio(),a.getSize(n),B&&"createProjectionLayer"in XRWebGLBinding.prototype){let fe=null,Se=null,be=null;_.depth&&(be=_.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,fe=_.stencil?Wt:oa,Se=_.stencil?$t:Xt);const ge={colorFormat:t.RGBA8,depthFormat:be,scaleFactor:l};F=this.getBinding(),v=F.createProjectionLayer(ge),c.updateRenderState({layers:[v]}),a.setPixelRatio(1),a.setSize(v.textureWidth,v.textureHeight,!1),S=new Pt(v.textureWidth,v.textureHeight,{format:Ot,type:Lt,depthTexture:new ra(v.textureWidth,v.textureHeight,Se,void 0,void 0,void 0,void 0,void 0,void 0,fe),stencilBuffer:_.stencil,colorSpace:a.outputColorSpace,samples:_.antialias?4:0,resolveDepthBuffer:v.ignoreDepthValues===!1,resolveStencilBuffer:v.ignoreDepthValues===!1,storeMultisampledDepthBuffer:v.ignoreDepthValues===!1,storeMultisampledStencilBuffer:v.ignoreDepthValues===!1})}else{const fe={antialias:_.antialias,alpha:!0,depth:_.depth,stencil:_.stencil,framebufferScaleFactor:l};T=new XRWebGLLayer(c,t,fe),c.updateRenderState({baseLayer:T}),a.setPixelRatio(1),a.setSize(T.framebufferWidth,T.framebufferHeight,!1),S=new Pt(T.framebufferWidth,T.framebufferHeight,{format:Ot,type:Lt,colorSpace:a.outputColorSpace,stencilBuffer:_.stencil,resolveDepthBuffer:T.ignoreDepthValues===!1,resolveStencilBuffer:T.ignoreDepthValues===!1,storeMultisampledDepthBuffer:T.ignoreDepthValues===!1,storeMultisampledStencilBuffer:T.ignoreDepthValues===!1})}S.isXRRenderTarget=!0,this.setFoveation(y),L=null,f=await c.requestReferenceSpace(g),Ne.setContext(c),Ne.start(),i.isPresenting=!0,i.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(c!==null)return c.environmentBlendMode},this.getDepthTexture=function(){return u.getDepthTexture()};function ae(z){for(let fe=0;fe<z.removed.length;fe++){const Se=z.removed[fe],be=x.indexOf(Se);be>=0&&(x[be]=null,C[be].disconnect(Se))}for(let fe=0;fe<z.added.length;fe++){const Se=z.added[fe];let be=x.indexOf(Se);if(be===-1){for(let xe=0;xe<C.length;xe++)if(xe>=x.length){x.push(Se),be=xe;break}else if(x[xe]===null){x[xe]=Se,be=xe;break}if(be===-1)break}const ge=C[be];ge&&ge.connect(Se)}}function X(z,fe){fe===null?z.matrixWorld.copy(z.matrix):z.matrixWorld.multiplyMatrices(fe.matrixWorld,z.matrix),z.matrixWorldInverse.copy(z.matrixWorld).invert()}this.updateCamera=function(z){if(c===null)return;let fe=z.near,Se=z.far;u.texture!==null&&(u.depthNear>0&&(fe=u.depthNear),u.depthFar>0&&(Se=u.depthFar)),k.near=O.near=N.near=fe,k.far=O.far=N.far=Se,(R!==k.near||Q!==k.far)&&(c.updateRenderState({depthNear:k.near,depthFar:k.far}),R=k.near,Q=k.far),k.layers.mask=z.layers.mask|6,N.layers.mask=k.layers.mask&-5,O.layers.mask=k.layers.mask&-3;const be=z.parent,ge=k.cameras;X(k,be);for(let xe=0;xe<ge.length;xe++)X(ge[xe],be);k.projectionMatrix.copy(N.projectionMatrix),k.projectionMatrixInverse.copy(N.projectionMatrixInverse),Y===null&&z.isPerspectiveCamera&&(Y={camera:z,fov:z.fov,zoom:z.zoom}),Z(z,k,be)};function Z(z,fe,Se){Se===null?z.matrix.copy(fe.matrixWorld):(z.matrix.copy(Se.matrixWorld),z.matrix.invert(),z.matrix.multiply(fe.matrixWorld)),z.matrix.decompose(z.position,z.quaternion,z.scale),z.updateMatrixWorld(!0),z.projectionMatrix.copy(fe.projectionMatrix),z.projectionMatrixInverse.copy(fe.projectionMatrixInverse),z.isPerspectiveCamera&&(z.fov=Gn*2*Math.atan(1/z.projectionMatrix.elements[5]),z.zoom=1)}this.getCamera=function(){return k},this.getFoveation=function(){if(!(v===null&&T===null))return y},this.setFoveation=function(z){y=z,v!==null&&(v.fixedFoveation=z),T!==null&&T.fixedFoveation!==void 0&&(T.fixedFoveation=z)},this.hasDepthSensing=function(){return u.texture!==null},this.getDepthSensingMesh=function(){return u.getMesh(k)},this.getCameraTexture=function(z){return s[z]};let ie=null;function Pe(z,fe){if(V=fe.getViewerPose(L||f),w=fe,V!==null){const Se=V.views;T!==null&&(a.setRenderTargetFramebuffer(S,T.framebuffer),a.setRenderTarget(S));let be=!1;Se.length!==k.cameras.length&&(k.cameras.length=0,be=!0);for(let xe=0;xe<Se.length;xe++){const $e=Se[xe];let we=null;if(T!==null)we=T.getViewport($e);else{const at=F.getViewSubImage(v,$e);we=at.viewport,xe===0&&(a.setRenderTargetTextures(S,at.colorTexture,at.depthStencilTexture),a.setRenderTarget(S))}let ye=W[xe];ye===void 0&&(ye=new Aa,ye.layers.enable(xe),ye.viewport=new ht,W[xe]=ye),ye.matrix.fromArray($e.transform.matrix),ye.matrix.decompose(ye.position,ye.quaternion,ye.scale),ye.projectionMatrix.fromArray($e.projectionMatrix),ye.projectionMatrixInverse.copy(ye.projectionMatrix).invert(),ye.viewport.set(we.x,we.y,we.width,we.height),xe===0&&(k.matrix.copy(ye.matrix),k.matrix.decompose(k.position,k.quaternion,k.scale)),be===!0&&k.cameras.push(ye)}const ge=c.enabledFeatures;if(ge&&ge.includes("depth-sensing")&&c.depthUsage=="gpu-optimized"&&B){F=i.getBinding();const xe=F.getDepthInformation(Se[0]);xe&&xe.isValid&&xe.texture&&u.init(xe,c.renderState)}if(ge&&ge.includes("camera-access")&&B){a.state.unbindTexture(),F=i.getBinding();for(let xe=0;xe<Se.length;xe++){const $e=Se[xe].camera;if($e){let we=s[$e];we||(we=new xr,s[$e]=we);const ye=F.getCameraImage($e);we.sourceTexture=ye}}}}for(let Se=0;Se<C.length;Se++){const be=x[Se],ge=C[Se];be!==null&&ge!==void 0&&ge.update(be,fe,L||f)}ie&&ie(z,fe),fe.detectedPlanes&&i.dispatchEvent({type:"planesdetected",data:fe}),w=null}const Ne=new Ir;Ne.setAnimationLoop(Pe),this.setAnimationLoop=function(z){ie=z},this.dispose=function(){}}}const od=new qt,kr=new Ie;kr.set(-1,0,0,0,1,0,0,0,1);function sd(e,a){function t(u,s){u.matrixAutoUpdate===!0&&u.updateMatrix(),s.value.copy(u.matrix)}function i(u,s){s.color.getRGB(u.fogColor.value,Tr(e)),s.isFog?(u.fogNear.value=s.near,u.fogFar.value=s.far):s.isFogExp2&&(u.fogDensity.value=s.density)}function c(u,s,_,D,S){s.isNodeMaterial?s.uniformsNeedUpdate=!1:s.isMeshBasicMaterial?l(u,s):s.isMeshLambertMaterial?(l(u,s),s.envMap&&(u.envMapIntensity.value=s.envMapIntensity)):s.isMeshToonMaterial?(l(u,s),F(u,s)):s.isMeshPhongMaterial?(l(u,s),V(u,s),s.envMap&&(u.envMapIntensity.value=s.envMapIntensity)):s.isMeshStandardMaterial?(l(u,s),v(u,s),s.isMeshPhysicalMaterial&&T(u,s,S)):s.isMeshMatcapMaterial?(l(u,s),w(u,s)):s.isMeshDepthMaterial?l(u,s):s.isMeshDistanceMaterial?(l(u,s),B(u,s)):s.isMeshNormalMaterial?l(u,s):s.isLineBasicMaterial?(f(u,s),s.isLineDashedMaterial&&g(u,s)):s.isPointsMaterial?y(u,s,_,D):s.isSpriteMaterial?L(u,s):s.isShadowMaterial?(u.color.value.copy(s.color),u.opacity.value=s.opacity):s.isShaderMaterial&&(s.uniformsNeedUpdate=!1)}function l(u,s){u.opacity.value=s.opacity,s.color&&u.diffuse.value.copy(s.color),s.emissive&&u.emissive.value.copy(s.emissive).multiplyScalar(s.emissiveIntensity),s.map&&(u.map.value=s.map,t(s.map,u.mapTransform)),s.alphaMap&&(u.alphaMap.value=s.alphaMap,t(s.alphaMap,u.alphaMapTransform)),s.bumpMap&&(u.bumpMap.value=s.bumpMap,t(s.bumpMap,u.bumpMapTransform),u.bumpScale.value=s.bumpScale,s.side===vt&&(u.bumpScale.value*=-1)),s.normalMap&&(u.normalMap.value=s.normalMap,t(s.normalMap,u.normalMapTransform),u.normalScale.value.copy(s.normalScale),s.side===vt&&u.normalScale.value.negate()),s.displacementMap&&(u.displacementMap.value=s.displacementMap,t(s.displacementMap,u.displacementMapTransform),u.displacementScale.value=s.displacementScale,u.displacementBias.value=s.displacementBias),s.emissiveMap&&(u.emissiveMap.value=s.emissiveMap,t(s.emissiveMap,u.emissiveMapTransform)),s.specularMap&&(u.specularMap.value=s.specularMap,t(s.specularMap,u.specularMapTransform)),s.alphaTest>0&&(u.alphaTest.value=s.alphaTest);const _=a.get(s),D=_.envMap,S=_.envMapRotation;D&&(u.envMap.value=D,u.envMapRotation.value.setFromMatrix4(od.makeRotationFromEuler(S)).transpose(),D.isCubeTexture&&D.isRenderTargetTexture===!1&&u.envMapRotation.value.premultiply(kr),u.reflectivity.value=s.reflectivity,u.ior.value=s.ior,u.refractionRatio.value=s.refractionRatio),s.lightMap&&(u.lightMap.value=s.lightMap,u.lightMapIntensity.value=s.lightMapIntensity,t(s.lightMap,u.lightMapTransform)),s.aoMap&&(u.aoMap.value=s.aoMap,u.aoMapIntensity.value=s.aoMapIntensity,t(s.aoMap,u.aoMapTransform))}function f(u,s){u.diffuse.value.copy(s.color),u.opacity.value=s.opacity,s.map&&(u.map.value=s.map,t(s.map,u.mapTransform))}function g(u,s){u.dashSize.value=s.dashSize,u.totalSize.value=s.dashSize+s.gapSize,u.scale.value=s.scale}function y(u,s,_,D){u.diffuse.value.copy(s.color),u.opacity.value=s.opacity,u.size.value=s.size*_,u.scale.value=D*.5,s.map&&(u.map.value=s.map,t(s.map,u.uvTransform)),s.alphaMap&&(u.alphaMap.value=s.alphaMap,t(s.alphaMap,u.alphaMapTransform)),s.alphaTest>0&&(u.alphaTest.value=s.alphaTest)}function L(u,s){u.diffuse.value.copy(s.color),u.opacity.value=s.opacity,u.rotation.value=s.rotation,s.map&&(u.map.value=s.map,t(s.map,u.mapTransform)),s.alphaMap&&(u.alphaMap.value=s.alphaMap,t(s.alphaMap,u.alphaMapTransform)),s.alphaTest>0&&(u.alphaTest.value=s.alphaTest)}function V(u,s){u.specular.value.copy(s.specular),u.shininess.value=Math.max(s.shininess,1e-4)}function F(u,s){s.gradientMap&&(u.gradientMap.value=s.gradientMap)}function v(u,s){u.metalness.value=s.metalness,s.metalnessMap&&(u.metalnessMap.value=s.metalnessMap,t(s.metalnessMap,u.metalnessMapTransform)),u.roughness.value=s.roughness,s.roughnessMap&&(u.roughnessMap.value=s.roughnessMap,t(s.roughnessMap,u.roughnessMapTransform)),s.envMap&&(u.envMapIntensity.value=s.envMapIntensity)}function T(u,s,_){u.ior.value=s.ior,s.diffuseRoughness>0&&(u.diffuseRoughness.value=s.diffuseRoughness,s.diffuseRoughnessMap&&(u.diffuseRoughnessMap.value=s.diffuseRoughnessMap,t(s.diffuseRoughnessMap,u.diffuseRoughnessMapTransform))),s.sheen>0&&(u.sheenColor.value.copy(s.sheenColor).multiplyScalar(s.sheen),u.sheenRoughness.value=s.sheenRoughness,s.sheenColorMap&&(u.sheenColorMap.value=s.sheenColorMap,t(s.sheenColorMap,u.sheenColorMapTransform)),s.sheenRoughnessMap&&(u.sheenRoughnessMap.value=s.sheenRoughnessMap,t(s.sheenRoughnessMap,u.sheenRoughnessMapTransform))),s.clearcoat>0&&(u.clearcoat.value=s.clearcoat,u.clearcoatRoughness.value=s.clearcoatRoughness,s.clearcoatMap&&(u.clearcoatMap.value=s.clearcoatMap,t(s.clearcoatMap,u.clearcoatMapTransform)),s.clearcoatRoughnessMap&&(u.clearcoatRoughnessMap.value=s.clearcoatRoughnessMap,t(s.clearcoatRoughnessMap,u.clearcoatRoughnessMapTransform)),s.clearcoatNormalMap&&(u.clearcoatNormalMap.value=s.clearcoatNormalMap,t(s.clearcoatNormalMap,u.clearcoatNormalMapTransform),u.clearcoatNormalScale.value.copy(s.clearcoatNormalScale),s.side===vt&&u.clearcoatNormalScale.value.negate())),s.dispersion>0&&(u.dispersion.value=s.dispersion),s.retroreflectivity>0&&(u.retroreflectivity.value=s.retroreflectivity),s.iridescence>0&&(u.iridescence.value=s.iridescence,u.iridescenceIOR.value=s.iridescenceIOR,u.iridescenceThicknessMinimum.value=s.iridescenceThicknessMinimum,u.iridescenceThicknessMaximum.value=s.iridescenceThicknessMaximum,s.iridescenceMap&&(u.iridescenceMap.value=s.iridescenceMap,t(s.iridescenceMap,u.iridescenceMapTransform)),s.iridescenceThicknessMap&&(u.iridescenceThicknessMap.value=s.iridescenceThicknessMap,t(s.iridescenceThicknessMap,u.iridescenceThicknessMapTransform))),s.transmission>0&&(u.transmission.value=s.transmission,u.transmissionSamplerMap.value=_.texture,u.transmissionSamplerSize.value.set(_.width,_.height),s.transmissionMap&&(u.transmissionMap.value=s.transmissionMap,t(s.transmissionMap,u.transmissionMapTransform)),u.thickness.value=s.thickness,s.thicknessMap&&(u.thicknessMap.value=s.thicknessMap,t(s.thicknessMap,u.thicknessMapTransform)),u.attenuationDistance.value=s.attenuationDistance,u.attenuationColor.value.copy(s.attenuationColor)),s.anisotropy>0&&(u.anisotropyVector.value.set(s.anisotropy*Math.cos(s.anisotropyRotation),s.anisotropy*Math.sin(s.anisotropyRotation)),s.anisotropyMap&&(u.anisotropyMap.value=s.anisotropyMap,t(s.anisotropyMap,u.anisotropyMapTransform))),u.specularIntensity.value=s.specularIntensity,u.specularColor.value.copy(s.specularColor),s.specularColorMap&&(u.specularColorMap.value=s.specularColorMap,t(s.specularColorMap,u.specularColorMapTransform)),s.specularIntensityMap&&(u.specularIntensityMap.value=s.specularIntensityMap,t(s.specularIntensityMap,u.specularIntensityMapTransform))}function w(u,s){s.matcap&&(u.matcap.value=s.matcap)}function B(u,s){const _=a.get(s).light;u.referencePosition.value.setFromMatrixPosition(_.matrixWorld),u.nearDistance.value=_.shadow.camera.near,u.farDistance.value=_.shadow.camera.far}return{refreshFogUniforms:i,refreshMaterialUniforms:c}}function ld(e,a,t,i){let c={},l={};function f(_,D){const S=D.program;i.uniformBlockBinding(_,S,c[_.id])}function g(_,D){let S=c[_.id];S===void 0&&(w(_),S=y(_),c[_.id]=S,_.addEventListener("dispose",u));const C=D.program;i.updateUBOMapping(_,C);const x=a.render.frame;l[_.id]!==x&&(L(_),l[_.id]=x)}function y(_){const D=e.createBuffer(),S=_.__size,C=_.usage;return e.bindBuffer(e.UNIFORM_BUFFER,D),e.bufferData(e.UNIFORM_BUFFER,S,C),e.bindBuffer(e.UNIFORM_BUFFER,null),D}function L(_){const D=c[_.id],S=_.uniforms,C=_.__cache;e.bindBuffer(e.UNIFORM_BUFFER,D);for(let x=0,n=S.length;x<n;x++){const p=S[x];if(Array.isArray(p))for(let Y=0,N=p.length;Y<N;Y++)V(p[Y],x,Y,C);else V(p,x,0,C)}e.bindBuffer(e.UNIFORM_BUFFER,null)}function V(_,D,S,C){if(v(_,D,S,C)===!0){const x=_.__offset,n=_.value;if(Array.isArray(n)){let p=0;for(let Y=0;Y<n.length;Y++){const N=n[Y],O=B(N,!0);F(N,_.__data,p),p+=O.storage/Float32Array.BYTES_PER_ELEMENT}}else F(n,_.__data,0);e.bufferSubData(e.UNIFORM_BUFFER,x,_.__data)}}function F(_,D,S){typeof _=="number"||typeof _=="boolean"?D[S]=_:_.isMatrix3?(D[S]=_.elements[0],D[S+1]=_.elements[1],D[S+2]=_.elements[2],D[S+3]=0,D[S+4]=_.elements[3],D[S+5]=_.elements[4],D[S+6]=_.elements[5],D[S+7]=0,D[S+8]=_.elements[6],D[S+9]=_.elements[7],D[S+10]=_.elements[8],D[S+11]=0):ArrayBuffer.isView(_)?D.set(_.subarray(0,D.length-S),S):_.toArray(D,S)}function v(_,D,S,C){const x=_.value,n=D+"_"+S;if(Array.isArray(x)){C[n]===void 0&&(C[n]=[]);const p=C[n];let Y=!1;for(let N=0;N<x.length;N++)T(x[N],p,N)===!0&&(Y=!0);return Y}return T(x,C,n)}function T(_,D,S){if(D[S]===void 0)return typeof _=="number"||typeof _=="boolean"?D[S]=_:ArrayBuffer.isView(_)?D[S]=_.slice():D[S]=_.clone(),!0;{const C=D[S];if(typeof _=="number"||typeof _=="boolean"){if(C!==_)return D[S]=_,!0}else{if(ArrayBuffer.isView(_))return!0;if(C.equals(_)===!1)return C.copy(_),!0}}return!1}function w(_){const D=_.uniforms;let S=0;const C=16;for(let n=0,p=D.length;n<p;n++){const Y=Array.isArray(D[n])?D[n]:[D[n]];for(let N=0,O=Y.length;N<O;N++){const W=Y[N],k=Array.isArray(W.value)?W.value:[W.value],R=Array.isArray(D[n])||Array.isArray(W.value);let Q=S;for(let H=0,ae=k.length;H<ae;H++){const X=k[H],Z=B(X,R),ie=S%C,Pe=ie%Z.boundary,Ne=ie+Pe;S+=Pe,Ne!==0&&C-Ne<Z.storage&&(S+=C-Ne),H===0&&(Q=S),S+=Z.storage}const q=W.type==="int"?Int32Array:W.type==="uint"?Uint32Array:Float32Array;W.__data=new q((S-Q)/Float32Array.BYTES_PER_ELEMENT),W.__offset=Q}}const x=S%C;return x>0&&(S+=C-x),_.__size=S,_.__cache={},this}function B(_,D){const S={boundary:0,storage:0};return typeof _=="number"||typeof _=="boolean"?(S.boundary=4,S.storage=4):_.isVector2?(S.boundary=8,S.storage=8):_.isVector3||_.isColor?(S.boundary=16,S.storage=12):_.isVector4?(S.boundary=16,S.storage=16):_.isMatrix3?(S.boundary=16,S.storage=48):_.isMatrix4?(S.boundary=16,S.storage=64):_.isTexture?Ge("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(_)?(S.boundary=16,S.storage=_.byteLength):Ge("WebGLRenderer: Unsupported uniform value type.",_),D===!0&&(S.boundary=16,S.storage=Math.ceil(S.storage/16)*16),S}function u(_){const D=_.target;D.removeEventListener("dispose",u),e.deleteBuffer(c[D.id]),delete c[D.id],delete l[D.id]}function s(){for(const _ in c)e.deleteBuffer(c[_]);c={},l={}}return{bind:f,update:g,dispose:s}}const cd=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]);let bt=null;function ud(){return bt===null&&(bt=new Hn(cd,16,16,Zt,Ut),bt.name="DFG_LUT",bt.minFilter=Rt,bt.magFilter=Rt,bt.wrapS=ya,bt.wrapT=ya,bt.generateMipmaps=!1,bt.needsUpdate=!0),bt}class fd{constructor(a={}){const{canvas:t=Jr(),context:i=null,depth:c=!0,stencil:l=!1,alpha:f=!1,antialias:g=!1,premultipliedAlpha:y=!0,preserveDrawingBuffer:L=!1,powerPreference:V="default",failIfMajorPerformanceCaveat:F=!1,reversedDepthBuffer:v=!1,outputBufferType:T=Lt}=a;this.isWebGLRenderer=!0;let w;if(i!==null){if(typeof WebGLRenderingContext<"u"&&i instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");w=i.getContextAttributes().alpha}else w=f;const B=T,u=new Set([gr,_r,vr]),s=new Set([Lt,Xt,_a,$t,Sr,Er]),_=new Uint32Array(4),D=new Int32Array(4),S={textures:[],min:[],max:[],resolution:[]};let C=null,x=null;const n=[],p=[];let Y=null;this.domElement=t,this.debug={checkShaderErrors:!0,diagnostics:{keywords:!1},onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=Nt,this.toneMappingExposure=1,this.transmissionResolutionScale=1;const N=this;let O=!1,W=null,k=null,R=null,Q=null;this._outputColorSpace=en;let q=0,H=0,ae=null,X=-1,Z=null;const ie=new ht,Pe=new ht;let Ne=null;const z=new Ze(0);let fe=0,Se=t.width,be=t.height,ge=1,xe=null,$e=null;const we=new ht(0,0,Se,be),ye=new ht(0,0,Se,be);let at=!1;const lt=new dr,_t=new an;let it=!1,pt=!1;const Qe=new qt,At=new He,st=new ht,St={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let Et=!1;function Mt(){return ae===null?ge:1}let E=i;function Tt(o,h){return t.getContext(o,h)}let Ke,Ye,re,rt,Re,Ce,d,r,P,$,G,ce,ne,M,K,pe,m,I,j,ee,oe,te,Me;try{const o={alpha:!0,depth:c,stencil:l,antialias:g,premultipliedAlpha:y,preserveDrawingBuffer:L,powerPreference:V,failIfMajorPerformanceCaveat:F};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${tn}`),t.addEventListener("webglcontextlost",Ae,!1),t.addEventListener("webglcontextrestored",Ue,!1),t.addEventListener("webglcontextcreationerror",me,!1),E===null){const h="webgl2";if(E=Tt(h,o),E===null)throw Tt(h)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}se()}catch(o){throw t.removeEventListener("webglcontextlost",Ae,!1),t.removeEventListener("webglcontextrestored",Ue,!1),t.removeEventListener("webglcontextcreationerror",me,!1),je("WebGLRenderer: "+o.message),o}function se(){Ke=new mc(E),Ke.init(),oe=new td(E,Ke),Ye=new ic(E,Ke,a,oe),re=new Ju(E,Ke),Ye.reversedDepthBuffer&&v&&re.buffers.depth.setReversed(!0),k=E.createFramebuffer(),R=E.createFramebuffer(),Q=E.createFramebuffer(),rt=new _c(E),Re=new Gu,Ce=new ed(E,Ke,re,Re,Ye,oe,rt),d=new pc(N),r=new So(E),te=new tc(E,r),P=new hc(E,r,rt,te),$=new Sc(E,P,r,te,rt),I=new vc(E,Ye,Ce),K=new rc(Re),G=new Bu(N,d,Ke,Ye,te,K),ce=new sd(N,Re),ne=new Vu,M=new Yu(Ke),m=new ec(N,d,re,$,w,y),pe=new Qu(N,$,Ye),Me=new ld(E,rt,Ye,re),j=new ac(E,Ke,rt),ee=new gc(E,Ke,rt),rt.programs=G.programs,N.capabilities=Ye,N.extensions=Ke,N.properties=Re,N.renderLists=ne,N.shadowMap=pe,N.state=re,N.info=rt}B!==Lt&&(Y=new Mc(B,t.width,t.height,g,c,l));const ve=new nd(N,E);this.xr=ve,this.getContext=function(){return E},this.getContextAttributes=function(){return E.getContextAttributes()},this.forceContextLoss=function(){const o=Ke.get("WEBGL_lose_context");o&&o.loseContext()},this.forceContextRestore=function(){const o=Ke.get("WEBGL_lose_context");o&&o.restoreContext()},this.getPixelRatio=function(){return ge},this.setPixelRatio=function(o){o!==void 0&&(ge=o,this.setSize(Se,be,!1))},this.getSize=function(o){return o.set(Se,be)},this.setSize=function(o,h,U=!0){if(ve.isPresenting){Ge("WebGLRenderer: Can't change size while VR device is presenting.");return}Se=o,be=h,t.width=Math.floor(o*ge),t.height=Math.floor(h*ge),U===!0&&(t.style.width=o+"px",t.style.height=h+"px"),Y!==null&&Y.setSize(t.width,t.height),this.setViewport(0,0,o,h)},this.getDrawingBufferSize=function(o){return o.set(Se*ge,be*ge).floor()},this.setDrawingBufferSize=function(o,h,U){Se=o,be=h,ge=U,t.width=Math.floor(o*U),t.height=Math.floor(h*U),this.setViewport(0,0,o,h)},this.setEffects=function(o){if(B===Lt){je("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(o){for(let h=0;h<o.length;h++)if(o[h].isOutputPass===!0){Ge("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}Y.setEffects(o||[])},this.getCurrentViewport=function(o){return o.copy(ie)},this.getViewport=function(o){return o.copy(we)},this.setViewport=function(o,h,U,b){o.isVector4?we.set(o.x,o.y,o.z,o.w):we.set(o,h,U,b),re.viewport(ie.copy(we).multiplyScalar(Mt()).round())},this.getScissor=function(o){return o.copy(ye)},this.setScissor=function(o,h,U,b){o.isVector4?ye.set(o.x,o.y,o.z,o.w):ye.set(o,h,U,b),re.scissor(Pe.copy(ye).multiplyScalar(Mt()).round())},this.getScissorTest=function(){return at},this.setScissorTest=function(o){re.setScissorTest(at=o)},this.setOpaqueSort=function(o){xe=o},this.setTransparentSort=function(o){$e=o},this.getClearColor=function(o){return o.copy(m.getClearColor())},this.setClearColor=function(){m.setClearColor(...arguments)},this.getClearAlpha=function(){return m.getClearAlpha()},this.setClearAlpha=function(){m.setClearAlpha(...arguments)},this.clear=function(o=!0,h=!0,U=!0){let b=0;if(o){let A=!1;if(ae!==null){const J=ae.texture.format;A=u.has(J)}if(A){const J=ae.texture.type,ue=s.has(J),le=m.getClearColor(),he=m.getClearAlpha(),Te=le.r,De=le.g,Oe=le.b;ue?(_[0]=Te,_[1]=De,_[2]=Oe,_[3]=he,E.clearBufferuiv(E.COLOR,0,_)):(D[0]=Te,D[1]=De,D[2]=Oe,D[3]=he,E.clearBufferiv(E.COLOR,0,D))}else b|=E.COLOR_BUFFER_BIT}h&&(b|=E.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),U&&(b|=E.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),b!==0&&E.clear(b)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(o){o.setRenderer(this),W=o},this.dispose=function(){t.removeEventListener("webglcontextlost",Ae,!1),t.removeEventListener("webglcontextrestored",Ue,!1),t.removeEventListener("webglcontextcreationerror",me,!1),m.dispose(),ne.dispose(),M.dispose(),Ce.dispose(),Re.dispose(),d.dispose(),$.dispose(),P.dispose(),te.dispose(),Me.dispose(),G.dispose(),ve.dispose(),ve.removeEventListener("sessionstart",ka),ve.removeEventListener("sessionend",Xa),Ft.stop()};function Ae(o){o.preventDefault(),ei("WebGLRenderer: Context Lost."),O=!0}function Ue(){ei("WebGLRenderer: Context Restored."),O=!1;const o=rt.autoReset,h=pe.enabled,U=pe.autoUpdate,b=pe.needsUpdate,A=pe.type;se(),rt.autoReset=o,pe.enabled=h,pe.autoUpdate=U,pe.needsUpdate=b,pe.type=A}function me(o){je("WebGLRenderer: A WebGL context could not be created. Reason: ",o.statusMessage)}function ke(o){const h=o.target;h.removeEventListener("dispose",ke),qe(h)}function qe(o){Xr(o),Re.remove(o)}function Xr(o){const h=Re.get(o).programs;h!==void 0&&(h.forEach(function(U){G.releaseProgram(U)}),o.isShaderMaterial&&G.releaseShaderCache(o))}this.renderBufferDirect=function(o,h,U,b,A,J){h===null&&(h=St);const ue=A.isMesh&&A.matrixWorld.determinantAffine()<0,le=qr(o,h,U,b,A);re.setMaterial(b,ue);let he=U.index,Te=1;if(b.wireframe===!0){if(he=P.getWireframeAttribute(U),he===void 0)return;Te=2}const De=U.drawRange,Oe=U.attributes.position;let _e=De.start*Te,Be=(De.start+De.count)*Te;J!==null&&(_e=Math.max(_e,J.start*Te),Be=Math.min(Be,(J.start+J.count)*Te)),he!==null?(_e=Math.max(_e,0),Be=Math.min(Be,he.count)):Oe!=null&&(_e=Math.max(_e,0),Be=Math.min(Be,Oe.count));const tt=Be-_e;if(tt<0||tt===1/0)return;te.setup(A,b,le,U,he);let Ve,ze=j;if(he!==null&&(Ve=r.get(he),ze=ee,ze.setIndex(Ve)),A.isMesh)b.wireframe===!0?(re.setLineWidth(b.wireframeLinewidth*Mt()),ze.setMode(E.LINES)):ze.setMode(E.TRIANGLES);else if(A.isLine){let et=b.linewidth;et===void 0&&(et=1),re.setLineWidth(et*Mt()),A.isLineSegments?ze.setMode(E.LINES):A.isLineLoop?ze.setMode(E.LINE_LOOP):ze.setMode(E.LINE_STRIP)}else A.isPoints?ze.setMode(E.POINTS):A.isSprite&&ze.setMode(E.TRIANGLES);if(A.isBatchedMesh)if(Ke.get("WEBGL_multi_draw"))ze.renderMultiDraw(A._multiDrawStarts,A._multiDrawCounts,A._multiDrawCount);else{const et=A._multiDrawStarts,Ee=A._multiDrawCounts,dt=A._multiDrawCount,Bt=he?r.get(he).bytesPerElement:1,Gt=Re.get(b).currentProgram.getUniforms();for(let ut=0;ut<dt;ut++)Gt.setValue(E,"_gl_DrawID",ut),ze.render(et[ut]/Bt,Ee[ut])}else if(A.isInstancedMesh)ze.renderInstances(_e,tt,A.count);else if(U.isInstancedBufferGeometry){const et=U._maxInstanceCount!==void 0?U._maxInstanceCount:1/0,Ee=Math.min(U.instanceCount,et);ze.renderInstances(_e,tt,Ee)}else ze.render(_e,tt)};function Wa(o,h,U,b){W!==null&&o.isNodeMaterial&&W.setObject(b,o),it===!0&&K.setState(o,U,!1),o.transparent===!0&&o.side===Dt&&o.forceSinglePass===!1?(o.side=vt,o.needsUpdate=!0,Jt(o,h,b),o.side=na,o.needsUpdate=!0,Jt(o,h,b),o.side=Dt):Jt(o,h,b)}this.compile=function(o,h,U=null){U===null&&(U=o),W!==null&&W.renderStart(o,h,U),x=M.get(U),x.init(h),p.push(x),U.traverseVisible(function(A){A.isLight&&A.layers.test(h.layers)&&(x.pushLight(A),A.castShadow&&x.pushShadow(A))}),o!==U&&o.traverseVisible(function(A){A.isLight&&A.layers.test(h.layers)&&(x.pushLight(A),A.castShadow&&x.pushShadow(A))}),x.setupLights(),W!==null&&W.updateLights(x.state.lightsArray),pt=this.localClippingEnabled,it=K.init(this.clippingPlanes,pt),it===!0&&K.setGlobalState(this.clippingPlanes,h),W!==null&&pe.render(x.state.shadowsArray,U,h);const b=new Set;return o.traverse(function(A){if(!(A.isMesh||A.isPoints||A.isLine||A.isSprite))return;const J=A.material;if(J)if(Array.isArray(J))for(let ue=0;ue<J.length;ue++){const le=J[ue];Wa(le,U,h,A),b.add(le)}else Wa(J,U,h,A),b.add(J)}),x=p.pop(),W!==null&&W.renderEnd(),b},this.compileAsync=function(o,h,U=null){const b=this.compile(o,h,U);return new Promise(A=>{function J(){if(b.forEach(function(ue){const le=Re.get(ue).currentProgram;(le===void 0||le.isReady())&&b.delete(ue)}),b.size===0){A(o);return}setTimeout(J,10)}Ke.get("KHR_parallel_shader_compile")!==null?J():setTimeout(J,10)})};let Ta=null;function Kr(o){Ta&&Ta(o)}function ka(){Ft.stop()}function Xa(){Ft.start()}const Ft=new Ir;Ft.setAnimationLoop(Kr),typeof self<"u"&&Ft.setContext(self),this.setAnimationLoop=function(o){Ta=o,ve.setAnimationLoop(o),o===null?Ft.stop():Ft.start()},ve.addEventListener("sessionstart",ka),ve.addEventListener("sessionend",Xa),this.render=function(o,h){if(h!==void 0&&h.isCamera!==!0){je("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(O===!0)return;W!==null&&W.renderStart(o,h);const U=ve.enabled===!0&&ve.isPresenting===!0,b=Y!==null&&(ae===null||U)&&Y.begin(N,ae);if(o.matrixWorldAutoUpdate===!0&&o.updateMatrixWorld(),h.parent===null&&h.matrixWorldAutoUpdate===!0&&h.updateMatrixWorld(),ve.enabled===!0&&ve.isPresenting===!0&&(Y===null||Y.isCompositing()===!1)&&(ve.cameraAutoUpdate===!0&&ve.updateCamera(h),h=ve.getCamera()),o.isScene===!0&&o.onBeforeRender(N,o,h,ae),x=M.get(o,p.length),x.init(h),x.state.textureUnits=Ce.getTextureUnits(),p.push(x),Qe.multiplyMatrices(h.projectionMatrix,h.matrixWorldInverse),h.isArrayCamera?_t.setFromArrayCamera(h):lt.setFromProjectionMatrix(Qe,ti,h.reversedDepth),pt=this.localClippingEnabled,it=K.init(this.clippingPlanes,pt),C=ne.get(o,n.length),C.init(),n.push(C),this.info.render.frame++,ve.enabled===!0&&ve.isPresenting===!0){const J=N.xr.getDepthSensingMesh();J!==null&&xa(J,h,-1/0,N.sortObjects)}xa(o,h,0,N.sortObjects),C.finish(),W!==null&&W.updateLights(x.state.lightsArray),N.sortObjects===!0&&C.sort(xe,$e),Et=ve.enabled===!1||ve.isPresenting===!1||ve.hasDepthSensing()===!1,Et&&m.addToRenderList(C,o),this.info.autoReset===!0&&this.info.reset(),it===!0&&K.beginShadows();const A=x.state.shadowsArray;if(pe.render(A,o,h),it===!0&&K.endShadows(),(b&&Y.hasRenderPass())===!1){const J=C.opaque,ue=C.transmissive;if(x.setupLights(),h.isArrayCamera){const le=h.cameras;if(ue.length>0)for(let he=0,Te=le.length;he<Te;he++){const De=le[he];Ya(J,ue,o,De)}Et&&m.render(o);for(let he=0,Te=le.length;he<Te;he++){const De=le[he];Ka(C,o,De,De.viewport)}}else ue.length>0&&Ya(J,ue,o,h),Et&&m.render(o),Ka(C,o,h)}ae!==null&&H===0&&(Ce.updateMultisampleRenderTarget(ae),Ce.updateRenderTargetMipmap(ae)),b&&Y.end(N),o.isScene===!0&&o.onAfterRender(N,o,h),te.resetDefaultState(),X=-1,Z=null,p.pop(),p.length>0?(x=p[p.length-1],Ce.setTextureUnits(x.state.textureUnits),it===!0&&K.setGlobalState(N.clippingPlanes,x.state.camera)):x=null,n.pop(),n.length>0?C=n[n.length-1]:C=null,W!==null&&W.renderEnd()};function xa(o,h,U,b){if(o.visible===!1)return;if(o.layers.test(h.layers)){if(o.isGroup)U=o.renderOrder;else if(o.isLOD)o.autoUpdate===!0&&o.update(h);else if(o.isLight)x.pushLight(o),o.castShadow&&x.pushShadow(o);else if(o.isSprite){const J=h.isArrayCamera?_t:lt;if(!o.frustumCulled||o.intersectsFrustum(J)){b&&st.setFromMatrixPosition(o.matrixWorld).applyMatrix4(Qe);const ue=$.update(o),le=o.material;le.visible&&C.push(o,ue,le,U,st.z,null,h)}}else if(o.isMesh||o.isLine||o.isPoints){const J=h.isArrayCamera?_t:lt;if(!o.frustumCulled||o.intersectsFrustum(J)){const ue=$.update(o),le=o.material;if(b&&(o.boundingSphere!==void 0?(o.boundingSphere===null&&o.computeBoundingSphere(),st.copy(o.boundingSphere.center)):(ue.boundingSphere===null&&ue.computeBoundingSphere(),st.copy(ue.boundingSphere.center)),st.applyMatrix4(o.matrixWorld).applyMatrix4(Qe)),Array.isArray(le)){const he=ue.groups;for(let Te=0,De=he.length;Te<De;Te++){const Oe=he[Te],_e=le[Oe.materialIndex];_e&&_e.visible&&C.push(o,ue,_e,U,st.z,Oe,h)}}else le.visible&&C.push(o,ue,le,U,st.z,null,h)}}}const A=o.children;for(let J=0,ue=A.length;J<ue;J++)xa(A[J],h,U,b)}function Ka(o,h,U,b){const{opaque:A,transmissive:J,transparent:ue}=o;x.setupLightsView(U),it===!0&&K.setGlobalState(N.clippingPlanes,U),b&&re.viewport(ie.copy(b)),A.length>0&&ca(A,h,U),J.length>0&&ca(J,h,U),ue.length>0&&ca(ue,h,U),re.buffers.depth.setTest(!0),re.buffers.depth.setMask(!0),re.buffers.color.setMask(!0),re.setPolygonOffset(!1)}function Ya(o,h,U,b){if((U.isScene===!0?U.overrideMaterial:null)!==null)return;if(x.state.transmissionRenderTarget[b.id]===void 0){const Oe=Ke.has("EXT_color_buffer_half_float")||Ke.has("EXT_color_buffer_float");x.state.transmissionRenderTarget[b.id]=new Pt(1,1,{generateMipmaps:!0,type:Oe?Ut:Lt,minFilter:Vt,samples:Math.max(4,Ye.samples),stencilBuffer:l,resolveDepthBuffer:!1,resolveStencilBuffer:!1,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,colorSpace:Je.workingColorSpace})}const A=x.state.transmissionRenderTarget[b.id],J=b.viewport||ie;A.setSize(J.z*N.transmissionResolutionScale,J.w*N.transmissionResolutionScale);const ue=N.getRenderTarget(),le=N.getActiveCubeFace(),he=N.getActiveMipmapLevel();N.setRenderTarget(A),N.getClearColor(z),fe=N.getClearAlpha(),fe<1&&N.setClearColor(16777215,.5),N.clear(),Et&&m.render(U);const Te=N.toneMapping;N.toneMapping=Nt;const De=b.viewport;if(b.viewport!==void 0&&(b.viewport=void 0),x.setupLightsView(b),it===!0&&K.setGlobalState(N.clippingPlanes,b),ca(o,U,b),Ce.updateMultisampleRenderTarget(A),Ce.updateRenderTargetMipmap(A),Ke.has("WEBGL_multisampled_render_to_texture")===!1){let Oe=!1;for(let _e=0,Be=h.length;_e<Be;_e++){const tt=h[_e],{object:Ve,geometry:ze,material:et,group:Ee}=tt;if(et.side===Dt&&Ve.layers.test(b.layers)){const dt=et.side;et.side=vt,et.needsUpdate=!0,qa(Ve,U,b,ze,et,Ee),et.side=dt,et.needsUpdate=!0,Oe=!0}}Oe===!0&&(Ce.updateMultisampleRenderTarget(A),Ce.updateRenderTargetMipmap(A))}N.setRenderTarget(ue,le,he),N.setClearColor(z,fe),De!==void 0&&(b.viewport=De),N.toneMapping=Te}function ca(o,h,U){const b=h.isScene===!0?h.overrideMaterial:null;for(let A=0,J=o.length;A<J;A++){const ue=o[A],{object:le,geometry:he,group:Te}=ue;let De=ue.material;De.allowOverride===!0&&b!==null&&(De=b),le.layers.test(U.layers)&&qa(le,h,U,he,De,Te)}}function qa(o,h,U,b,A,J){W!==null&&A.isNodeMaterial&&W.setObject(o,A),o.onBeforeRender(N,h,U,b,A,J),o.modelViewMatrix.multiplyMatrices(U.matrixWorldInverse,o.matrixWorld),o.normalMatrix.getNormalMatrix(o.modelViewMatrix),A.onBeforeRender(N,h,U,b,o,J),A.transparent===!0&&A.side===Dt&&A.forceSinglePass===!1?(A.side=vt,A.needsUpdate=!0,N.renderBufferDirect(U,h,b,A,o,J),A.side=na,A.needsUpdate=!0,N.renderBufferDirect(U,h,b,A,o,J),A.side=Dt):N.renderBufferDirect(U,h,b,A,o,J),o.onAfterRender(N,h,U,b,A,J)}function ja(o){let h=0;for(const U of o)U.texture!==null&&h++;return h}function Jt(o,h,U){h.isScene!==!0&&(h=St);const b=Re.get(o),A=x.state.lights,J=x.state.shadowsArray,ue=A.state.version,le=G.getParameters(o,A.state,J,h,U,x.state.lightProbeGridArray),he=G.getProgramCacheKey(le);let Te=b.programs;b.environment=o.isMeshStandardMaterial||o.isMeshLambertMaterial||o.isMeshPhongMaterial?h.environment:null,b.fog=h.fog;const De=o.isMeshStandardMaterial||o.isMeshLambertMaterial&&!o.envMap||o.isMeshPhongMaterial&&!o.envMap;b.envMap=d.get(o.envMap||b.environment,De),b.envMapRotation=b.environment!==null&&o.envMap===null?h.environmentRotation:o.envMapRotation,Te===void 0&&(o.addEventListener("dispose",ke),Te=new Map,b.programs=Te,b.programVariants=new Map);let Oe=Te.get(he);if(Oe!==void 0){if(b.currentProgram===Oe&&b.lightsStateVersion===ue)return $a(o,le),Oe}else le.uniforms=G.getUniforms(o),W!==null&&o.isNodeMaterial&&W.build(o,U,le),o.onBeforeCompile(le,N),Oe=G.acquireProgram(le,he),Te.set(he,Oe),b.uniforms=le.uniforms;const _e=b.uniforms;return(!o.isShaderMaterial&&!o.isRawShaderMaterial||o.clipping===!0)&&(_e.clippingPlanes=K.uniform),$a(o,le),b.needsLights=Zr(o),b.lightsStateVersion=ue,b.needsLights&&(_e.ambientLightColor.value=A.state.ambient,_e.lightProbe.value=A.state.probe,_e.sunLights.value=A.state.sun,_e.sunLightShadows.value=A.state.sunShadow,_e.directionalLights.value=A.state.directional,_e.directionalLightShadows.value=A.state.directionalShadow,_e.spotLights.value=A.state.spot,_e.spotLightShadows.value=A.state.spotShadow,_e.rectAreaLights.value=A.state.rectArea,_e.ltc_1.value=A.state.rectAreaLTC1,_e.ltc_2.value=A.state.rectAreaLTC2,_e.pointLights.value=A.state.point,_e.pointLightShadows.value=A.state.pointShadow,_e.hemisphereLights.value=A.state.hemi,_e.sunShadowMatrix.value=A.state.sunShadowMatrix,_e.sunShadowCascade.value=A.state.sunShadowCascade,_e.directionalShadowMatrix.value=A.state.directionalShadowMatrix,_e.spotLightMatrix.value=A.state.spotLightMatrix,_e.spotLightMap.value=A.state.spotLightMap,_e.pointShadowMatrix.value=A.state.pointShadowMatrix),b.numLightProbeGrids=ja(x.state.lightProbeGridArray),b.currentProgram=Oe,b.uniformsList=null,Oe}function Yr(o,h,U,b,A){const J=Re.get(o),ue=J.currentProgram.id+","+b+","+A;let le=J.programVariants.get(ue);return le===void 0?(le=Jt(o,h,U),J.programVariants.set(ue,le)):(J.currentProgram=le,J.uniformsList=null,J.outputColorSpace=b,J.toneMapping=A),le}function Za(o){if(o.uniformsList===null){const h=o.currentProgram.getUniforms();o.uniformsList=ga.seqWithValue(h.seq,o.uniforms)}return o.uniformsList}function $a(o,h){const U=Re.get(o);U.outputColorSpace=h.outputColorSpace,U.batching=h.batching,U.batchingColor=h.batchingColor,U.instancing=h.instancing,U.instancingColor=h.instancingColor,U.instancingMorph=h.instancingMorph,U.skinning=h.skinning,U.morphTargets=h.morphTargets,U.morphNormals=h.morphNormals,U.morphColors=h.morphColors,U.morphTargetsCount=h.morphTargetsCount,U.numClippingPlanes=h.numClippingPlanes,U.numIntersection=h.numClipIntersection,U.vertexAlphas=h.vertexAlphas,U.vertexTangents=h.vertexTangents,U.toneMapping=h.toneMapping}function qr(o,h,U,b,A){h.isScene!==!0&&(h=St),Ce.resetTextureUnits();const J=h.fog,ue=b.isMeshStandardMaterial||b.isMeshLambertMaterial||b.isMeshPhongMaterial?h.environment:null,le=ae===null?N.outputColorSpace:ae.isXRRenderTarget===!0?ae.texture.colorSpace:Je.workingColorSpace,he=b.isMeshStandardMaterial||b.isMeshLambertMaterial&&!b.envMap||b.isMeshPhongMaterial&&!b.envMap,Te=d.get(b.envMap||ue,he),De=b.vertexColors===!0&&!!U.attributes.color&&U.attributes.color.itemSize===4,Oe=!!U.attributes.tangent&&(!!b.normalMap||b.anisotropy>0),_e=!!U.morphAttributes.position,Be=!!U.morphAttributes.normal,tt=!!U.morphAttributes.color;let Ve=Nt;b.toneMapped&&(ae===null||ae.isXRRenderTarget===!0)&&(Ve=N.toneMapping);const ze=U.morphAttributes.position||U.morphAttributes.normal||U.morphAttributes.color,et=ze!==void 0?ze.length:0,Ee=Re.get(b),dt=x.state.lights;if(it===!0&&(pt===!0||o!==Z)){const Xe=o===Z&&b.id===X;K.setState(b,o,Xe)}let Bt=!1,Gt=!1;b.version===Ee.__version?Ee.needsLights&&Ee.lightsStateVersion!==dt.state.version||A.isBatchedMesh&&Ee.batching===!1||!A.isBatchedMesh&&Ee.batching===!0||A.isBatchedMesh&&Ee.batchingColor===!0&&A._colorsTexture===null||A.isBatchedMesh&&Ee.batchingColor===!1&&A._colorsTexture!==null||A.isInstancedMesh&&Ee.instancing===!1||!A.isInstancedMesh&&Ee.instancing===!0||A.isSkinnedMesh&&Ee.skinning===!1||!A.isSkinnedMesh&&Ee.skinning===!0||A.isInstancedMesh&&Ee.instancingColor===!0&&A.instanceColor===null||A.isInstancedMesh&&Ee.instancingColor===!1&&A.instanceColor!==null||A.isInstancedMesh&&Ee.instancingMorph===!0&&A.morphTexture===null||A.isInstancedMesh&&Ee.instancingMorph===!1&&A.morphTexture!==null||Ee.envMap!==Te||b.fog===!0&&Ee.fog!==J||Ee.numClippingPlanes!==void 0&&(Ee.numClippingPlanes!==K.numPlanes||Ee.numIntersection!==K.numIntersection)||Ee.vertexAlphas!==De||Ee.vertexTangents!==Oe||Ee.morphTargets!==_e||Ee.morphNormals!==Be||Ee.morphColors!==tt||Ee.morphTargetsCount!==et||Ee.numLightProbeGrids!==ja(x.state.lightProbeGridArray)?Bt=!0:(Ee.outputColorSpace!==le||Ee.toneMapping!==Ve)&&(Gt=!0):(Bt=!0,Ee.__version=b.version);let ut=Ee.currentProgram;(Bt===!0||Gt===!0)&&(ut=Gt===!0?Yr(b,h,A,le,Ve):Jt(b,h,A),W&&b.isNodeMaterial&&W.onUpdateProgram(b,ut,Ee));let ua=!1,It=!1,Ht=!1;const Fe=ut.getUniforms(),ct=Ee.uniforms;if(re.useProgram(ut.program)&&(ua=!0,It=!0,Ht=!0),b.id!==X&&(X=b.id,It=!0),ua||Z!==o){re.buffers.depth.getReversed()&&o.reversedDepth!==!0&&(o._reversedDepth=!0,o.updateProjectionMatrix()),Fe.setValue(E,"projectionMatrix",o.projectionMatrix),Fe.setValue(E,"viewMatrix",o.matrixWorldInverse);const Xe=Fe.map.cameraPosition;Xe!==void 0&&Xe.setValue(E,At.setFromMatrixPosition(o.matrixWorld)),Ye.logarithmicDepthBuffer&&Fe.setValue(E,"logDepthBufFC",2/(Math.log(o.far+1)/Math.LN2)),(b.isMeshPhongMaterial||b.isMeshToonMaterial||b.isMeshLambertMaterial||b.isMeshBasicMaterial||b.isMeshStandardMaterial||b.isShaderMaterial)&&Fe.setValue(E,"isOrthographic",o.isOrthographicCamera===!0),Z!==o&&(Z=o,It=!0,Ht=!0)}if(Ee.needsLights&&(dt.state.sunShadowMap.length>0&&Fe.setValue(E,"sunShadowMap",dt.state.sunShadowMap,Ce),dt.state.directionalShadowMap.length>0&&Fe.setValue(E,"directionalShadowMap",dt.state.directionalShadowMap,Ce),dt.state.spotShadowMap.length>0&&Fe.setValue(E,"spotShadowMap",dt.state.spotShadowMap,Ce),dt.state.pointShadowMap.length>0&&Fe.setValue(E,"pointShadowMap",dt.state.pointShadowMap,Ce)),A.isSkinnedMesh){Fe.setOptional(E,A,"bindMatrix"),Fe.setOptional(E,A,"bindMatrixInverse");const Xe=A.skeleton;Xe&&(Xe.boneTexture===null&&Xe.computeBoneTexture(),Fe.setValue(E,"boneTexture",Xe.boneTexture,Ce))}A.isBatchedMesh&&(Fe.setOptional(E,A,"batchingTexture"),Fe.setValue(E,"batchingTexture",A._matricesTexture,Ce),Fe.setOptional(E,A,"batchingIdTexture"),Fe.setValue(E,"batchingIdTexture",A._indirectTexture,Ce),Fe.setOptional(E,A,"batchingColorTexture"),A._colorsTexture!==null&&Fe.setValue(E,"batchingColorTexture",A._colorsTexture,Ce));const xt=U.morphAttributes;if((xt.position!==void 0||xt.normal!==void 0||xt.color!==void 0)&&I.update(A,U,ut),(It||Ee.receiveShadow!==A.receiveShadow)&&(Ee.receiveShadow=A.receiveShadow,Fe.setValue(E,"receiveShadow",A.receiveShadow)),(b.isMeshStandardMaterial||b.isMeshLambertMaterial||b.isMeshPhongMaterial)&&b.envMap===null&&h.environment!==null&&(ct.envMapIntensity.value=h.environmentIntensity),ct.dfgLUT!==void 0&&(ct.dfgLUT.value=ud()),It){if(Fe.setValue(E,"toneMappingExposure",N.toneMappingExposure),Ee.needsLights&&jr(ct,Ht),J&&b.fog===!0&&ce.refreshFogUniforms(ct,J),ce.refreshMaterialUniforms(ct,b,ge,be,x.state.transmissionRenderTarget[o.id]),Ee.needsLights&&Ee.numLightProbeGrids>0){const Xe=S;let ft=0;for(const wt of x.state.lightProbeGridArray)wt.texture!==null&&(Xe.textures[ft]=wt.texture,Xe.min[ft]=wt.boundingBox.min,Xe.max[ft]=wt.boundingBox.max,Xe.resolution[ft]=wt.resolution,ft++);for(const wt in Xe)Xe[wt].length=ft;ct.probesSH.value=Xe.textures,ct.probesMin.value=Xe.min,ct.probesMax.value=Xe.max,ct.probesResolution.value=Xe.resolution}ga.upload(E,Za(Ee),ct,Ce)}if(b.isShaderMaterial&&b.uniformsNeedUpdate===!0&&(ga.upload(E,Za(Ee),ct,Ce),b.uniformsNeedUpdate=!1),b.isSpriteMaterial&&Fe.setValue(E,"center",A.center),Fe.setValue(E,"modelViewMatrix",A.modelViewMatrix),Fe.setValue(E,"normalMatrix",A.normalMatrix),Fe.setValue(E,"modelMatrix",A.matrixWorld),b.uniformsGroups!==void 0){const Xe=b.uniformsGroups;for(let ft=0,wt=Xe.length;ft<wt;ft++){const Ja=Xe[ft];Me.update(Ja,ut),Me.bind(Ja,ut)}}return ut}function jr(o,h){o.ambientLightColor.needsUpdate=h,o.lightProbe.needsUpdate=h,o.sunLights.needsUpdate=h,o.sunLightShadows.needsUpdate=h,o.directionalLights.needsUpdate=h,o.directionalLightShadows.needsUpdate=h,o.pointLights.needsUpdate=h,o.pointLightShadows.needsUpdate=h,o.spotLights.needsUpdate=h,o.spotLightShadows.needsUpdate=h,o.rectAreaLights.needsUpdate=h,o.hemisphereLights.needsUpdate=h}function Zr(o){return o.isMeshLambertMaterial||o.isMeshToonMaterial||o.isMeshPhongMaterial||o.isMeshStandardMaterial||o.isShadowMaterial||o.isShaderMaterial&&o.lights===!0}this.getActiveCubeFace=function(){return q},this.getActiveMipmapLevel=function(){return H},this.getRenderTarget=function(){return ae},this.setRenderTargetTextures=function(o,h,U){const b=Re.get(o);b.__autoAllocateDepthBuffer=o.resolveDepthBuffer===!1,b.__autoAllocateDepthBuffer===!1&&(b.__useRenderToTexture=!1),Re.get(o.texture).__webglTexture=h,Re.get(o.depthTexture).__webglTexture=b.__autoAllocateDepthBuffer?void 0:U,b.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(o,h){const U=Re.get(o);U.__webglFramebuffer=h,U.__useDefaultFramebuffer=h===void 0},this.setRenderTarget=function(o,h=0,U=0){ae=o,q=h,H=U;let b=null,A=!1,J=!1;if(o){const ue=Re.get(o);if(ue.__useDefaultFramebuffer!==void 0){re.bindFramebuffer(E.FRAMEBUFFER,ue.__webglFramebuffer),ie.copy(o.viewport),Pe.copy(o.scissor),Ne=o.scissorTest,re.viewport(ie),re.scissor(Pe),re.setScissorTest(Ne),X=-1;return}else if(ue.__webglFramebuffer===void 0)Ce.setupRenderTarget(o);else if(ue.__hasExternalTextures)Ce.rebindTextures(o,Re.get(o.texture).__webglTexture,Re.get(o.depthTexture).__webglTexture);else if(o.depthBuffer){const Te=o.depthTexture;if(ue.__boundDepthTexture!==Te){if(Te!==null&&Re.has(Te)&&(o.width!==Te.image.width||o.height!==Te.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");Ce.setupDepthRenderbuffer(o)}}const le=o.texture;(le.isData3DTexture||le.isDataArrayTexture||le.isCompressedArrayTexture)&&(J=!0);const he=Re.get(o).__webglFramebuffer;o.isWebGLCubeRenderTarget?(Array.isArray(he[h])?b=he[h][U]:b=he[h],A=!0):o.samples>0&&Ce.useMultisampledRTT(o)===!1?b=Re.get(o).__webglMultisampledFramebuffer:Array.isArray(he)?b=he[U]:b=he,ie.copy(o.viewport),Pe.copy(o.scissor),Ne=o.scissorTest}else ie.copy(we).multiplyScalar(ge).floor(),Pe.copy(ye).multiplyScalar(ge).floor(),Ne=at;if(U!==0&&(b=k),re.bindFramebuffer(E.FRAMEBUFFER,b)&&re.drawBuffers(o,b),re.viewport(ie),re.scissor(Pe),re.setScissorTest(Ne),A){const ue=Re.get(o.texture);E.framebufferTexture2D(E.FRAMEBUFFER,E.COLOR_ATTACHMENT0,E.TEXTURE_CUBE_MAP_POSITIVE_X+h,ue.__webglTexture,U)}else if(J){const ue=h;for(let le=0;le<o.textures.length;le++){const he=Re.get(o.textures[le]);E.framebufferTextureLayer(E.FRAMEBUFFER,E.COLOR_ATTACHMENT0+le,he.__webglTexture,U,ue)}}else if(o!==null&&U!==0){const ue=Re.get(o.texture);E.framebufferTexture2D(E.FRAMEBUFFER,E.COLOR_ATTACHMENT0,E.TEXTURE_2D,ue.__webglTexture,U)}X=-1};function Qa(o){const h=Re.get(o);return(h.__readFormat!==o.format||h.__readType!==o.type)&&(h.__readFormat=o.format,h.__readType=o.type,h.__formatReadable=Ye.textureFormatReadable(o.format),h.__typeReadable=Ye.textureTypeReadable(o.type)),h}this.readRenderTargetPixels=function(o,h,U,b,A,J,ue,le=0){if(!(o&&o.isWebGLRenderTarget)){je("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let he=Re.get(o).__webglFramebuffer;if(o.isWebGLCubeRenderTarget&&ue!==void 0&&(he=he[ue],Array.isArray(he)&&(he=he[0])),he){re.bindFramebuffer(E.FRAMEBUFFER,he);try{const Te=o.textures[le],De=Te.format,Oe=Te.type;o.textures.length>1&&E.readBuffer(E.COLOR_ATTACHMENT0+le);const _e=Qa(Te);if(_e.__formatReadable===!1){je("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(_e.__typeReadable===!1){je("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}h>=0&&h<=o.width-b&&U>=0&&U<=o.height-A&&E.readPixels(h,U,b,A,oe.convert(De),oe.convert(Oe),J)}finally{const Te=ae!==null?Re.get(ae).__webglFramebuffer:null;re.bindFramebuffer(E.FRAMEBUFFER,Te)}}},this.readRenderTargetPixelsAsync=async function(o,h,U,b,A,J,ue,le=0){if(!(o&&o.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let he=Re.get(o).__webglFramebuffer;if(o.isWebGLCubeRenderTarget&&ue!==void 0&&(he=he[ue],Array.isArray(he)&&(he=he[0])),he)if(h>=0&&h<=o.width-b&&U>=0&&U<=o.height-A){re.bindFramebuffer(E.FRAMEBUFFER,he);const Te=o.textures[le],De=Te.format,Oe=Te.type;o.textures.length>1&&E.readBuffer(E.COLOR_ATTACHMENT0+le);const _e=Qa(Te);if(_e.__formatReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(_e.__typeReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");const Be=E.createBuffer();E.bindBuffer(E.PIXEL_PACK_BUFFER,Be),E.bufferData(E.PIXEL_PACK_BUFFER,J.byteLength,E.STREAM_READ),E.readPixels(h,U,b,A,oe.convert(De),oe.convert(Oe),0),E.bindBuffer(E.PIXEL_PACK_BUFFER,null);const tt=ae!==null?Re.get(ae).__webglFramebuffer:null;re.bindFramebuffer(E.FRAMEBUFFER,tt);const Ve=E.fenceSync(E.SYNC_GPU_COMMANDS_COMPLETE,0);return E.flush(),await rn(E,Ve,4),E.bindBuffer(E.PIXEL_PACK_BUFFER,Be),E.getBufferSubData(E.PIXEL_PACK_BUFFER,0,J),E.bindBuffer(E.PIXEL_PACK_BUFFER,null),E.deleteBuffer(Be),E.deleteSync(Ve),J}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(o,h=null,U=0){const b=Math.pow(2,-U),A=Math.floor(o.image.width*b),J=Math.floor(o.image.height*b),ue=h!==null?h.x:0,le=h!==null?h.y:0;Ce.setTexture2D(o,0),E.copyTexSubImage2D(E.TEXTURE_2D,U,0,0,ue,le,A,J),re.unbindTexture()},this.copyTextureToTexture=function(o,h,U=null,b=null,A=0,J=0){let ue,le,he,Te,De,Oe,_e,Be,tt;const Ve=o.isCompressedTexture?o.mipmaps[J]:o.image;if(U!==null)ue=U.max.x-U.min.x,le=U.max.y-U.min.y,he=U.isBox3?U.max.z-U.min.z:1,Te=U.min.x,De=U.min.y,Oe=U.isBox3?U.min.z:0;else{const Fe=Math.pow(2,-A);ue=Math.floor(Ve.width*Fe),le=Math.floor(Ve.height*Fe),o.isDataArrayTexture?he=Ve.depth:o.isData3DTexture?he=Math.floor(Ve.depth*Fe):he=1,Te=0,De=0,Oe=0}b!==null?(_e=b.x,Be=b.y,tt=b.z):(_e=0,Be=0,tt=0);const ze=oe.convert(h.format),et=oe.convert(h.type);let Ee;h.isData3DTexture?(Ce.setTexture3D(h,0),Ee=E.TEXTURE_3D):h.isDataArrayTexture||h.isCompressedArrayTexture?(Ce.setTexture2DArray(h,0),Ee=E.TEXTURE_2D_ARRAY):(Ce.setTexture2D(h,0),Ee=E.TEXTURE_2D),re.activeTexture(E.TEXTURE0),re.pixelStorei(E.UNPACK_FLIP_Y_WEBGL,h.flipY),re.pixelStorei(E.UNPACK_PREMULTIPLY_ALPHA_WEBGL,h.premultiplyAlpha),re.pixelStorei(E.UNPACK_ALIGNMENT,h.unpackAlignment);const dt=re.getParameter(E.UNPACK_ROW_LENGTH),Bt=re.getParameter(E.UNPACK_IMAGE_HEIGHT),Gt=re.getParameter(E.UNPACK_SKIP_PIXELS),ut=re.getParameter(E.UNPACK_SKIP_ROWS),ua=re.getParameter(E.UNPACK_SKIP_IMAGES);re.pixelStorei(E.UNPACK_ROW_LENGTH,Ve.width),re.pixelStorei(E.UNPACK_IMAGE_HEIGHT,Ve.height),re.pixelStorei(E.UNPACK_SKIP_PIXELS,Te),re.pixelStorei(E.UNPACK_SKIP_ROWS,De),re.pixelStorei(E.UNPACK_SKIP_IMAGES,Oe);const It=o.isDataArrayTexture||o.isData3DTexture,Ht=h.isDataArrayTexture||h.isData3DTexture;if(o.isDepthTexture){const Fe=Re.get(o),ct=Re.get(h),xt=Re.get(Fe.__renderTarget),Xe=Re.get(ct.__renderTarget);re.bindFramebuffer(E.READ_FRAMEBUFFER,xt.__webglFramebuffer),re.bindFramebuffer(E.DRAW_FRAMEBUFFER,Xe.__webglFramebuffer);for(let ft=0;ft<he;ft++)It&&(E.framebufferTextureLayer(E.READ_FRAMEBUFFER,E.COLOR_ATTACHMENT0,Re.get(o).__webglTexture,A,Oe+ft),E.framebufferTextureLayer(E.DRAW_FRAMEBUFFER,E.COLOR_ATTACHMENT0,Re.get(h).__webglTexture,J,tt+ft)),E.blitFramebuffer(Te,De,Te+ue,De+le,_e,Be,_e+ue,Be+le,E.DEPTH_BUFFER_BIT,E.NEAREST);re.bindFramebuffer(E.READ_FRAMEBUFFER,null),re.bindFramebuffer(E.DRAW_FRAMEBUFFER,null)}else if(A!==0||o.isRenderTargetTexture||Re.has(o)){const Fe=Re.get(o),ct=Re.get(h);re.bindFramebuffer(E.READ_FRAMEBUFFER,R),re.bindFramebuffer(E.DRAW_FRAMEBUFFER,Q);for(let xt=0;xt<he;xt++)It?E.framebufferTextureLayer(E.READ_FRAMEBUFFER,E.COLOR_ATTACHMENT0,Fe.__webglTexture,A,Oe+xt):E.framebufferTexture2D(E.READ_FRAMEBUFFER,E.COLOR_ATTACHMENT0,E.TEXTURE_2D,Fe.__webglTexture,A),Ht?E.framebufferTextureLayer(E.DRAW_FRAMEBUFFER,E.COLOR_ATTACHMENT0,ct.__webglTexture,J,tt+xt):E.framebufferTexture2D(E.DRAW_FRAMEBUFFER,E.COLOR_ATTACHMENT0,E.TEXTURE_2D,ct.__webglTexture,J),A!==0?E.blitFramebuffer(Te,De,Te+ue,De+le,_e,Be,_e+ue,Be+le,E.COLOR_BUFFER_BIT,E.NEAREST):Ht?E.copyTexSubImage3D(Ee,J,_e,Be,tt+xt,Te,De,ue,le):E.copyTexSubImage2D(Ee,J,_e,Be,Te,De,ue,le);re.bindFramebuffer(E.READ_FRAMEBUFFER,null),re.bindFramebuffer(E.DRAW_FRAMEBUFFER,null)}else Ht?o.isDataTexture||o.isData3DTexture?E.texSubImage3D(Ee,J,_e,Be,tt,ue,le,he,ze,et,Ve.data):h.isCompressedArrayTexture?E.compressedTexSubImage3D(Ee,J,_e,Be,tt,ue,le,he,ze,Ve.data):E.texSubImage3D(Ee,J,_e,Be,tt,ue,le,he,ze,et,Ve):o.isDataTexture?E.texSubImage2D(E.TEXTURE_2D,J,_e,Be,ue,le,ze,et,Ve.data):o.isCompressedTexture?E.compressedTexSubImage2D(E.TEXTURE_2D,J,_e,Be,Ve.width,Ve.height,ze,Ve.data):E.texSubImage2D(E.TEXTURE_2D,J,_e,Be,ue,le,ze,et,Ve);re.pixelStorei(E.UNPACK_ROW_LENGTH,dt),re.pixelStorei(E.UNPACK_IMAGE_HEIGHT,Bt),re.pixelStorei(E.UNPACK_SKIP_PIXELS,Gt),re.pixelStorei(E.UNPACK_SKIP_ROWS,ut),re.pixelStorei(E.UNPACK_SKIP_IMAGES,ua),J===0&&h.generateMipmaps===!0&&h.mipmapsAutoUpdate===!0&&E.generateMipmap(Ee),re.unbindTexture()},this.initRenderTarget=function(o){Re.get(o).__webglFramebuffer===void 0&&Ce.setupRenderTarget(o)},this.initTexture=function(o){o.isCubeTexture?Ce.setTextureCube(o,0):o.isData3DTexture?Ce.setTexture3D(o,0):o.isDataArrayTexture||o.isCompressedArrayTexture?Ce.setTexture2DArray(o,0):Ce.setTexture2D(o,0),re.unbindTexture()},this.resetState=function(){q=0,H=0,ae=null,re.reset(),te.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return ti}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(a){this._outputColorSpace=a;const t=this.getContext();t.drawingBufferColorSpace=Je._getDrawingBufferColorSpace(a),t.unpackColorSpace=Je._getUnpackColorSpace()}}export{fd as p};
