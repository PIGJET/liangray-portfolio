'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { generateParticleText } from '@/lib/particleTextGenerator';

const vertexShader = `
attribute float aSize;attribute float aBrightness;
uniform vec2 uParallax;varying float vBrightness;
void main(){
 vec3 p=position;p.xy+=uParallax*p.z*.035;
 gl_Position=vec4(p.xy,0.,1.);
 gl_PointSize=aSize*(1.+p.z*.28);
 vBrightness=aBrightness;
}`;

const fragmentShader = `
precision highp float;varying float vBrightness;
void main(){
 vec2 p=gl_PointCoord-.5;float d=length(p);
 float core=1.-smoothstep(.05,.24,d);
 float glow=(1.-smoothstep(.08,.5,d))*.28;
 float alpha=(core+glow)*vBrightness;
 gl_FragColor=vec4(vec3(.84,.87,.86)+vBrightness*.14,alpha);
}`;

export default function ParticleScene({entered,text}:{entered:boolean;text:string}){
 const mount=useRef<HTMLDivElement>(null);const enteredRef=useRef(entered);
 useEffect(()=>{enteredRef.current=entered},[entered]);
 useEffect(()=>{
  const el=mount.current;if(!el)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile=innerWidth<720;const count=mobile?12000:32000;
  const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance',alpha:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1:1.35));renderer.setClearColor(0x030504,1);renderer.domElement.setAttribute('aria-hidden','true');el.appendChild(renderer.domElement);

  const target=generateParticleText(text,count);const current=new Float32Array(count*3);const velocity=new Float32Array(count*3);const random=new Float32Array(count*3);
  for(let i=0;i<count;i++){
   const k=i*3;random[k]=Math.random()*6.283;random[k+1]=.4+Math.random()*.9;random[k+2]=Math.random();
   if(reduced){current[k]=target.positions[k];current[k+1]=target.positions[k+1];current[k+2]=target.positions[k+2];}
   else{const angle=Math.random()*6.283,rad=.35+Math.random()*1.25;current[k]=Math.cos(angle)*rad;current[k+1]=Math.sin(angle)*rad;current[k+2]=target.positions[k+2];}
  }

  const geometry=new THREE.BufferGeometry();const positionAttr=new THREE.BufferAttribute(current,3);positionAttr.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('position',positionAttr);geometry.setAttribute('aSize',new THREE.BufferAttribute(target.sizes,1));geometry.setAttribute('aBrightness',new THREE.BufferAttribute(target.brightness,1));
  const uniforms={uParallax:{value:new THREE.Vector2()}};const material=new THREE.ShaderMaterial({vertexShader,fragmentShader,uniforms,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});const scene=new THREE.Scene(),camera=new THREE.Camera();scene.add(new THREE.Points(geometry,material));

  const pointerTarget=new THREE.Vector2(5,5),pointer=new THREE.Vector2(5,5),neutral=new THREE.Vector2();let frame=0,last=performance.now(),visible=true;
  const resize=()=>renderer.setSize(el.clientWidth,el.clientHeight,false);
  const setPointer=(x:number,y:number)=>pointerTarget.set(x/innerWidth*2-1,-(y/innerHeight*2-1));
  const onPointer=(e:PointerEvent)=>setPointer(e.clientX,e.clientY);const onLeave=()=>pointerTarget.set(5,5);const onScroll=()=>{visible=scrollY<innerHeight};
  const render=(now:number)=>{
   const dt=Math.min((now-last)/16.67,1.7);last=now;pointer.lerp(pointerTarget,.09);uniforms.uParallax.value.lerp(pointerTarget.length()<2?pointer:neutral,.035);
   const active=enteredRef.current||reduced;const radius=mobile?.19:.16,radius2=radius*radius;
   for(let i=0;i<count;i++){
    const k=i*3;let x=current[k],y=current[k+1],vx=velocity[k],vy=velocity[k+1];const ox=target.positions[k],oy=target.positions[k+1];
    if(active){vx+=(ox-x)*(reduced?.2:.018)*dt;vy+=(oy-y)*(reduced?.2:.018)*dt;}
    else{const a=random[k]+now*.00006*random[k+1];vx+=Math.cos(a)*.000025;vy+=Math.sin(a)*.000025;}
    const dx=x-pointer.x,dy=y-pointer.y,d2=dx*dx+dy*dy;
    if(!reduced&&d2<radius2){const d=Math.sqrt(d2)+.0001,fall=1-d/radius,force=fall*fall*.012*dt;vx+=dx/d*force-dy/d*force*.18;vy+=dy/d*force+dx/d*force*.18;}
    vx*=reduced?.55:.91;vy*=reduced?.55:.91;x+=vx*dt;y+=vy*dt;current[k]=x;current[k+1]=y;velocity[k]=vx;velocity[k+1]=vy;
   }
   positionAttr.needsUpdate=true;if(visible)renderer.render(scene,camera);frame=requestAnimationFrame(render);
  };
  resize();addEventListener('resize',resize);addEventListener('pointermove',onPointer);addEventListener('pointerleave',onLeave);addEventListener('scroll',onScroll,{passive:true});frame=requestAnimationFrame(render);
  return()=>{cancelAnimationFrame(frame);removeEventListener('resize',resize);removeEventListener('pointermove',onPointer);removeEventListener('pointerleave',onLeave);removeEventListener('scroll',onScroll);geometry.dispose();material.dispose();renderer.dispose();el.removeChild(renderer.domElement)};
 },[text]);
 return <div ref={mount} className="eclipse-canvas particle-canvas"><noscript><p className="canvas-fallback">LIANGRAY LI</p></noscript></div>;
}
