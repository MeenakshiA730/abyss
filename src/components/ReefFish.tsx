/**
 * ABYSS — ReefFish
 * Shallow-water schooling fish visible in sunlight zone only.
 * Single useFrame, zero allocations per frame.
 */

import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ZoneId } from './CameraController';

interface ReefFishProps {
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

function getReefOpacity(zone: ZoneId, zoneProgress: number): number {
  if (zone === 'sunlight') return 1;
  if (zone === 'twilight') return 1 - zoneProgress;
  return 0;
}

const FISH_COLORS = [0xff7a30, 0xffd23f, 0x2fa8ff, 0xff5fa8, 0x45e08a] as const;

export function ReefFish({
  zone,
  zoneProgress,
  reducedMotion,
  isPaused = false,
  depth,
}: ReefFishProps) {
  const { scene } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const _m4 = useRef(new THREE.Matrix4());

  const fish = useMemo(() => {
    const rand = createSeededRandom(0xdecafbad);
    const count = 60;
    const schools = 3;
    const perSchool = count / schools;

    // Build fish shape once: flattened ellipsoid body + tail
    const bodyGeo = new THREE.SphereGeometry(0.5, 16, 8);
    bodyGeo.scale(1.0, 0.4, 0.15); // 1.0 long along X, 0.4 tall, 0.15 thick
    bodyGeo.translate(0.5, 0, 0); // center body at x=0.5 (nose at x=1.0)

    const tailGeo = new THREE.ConeGeometry(0.175, 0.4, 4, 1); // radius 0.175, height 0.4
    tailGeo.rotateZ(Math.PI / 2); // point along -X (backwards)
    tailGeo.scale(0.4, 0.35, 0.05); // flat triangle: 0.4 long, 0.35 wide, 0.05 thick
    tailGeo.translate(-0.2, 0, 0); // attach at back of body (body goes to x=0)

    const geo = mergeGeometries([bodyGeo, tailGeo]);
    // Total length ~1.4 (body 1.0 + tail 0.4)
    geo.translate(0.7, 0, 0); // center at origin so fish pivots at center

    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      toneMapped: false,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;

    // School centers: x at -9, 0 (y +4), +9; z 8-14 in front
    const centers: THREE.Vector3[] = [
      new THREE.Vector3(-9, -3, -8 - rand() * 6),   // left
      new THREE.Vector3(0, 4, -8 - rand() * 6),     // center, above submersible
      new THREE.Vector3(9, -3, -8 - rand() * 6),    // right
    ];

    // School orbit data (shared per school)
    const schoolOrbits: Array<{
      center: THREE.Vector3;
      orbitRadius: number;
      orbitAngle: number;
      orbitSpeed: number;
    }> = [];

    for (let s = 0; s < schools; s++) {
      schoolOrbits.push({
        center: centers[s],
        orbitRadius: 8 + rand() * 3, // 8-11, wider to cross frame
        orbitAngle: rand() * Math.PI * 2,
        orbitSpeed: 0.004 + rand() * 0.006, // 0.004-0.01 rad/s
      });
    }

    const data: Array<{
      schoolIndex: number;
      offset: THREE.Vector3;
      headingOffset: number;
      wobblePhase: number;
      wobbleSpeed: number;
    }> = [];

    for (let i = 0; i < count; i++) {
      const si = Math.floor(i / perSchool);
      const offset = new THREE.Vector3(
        (rand() - 0.5) * 3, // ~1.5 units spread
        (rand() - 0.5) * 2,
        (rand() - 0.5) * 3
      );
      const headingOffset = (rand() - 0.5) * 0.2; // tiny heading variation
      const wobblePhase = rand() * Math.PI * 2;
      const wobbleSpeed = 1.5 + rand() * 1; // ~1.5-2.5 rad/s (4x slower, capped well under 6)
      const color = FISH_COLORS[Math.floor(rand() * FISH_COLORS.length)];

      data.push({ schoolIndex: si, offset, headingOffset, wobblePhase, wobbleSpeed });

      // Initial position will be set in useFrame first frame
      _m4.current.identity();
      mesh.setMatrixAt(i, _m4.current);
      mesh.setColorAt(i, new THREE.Color(color));
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor!.needsUpdate = true;

    scene.add(mesh);
    return { mesh, data, schoolOrbits, geo, mat, cleanup: () => { scene.remove(mesh); geo.dispose(); mat.dispose(); } };
  }, [scene]);

  useFrame((state) => {
    if (isPaused || !groupRef.current) return;

    const elapsed = state.clock.elapsedTime * (reducedMotion ? 0.1 : 1);
    const opacity = getReefOpacity(zone, zoneProgress);

    groupRef.current.position.y = -depth / 1000;
    groupRef.current.scale.setScalar(opacity);
    groupRef.current.visible = opacity > 0;

    fish.mat.opacity = 0.9 * opacity;

    // Update school orbit positions
    for (let s = 0; s < fish.schoolOrbits.length; s++) {
      const so = fish.schoolOrbits[s];
      so.orbitAngle += elapsed * so.orbitSpeed;
      so.center.x = so.center.x + Math.cos(so.orbitAngle) * so.orbitRadius;
      so.center.z = so.center.z + Math.sin(so.orbitAngle) * so.orbitRadius;
    }

    for (let i = 0; i < fish.data.length; i++) {
      const d = fish.data[i];
      const so = fish.schoolOrbits[d.schoolIndex];

      // School center position on orbit
      const schoolX = so.center.x + Math.cos(so.orbitAngle) * so.orbitRadius;
      const schoolZ = so.center.z + Math.sin(so.orbitAngle) * so.orbitRadius;
      const schoolY = so.center.y;

      // Fish position: school center + small offset
      const pos = new THREE.Vector3(
        schoolX + d.offset.x,
        schoolY + d.offset.y,
        schoolZ + d.offset.z
      );

      // Heading: tangent to orbit + tiny variation
      const heading = so.orbitAngle + Math.PI / 2 + d.headingOffset;
      const wobble = Math.sin(elapsed * d.wobbleSpeed + d.wobblePhase) * 0.3; // increased to 0.3 rad

      _m4.current.makeRotationFromEuler(new THREE.Euler(0, heading, wobble));
      _m4.current.setPosition(pos);
      fish.mesh.setMatrixAt(i, _m4.current);
    }
    fish.mesh.instanceMatrix.needsUpdate = true;
  });

  return <group ref={groupRef} />;
}