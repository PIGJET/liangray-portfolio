'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const vertexShader = `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position,1.);}`;

// An original polar flow field: no textures, models, or sampled imagery.
const fragmentShader = `
precision highp float;
varying vec2 vUv;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform float uTime;
uniform float uReveal;
uniform float uScroll;

float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash21(i),hash21(i+vec2(1.,0.)),f.x),mix(hash21(i+vec2(0.,1.)),hash21(i+vec2(1.)),f.x),f.y);
}
float fbm(vec2 p){
  float v=0.,a=.5;
  for(int i=0;i<4;i++){v+=a*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.03+1.7;a*=.5;}
  return v;
}

void main(){
  vec2 uv=(gl_FragCoord.xy-.5*uResolution.xy)/uResolution.y;
  vec2 center=vec2(.09,.06)+uPointer*.016;
  vec2 p=uv-center;
  float r=length(p), ang=atan(p.y,p.x);
  float t=uTime*.12;

  // Fold polar space into a slowly breathing, uneven current.
  vec2 q=vec2(ang*1.45,log(r+.055)*2.15);
  q+=vec2(fbm(q*.72+vec2(t,-t))-.5,fbm(q*.91+vec2(-t,t*.7))-.5)*1.18;
  vec2 w=q;
  float flow=0.;
  for(int i=0;i<5;i++){
    float fi=float(i)+1.;
    w+=vec2(sin(w.y*1.17+fi*1.9+t*fi),cos(w.x*1.09-fi*1.4-t*.8))/fi*.42;
    flow+=abs(sin(w.x*2.1)+cos(w.y*1.7))*.14;
  }

  float radius=.205*(1.-uScroll*.26);
  float warpedR=r+(fbm(vec2(ang*2.4,t))- .5)*.022;
  float shell=abs(warpedR-radius);
  float thread=exp(-shell*175.)*(.42+.58*pow(.5+.5*cos(ang-t*4.+flow),2.));
  float innerThreads=exp(-abs(r-radius*.78+sin(ang*7.+flow*4.)*.011)*90.)*.22;
  float outerThreads=exp(-abs(r-radius*1.22+sin(ang*5.-flow*3.)*.017)*62.)*.16;
  float wisps=exp(-shell*32.)*pow(max(0.,sin(w.x*3.2+w.y*1.8)),8.)*.24;
  float traveling=exp(-pow(mod(ang-t*5.+6.283,6.283)-3.14,.0+2.))*.16;
  float halo=exp(-shell*18.)*.16;
  float core=1.-smoothstep(radius*.66,radius*.83,r);

  vec3 bg=mix(vec3(.012,.021,.015),vec3(.026,.039,.029),clamp(.35-vUv.y+uPointer.y*.035,0.,1.));
  vec3 ivory=vec3(.91,.93,.88),warm=vec3(.77,.76,.66),moss=vec3(.24,.34,.26);
  float reveal=mix(.12,1.,uReveal)*(1.-smoothstep(.05,.66,uScroll));
  vec3 col=bg+moss*halo*reveal;
  col+=warm*(wisps+innerThreads+outerThreads)*reveal;
  col+=ivory*thread*reveal;
  col+=ivory*traveling*uReveal*(1.-uReveal*.7);
  col=mix(col,vec3(.0015,.004,.002),core);
  col+=(hash21(gl_FragCoord.xy+floor(uTime*8.))-.5)*.007;
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
    const material=new THREE.ShaderMaterial({vertexShader,fragmentShader,uniforms});
    const geometry=new THREE.PlaneGeometry(2,2);scene.add(new THREE.Mesh(geometry,material));
    const target=new THREE.Vector2(),current=new THREE.Vector2();let frame=0,start=performance.now(),visible=true;
    const resize=()=>{renderer.setSize(el.clientWidth,el.clientHeight,false);uniforms.uResolution.value.set(el.clientWidth*renderer.getPixelRatio(),el.clientHeight*renderer.getPixelRatio())};
    const pointer=(e:PointerEvent)=>{if(!reduced)target.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2)};
    const scroll=()=>{uniforms.uScroll.value=Math.min(scrollY/innerHeight,1);visible=scrollY<innerHeight};
    const render=(now:number)=>{current.lerp(target,.025);uniforms.uPointer.value.copy(current);uniforms.uTime.value=reduced?0:(now-start)/1000;const goal=entered?1:0;uniforms.uReveal.value+=(goal-uniforms.uReveal.value)*(reduced?.16:.035);if(visible)renderer.render(scene,camera);frame=requestAnimationFrame(render)};
    resize();addEventListener('resize',resize);addEventListener('pointermove',pointer);addEventListener('scroll',scroll,{passive:true});frame=requestAnimationFrame(render);
    return()=>{cancelAnimationFrame(frame);removeEventListener('resize',resize);removeEventListener('pointermove',pointer);removeEventListener('scroll',scroll);geometry.dispose();material.dispose();renderer.dispose();el.removeChild(renderer.domElement)};
  },[entered]);
  return <div ref={mount} className="eclipse-canvas"><noscript><div className="eclipse-fallback" /></noscript></div>;
}
