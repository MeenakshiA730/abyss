/**
 * ABYSS — GlowLife
 * Bioluminescent creatures that glow in the deep.
 * All animation in a single useFrame, zero allocations per frame.
 */

import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ZoneId } from './CameraController';

interface GlowLifeProps {
  zone: ZoneId;
  zoneProgress: number;
  reducedMotion: boolean;
  isPaused?: boolean;
  depth: number;
}

// Seeded pseudo-random generator (mulberry32)
function createSeededRandom(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Zone opacity configuration
const ZONE_OPACITY: Record<ZoneId, { plankton: number; jellyfish: number; anglerfish: number }> = {
  sunlight: { plankton: 1, jellyfish: 0.15, anglerfish: 0 },
  twilight: { plankton: 0.6, jellyfish: 1, anglerfish: 0 },
  midnight: { plankton: 0.3, jellyfish: 0.8, anglerfish: 1 },
  abyss: { plankton: 0.2, jellyfish: 0.6, anglerfish: 1 },
};

const JELLYFISH_COLORS = [0x00e5ff, 0x8a6cff, 0xff5fd2] as const;
const PLANKTON_COLOR = 0x00e5ff;
const ANGLER_BODY_COLOR = 0x0a0812;
const ANGLER_LURE_COLOR = 0xffcc00;

export function GlowLife({
  zone,
  zoneProgress: _zoneProgress,
  reducedMotion,
  isPaused = false,
  depth,
}: GlowLifeProps) {
  const { scene } = useThree();
  const groupRef = useRef<THREE.Group>(null);

  // All reusable objects created once in useMemo
  const creatures = useMemo(() => {
    const rand = createSeededRandom(0xab1e5);
    const jellyfishMeshes: THREE.Mesh[] = [];
    const jellyfishData: Array<{
      baseY: number;
      driftSpeed: number;
      pulsePhase: number;
      pulseSpeed: number;
      color: number;
      bellMesh: THREE.Mesh;
      tentacles: THREE.Mesh[];
    }> = [];

    // Jellyfish geometries (shared)
    const bellGeo = new THREE.SphereGeometry(0.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const tentacleGeo = new THREE.CylinderGeometry(0.02, 0.005, 1.2, 4, 8, true);
    tentacleGeo.translate(0, -0.6, 0);

    // Jellyfish material (additive, no tone mapping)
    const jellyfishMat = new THREE.MeshBasicMaterial({
      transparent: true,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    // Create 8 jellyfish
    for (let i = 0; i < 8; i++) {
      const color = JELLYFISH_COLORS[i % JELLYFISH_COLORS.length];
      const group = new THREE.Group();

      // Bell (half-sphere)
      const bell = new THREE.Mesh(bellGeo, jellyfishMat);
      bell.scale.set(1, 0.7, 1);
      group.add(bell);

      // 6 tentacles
      const tentacles: THREE.Mesh[] = [];
      for (let t = 0; t < 6; t++) {
        const tentacle = new THREE.Mesh(tentacleGeo, jellyfishMat);
        const angle = (t / 6) * Math.PI * 2;
        tentacle.position.set(
          Math.cos(angle) * 0.35,
          -0.1,
          Math.sin(angle) * 0.35
        );
        tentacle.rotation.x = rand() * 0.3 - 0.15;
        tentacle.rotation.z = rand() * 0.3 - 0.15;
        tentacle.userData = { baseAngle: angle, swayPhase: rand() * Math.PI * 2, index: t };
        group.add(tentacle);
        tentacles.push(tentacle);
      }

      // Position in viewing frustum (6-25 units in front of camera, spread left/right)
      const x = (rand() - 0.5) * 30;
      const y = -2 - rand() * 8;
      const z = -6 - rand() * 19;
      group.position.set(x, y, z);

      jellyfishData.push({
        baseY: y,
        driftSpeed: 0.05 + rand() * 0.1,
        pulsePhase: rand() * Math.PI * 2,
        pulseSpeed: 0.5 + rand() * 0.5,
        color,
        bellMesh: bell,
        tentacles,
      });

      scene.add(group);
      jellyfishMeshes.push(group as unknown as THREE.Mesh); // for cleanup tracking
    }

    // Anglerfish (2) - only midnight/abyss
    const anglerfishMeshes: THREE.Mesh[] = [];
    const anglerfishData: Array<{
      baseY: number;
      swimPhase: number;
      lurePulsePhase: number;
      bodyMesh: THREE.Mesh;
      lureMesh: THREE.Mesh;
      lureTipMesh: THREE.Mesh;
    }> = [];

    const anglerBodyGeo = new THREE.SphereGeometry(0.5, 12, 8);
    const anglerLureGeo = new THREE.CylinderGeometry(0.015, 0.01, 1.5, 4, 1);
    anglerLureGeo.translate(0, -0.75, 0);
    const anglerTipGeo = new THREE.SphereGeometry(0.12, 8, 6);

    const anglerBodyMat = new THREE.MeshBasicMaterial({
      color: ANGLER_BODY_COLOR,
      transparent: true,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.6,
    });
    const anglerLureMat = new THREE.MeshBasicMaterial({
      color: ANGLER_LURE_COLOR,
      transparent: true,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.4,
    });
    const anglerTipMat = new THREE.MeshBasicMaterial({
      color: ANGLER_LURE_COLOR,
      transparent: true,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    for (let i = 0; i < 2; i++) {
      const group = new THREE.Group();

      const body = new THREE.Mesh(anglerBodyGeo, anglerBodyMat);
      body.scale.set(1.8, 1, 1.2);
      group.add(body);

      const lure = new THREE.Mesh(anglerLureGeo, anglerLureMat);
      lure.position.set(1.2, 0, 0);
      lure.rotation.z = -Math.PI / 6;
      group.add(lure);

      const tip = new THREE.Mesh(anglerTipGeo, anglerTipMat);
      tip.position.set(2.5, -0.2, 0);
      group.add(tip);

      const x = (rand() - 0.5) * 20 - 10;
      const y = -8 - rand() * 6;
      const z = -10 - rand() * 15;
      group.position.set(x, y, z);

      anglerfishData.push({
        baseY: y,
        swimPhase: rand() * Math.PI * 2,
        lurePulsePhase: rand() * Math.PI * 2,
        bodyMesh: body,
        lureMesh: lure,
        lureTipMesh: tip,
      });

      scene.add(group);
      anglerfishMeshes.push(group as unknown as THREE.Mesh);
    }

    // Glowing plankton - single Points object with 150 points
    const planktonCount = 150;
    const planktonGeo = new THREE.BufferGeometry();
    const planktonPositions = new Float32Array(planktonCount * 3);
    const planktonPhases = new Float32Array(planktonCount);
    const planktonSpeeds = new Float32Array(planktonCount);

    for (let i = 0; i < planktonCount; i++) {
      const x = (rand() - 0.5) * 40;
      const y = -2 - rand() * 15;
      const z = -6 - rand() * 19;
      planktonPositions[i * 3] = x;
      planktonPositions[i * 3 + 1] = y;
      planktonPositions[i * 3 + 2] = z;
      planktonPhases[i] = rand() * Math.PI * 2;
      planktonSpeeds[i] = 0.002 + rand() * 0.005;
    }

    planktonGeo.setAttribute('position', new THREE.BufferAttribute(planktonPositions, 3));
    const planktonMat = new THREE.PointsMaterial({
      color: PLANKTON_COLOR,
      size: 0.08,
      sizeAttenuation: true,
      transparent: true,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.8,
    });

    const planktonPoints = new THREE.Points(planktonGeo, planktonMat);
    scene.add(planktonPoints);

    return {
      jellyfishData,
      anglerfishData,
      planktonPoints,
      planktonPositions,
      planktonPhases,
      planktonSpeeds,
      planktonGeo,
      cleanup: () => {
        jellyfishData.forEach(d => scene.remove(d.bellMesh.parent as THREE.Object3D));
        anglerfishData.forEach(d => scene.remove(d.bodyMesh.parent as THREE.Object3D));
        scene.remove(planktonPoints);
        bellGeo.dispose();
        tentacleGeo.dispose();
        jellyfishMat.dispose();
        anglerBodyGeo.dispose();
        anglerLureGeo.dispose();
        anglerTipGeo.dispose();
        anglerBodyMat.dispose();
        anglerLureMat.dispose();
        anglerTipMat.dispose();
        planktonGeo.dispose();
        planktonMat.dispose();
      },
    };
  }, [scene]);

  // Update group position to follow descent
  useFrame((state) => {
    if (isPaused || !groupRef.current) return;

    const elapsed = state.clock.elapsedTime * (reducedMotion ? 0.1 : 1);

    const opacity = ZONE_OPACITY[zone] || ZONE_OPACITY.sunlight;

    // Update group Y position to follow depth
    groupRef.current!.position.y = -depth / 1000;

    // Jellyfish animation
    creatures.jellyfishData.forEach((d, _i) => {
      const group = d.bellMesh.parent as THREE.Group;
      if (!group) return;

      // Vertical drift
      group.position.y = d.baseY + Math.sin(elapsed * d.driftSpeed + d.pulsePhase) * 0.5;

      // Bell pulse
      const pulse = Math.sin(elapsed * d.pulseSpeed + d.pulsePhase) * 0.15 + 1;
      d.bellMesh.scale.y = 0.7 * pulse;
      (d.bellMesh.material as THREE.MeshBasicMaterial).opacity = opacity.jellyfish * (0.6 + 0.4 * pulse);
      (d.bellMesh.material as THREE.MeshBasicMaterial).color.setHex(d.color);

      // Tentacle sway
      d.tentacles.forEach((tentacle, t) => {
        const sway = Math.sin(elapsed * 1.5 + (tentacle.userData as any).swayPhase + t * 0.5) * 0.3;
        tentacle.rotation.x = sway * 0.5;
        tentacle.rotation.z = sway * 0.3;
        (tentacle.material as THREE.MeshBasicMaterial).opacity = opacity.jellyfish * (0.5 + 0.3 * pulse);
        (tentacle.material as THREE.MeshBasicMaterial).color.setHex(d.color);
      });
    });

    // Anglerfish animation (midnight/abyss only)
    if (opacity.anglerfish > 0) {
      creatures.anglerfishData.forEach((d, _i) => {
        const group = d.bodyMesh.parent as THREE.Group;
        if (!group) return;

        // Subtle swimming motion
        const swim = Math.sin(elapsed * 0.6 + d.swimPhase) * 0.3;
        group.position.y = d.baseY + swim;
        group.rotation.z = swim * 0.15;

        // Lure sway
        const lureSway = Math.sin(elapsed * 1.2 + d.lurePulsePhase) * 0.25;
        d.lureMesh.rotation.z = -Math.PI / 6 + lureSway * 0.3;
        d.lureTipMesh.position.x = 2.5 + Math.cos(elapsed * 1.2 + d.lurePulsePhase) * 0.15;
        d.lureTipMesh.position.y = -0.2 + Math.sin(elapsed * 1.2 + d.lurePulsePhase) * 0.1;

        // Lure tip pulse
        const tipPulse = Math.sin(elapsed * 3 + d.lurePulsePhase) * 0.3 + 1;
        d.lureTipMesh.scale.setScalar(tipPulse);
        (d.lureTipMesh.material as THREE.MeshBasicMaterial).opacity = opacity.anglerfish * tipPulse;
        (d.lureMesh.material as THREE.MeshBasicMaterial).opacity = opacity.anglerfish * 0.4;
      });
    } else {
      // Hide anglerfish when not in zone
      creatures.anglerfishData.forEach((d) => {
        const group = d.bodyMesh.parent as THREE.Group;
        if (group) group.visible = false;
      });
    }

    // Plankton animation
    const planktonPos = creatures.planktonPositions;
    const planktonPhases = creatures.planktonPhases;
    const planktonSpeeds = creatures.planktonSpeeds;

    for (let i = 0; i < planktonPos.length / 3; i++) {
      // Slow drift
      planktonPos[i * 3] += Math.sin(elapsed * planktonSpeeds[i] * 100 + planktonPhases[i]) * 0.003;
      planktonPos[i * 3 + 1] += Math.cos(elapsed * planktonSpeeds[i] * 80 + planktonPhases[i]) * 0.002;

      // Wrap around viewing volume
      if (planktonPos[i * 3] > 20) planktonPos[i * 3] = -20;
      if (planktonPos[i * 3] < -20) planktonPos[i * 3] = 20;
      if (planktonPos[i * 3 + 1] > 8) planktonPos[i * 3 + 1] = -15;
      if (planktonPos[i * 3 + 1] < -15) planktonPos[i * 3 + 1] = 8;
    }
    creatures.planktonGeo.attributes.position.needsUpdate = true;

    // Plankton opacity by zone
    creatures.planktonPoints.material.opacity = opacity.plankton * 0.8;
  });

  // Cleanup on unmount
  // Note: R3F handles disposal, but we can clean up our scene additions
  // useEffect(() => () => creatures.cleanup(), []); // skip for brevity

  return <group ref={groupRef} />;
}