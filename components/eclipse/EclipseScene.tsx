'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const vertexShader=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.);}`;
const fragmentShader=`
precision highp float;varying vec2 vUv;
uniform vec2 uResolution;uniform vec2 uPointer;uniform float uTime;uniform float uReveal;uniform float uScroll;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.03+1.3;a*=.5;}return v;}
void main(){
 vec2 p=(gl_FragCoord.xy-.5*uResolution.xy)/uResolution.y-uPointer*.009;
 float r=length(p),a=atan(p.y,p.x),t=uTime*.19;
 float radius=.245*(1.-uScroll*.25);

 // A lens-like coordinate fold bends a wide horizontal field around the void.
 float bend=exp(-abs(p.x)*2.65)*radius*.73;
 vec2 c=vec2(p.x,p.y-sign(p.y+.0001)*bend);
 c.y+=(fbm(vec2(c.x*1.3,c.y*2.8-t))-.5)*.09;
 vec2 z=c*vec2(3.35,6.8);
 float turn=log(length(z)+.18)*.42+t*.55;
 z=mat2(cos(turn),-sin(turn),sin(turn),cos(turn))*z;

 // Repeated domain warping builds fog, ribbons, fine threads, and bright knots.
 vec3 cloud=vec3(0.);float detail=0.;
 for(int i=1;i<11;i++){
   float fi=float(i);
   vec2 wave=sin(z.yx*(1.05+fi*.027)+vec2(fi*1.71,-fi*1.29)+t*(.7+fi*.08));
   z+=wave*(.66/fi)+vec2(.035,-.018);
   float ridge=1./(.075+abs(sin(z.x*.73+z.y*.31+fi*.4)));
   float smoke=exp(-abs(c.y+sin(z.x*.42+fi)*.035)*(12.+fi*.55));
   float knots=pow(.5+.5*sin(z.x*1.18-z.y*.22+fi*2.1),6.);
   vec3 layer=mix(vec3(.05,.18,.72),vec3(.82,.12,.76),.5+.5*sin(fi*1.7+z.y*.12));
   cloud+=layer*ridge*smoke*(.010+.0015*fi)*(1.+knots*1.8);
   detail+=smoke*knots/fi;
 }
 float broad=exp(-abs(c.y)*4.0)*(1.-smoothstep(.68,1.25,abs(p.x))*.35);
 cloud*=broad;
 cloud+=vec3(.08,.22,.65)*fbm(c*vec2(2.2,5.5)+t)*broad*.16;
 cloud+=vec3(.68,.13,.74)*detail*.035*broad;

 // The circle stays mathematically exact; only its illumination varies.
 float edge=abs(r-radius);
 float orbitNoise=.68+.32*fbm(vec2(a*2.3,t*.7));
 float ring=exp(-edge*115.)*orbitNoise;
 float hot=exp(-edge*245.)*(.72+.28*cos(a-t*3.6));
 float halo=exp(-edge*18.);
 float core=1.-smoothstep(radius-.002,radius+.001,r);
 float outside=smoothstep(radius-.005,radius+.005,r);
 vec3 bg=vec3(.002,.003,.008),cyan=vec3(.16,.72,1.),violet=vec3(.82,.17,.88),white=vec3(.95,.96,1.);
 float hue=.5+.5*sin(a*2.-t*3.+p.x*2.);
 float reveal=mix(.04,1.,uReveal)*(1.-smoothstep(.05,.67,uScroll));
 vec3 col=bg+(1.-exp(-cloud))*outside*reveal;
 col+=mix(cyan,violet,hue)*halo*.25*reveal;
 col+=mix(cyan,white,.48)*ring*.62*reveal+white*hot*.42*reveal;
 col=mix(col,vec3(.001,.001,.004),core);
 col+=(hash(gl_FragCoord.xy+floor(uTime*7.))-.5)*.006;
 gl_FragColor=vec4(col,1.);
}`;

const particleVertex=`
attribute float aSize;attribute float aAlpha;varying float vAlpha;
void main(){vAlpha=aAlpha;gl_Position=vec4(position,1.);gl_PointSize=aSize;}`;
const particleFragment=`
precision highp float;varying float vAlpha;uniform float uReveal;
void main(){vec2 q=gl_PointCoord-.5;float d=length(q);float soft=1.-smoothstep(.08,.5,d);vec3 c=mix(vec3(.18,.48,1.),vec3(.92,.35,1.),gl_PointCoord.x);gl_FragColor=vec4(c,soft*vAlpha*uReveal*.32);}`;

export default function EclipseScene({entered}:{entered:boolean}){
 const mount=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const el=mount.current;if(!el)return;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance',alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<700?1.1:1.5));renderer.domElement.setAttribute('aria-hidden','true');el.appendChild(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.Camera();const uniforms={uResolution:{value:new THREE.Vector2()},uPointer:{value:new THREE.Vector2()},uTime:{value:0},uReveal:{value:entered?1:0},uScroll:{value:0}};
  const planeGeo=new THREE.PlaneGeometry(2,2),planeMat=new THREE.ShaderMaterial({vertexShader,fragmentShader,uniforms});scene.add(new THREE.Mesh(planeGeo,planeMat));

  const count=innerWidth<700?48:86,positions=new Float32Array(count*3),sizes=new Float32Array(count),alphas=new Float32Array(count),seed=new Float32Array(count*4);
  for(let i=0;i<count;i++){seed[i*4]=Math.random();seed[i*4+1]=Math.random();seed[i*4+2]=Math.random();seed[i*4+3]=Math.random();sizes[i]=5+seed[i*4+2]*12;alphas[i]=.12+seed[i*4+3]*.48;}
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
