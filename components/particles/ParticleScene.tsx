'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { generateParticleText } from '@/lib/particleTextGenerator';

const vertexShader = `
attribute float aSize;
attribute float aBrightness;
attribute vec3 aColor;
uniform vec2 uParallax;
uniform vec2 uPointer;
uniform float uPixelRatio;
uniform float uInteractive;
varying float vBrightness;
varying vec3 vColor;
varying float vReveal;
void main() {
  vec3 p = position;
  p.xy += uParallax * p.z * .028;
  float pointerDistance = distance(p.xy, uPointer);
  vReveal = mix(1., 1. - smoothstep(.08, .34, pointerDistance), uInteractive);
  gl_Position = vec4(p.xy, 0., 1.);
  gl_PointSize = aSize * uPixelRatio * (1.45 + p.z * .2 - vReveal * .25);
  vBrightness = aBrightness;
  vColor = aColor;
}`;

const fragmentShader = `
precision highp float;
uniform float uOpacity;
varying float vBrightness;
varying vec3 vColor;
varying float vReveal;
void main() {
  float d = length(gl_PointCoord - .5);
  float core = 1. - smoothstep(.035, mix(.28, .16, vReveal), d);
  float glow = (1. - smoothstep(.1, .5, d)) * mix(.62, .2, vReveal);
  float alpha = (core * mix(.22, 1., vReveal) + glow) * vBrightness * uOpacity;
  if (alpha < .01) discard;
  gl_FragColor = vec4(vColor, alpha);
}`;

function material(opacity: number, pixelRatio: number, parallax: THREE.Vector2, pointer: THREE.Vector2, interactive = true) {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uParallax: { value: parallax },
      uPointer: { value: pointer },
      uPixelRatio: { value: pixelRatio },
      uInteractive: { value: interactive ? 1 : 0 },
      uOpacity: { value: opacity },
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

function colorAttributes(count: number, palette: number[][]) {
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colors.set(palette[(Math.random() * palette.length) | 0], i * 3);
  return colors;
}

export default function ParticleScene({ entered, text }: { entered: boolean; text: string }) {
  const mount = useRef<HTMLDivElement>(null);
  const enteredRef = useRef(entered);
  useEffect(() => { enteredRef.current = entered; }, [entered]);

  useEffect(() => {
    const el = mount.current;
    if (!el) return;

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mobile = innerWidth < 720;
    const nameCount = mobile ? 14000 : 34000;
    const flowCount = mobile ? 16000 : 44000;
    const streamCount = mobile ? 5000 : 14000;
    let aspect = Math.max(1, el.clientWidth / el.clientHeight);
    const pixelRatio = Math.min(devicePixelRatio, mobile ? 1 : 1.35);

    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(pixelRatio);
    renderer.setClearColor(0x020304, 1);
    renderer.domElement.setAttribute('aria-hidden', 'true');
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.Camera();
    const parallax = new THREE.Vector2();
    const pointerTarget = new THREE.Vector2(4, 4);
    const pointer = new THREE.Vector2(4, 4);
    const neutral = new THREE.Vector2();
    const disposables: Array<THREE.BufferGeometry | THREE.Material> = [];

    // Horizontal wind field. Particles share narrow lanes but move independently.
    const flowPosition = new Float32Array(flowCount * 3);
    const flowVelocity = new Float32Array(flowCount * 2);
    const flowLane = new Float32Array(flowCount);
    const flowSpeed = new Float32Array(flowCount);
    const flowPhase = new Float32Array(flowCount);
    const flowDirection = new Int8Array(flowCount);
    const flowCapture = new Uint8Array(flowCount);
    const flowBrightness = new Float32Array(flowCount);
    const flowSize = new Float32Array(flowCount);
    for (let i = 0; i < flowCount; i++) {
      const k = i * 3;
      const lane = (Math.random() + Math.random() + Math.random() + Math.random() - 2) * .5;
      const x = Math.random() * 2.7 - 1.35;
      const progress = (x + 1.35) / 2.7;
      const beamWidth = .026 + Math.pow(Math.sin(Math.PI * progress), 1.15) * .54;
      flowPosition[k] = x;
      flowPosition[k + 1] = lane * beamWidth;
      flowPosition[k + 2] = Math.random() * .9 - .45;
      flowLane[i] = lane;
      flowSpeed[i] = .00115 + Math.random() * .0024;
      flowPhase[i] = Math.random() * Math.PI * 2;
      flowDirection[i] = Math.random() < .68 ? 1 : -1;
      flowCapture[i] = Math.random() < .16 ? 1 : 0;
      flowBrightness[i] = .16 + Math.random() * .62;
      flowSize[i] = .5 + Math.random() * 1.55;
    }
    const flowGeometry = new THREE.BufferGeometry();
    const flowPositionAttr = new THREE.BufferAttribute(flowPosition, 3).setUsage(THREE.DynamicDrawUsage);
    flowGeometry.setAttribute('position', flowPositionAttr);
    flowGeometry.setAttribute('aSize', new THREE.BufferAttribute(flowSize, 1));
    flowGeometry.setAttribute('aBrightness', new THREE.BufferAttribute(flowBrightness, 1));
    flowGeometry.setAttribute('aColor', new THREE.BufferAttribute(colorAttributes(flowCount, [
      [.42, .63, 1], [.58, .43, .92], [.56, .78, 1], [.78, .82, .94],
    ]), 3));
    const flowMaterial = material(.46, pixelRatio, parallax, pointer);
    const flowPoints = new THREE.Points(flowGeometry, flowMaterial);
    flowPoints.renderOrder = 0;
    scene.add(flowPoints);
    disposables.push(flowGeometry, flowMaterial);

    // The black event horizon sits between the wind field and the brighter ring/name.
    const holeGeometry = new THREE.CircleGeometry(1, 96);
    const holeMaterial = new THREE.MeshBasicMaterial({ color: 0x010102, depthTest: false, depthWrite: false });
    const hole = new THREE.Mesh(holeGeometry, holeMaterial);
    hole.renderOrder = 1;
    scene.add(hole);
    disposables.push(holeGeometry, holeMaterial);

    // This accretion stream has a finite lifetime: every point enters, crosses the
    // vortex, exits, and is replaced by a fresh particle from either screen edge.
    const streamPosition = new Float32Array(streamCount * 3);
    const streamProgress = new Float32Array(streamCount);
    const streamSpeed = new Float32Array(streamCount);
    const streamLane = new Float32Array(streamCount);
    const streamPhase = new Float32Array(streamCount);
    const streamDirection = new Int8Array(streamCount);
    const streamFalls = new Uint8Array(streamCount);
    const streamBrightness = new Float32Array(streamCount);
    const streamSize = new Float32Array(streamCount);
    for (let i = 0; i < streamCount; i++) {
      streamProgress[i] = Math.random();
      streamSpeed[i] = .00012 + Math.random() * .00025;
      streamLane[i] = (Math.random() + Math.random() - 1) * .28;
      streamPhase[i] = Math.random() * Math.PI * 2;
      streamDirection[i] = Math.random() < .5 ? 1 : -1;
      streamFalls[i] = Math.random() < .38 ? 1 : 0;
      streamBrightness[i] = .22 + Math.random() * .72;
      streamSize[i] = .6 + Math.random() * 1.8;
    }
    const streamGeometry = new THREE.BufferGeometry();
    const streamPositionAttr = new THREE.BufferAttribute(streamPosition, 3).setUsage(THREE.DynamicDrawUsage);
    streamGeometry.setAttribute('position', streamPositionAttr);
    streamGeometry.setAttribute('aSize', new THREE.BufferAttribute(streamSize, 1));
    streamGeometry.setAttribute('aBrightness', new THREE.BufferAttribute(streamBrightness, 1));
    streamGeometry.setAttribute('aColor', new THREE.BufferAttribute(colorAttributes(streamCount, [
      [.47, .76, 1], [.68, .48, 1], [.8, .88, 1], [.38, .56, .96],
    ]), 3));
    const streamMaterial = material(.72, pixelRatio, parallax, pointer);
    const streamPoints = new THREE.Points(streamGeometry, streamMaterial);
    streamPoints.renderOrder = 2;
    scene.add(streamPoints);
    disposables.push(streamGeometry, streamMaterial);

    // The existing elastic particle typography remains the foreground layer.
    const target = generateParticleText(text, nameCount);
    const namePosition = new Float32Array(nameCount * 3);
    const nameVelocity = new Float32Array(nameCount * 2);
    const nameRandom = new Float32Array(nameCount * 2);
    for (let i = 0; i < nameCount; i++) {
      const k = i * 3;
      nameRandom[i * 2] = Math.random() * Math.PI * 2;
      nameRandom[i * 2 + 1] = .4 + Math.random() * .9;
      if (reduced) {
        namePosition[k] = target.positions[k];
        namePosition[k + 1] = target.positions[k + 1];
      } else {
        namePosition[k] = Math.random() * 2.4 - 1.2;
        namePosition[k + 1] = (Math.random() + Math.random() - 1) * .72;
      }
      namePosition[k + 2] = target.positions[k + 2];
    }
    const nameGeometry = new THREE.BufferGeometry();
    const namePositionAttr = new THREE.BufferAttribute(namePosition, 3).setUsage(THREE.DynamicDrawUsage);
    nameGeometry.setAttribute('position', namePositionAttr);
    nameGeometry.setAttribute('aSize', new THREE.BufferAttribute(target.sizes, 1));
    nameGeometry.setAttribute('aBrightness', new THREE.BufferAttribute(target.brightness, 1));
    nameGeometry.setAttribute('aColor', new THREE.BufferAttribute(colorAttributes(nameCount, [[.9, .93, .94], [.75, .83, .95], [1, 1, 1]]), 3));
    const nameMaterial = material(.96, pixelRatio, parallax, pointer, false);
    const namePoints = new THREE.Points(nameGeometry, nameMaterial);
    namePoints.renderOrder = 3;
    scene.add(namePoints);
    disposables.push(nameGeometry, nameMaterial);

    let frame = 0;
    let last = performance.now();
    let visible = true;

    const resize = () => {
      aspect = Math.max(1, el.clientWidth / el.clientHeight);
      renderer.setSize(el.clientWidth, el.clientHeight, false);
      hole.scale.set(.255 / aspect, .255, 1);
    };
    const onPointer = (event: PointerEvent) => pointerTarget.set(event.clientX / innerWidth * 2 - 1, -(event.clientY / innerHeight * 2 - 1));
    const onLeave = () => pointerTarget.set(4, 4);
    const onScroll = () => { visible = scrollY < innerHeight; };

    const render = (now: number) => {
      const dt = Math.min((now - last) / 16.67, 1.7);
      last = now;
      const time = now * .001;
      pointer.lerp(pointerTarget, .1);
      parallax.lerp(pointerTarget.length() < 2 ? pointer : neutral, .03);
      const mouseActive = !reduced && pointer.length() < 2;
      const mouseRadius = mobile ? .24 : .19;
      const mouseRadius2 = mouseRadius * mouseRadius;

      for (let i = 0; i < flowCount; i++) {
        const k = i * 3;
        const v = i * 2;
        let x = flowPosition[k];
        let y = flowPosition[k + 1];
        let vx = flowVelocity[v];
        let vy = flowVelocity[v + 1];
        const direction = flowDirection[i];
        x += flowSpeed[i] * direction * dt;
        if ((direction > 0 && x > 1.36) || (direction < 0 && x < -1.36)) {
          x = direction > 0 ? -1.36 : 1.36;
          y = flowLane[i] * .026;
          vx = 0;
          vy = 0;
        }

        const lane = flowLane[i];
        const travel = direction > 0 ? (x + 1.36) / 2.72 : (1.36 - x) / 2.72;
        const beamWidth = .026 + Math.pow(Math.sin(Math.PI * Math.max(0, Math.min(1, travel))), 1.15) * .54;
        const wave = Math.sin(x * 5.2 + flowPhase[i] + time * .38) * (.006 + beamWidth * .035);
        const influence = Math.exp(-x * x * 5.5);
        let targetY = lane * beamWidth + wave;

        if (flowCapture[i] && Math.abs(x) < .52) {
          const q = direction > 0 ? (x + .52) / 1.04 : (.52 - x) / 1.04;
          const radius = .035 + Math.abs(q - .5) * .64;
          const angle = direction * q * Math.PI * 5 + flowPhase[i];
          const targetX = Math.cos(angle) * radius / aspect;
          targetY = Math.sin(angle) * radius;
          vx += (targetX - x) * .055 * dt;
          vy += (targetY - y) * .055 * dt;
        } else if (Math.abs(targetY) < .36) {
          const side = targetY === 0 ? (i & 1 ? 1 : -1) : Math.sign(targetY);
          targetY += side * (.37 - Math.abs(targetY)) * influence * .9;
          vy += (targetY - y) * .038 * dt;
        } else {
          vy += (targetY - y) * .025 * dt;
        }

        vx += (flowSpeed[i] * direction - vx) * .012 * dt;
        if (mouseActive) {
          const dx = (x - pointer.x) * aspect;
          const dy = y - pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < mouseRadius2) {
            const d = Math.sqrt(d2) + .0001;
            const force = Math.pow(1 - d / mouseRadius, 2) * .009 * dt;
            vx += dx / d * force / aspect - dy / d * force * .14;
            vy += dy / d * force + dx / d * force * .14;
          }
        }
        vx *= .93;
        vy *= .92;
        flowPosition[k] = x + vx * dt;
        flowPosition[k + 1] = y + vy * dt;
        flowVelocity[v] = vx;
        flowVelocity[v + 1] = vy;
      }

      for (let i = 0; i < streamCount; i++) {
        let progress = streamProgress[i] + streamSpeed[i] * dt;
        if (progress >= 1) {
          progress -= 1;
          streamDirection[i] = Math.random() < .5 ? 1 : -1;
          streamLane[i] = (Math.random() + Math.random() - 1) * .28;
          streamPhase[i] = Math.random() * Math.PI * 2;
          streamFalls[i] = Math.random() < .38 ? 1 : 0;
        }
        streamProgress[i] = progress;
        const direction = streamDirection[i];
        const baseX = direction > 0 ? -1.38 + progress * 2.76 : 1.38 - progress * 2.76;
        const lane = streamLane[i];
        const beamWidth = .018 + Math.pow(Math.sin(Math.PI * progress), 1.2) * .34;
        const k = i * 3;
        let x = baseX;
        let y = lane * beamWidth + Math.sin(baseX * 6 + streamPhase[i] + time * .55) * (.004 + beamWidth * .035);
        const centerInfluence = Math.exp(-baseX * baseX * 7);
        if (streamFalls[i] && Math.abs(baseX) < .5) {
          const q = direction > 0 ? (baseX + .5) : (.5 - baseX);
          const radius = .014 + Math.abs(q - .5) * .72;
          const angle = streamPhase[i] + direction * q * Math.PI * 6;
          x = Math.cos(angle) * radius / aspect;
          y = Math.sin(angle) * radius;
        } else if (Math.abs(y) < .34) {
          const side = y === 0 ? (i & 1 ? 1 : -1) : Math.sign(y);
          y += side * (.36 - Math.abs(y)) * centerInfluence;
        }
        if (mouseActive) {
          const dx = (x - pointer.x) * aspect;
          const dy = y - pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < mouseRadius2) {
            const d = Math.sqrt(d2) + .0001;
            const push = Math.pow(1 - d / mouseRadius, 2) * .12;
            x += dx / d * push / aspect;
            y += dy / d * push;
          }
        }
        streamPosition[k] = x;
        streamPosition[k + 1] = y;
        streamPosition[k + 2] = (i % 23) / 23 * .6 - .3;
      }

      const active = enteredRef.current || reduced;
      for (let i = 0; i < nameCount; i++) {
        const k = i * 3;
        const v = i * 2;
        let x = namePosition[k];
        let y = namePosition[k + 1];
        let vx = nameVelocity[v];
        let vy = nameVelocity[v + 1];
        if (active) {
          vx += (target.positions[k] - x) * (reduced ? .2 : .018) * dt;
          vy += (target.positions[k + 1] - y) * (reduced ? .2 : .018) * dt;
        } else {
          const angle = nameRandom[v] + time * .06 * nameRandom[v + 1];
          vx += (Math.cos(angle) * .000025 + .000018) * dt;
          vy += Math.sin(angle) * .000025 * dt;
        }
        if (mouseActive) {
          const dx = (x - pointer.x) * aspect;
          const dy = y - pointer.y;
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

      flowPositionAttr.needsUpdate = true;
      streamPositionAttr.needsUpdate = true;
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
      disposables.forEach((item) => item.dispose());
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [text]);

  return <div ref={mount} className="eclipse-canvas particle-canvas"><noscript><p className="canvas-fallback">LIANGRAY LI</p></noscript></div>;
}
