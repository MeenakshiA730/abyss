/**
 * ABYSS — Particles Component
 * Marine snow, bioluminescent organisms, and drifting particulates at multiple depth layers
 * Uses unified zone configuration from @/config/zones
 */

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ZoneId } from '@/config/zones';
import { ZONE_COLORS, ZONE_VISIBILITY } from '@/config/zones';

interface ParticlesProps {
  zone: ZoneId;
  zoneProgress: number;
  reducedMotion: boolean;
  isPaused?: boolean;
}

export function Particles({ zone, zoneProgress: _zoneProgress, reducedMotion, isPaused = false }: ParticlesProps) {
  const particleSystemsRef = useRef<THREE.Points[]>([]);
  const timeRef = useRef(0);

  // Get visibility rules and colors for current zone
  const visibility = ZONE_VISIBILITY[zone];
  const colors = ZONE_COLORS[zone];

  // Create marine snow layers based on zone config
  const createLayerGeometry = (config: { count: number; size: number; speed: number; color: string; opacity: number; radius: number; height: number; drift: number }, layerIndex: number) => {
    const geometry = new THREE.BufferGeometry();
    const count = config.count;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const alphas = new Float32Array(count);
    // Pre-computed reset positions and alphas to avoid Math.random() in useFrame
    const resetPositions = new Float32Array(count * 2);
    const resetAlphas = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Spherical distribution around camera
      const radius = Math.random() * config.radius;
      const height = (Math.random() - 0.5) * config.height;
      const angle = Math.random() * Math.PI * 2;

      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = height;
      positions[i * 3 + 2] = Math.sin(angle) * radius;

      // Velocity (downward drift with some horizontal movement)
      velocities[i * 3] = (Math.random() - 0.5) * config.drift;
      velocities[i * 3 + 1] = -config.speed * (0.5 + Math.random() * 0.5);
      velocities[i * 3 + 2] = (Math.random() - 0.5) * config.drift;

      sizes[i] = config.size * (0.5 + Math.random() * 0.5);
      phases[i] = Math.random() * Math.PI * 2;
      alphas[i] = config.opacity * (0.5 + Math.random() * 0.5);

      // Pre-compute reset position (x, z) and alpha for when particle wraps
      resetPositions[i * 2] = (Math.random() - 0.5) * config.radius * 2;
      resetPositions[i * 2 + 1] = (Math.random() - 0.5) * config.radius * 2;
      resetAlphas[i] = config.opacity * (0.5 + Math.random() * 0.5);
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
    geometry.setAttribute('resetPosition', new THREE.BufferAttribute(resetPositions, 2));
    geometry.setAttribute('resetAlpha', new THREE.BufferAttribute(resetAlphas, 1));

    return { geometry, config, layerIndex };
  };

  // Create bioluminescent particle geometry
  const createBioGeometry = (config: { count: number; size: number; color: string; opacity: number; pulseSpeed: number }) => {
    const geometry = new THREE.BufferGeometry();
    const count = config.count;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const baseSizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const radius = Math.random() * 80 + 20;
      const height = (Math.random() - 0.5) * 120;
      const angle = Math.random() * Math.PI * 2;

      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = height;
      positions[i * 3 + 2] = Math.sin(angle) * radius;

      const baseSize = config.size * (0.5 + Math.random() * 0.5);
      sizes[i] = baseSize;
      baseSizes[i] = baseSize;
      phases[i] = Math.random() * Math.PI * 2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('baseSize', new THREE.BufferAttribute(baseSizes, 1));

    return { geometry, config };
  };

  // Initialize particle systems based on zone visibility
  useMemo(() => {
    particleSystemsRef.current = [];

    // Marine snow layers - density and count based on zone
    const layerConfigs = getMarineSnowLayers(zone);
    layerConfigs.forEach((layerConfig, i) => {
      const { geometry, config } = createLayerGeometry(layerConfig, i);

      const material = new THREE.PointsMaterial({
        color: config.color,
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
      points.renderOrder = i;
      particleSystemsRef.current.push(points);
    });

    // Bioluminescent layer - only in zones where visible
    if (visibility.bioluminescentOrgs) {
      const bioConfig = getBioConfig(zone);
      const { geometry: bioGeometry, config: bioConfigData } = createBioGeometry(bioConfig);
      const bioMaterial = new THREE.PointsMaterial({
        color: bioConfigData.color,
        size: 1,
        transparent: true,
        opacity: bioConfigData.opacity,
        sizeAttenuation: true,
        depthWrite: false,
        map: createBioTexture(),
        blending: THREE.AdditiveBlending,
      });

      const bioPoints = new THREE.Points(bioGeometry, bioMaterial);
      bioPoints.renderOrder = 10;
      particleSystemsRef.current.push(bioPoints);
    }
  }, [zone, visibility.bioluminescentOrgs, colors]);

  // Animate particles
  useFrame((_, delta) => {
    if (reducedMotion || isPaused) return;
    timeRef.current += delta;

    particleSystemsRef.current.forEach((points, systemIndex) => {
      const geometry = points.geometry as THREE.BufferGeometry;
      const positions = geometry.attributes.position;
      const isBio = systemIndex === particleSystemsRef.current.length - 1 && visibility.bioluminescentOrgs;

      if (isBio) {
        // Bioluminescent pulsing - slower and more subtle
        const sizes = geometry.attributes.size;
        const baseSizes = geometry.attributes.baseSize;
        const phases = geometry.attributes.phase;
        const bioConfig = getBioConfig(zone);

        for (let i = 0; i < sizes.count; i++) {
          const phase = phases.getX(i);
          const pulse = Math.sin(timeRef.current * bioConfig.pulseSpeed + phase) * 0.5 + 0.5;
          sizes.setX(i, baseSizes.getX(i) * (0.7 + pulse * 0.3));
        }
        sizes.needsUpdate = true;

        // Slow rotation of bio cloud
        points.rotation.y += delta * 0.005;
      } else {
        // Marine snow falling
        const velocities = geometry.attributes.velocity;
        const alphas = geometry.attributes.alpha;
        const resetPositions = geometry.attributes.resetPosition;
        const resetAlphas = geometry.attributes.resetAlpha;
        const layerConfigs = getMarineSnowLayers(zone);
        const config = layerConfigs[systemIndex];
        const layerHeight = config.height;

        for (let i = 0; i < positions.count; i++) {
          // Update position
          positions.setX(i, positions.getX(i) + velocities.getX(i) * delta);
          positions.setY(i, positions.getY(i) + velocities.getY(i) * delta);
          positions.setZ(i, positions.getZ(i) + velocities.getZ(i) * delta);

          // Wrap around when particles go below
          if (positions.getY(i) < -layerHeight / 2) {
            positions.setY(i, layerHeight / 2);
            // Use pre-computed reset positions and alphas
            positions.setX(i, resetPositions.getX(i));
            positions.setZ(i, resetPositions.getY(i));
            alphas.setX(i, resetAlphas.getX(i));
          }

          // Gentle horizontal oscillation
          positions.setX(i, positions.getX(i) + Math.sin(timeRef.current + i) * 0.001);
          positions.setZ(i, positions.getZ(i) + Math.cos(timeRef.current + i) * 0.001);
        }
        positions.needsUpdate = true;
      }
    });
  });

  return (
    <group>
      {particleSystemsRef.current.map((points, i) => (
        <primitive key={`particles-${i}`} object={points} dispose={null} />
      ))}
    </group>
  );
}

// Zone-specific marine snow layer configurations
function getMarineSnowLayers(zone: ZoneId) {
  const colors = ZONE_COLORS[zone];
  const baseLayers = {
    sunlight: [
      { count: 800, size: 0.08, speed: 0.15, color: colors.marineSnowColor, opacity: 0.4, radius: 40, height: 60, drift: 0.3 },
      { count: 400, size: 0.12, speed: 0.1, color: colors.marineSnowColor, opacity: 0.3, radius: 50, height: 80, drift: 0.5 },
      { count: 200, size: 0.2, speed: 0.05, color: colors.marineSnowColor, opacity: 0.2, radius: 60, height: 100, drift: 0.8 },
    ],
    twilight: [
      { count: 600, size: 0.06, speed: 0.12, color: colors.marineSnowColor, opacity: 0.35, radius: 45, height: 70, drift: 0.4 },
      { count: 300, size: 0.1, speed: 0.08, color: colors.marineSnowColor, opacity: 0.25, radius: 55, height: 90, drift: 0.6 },
      { count: 150, size: 0.15, speed: 0.04, color: colors.marineSnowColor, opacity: 0.15, radius: 65, height: 110, drift: 1.0 },
    ],
    midnight: [
      { count: 400, size: 0.05, speed: 0.08, color: colors.marineSnowColor, opacity: 0.3, radius: 40, height: 80, drift: 0.5 },
      { count: 200, size: 0.08, speed: 0.05, color: colors.marineSnowColor, opacity: 0.2, radius: 50, height: 100, drift: 0.8 },
      { count: 100, size: 0.12, speed: 0.03, color: colors.marineSnowColor, opacity: 0.1, radius: 60, height: 120, drift: 1.2 },
    ],
    abyss: [
      { count: 200, size: 0.04, speed: 0.04, color: colors.marineSnowColor, opacity: 0.25, radius: 35, height: 60, drift: 0.3 },
      { count: 100, size: 0.06, speed: 0.02, color: colors.marineSnowColor, opacity: 0.15, radius: 45, height: 80, drift: 0.5 },
      { count: 50, size: 0.1, speed: 0.01, color: colors.marineSnowColor, opacity: 0.1, radius: 55, height: 100, drift: 0.8 },
    ],
  };
  return baseLayers[zone] || baseLayers.abyss;
}

// Zone-specific bioluminescent config
function getBioConfig(zone: ZoneId) {
  const colors = ZONE_COLORS[zone];
  const configs = {
    sunlight: { count: 50, size: 0.3, color: colors.bioParticleColor, opacity: 0.5, pulseSpeed: 0.6 },
    twilight: { count: 80, size: 0.4, color: colors.bioParticleColor, opacity: 0.6, pulseSpeed: 0.5 },
    midnight: { count: 120, size: 0.5, color: colors.bioParticleColor, opacity: 0.7, pulseSpeed: 0.4 },
    abyss: { count: 60, size: 0.6, color: colors.bioParticleColor, opacity: 0.5, pulseSpeed: 0.3 },
  };
  return configs[zone] || configs.abyss;
}

// Create a simple circular particle texture
function createParticleTexture(): THREE.Texture {
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

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Create a softer glow texture for bioluminescent particles
function createBioTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.3, 'rgba(255,255,255,0.8)');
  gradient.addColorStop(0.6, 'rgba(255,255,255,0.3)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}