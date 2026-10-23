/**
 * ABYSS — SeaPlants
 * Shallow-water kelp/seagrass visible in sunlight zone only.
 * Single useFrame, zero allocations per frame. CPU-side sway only.
 */

import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ZoneId } from './CameraController';

interface SeaPlantsProps {
  zone: ZoneId;
  zoneProgress: number;
  reducedMotion: boolean;
  isPaused?: boolean;
  depth: number;
}

function createSeededRandom(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function getSeaPlantsOpacity(zone: ZoneId, zoneProgress: number): number {
  if (zone === 'sunlight') return 1;
  if (zone === 'twilight') return 1 - zoneProgress;
  return 0;
}

const BLADE_COLORS = [0x2d7a2d, 0x3a9d3a, 0x1e5c1e, 0x4ab84a, 0x257025] as const;
const COUNT = 60;
const SPREAD = 35;

export function SeaPlants({
  zone,
  zoneProgress,
  reducedMotion,
  isPaused = false,
  depth,
}: SeaPlantsProps) {
  const { scene } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const _m4 = useRef(new THREE.Matrix4());
  const _scaleVec = useRef(new THREE.Vector3());

  const plants = useMemo(() => {
    const rand = createSeededRandom(0x5ea1);
    const count = COUNT;

    // Tapered blade geometry: plane with vertex scaling for taper
    const geo = new THREE.PlaneGeometry(1, 4, 1, 8);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const normalized = (y + 2) / 4; // 0 at base, 1 at tip
      const taper = 1 - normalized * 0.7; // 1.0 at base, 0.3 at tip
      pos.setX(i, pos.getX(i) * taper);
    }
    geo.translate(0, 2, 0); // pivot at base

    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      toneMapped: false,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;

    const data: Array<{
      position: THREE.Vector3;
      swayPhase: number;
      color: number;
    }> = [];

    for (let i = 0; i < count; i++) {
      const position = new THREE.Vector3(
        (rand() - 0.5) * SPREAD * 2,
        0,
        (rand() - 0.5) * SPREAD * 2
      );
      const swayPhase = rand() * Math.PI * 2;
      const color = BLADE_COLORS[Math.floor(rand() * BLADE_COLORS.length)];

      data.push({ position, swayPhase, color });

      _m4.current.identity();
      mesh.setMatrixAt(i, _m4.current);
      mesh.setColorAt(i, new THREE.Color(color));
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor!.needsUpdate = true;

    scene.add(mesh);
    return { mesh, data, geo, mat, cleanup: () => { scene.remove(mesh); geo.dispose(); mat.dispose(); } };
  }, [scene]);

  useFrame((state) => {
    if (isPaused || !groupRef.current) return;

    const elapsed = state.clock.elapsedTime * (reducedMotion ? 0.1 : 1);
    const opacity = getSeaPlantsOpacity(zone, zoneProgress);

    groupRef.current.position.y = -depth / 1000;
    groupRef.current.scale.setScalar(opacity);
    groupRef.current.visible = opacity > 0;

    plants.mat.opacity = 0.85 * opacity;

    for (let i = 0; i < plants.data.length; i++) {
      const d = plants.data[i];

      _m4.current.identity();
      // Sway: Z rotation = sin(t * 0.9 + phase) * 0.12
      const sway = Math.sin(elapsed * 0.9 + d.swayPhase) * 0.12;
      _m4.current.makeRotationZ(sway);
      _scaleVec.current.set(1, 1, 1);
      _m4.current.scale(_scaleVec.current);
      _m4.current.setPosition(d.position);
      plants.mesh.setMatrixAt(i, _m4.current);
    }
    plants.mesh.instanceMatrix.needsUpdate = true;
  });

  return <group ref={groupRef} />;
}