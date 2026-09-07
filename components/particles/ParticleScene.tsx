'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { generateParticleText } from '@/lib/particleTextGenerator';

const flowVertexShader = `
attribute float aSize;
attribute float aBrightness;
attribute float aSpeed;
attribute float aPhase;
attribute float aDirection;
attribute float aCapture;
attribute float aTone;
uniform float uTime;
uniform float uPixelRatio;
uniform float uAspect;
uniform vec2 uPointer;
uniform vec2 uParallax;
uniform vec3 uColorA;
uniform vec3 uColorB;
varying float vBrightness;
varying float vReveal;
varying vec3 vColor;

void main() {
  float progress = fract(position.x + uTime * aSpeed);
  float directed = mix(1. - progress, progress, step(0., aDirection));
  float baseX = mix(-1.42, 1.42, directed);
  float widthNoise = 1. + sin(aPhase * 2.7 + uTime * .08) * .025;
  float envelope = (.018 + pow(max(0., sin(3.14159265 * progress)), 1.08) * .57) * widthNoise;

  // Several weak, mismatched fields keep the silhouette organic instead of geometric.
  float slowDrift = sin(baseX * 3.1 + uTime * .19 + aPhase) * .018;
  float filament = sin(baseX * 8.7 - uTime * .31 + aPhase * .43) * .026;
  float turbulence = sin(baseX * 17. + uTime * .47 + aPhase * 1.7) * .009;
  float magneticPocket = sin(baseX * 5.2 + uTime * .23) * sin(aPhase * 2.3 - uTime * .11) * .035;
  float y = position.y * envelope + (slowDrift + filament + turbulence + magneticPocket) * envelope;
  float x = baseX + sin(position.y * 9. + aPhase + uTime * .13) * .009;

  float center = exp(-baseX * baseX * 7.);
  float side = mix(-1., 1., step(0., position.y + sin(aPhase) * .08));
  float deflect = step(aCapture, .63);
  float orbitEdge = .35 * (1. + sin(aPhase * 3.7 + uTime * .08) * .05);
  y += side * (orbitEdge - min(orbitEdge, abs(y))) * center * deflect;

  // A changing subset is weakly captured, spirals inward, and later exits.
  if (aCapture > .63 && abs(baseX) < .52) {
    float q = mix(.52 - baseX, baseX + .52, step(0., aDirection));
    float radius = .012 + abs(q - .52) * .69;
    float angle = aPhase + aDirection * q * 18.4 + sin(uTime * .16 + aPhase) * .35;
    x = cos(angle) * radius / uAspect;
    y = sin(angle) * radius;
  }

  vec2 p = vec2(x, y) + uParallax * position.z * .025;
  vec2 delta = vec2((p.x - uPointer.x) * uAspect, p.y - uPointer.y);
  float pointerDistance = length(delta);
  vReveal = 1. - smoothstep(.075, .34, pointerDistance);
  float push = pow(max(0., 1. - pointerDistance / .23), 2.) * .13;
  p += normalize(delta + .00001) * push * vec2(1. / uAspect, 1.);
  p += vec2(-delta.y / uAspect, delta.x) * push * .16;

  gl_Position = vec4(p, 0., 1.);
  gl_PointSize = aSize * uPixelRatio * mix(1.55, 1.08, vReveal);
  vBrightness = aBrightness * (.9 + .1 * exp(-abs(position.y) * .8));
  vColor = mix(uColorA, uColorB, aTone);
}`;

const nameVertexShader = `
attribute float aSize;
attribute float aBrightness;
attribute float aTone;
uniform float uPixelRatio;
uniform vec2 uParallax;
uniform vec3 uColorA;
uniform vec3 uColorB;
varying float vBrightness;
varying float vReveal;
varying vec3 vColor;
void main() {
  vec3 p = position;
  p.xy += uParallax * p.z * .028;
  gl_Position = vec4(p.xy, 0., 1.);
  gl_PointSize = aSize * uPixelRatio * (1. + p.z * .2);
  vBrightness = aBrightness;
  vReveal = 1.;
  vColor = mix(uColorA, uColorB, aTone);
}`;

const fragmentShader = `
precision highp float;
uniform float uOpacity;
uniform float uSoftField;
varying float vBrightness;
varying float vReveal;
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - .5);
  float core = 1. - smoothstep(.035, mix(.29, .15, vReveal), d);
  float haze = (1. - smoothstep(.08, .5, d)) * mix(.66, .18, vReveal);
  float alpha = (core * mix(.16, 1., vReveal) + haze * uSoftField) * vBrightness * uOpacity;
  if (alpha < .008) discard;
  gl_FragColor = vec4(vColor, alpha);
}`;

function tones(count: number) {
  const values = new Float32Array(count);
  for (let i = 0; i < count; i++) values[i] = Math.random();
  return values;
}

export type ParticlePalette = 'pearl' | 'ice' | 'violet' | 'aurora' | 'ember';

const colorways: Record<ParticlePalette, { flow: [string, string]; name: [string, string] }> = {
  pearl: { flow: ['#8c9396', '#f7fbff'], name: ['#cad0d2', '#ffffff'] },
  ice: { flow: ['#296bff', '#b9f4ff'], name: ['#d8e5ff', '#ffffff'] },
  violet: { flow: ['#6d35ff', '#f0a8ff'], name: ['#e4d5ff', '#fff7ff'] },
  aurora: { flow: ['#16c7a4', '#77a8ff'], name: ['#c8fff1', '#eef5ff'] },
  ember: { flow: ['#ff4f2b', '#ffd06b'], name: ['#ffe0bd', '#fffaf0'] },
};

type ColorUniforms = {
  flowA: THREE.IUniform<THREE.Color>;
  flowB: THREE.IUniform<THREE.Color>;
  nameA: THREE.IUniform<THREE.Color>;
  nameB: THREE.IUniform<THREE.Color>;
};

export default function ParticleScene({ entered, text, palette }: { entered: boolean; text: string; palette: ParticlePalette }) {
  const mount = useRef<HTMLDivElement>(null);
  const enteredRef = useRef(entered);
  const colorsRef = useRef<ColorUniforms | null>(null);
  useEffect(() => { enteredRef.current = entered; }, [entered]);
  useEffect(() => {
    const uniforms = colorsRef.current;
    if (!uniforms) return;
    const colors = colorways[palette];
    uniforms.flowA.value.set(colors.flow[0]);
    uniforms.flowB.value.set(colors.flow[1]);
    uniforms.nameA.value.set(colors.name[0]);
    uniforms.nameB.value.set(colors.name[1]);
  }, [palette]);

  useEffect(() => {
    const el = mount.current;
    if (!el) return;

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mobile = innerWidth < 720;
    const cores = navigator.hardwareConcurrency || 4;
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 4;
    const highPower = !mobile && cores >= 8 && memory >= 8;
    const flowCount = mobile ? (cores >= 8 ? 90000 : 65000) : (highPower ? 300000 : 200000);
    const nameCount = mobile ? 14000 : 34000;
    const pixelRatio = Math.min(devicePixelRatio, mobile ? 1 : 1.3);
    let aspect = Math.max(1, el.clientWidth / el.clientHeight);

    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(pixelRatio);
    renderer.setClearColor(0x020304, 1);
    renderer.domElement.setAttribute('aria-hidden', 'true');
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.Camera();
    const pointerTarget = new THREE.Vector2(4, 4);
    const pointer = new THREE.Vector2(4, 4);
    const parallax = new THREE.Vector2();
    const neutral = new THREE.Vector2();
    const initialColors = colorways[palette];

    // Static seeds are animated entirely in the vertex shader, allowing hundreds
    // of thousands of particles without a per-particle JavaScript update.
    const flowSeed = new Float32Array(flowCount * 3);
    const flowSize = new Float32Array(flowCount);
    const flowBrightness = new Float32Array(flowCount);
    const flowSpeed = new Float32Array(flowCount);
    const flowPhase = new Float32Array(flowCount);
    const flowDirection = new Float32Array(flowCount);
    const flowCapture = new Float32Array(flowCount);
    for (let i = 0; i < flowCount; i++) {
      const k = i * 3;
      flowSeed[k] = Math.random();
      const originalLane = (Math.random() + Math.random() + Math.random() + Math.random() - 2) * .5;
      const subtleVerticalFeather = Math.random() < .1 ? 1 + Math.random() * .15 : 1;
      flowSeed[k + 1] = originalLane * subtleVerticalFeather;
      flowSeed[k + 2] = Math.random() - .5;
      flowSize[i] = .48 + Math.random() * 1.38;
      flowBrightness[i] = .12 + Math.pow(Math.random(), .7) * .68;
      flowSpeed[i] = .018 + Math.random() * .032;
      flowPhase[i] = Math.random() * Math.PI * 2;
      flowDirection[i] = Math.random() < .5 ? -1 : 1;
      flowCapture[i] = Math.random();
    }
    const flowGeometry = new THREE.BufferGeometry();
    flowGeometry.setAttribute('position', new THREE.BufferAttribute(flowSeed, 3));
    flowGeometry.setAttribute('aSize', new THREE.BufferAttribute(flowSize, 1));
    flowGeometry.setAttribute('aBrightness', new THREE.BufferAttribute(flowBrightness, 1));
    flowGeometry.setAttribute('aSpeed', new THREE.BufferAttribute(flowSpeed, 1));
    flowGeometry.setAttribute('aPhase', new THREE.BufferAttribute(flowPhase, 1));
    flowGeometry.setAttribute('aDirection', new THREE.BufferAttribute(flowDirection, 1));
    flowGeometry.setAttribute('aCapture', new THREE.BufferAttribute(flowCapture, 1));
    flowGeometry.setAttribute('aTone', new THREE.BufferAttribute(tones(flowCount), 1));
    const flowUniforms = {
      uTime: { value: 0 }, uPixelRatio: { value: pixelRatio }, uAspect: { value: aspect },
      uPointer: { value: pointer }, uParallax: { value: parallax }, uOpacity: { value: .43 }, uSoftField: { value: 1 },
      uColorA: { value: new THREE.Color(initialColors.flow[0]) }, uColorB: { value: new THREE.Color(initialColors.flow[1]) },
    };
    const flowMaterial = new THREE.ShaderMaterial({ vertexShader: flowVertexShader, fragmentShader, uniforms: flowUniforms, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending });
    const flowPoints = new THREE.Points(flowGeometry, flowMaterial);
    flowPoints.renderOrder = 0;
    scene.add(flowPoints);

    const holeGeometry = new THREE.CircleGeometry(1, 96);
    const holeMaterial = new THREE.MeshBasicMaterial({ color: 0x010102, depthTest: false, depthWrite: false });
    const hole = new THREE.Mesh(holeGeometry, holeMaterial);
    hole.renderOrder = 1;
    scene.add(hole);

    const target = generateParticleText(text, nameCount);
    const namePosition = new Float32Array(nameCount * 3);
    const nameVelocity = new Float32Array(nameCount * 2);
    const nameRandom = new Float32Array(nameCount * 2);
    for (let i = 0; i < nameCount; i++) {
      const k = i * 3;
      const v = i * 2;
      nameRandom[v] = Math.random() * Math.PI * 2;
      nameRandom[v + 1] = .4 + Math.random() * .9;
      namePosition[k] = reduced ? target.positions[k] : Math.random() * 2.4 - 1.2;
      namePosition[k + 1] = reduced ? target.positions[k + 1] : (Math.random() + Math.random() - 1) * .72;
      namePosition[k + 2] = target.positions[k + 2];
    }
    const nameGeometry = new THREE.BufferGeometry();
    const namePositionAttr = new THREE.BufferAttribute(namePosition, 3).setUsage(THREE.DynamicDrawUsage);
    nameGeometry.setAttribute('position', namePositionAttr);
    nameGeometry.setAttribute('aSize', new THREE.BufferAttribute(target.sizes, 1));
    nameGeometry.setAttribute('aBrightness', new THREE.BufferAttribute(target.brightness, 1));
    nameGeometry.setAttribute('aTone', new THREE.BufferAttribute(tones(nameCount), 1));
    const nameColorA = { value: new THREE.Color(initialColors.name[0]) };
    const nameColorB = { value: new THREE.Color(initialColors.name[1]) };
    const nameMaterial = new THREE.ShaderMaterial({
      vertexShader: nameVertexShader, fragmentShader,
      uniforms: { uPixelRatio: { value: pixelRatio }, uParallax: { value: parallax }, uOpacity: { value: .96 }, uSoftField: { value: .3 }, uColorA: nameColorA, uColorB: nameColorB },
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const namePoints = new THREE.Points(nameGeometry, nameMaterial);
    namePoints.renderOrder = 2;
    scene.add(namePoints);
    colorsRef.current = { flowA: flowUniforms.uColorA, flowB: flowUniforms.uColorB, nameA: nameColorA, nameB: nameColorB };

    let frame = 0;
    let last = performance.now();
    let visible = true;
    const resize = () => {
      aspect = Math.max(1, el.clientWidth / el.clientHeight);
      renderer.setSize(el.clientWidth, el.clientHeight, false);
      flowUniforms.uAspect.value = aspect;
      hole.scale.set(.255 / aspect, .255, 1);
    };
    const onPointer = (event: PointerEvent) => pointerTarget.set(event.clientX / innerWidth * 2 - 1, -(event.clientY / innerHeight * 2 - 1));
    const onLeave = () => pointerTarget.set(4, 4);
    const onScroll = () => { visible = scrollY < innerHeight; };

    const render = (now: number) => {
      const dt = Math.min((now - last) / 16.67, 1.7);
      last = now;
      pointer.lerp(pointerTarget, .1);
      parallax.lerp(pointerTarget.length() < 2 ? pointer : neutral, .03);
      flowUniforms.uTime.value = reduced ? 0 : now * .001;

      const active = enteredRef.current || reduced;
      const mouseActive = !reduced && pointer.length() < 2;
      const mouseRadius = mobile ? .24 : .19;
      const mouseRadius2 = mouseRadius * mouseRadius;
      for (let i = 0; i < nameCount; i++) {
        const k = i * 3;
        const v = i * 2;
        let x = namePosition[k], y = namePosition[k + 1];
        let vx = nameVelocity[v], vy = nameVelocity[v + 1];
        if (active) {
          vx += (target.positions[k] - x) * (reduced ? .2 : .018) * dt;
          vy += (target.positions[k + 1] - y) * (reduced ? .2 : .018) * dt;
        } else {
          const angle = nameRandom[v] + now * .00006 * nameRandom[v + 1];
          vx += (Math.cos(angle) * .000025 + .000018) * dt;
          vy += Math.sin(angle) * .000025 * dt;
        }
        if (mouseActive) {
          const dx = (x - pointer.x) * aspect, dy = y - pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < mouseRadius2) {
            const d = Math.sqrt(d2) + .0001;
            const force = Math.pow(1 - d / mouseRadius, 2) * .012 * dt;
            vx += dx / d * force / aspect - dy / d * force * .18;
            vy += dy / d * force + dx / d * force * .18;
          }
        }
        vx *= reduced ? .55 : .91;
        vy *= reduced ? .55 : .91;
        namePosition[k] = x + vx * dt;
        namePosition[k + 1] = y + vy * dt;
        nameVelocity[v] = vx;
        nameVelocity[v + 1] = vy;
      }
      namePositionAttr.needsUpdate = true;
      if (visible) renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };

    resize();
    addEventListener('resize', resize);
    addEventListener('pointermove', onPointer);
    addEventListener('pointerleave', onLeave);
    addEventListener('scroll', onScroll, { passive: true });
    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener('resize', resize);
      removeEventListener('pointermove', onPointer);
      removeEventListener('pointerleave', onLeave);
      removeEventListener('scroll', onScroll);
      flowGeometry.dispose(); flowMaterial.dispose(); holeGeometry.dispose(); holeMaterial.dispose(); nameGeometry.dispose(); nameMaterial.dispose();
      colorsRef.current = null;
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [text]);

  return <div ref={mount} className="eclipse-canvas particle-canvas"><noscript><p className="canvas-fallback">LIANGRAY LI</p></noscript></div>;
}
