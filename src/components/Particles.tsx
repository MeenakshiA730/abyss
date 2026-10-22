/**
 * ABYSS — Particles Component (marine snow)
 * Single THREE.Points with one BufferGeometry, seeded PRNG, ~800 particles
 * Per-frame motion mutates position attribute (needsUpdate = true)
 */

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ZoneId } from '@/config/zones';
import { ZONE_COLORS } from '@/config/zones';

interface ParticlesProps {
  zone: ZoneId;
  zoneProgress: number;
  reducedMotion: boolean;
  isPaused?: boolean;
}

// Seeded PRNG (mulberry32) - deterministic, no Math.random in render
function createSeededRandom(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function Particles({ zone, zoneProgress: _zoneProgress, reducedMotion, isPaused = false }: ParticlesProps) {
  const pointsRef = useRef<THREE.Points | null>(null);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const timeRef = useRef(0);
  const initRef = useRef(false);

  const colors = ZONE_COLORS[zone];
  const particleColor = colors.marineSnowColor;
  const particleOpacity = 0.35;

  // Build single geometry once (or when zone changes)
  useMemo(() => {
    if (initRef.current) return;
    initRef.current = true;

    const count = 800;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const alphas = new Float32Array(count);
    const phases = new Float32Array(count);
    const resetY = new Float32Array(count);
    const resetXZ = new Float32Array(count * 2);

    // Seeded PRNG for deterministic initialization
    const rand = createSeededRandom(zone.length * 1000 + Date.now() % 1000);

    // Zone-specific params
    const radius = zone === 'sunlight' ? 50 : zone === 'twilight' ? 55 : zone === 'midnight' ? 50 : 40;
    const height = zone === 'sunlight' ? 80 : zone === 'twilight' ? 90 : zone === 'midnight' ? 100 : 70;
    const baseSpeed = zone === 'sunlight' ? 0.12 : zone === 'twilight' ? 0.08 : zone === 'midnight' ? 0.05 : 0.03;
    const baseDrift = zone === 'sunlight' ? 0.4 : zone === 'twilight' ? 0.5 : zone === 'midnight' ? 0.6 : 0.4;
    const baseSize = zone === 'sunlight' ? 0.1 : zone === 'twilight' ? 0.08 : zone === 'midnight' ? 0.06 : 0.05;

    for (let i = 0; i < count; i++) {
      // Spherical shell distribution around camera
      const r = rand() * radius;
      const h = (rand() - 0.5) * height;
      const angle = rand() * Math.PI * 2;

      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = h;
      positions[i * 3 + 2] = Math.sin(angle) * r;

      // Velocity: downward + horizontal drift
      velocities[i * 3] = (rand() - 0.5) * baseDrift;
      velocities[i * 3 + 1] = -baseSpeed * (0.5 + rand() * 0.5);
      velocities[i * 3 + 2] = (rand() - 0.5) * baseDrift;

      sizes[i] = baseSize * (0.5 + rand() * 0.5);
      alphas[i] = particleOpacity * (0.5 + rand() * 0.5);
      phases[i] = rand() * Math.PI * 2;

      // Pre-compute reset position for wrapping
      resetY[i] = height / 2;
      resetXZ[i * 2] = (rand() - 0.5) * radius * 2;
      resetXZ[i * 2 + 1] = (rand() - 0.5) * radius * 2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
    geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('resetY', new THREE.BufferAttribute(resetY, 1));
    geometry.setAttribute('resetXZ', new THREE.BufferAttribute(resetXZ, 2));

    geometryRef.current = geometry;

    // Single shared material
    const material = new THREE.PointsMaterial({
      color: particleColor,
      size: 1,
      transparent: true,
      opacity: 1,
      sizeAttenuation: true,
      depthWrite: false,
      vertexColors: false,
      map: createParticleTexture(),
      alphaTest: 0.01,
    });

    const points = new THREE.Points(geometry, material);
    points.renderOrder = 0;
    pointsRef.current = points;
  }, [zone, particleColor, particleOpacity]);

  // Per-frame animation - mutate position attribute only
  useFrame((_, delta) => {
    if (reducedMotion || isPaused || !geometryRef.current) return;
    timeRef.current += delta;

    const geometry = geometryRef.current;
    const positions = geometry.attributes.position as THREE.BufferAttribute;
    const velocities = geometry.attributes.velocity as THREE.BufferAttribute;
    const alphas = geometry.attributes.alpha as THREE.BufferAttribute;
    const resetY = geometry.attributes.resetY as THREE.BufferAttribute;
    const resetXZ = geometry.attributes.resetXZ as THREE.BufferAttribute;
    const phases = geometry.attributes.phase as THREE.BufferAttribute;
    const count = positions.count;

    const halfHeight = zone === 'sunlight' ? 40 : zone === 'twilight' ? 45 : zone === 'midnight' ? 50 : 35;

    for (let i = 0; i < count; i++) {
      // Update position
      positions.setX(i, positions.getX(i) + velocities.getX(i) * delta);
      positions.setY(i, positions.getY(i) + velocities.getY(i) * delta);
      positions.setZ(i, positions.getZ(i) + velocities.getZ(i) * delta);

      // Wrap when below
      if (positions.getY(i) < -halfHeight) {
        positions.setY(i, resetY.getX(i));
        positions.setX(i, resetXZ.getX(i * 2));
        positions.setZ(i, resetXZ.getX(i * 2 + 1));
        // Fade in on reset
        alphas.setX(i, particleOpacity * (0.5 + (phases.getX(i) / (Math.PI * 2)) * 0.5));
      }

      // Gentle horizontal oscillation (deterministic via phase)
      const t = timeRef.current + phases.getX(i);
      positions.setX(i, positions.getX(i) + Math.sin(t) * 0.0005);
      positions.setZ(i, positions.getZ(i) + Math.cos(t) * 0.0005);
    }

    positions.needsUpdate = true;
  });

  if (!pointsRef.current) return null;

  return <primitive object={pointsRef.current} dispose={null} />;
}

// Shared particle texture (created once)
let particleTexture: THREE.Texture | null = null;
function createParticleTexture(): THREE.Texture {
  if (particleTexture) return particleTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.5)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);
  particleTexture = new THREE.CanvasTexture(canvas);
  particleTexture.needsUpdate = true;
  return particleTexture;
}