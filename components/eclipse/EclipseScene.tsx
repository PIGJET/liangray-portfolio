'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const vertexShader=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.);}`;
const fragmentShader=`
precision highp float;varying vec2 vUv;
uniform vec2 uResolution;uniform vec2 uPointer;uniform float uTime;uniform float uReveal;uniform float uScroll;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.03+1.3;a*=.5;}return v;}
void main(){
 vec2 p=(gl_FragCoord.xy-.5*uResolution.xy)/uResolution.y-uPointer*.009;
 float r=length(p),a=atan(p.y,p.x),t=uTime*.16;
 float radius=.245*(1.-uScroll*.25);

 // Horizontal currents are bent around an exact circular obstacle.
 float bend=exp(-abs(p.x)*3.1)*radius*.72;
 float side=sign(p.y+.0001);
 vec2 flowP=vec2(p.x,p.y-side*bend);
 float warp=(fbm(vec2(flowP.x*1.35,flowP.y*3.5-t))-.5)*.12;
 float filaments=0.;
 for(int i=0;i<9;i++){
   float fi=float(i);
   float lane=(fi-4.)*.029;
   float wave=sin(flowP.x*(3.2+fi*.13)+t*(1.2+fi*.08)+fi*1.71)*(.012+fi*.001);
   float line=abs(flowP.y-lane-wave-warp*(.18+fi*.035));
   filaments+=exp(-line*(135.+fi*8.))*(.46+.54*sin(fi*2.4+p.x*4.+t));
 }
 float streamMask=exp(-abs(flowP.y)*3.8)*(1.-smoothstep(.52,1.05,abs(p.x))*.25);
 filaments*=streamMask;

 // The circle itself remains geometrically perfect; noise affects light only.
 float edge=abs(r-radius);
 float orbitNoise=.72+.28*fbm(vec2(a*2.4,t));
 float ring=exp(-edge*150.)*orbitNoise;
 float hot=exp(-edge*310.)*(.7+.3*cos(a-t*4.));
 float halo=exp(-edge*25.);
 float core=1.-smoothstep(radius-.002,radius+.001,r);
 float outside=smoothstep(radius-.006,radius+.006,r);

 vec3 bg=vec3(.004,.005,.009);
 vec3 blue=vec3(.10,.32,.95),cyan=vec3(.16,.76,1.),violet=vec3(.78,.19,.88),white=vec3(.93,.95,1.);
 float hue=.5+.5*sin(a*2.-t*3.+p.x*2.);
 vec3 flowColor=mix(blue,violet,hue);
 float reveal=mix(.04,1.,uReveal)*(1.-smoothstep(.05,.67,uScroll));
 vec3 col=bg;
 col+=flowColor*filaments*.13*outside*reveal;
 col+=mix(cyan,violet,hue)*halo*.18*reveal;
 col+=mix(cyan,white,.45)*ring*.48*reveal+white*hot*.35*reveal;
 col=mix(col,vec3(.001,.001,.004),core);
 col+=(hash(gl_FragCoord.xy+floor(uTime*7.))-.5)*.006;
 gl_FragColor=vec4(col,1.);
}`;

const particleVertex=`
attribute float aSize;attribute float aAlpha;varying float vAlpha;
void main(){vAlpha=aAlpha;gl_Position=vec4(position,1.);gl_PointSize=aSize;}`;
const particleFragment=`
precision highp float;varying float vAlpha;uniform float uReveal;
void main(){vec2 q=gl_PointCoord-.5;float d=length(q);float soft=1.-smoothstep(.08,.5,d);vec3 c=mix(vec3(.18,.48,1.),vec3(.92,.35,1.),gl_PointCoord.x);gl_FragColor=vec4(c,soft*vAlpha*uReveal*.68);}`;

export default function EclipseScene({entered}:{entered:boolean}){
 const mount=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const el=mount.current;if(!el)return;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance',alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<700?1.1:1.5));renderer.domElement.setAttribute('aria-hidden','true');el.appendChild(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.Camera();const uniforms={uResolution:{value:new THREE.Vector2()},uPointer:{value:new THREE.Vector2()},uTime:{value:0},uReveal:{value:entered?1:0},uScroll:{value:0}};
  const planeGeo=new THREE.PlaneGeometry(2,2),planeMat=new THREE.ShaderMaterial({vertexShader,fragmentShader,uniforms});scene.add(new THREE.Mesh(planeGeo,planeMat));

  const count=innerWidth<700?72:130,positions=new Float32Array(count*3),sizes=new Float32Array(count),alphas=new Float32Array(count),seed=new Float32Array(count*4);
  for(let i=0;i<count;i++){seed[i*4]=Math.random();seed[i*4+1]=Math.random();seed[i*4+2]=Math.random();seed[i*4+3]=Math.random();sizes[i]=6+seed[i*4+2]*18;alphas[i]=.18+seed[i*4+3]*.7;}
  const pointsGeo=new THREE.BufferGeometry();pointsGeo.setAttribute('position',new THREE.BufferAttribute(positions,3));pointsGeo.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));pointsGeo.setAttribute('aAlpha',new THREE.BufferAttribute(alphas,1));
  const pointUniforms={uReveal:{value:entered?1:0}};const pointsMat=new THREE.ShaderMaterial({vertexShader:particleVertex,fragmentShader:particleFragment,uniforms:pointUniforms,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});const points=new THREE.Points(pointsGeo,pointsMat);scene.add(points);

  const target=new THREE.Vector2(),current=new THREE.Vector2();let frame=0,start=performance.now(),visible=true;
  const resize=()=>{renderer.setSize(el.clientWidth,el.clientHeight,false);uniforms.uResolution.value.set(el.clientWidth*renderer.getPixelRatio(),el.clientHeight*renderer.getPixelRatio())};
  const pointer=(e:PointerEvent)=>{if(!reduced)target.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2)};const scroll=()=>{uniforms.uScroll.value=Math.min(scrollY/innerHeight,1);visible=scrollY<innerHeight};
  const render=(now:number)=>{const time=reduced?0:(now-start)/1000;current.lerp(target,.025);uniforms.uPointer.value.copy(current);uniforms.uTime.value=time;const goal=entered?1:0;uniforms.uReveal.value+=(goal-uniforms.uReveal.value)*(reduced?.18:.035);pointUniforms.uReveal.value=uniforms.uReveal.value*(1-uniforms.uScroll.value);
   for(let i=0;i<count;i++){const dir=seed[i*4]>.5?1:-1,speed=.035+seed[i*4+1]*.07;let x=((seed[i*4]+time*speed*dir+10)%1)*2.6-1.3;if(dir<0)x=-x;const base=(seed[i*4+2]-.5)*.62;const bend=Math.sign(base||1)*.34*Math.exp(-Math.abs(x)*3.2);const y=base+bend+Math.sin(x*5+seed[i*4+3]*12+time*.6)*.025;positions[i*3]=x;positions[i*3+1]=y;positions[i*3+2]=0;}pointsGeo.attributes.position.needsUpdate=true;
   if(visible)renderer.render(scene,camera);frame=requestAnimationFrame(render)};
  resize();addEventListener('resize',resize);addEventListener('pointermove',pointer);addEventListener('scroll',scroll,{passive:true});frame=requestAnimationFrame(render);
  return()=>{cancelAnimationFrame(frame);removeEventListener('resize',resize);removeEventListener('pointermove',pointer);removeEventListener('scroll',scroll);planeGeo.dispose();planeMat.dispose();pointsGeo.dispose();pointsMat.dispose();renderer.dispose();el.removeChild(renderer.domElement)};
 },[entered]);return <div ref={mount} className="eclipse-canvas"><noscript><div className="eclipse-fallback" /></noscript></div>;
}
