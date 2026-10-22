/**
 * ABYSS — Searchlight Component
 * The submersible's primary illumination cutting through the darkness
 * Uses unified zone configuration from @/config/zones
 */

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ZoneId } from '@/config/zones';
import { ZONE_COLORS, ZONE_VISIBILITY } from '@/config/zones';

interface SearchlightProps {
  zone: ZoneId;
  zoneProgress: number;
  reducedMotion: boolean;
  isPaused?: boolean;
}

export function Searchlight({ zone, zoneProgress: _zoneProgress, reducedMotion, isPaused = false }: SearchlightProps) {
  const lightRef = useRef<THREE.SpotLight>(null);
  const coneRef = useRef<THREE.Mesh>(null);
  const moteRef = useRef<THREE.Points>(null);
  const targetRef = useRef<THREE.Object3D>(new THREE.Object3D());
  const timeRef = useRef(0);
  const sweepAngleRef = useRef(0);
  const targetSweepRef = useRef(0);

  // Get visibility rules and colors for current zone
  const visibility = ZONE_VISIBILITY[zone];
  const colors = ZONE_COLORS[zone];

  // Searchlight config based on zone visibility
  const lightConfig = useMemo(() => {
    return {
      intensity: visibility.searchlightIntensity,
      distance: visibility.searchlightDistance,
      color: colors.sunColor,
      coneAngle: zone === 'sunlight' ? 0.4 : zone === 'twilight' ? 0.35 : zone === 'midnight' ? 0.25 : 0.2,
    };
  }, [zone, visibility, colors]);

  // Beam geometry for volumetric effect
  const beamGeometry = useMemo(() => {
    const geometry = new THREE.CylinderGeometry(0.15, 8, 60, 16, 1, true);
    // Remove bottom cap
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      if (positions.getY(i) < 0) positions.setY(i, 0);
    }
    geometry.computeVertexNormals();
    return geometry;
  }, []);

  // Dust/mote geometry for light shaft
  const moteGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const count = 500;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const alphas = new Float32Array(count);
    // Pre-computed attributes to avoid Math.random() in useFrame
    const driftSpeeds = new Float32Array(count);
    const resetX = new Float32Array(count);
    const resetZ = new Float32Array(count);
    const alphaFlicker = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const radius = Math.random() * 8;
      const height = Math.random() * 60;
      const angle = Math.random() * Math.PI * 2;

      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = height;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
      sizes[i] = Math.random() * 0.1 + 0.02;
      alphas[i] = Math.random() * 0.5 + 0.1;

      // Pre-compute drift speed (0.5 to 2.0)
      driftSpeeds[i] = 0.5 + Math.random() * 1.5;
      // Pre-compute reset X, Z positions
      resetX[i] = (Math.random() - 0.5) * 16;
      resetZ[i] = (Math.random() - 0.5) * 16;
      // Pre-compute alpha flicker variation (0.0 to 0.01)
      alphaFlicker[i] = Math.random() * 0.01;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
    geometry.setAttribute('driftSpeed', new THREE.BufferAttribute(driftSpeeds, 1));
    geometry.setAttribute('resetX', new THREE.BufferAttribute(resetX, 1));
    geometry.setAttribute('resetZ', new THREE.BufferAttribute(resetZ, 1));
    geometry.setAttribute('alphaFlicker', new THREE.BufferAttribute(alphaFlicker, 1));
    return geometry;
  }, []);

  // Beam material - volumetric light shaft
  const beamMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: lightConfig.color,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }, [lightConfig.color]);

  // Mote material - particles in light beam
  const moteMaterial = useMemo(() => {
    return new THREE.PointsMaterial({
      color: lightConfig.color,
      size: 0.15,
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: true,
      depthWrite: false,
      vertexColors: false,
    });
  }, [lightConfig.color]);

  // Light lens material
  const lensMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: lightConfig.color,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
  }, [lightConfig.color]);

  // Animate searchlight sweep and beam
  useFrame((_, delta) => {
    if (reducedMotion || isPaused) return;
    timeRef.current += delta;

    // Slow sweeping motion
    const sweepSpeed = 0.08;
    targetSweepRef.current = Math.sin(timeRef.current * sweepSpeed) * 0.15;
    sweepAngleRef.current = THREE.MathUtils.lerp(sweepAngleRef.current, targetSweepRef.current, delta * 1.5);

    // Apply rotation to light and beam
    if (lightRef.current && targetRef.current) {
      targetRef.current.position.x = sweepAngleRef.current * 50;
      targetRef.current.updateMatrixWorld();
    }

    if (coneRef.current) {
      coneRef.current.rotation.y = sweepAngleRef.current;
    }

    // Animate motes in beam
    if (moteRef.current) {
      const positions = moteRef.current.geometry.attributes.position;
      const alphas = moteRef.current.geometry.attributes.alpha;
      const driftSpeeds = moteRef.current.geometry.attributes.driftSpeed;
      const resetX = moteRef.current.geometry.attributes.resetX;
      const resetZ = moteRef.current.geometry.attributes.resetZ;
      const alphaFlicker = moteRef.current.geometry.attributes.alphaFlicker;

      for (let i = 0; i < positions.count; i++) {
        let y = positions.getY(i);
        // Use pre-computed drift speed instead of Math.random()
        y -= delta * driftSpeeds.getX(i);

        if (y <= 0) {
          y = 60;
          // Use pre-computed reset positions
          positions.setX(i, resetX.getX(i));
          positions.setZ(i, resetZ.getX(i));
        }
        positions.setY(i, y);

        // Use pre-computed alpha flicker instead of Math.random()
        alphas.setX(i, alphas.getX(i) * 0.99 + alphaFlicker.getX(i));
      }
      positions.needsUpdate = true;
      alphas.needsUpdate = true;
      (moteRef.current.material as THREE.PointsMaterial).opacity = 0.3 + Math.sin(timeRef.current * 3) * 0.1;
    }

    // Pulse light intensity slightly
    if (lightRef.current) {
      lightRef.current.intensity = lightConfig.intensity * (1 + Math.sin(timeRef.current * 2) * 0.05);
    }
  });

  return (
    <group position={[0, -0.3, 2.5]}>
      {/* Spot Light - the actual illumination */}
      <spotLight
        ref={lightRef}
        color={lightConfig.color}
        intensity={lightConfig.intensity}
        distance={lightConfig.distance}
        angle={lightConfig.coneAngle}
        penumbra={0.5}
        decay={2}
        castShadow={false}
        position={[0, 0, 0]}
        target={targetRef.current}
      />

      {/* Light Lens - visible at source */}
      <mesh
        geometry={new THREE.SphereGeometry(0.15, 16, 16)}
        material={lensMaterial}
        scale={[1, 0.3, 1]}
      />

      {/* Volumetric Beam Cone */}
      <mesh
        ref={coneRef}
        geometry={beamGeometry}
        material={beamMaterial}
        position={[0, -30, 0]}
        rotation={[Math.PI, 0, 0]}
        scale={[1, 1, 1]}
      />

      {/* Motes/Particles in Light Shaft */}
      <points
        ref={moteRef}
        geometry={moteGeometry}
        material={moteMaterial}
        position={[0, -30, 0]}
        rotation={[Math.PI, 0, 0]}
      />

      {/* Outer Glow Cone - wider, fainter */}
      <mesh
        geometry={beamGeometry}
        material={new THREE.MeshBasicMaterial({
          color: lightConfig.color,
          transparent: true,
          opacity: 0.03,
          depthWrite: false,
          side: THREE.DoubleSide,
        })}
        position={[0, -30, 0]}
        rotation={[Math.PI, 0, 0]}
        scale={[2, 1, 2]}
      />
    </group>
  );
}