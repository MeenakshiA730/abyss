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

const EDGE_COLOR = 0x1f7a4a;
const INNER_COLOR = 0x3ddc84;
const CLUMPS_PER_SIDE = 3;
const CLUMP_SIZE_MIN = 10;
const CLUMP_SIZE_MAX = 14;

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

    // Build exactly 3 clumps per side (left/right)
    const clumps: Array<{
      centerX: number;
      centerZ: number;
      bladeCount: number;
      baseY: number;
      swayPhase: number;
      blades: Array<{
        offsetX: number;
        offsetZ: number;
        height: number;
        color: number;
        phaseOffset: number;
      }>;
    }> = [];

    for (const side of [-1, 1] as const) {
      for (let c = 0; c < CLUMPS_PER_SIDE; c++) {
        const bladeCount = CLUMP_SIZE_MIN + Math.floor(rand() * (CLUMP_SIZE_MAX - CLUMP_SIZE_MIN + 1));
        // x range: left -34..-20, right 20..34
        const centerX = side * (20 + rand() * 14);
        // z between -4 and -12 (closer to camera)
        const centerZ = -4 - rand() * 8;
        const baseY = -8; // fixed base y
        const clumpSwayPhase = rand() * Math.PI * 2;

        const blades: Array<{
          offsetX: number;
          offsetZ: number;
          height: number;
          color: number;
          phaseOffset: number;
        }> = [];

        for (let b = 0; b < bladeCount; b++) {
          const angle = rand() * Math.PI * 2;
          const radius = 0.3 + rand() * 0.5; // tight clump
          blades.push({
            offsetX: Math.cos(angle) * radius,
            offsetZ: Math.sin(angle) * radius,
            height: 3 + rand() * 2, // 3 to 5
            color: rand() < 0.5 ? EDGE_COLOR : INNER_COLOR,
            phaseOffset: rand() * Math.PI * 0.5, // slight per-blade variation
          });
        }

        clumps.push({ centerX, centerZ, bladeCount, baseY, swayPhase: clumpSwayPhase, blades });
      }
    }

    const totalBlades = clumps.reduce((sum, cl) => sum + cl.bladeCount, 0);

    // Tapered blade geometry: thin plane with vertex scaling for taper
    const geo = new THREE.PlaneGeometry(0.12, 1, 1, 8); // width 0.12, height 1 (scaled per instance)
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const normalized = (y + 0.5); // 0 at base, 1 at tip
      const taper = 1 - normalized * 0.6; // 1.0 at base, 0.4 at tip
      pos.setX(i, pos.getX(i) * taper);
    }
    geo.translate(0, 0.5, 0); // pivot at base

    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      toneMapped: false,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.InstancedMesh(geo, mat, totalBlades);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;

    const data: Array<{
      position: THREE.Vector3;
      height: number;
      swayPhase: number;
      color: number;
    }> = [];

    let idx = 0;
    for (const clump of clumps) {
      for (const blade of clump.blades) {
        const position = new THREE.Vector3(
          clump.centerX + blade.offsetX,
          clump.baseY,
          clump.centerZ + blade.offsetZ
        );
        data.push({
          position,
          height: blade.height,
          swayPhase: clump.swayPhase + blade.phaseOffset,
          color: blade.color,
        });

        _m4.current.identity();
        mesh.setMatrixAt(idx, _m4.current);
        mesh.setColorAt(idx, new THREE.Color(blade.color));
        idx++;
      }
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
      // Sway: Z rotation = sin(t * 0.5 + phase) * 0.08 (slow, small)
      const sway = Math.sin(elapsed * 0.5 + d.swayPhase) * 0.08;
      _m4.current.makeRotationZ(sway);
      _scaleVec.current.set(1, d.height, 1); // scale Y for height
      _m4.current.scale(_scaleVec.current);
      _m4.current.setPosition(d.position);
      plants.mesh.setMatrixAt(i, _m4.current);
    }
    plants.mesh.instanceMatrix.needsUpdate = true;
  });

  return <group ref={groupRef} />;
}