'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const vertexShader=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.);}`;

// One continuous mathematical field: analytic cylinder flow + iterative sine feedback.
const fragmentShader=`
precision highp float;varying vec2 vUv;
uniform vec2 uResolution;uniform vec2 uPointer;uniform float uTime;uniform float uReveal;uniform float uScroll;

float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float valueNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash21(i),hash21(i+vec2(1.,0.)),f.x),mix(hash21(i+vec2(0.,1.)),hash21(i+vec2(1.)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=valueNoise(p)*a;p=mat2(.81,-.59,.59,.81)*p*2.03+vec2(1.7,.9);a*=.5;}return s;}
vec3 palette(float x){
 vec3 deep=vec3(.025,.055,.32),blue=vec3(.06,.34,1.08),cyan=vec3(.16,.78,1.12),pink=vec3(1.02,.16,.76),white=vec3(1.15,1.08,1.2);
 vec3 c=mix(deep,blue,smoothstep(0.,.38,x));c=mix(c,pink,smoothstep(.28,.72,x));c=mix(c,cyan,smoothstep(.58,.86,x));return mix(c,white,smoothstep(.84,1.,x));
}

void main(){
 vec2 p=(gl_FragCoord.xy-.5*uResolution.xy)/uResolution.y-uPointer*.008;
 float r=length(p),angle=atan(p.y,p.x),time=uTime*.16;
 float R=.245*(1.-uScroll*.25),r2=max(dot(p,p),R*R*.62);

 // Exact potential-flow coordinates around a circular obstacle.
 float inv=R*R/r2;
 float potential=p.x*(1.+inv);
 float stream=p.y*(1.-inv);
 float wind=time*1.65;
 vec2 field=vec2(potential*3.05-wind,stream*7.8);
 field.y+=(fbm(vec2(p.x*1.55,p.y*4.2-time))-.5)*.47;
 float rot=(fbm(vec2(angle*1.3,time*.18))-.5)*.12+uPointer.x*.035;
 field=mat2(cos(rot),-sin(rot),sin(rot),cos(rot))*field;

 vec2 z=field;vec3 energy=vec3(0.);float fog=0.;float sparks=0.;
 for(int i=1;i<13;i++){
   float fi=float(i);
   vec2 phase=vec2(fi*1.618-wind,-fi*1.173)+time*vec2(1.08+fi*.035,-.16-fi*.014);
   vec2 fold=sin(z.yx*vec2(1.11,1.27)+phase)+.46*sin(z*vec2(.63,.77)-phase.yx*.7);
   z+=fold*(.82/fi)+vec2(.024,-.017);

   float interference=sin(z.x*.91+sin(z.y*.67+fi))+cos(z.y*.73-sin(z.x*.51-fi));
   float ridge=1./(.12+abs(interference));
   float ribbon=exp(-abs(stream+.018*sin(z.x*1.1+fi*2.4)+.011*sin(z.y*1.7-fi))*(9.+fi*.58));
   float grain=.5+.5*sin(z.x*2.17-z.y*.38+fi*2.07);
   float knot=pow(grain,8.)*pow(.5+.5*cos(z.y*1.43+fi),4.);
   float weight=(.021+.0016*fi)*ribbon*ridge;
   energy+=palette(fract(fi*.173+grain*.24))*weight*(.72+knot*2.8);
   fog+=ribbon/(fi*.72);
   sparks+=knot*ribbon/fi;
 }

 // Closely spaced contour lines turn the field into individual energy strands.
 float strandPhase=stream*168.+sin(potential*8.4-wind*2.8)*2.4+sin(angle*7.-time)*1.15;
 strandPhase+=potential*13.5-wind*3.2;
 strandPhase+=(fbm(vec2(potential*4.2,stream*18.)+time*.16)-.5)*8.5;
 float strandsA=pow(.5+.5*cos(strandPhase),22.);
 float strandsB=pow(.5+.5*cos(strandPhase*.517+z.x*2.7+4.2),28.);
 float hairlines=pow(.5+.5*cos(strandPhase*1.83-z.y*1.4),42.);
 float strandBody=(strandsA*.58+strandsB*.34+hairlines*.28);
 float strandFlicker=.68+.32*sin(potential*10.-wind*4.2+fbm(field)*5.);
 strandBody*=strandFlicker;

 // Multi-scale body: broad mist, structured plasma, hairline detail, hot knots.
 float horizontal=exp(-abs(stream)*4.35);
 float outer=smoothstep(R-.004,R+.004,r);
 float turbulence=fbm(field*.58+vec2(time,-time*.4));
 vec3 mist=palette(.12+.2*turbulence)*fog*.009;
 vec3 plasma=1.-exp(-energy*1.14);
 float micro=pow(.5+.5*sin(z.x*4.3+z.y*2.1),18.)*horizontal;
 vec3 strandColor=mix(vec3(.055,.31,1.18),vec3(1.05,.12,.74),.5+.5*sin(potential*3.7+angle-time));
 vec3 outsideCloud=(mist+plasma*.74+palette(.48)*micro*.1+palette(.82)*sparks*.018)*horizontal*outer;
 vec3 strandLight=strandColor*strandBody*horizontal*(.11+.89*outer)*.42;

 // A few dim strands cross the dark interior instead of being cut off at the rim.
 float inside=1.-outer;
 float innerWarp=p.y+.045*sin(p.x*12.-wind*2.4)+.02*sin(p.x*29.-wind*4.));
 float innerA=pow(.5+.5*cos(innerWarp*82.+p.x*13.-wind*3.2),30.);
 float innerB=pow(.5+.5*cos((innerWarp+.055)*105.-p.x*9.+wind*2.6),38.);
 float innerEnvelope=(1.-smoothstep(R*.12,R*.99,r))*(.38+.62*exp(-abs(p.y)*5.));
 vec3 interiorStrands=mix(vec3(.025,.12,.54),vec3(.42,.06,.48),.5+.5*sin(p.x*8.+time))*
   (innerA*.78+innerB*.46)*innerEnvelope*inside*.42;
 vec3 cloud=outsideCloud+strandLight+interiorStrands;

 // Independent chromatic fringes create optical depth without textures.
 float edge=abs(r-R);
 float irregularLight=.74+.26*fbm(vec2(angle*2.2,time*.34));
 float broadGlow=exp(-edge*15.)*(.38+.62*horizontal);
 float blueRim=exp(-abs(r-(R+.005))*108.);
 float pinkRim=exp(-abs(r-(R-.003))*142.);
 float whiteRim=exp(-edge*255.)*irregularLight;
 cloud+=vec3(.03,.19,.68)*broadGlow*.42+vec3(.03,.48,1.1)*blueRim*.38+vec3(.92,.08,.62)*pinkRim*.3+vec3(1.08,1.03,1.16)*whiteRim*.62;

 float reveal=mix(.025,1.,uReveal)*(1.-smoothstep(.05,.67,uScroll));
 vec3 col=vec3(.0018,.0022,.006)+cloud*reveal;
 col=1.-exp(-col*1.24); // filmic/exponential light compression
 float core=1.-smoothstep(R-.0015,R+.001,r);
 col=mix(col,vec3(.0005,.0006,.0018)+interiorStrands*reveal*.96,core);
 float vignette=1.-.48*pow(length((vUv-.5)*vec2(1.05,.72)),2.);
 col*=vignette;
 col+=(hash21(gl_FragCoord.xy+floor(uTime*9.))-.5)*.006;
 gl_FragColor=vec4(col,1.);
}`;

export default function EclipseScene({entered}:{entered:boolean}){
 const mount=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const el=mount.current;if(!el)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<700?1.15:1.5));
  renderer.domElement.setAttribute('aria-hidden','true');el.appendChild(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.Camera();
  const uniforms={uResolution:{value:new THREE.Vector2()},uPointer:{value:new THREE.Vector2()},uTime:{value:0},uReveal:{value:entered?1:0},uScroll:{value:0}};
  const geometry=new THREE.PlaneGeometry(2,2),material=new THREE.ShaderMaterial({vertexShader,fragmentShader,uniforms});scene.add(new THREE.Mesh(geometry,material));
  const target=new THREE.Vector2(),current=new THREE.Vector2();let frame=0,start=performance.now(),visible=true;
  const resize=()=>{renderer.setSize(el.clientWidth,el.clientHeight,false);const dpr=renderer.getPixelRatio();uniforms.uResolution.value.set(el.clientWidth*dpr,el.clientHeight*dpr)};
  const pointer=(e:PointerEvent)=>{if(!reduced)target.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2)};
  const scroll=()=>{uniforms.uScroll.value=Math.min(scrollY/innerHeight,1);visible=scrollY<innerHeight};
  const render=(now:number)=>{current.lerp(target,.022);uniforms.uPointer.value.copy(current);uniforms.uTime.value=reduced?0:(now-start)/1000;const goal=entered?1:0;uniforms.uReveal.value+=(goal-uniforms.uReveal.value)*(reduced?.18:.032);if(visible)renderer.render(scene,camera);frame=requestAnimationFrame(render)};
  resize();addEventListener('resize',resize);addEventListener('pointermove',pointer);addEventListener('scroll',scroll,{passive:true});frame=requestAnimationFrame(render);
  return()=>{cancelAnimationFrame(frame);removeEventListener('resize',resize);removeEventListener('pointermove',pointer);removeEventListener('scroll',scroll);geometry.dispose();material.dispose();renderer.dispose();el.removeChild(renderer.domElement)};
 },[entered]);
 return <div ref={mount} className="eclipse-canvas"><noscript><div className="eclipse-fallback" /></noscript></div>;
}
