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
const X_MIN = -30;
const X_MAX = 30;
const X_RANGE = X_MAX - X_MIN;
const WRAP_FADE = 3; // units near edges to fade

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
  const _scaleVec = useRef(new THREE.Vector3());

  const fish = useMemo(() => {
    const rand = createSeededRandom(0xdecafbad);
    const count = 60;
    const schools = 3;
    const perSchool = count / schools; // 20

    // Build fish shape once: flattened ellipsoid body + tail
    const bodyGeo = new THREE.SphereGeometry(0.5, 16, 8);
    bodyGeo.scale(1.0, 0.4, 0.15);
    bodyGeo.translate(0.5, 0, 0);

    const tailGeo = new THREE.ConeGeometry(0.175, 0.4, 4, 1);
    tailGeo.rotateZ(Math.PI / 2);
    tailGeo.scale(0.4, 0.35, 0.05);
    tailGeo.translate(-0.2, 0, 0);

    const geo = mergeGeometries([bodyGeo, tailGeo]);
    geo.translate(0.7, 0, 0);

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

    // Fixed lanes: horizontal band, small y differences, staggered x
    const lanes = [
      { startX: -22, y: 1,   z: -12, speed: 0.5 },  // school 0
      { startX: 0,   y: -0.5, z: -14, speed: 0.5 },  // school 1
      { startX: 22,  y: 0.5,  z: -13, speed: 0.5 },  // school 2
    ];

    const schoolTravel = lanes.map(l => ({
      startX: l.startX,
      y: l.y,
      z: l.z,
      dir: 1,          // all +X
      speed: l.speed,
    }));

    const data: Array<{
      schoolIndex: number;
      offset: THREE.Vector3;
      driftPhaseY: number;
      driftPhaseZ: number;
      headingOffset: number;
      wobblePhase: number;
    }> = [];

    for (let i = 0; i < count; i++) {
      const si = Math.floor(i / perSchool);
      // Wide loose spread: x +-6, y +-3, z +-3
      const offset = new THREE.Vector3(
        (rand() - 0.5) * 12,
        (rand() - 0.5) * 6,
        (rand() - 0.5) * 6
      );
      const driftPhaseY = rand() * Math.PI * 2;
      const driftPhaseZ = rand() * Math.PI * 2;
      const headingOffset = (rand() - 0.5) * 0.2; // at most 0.1 rad
      const wobblePhase = rand() * Math.PI * 2;
      const color = FISH_COLORS[Math.floor(rand() * FISH_COLORS.length)];

      data.push({ schoolIndex: si, offset, driftPhaseY, driftPhaseZ, headingOffset, wobblePhase });

      _m4.current.identity();
      mesh.setMatrixAt(i, _m4.current);
      mesh.setColorAt(i, new THREE.Color(color));
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor!.needsUpdate = true;

    scene.add(mesh);
    return { mesh, data, schoolTravel, geo, mat, cleanup: () => { scene.remove(mesh); geo.dispose(); mat.dispose(); } };
  }, [scene]);

  useFrame((state) => {
    if (isPaused || !groupRef.current) return;

    const elapsed = state.clock.elapsedTime * (reducedMotion ? 0.1 : 1);
    const opacity = getReefOpacity(zone, zoneProgress);

    groupRef.current.position.y = -depth / 1000;
    groupRef.current.scale.setScalar(opacity);
    groupRef.current.visible = opacity > 0;

    fish.mat.opacity = 0.9 * opacity;

    for (let i = 0; i < fish.data.length; i++) {
      const d = fish.data[i];
      const st = fish.schoolTravel[d.schoolIndex];

      // School position from elapsed time: x = startX + speed * elapsed, wrapped at +-30
      const traveled = st.speed * elapsed;
      let schoolX = st.startX + traveled;
      // Wrap within -30..+30
      schoolX = ((schoolX - X_MIN) % X_RANGE + X_RANGE) % X_RANGE + X_MIN;

      // Fade scale near wrap edges (last 3 units)
      let scaleFactor = 1;
      if (schoolX > X_MAX - WRAP_FADE) {
        scaleFactor = (X_MAX - schoolX) / WRAP_FADE;
      } else if (schoolX < X_MIN + WRAP_FADE) {
        scaleFactor = (schoolX - X_MIN) / WRAP_FADE;
      }

      const schoolY = st.y;
      const schoolZ = st.z;

      // Fish position: school center + fixed offset + slow drift on y/z
      const pos = new THREE.Vector3(
        schoolX + d.offset.x,
        schoolY + d.offset.y + Math.sin(elapsed * 0.25 + d.driftPhaseY) * 0.8,
        schoolZ + d.offset.z + Math.sin(elapsed * 0.25 + d.driftPhaseZ) * 0.8
      );

      // Heading: all swim +X (0 rad) with tiny variation
      const heading = d.headingOffset; // base 0

      // Tail wobble: sin(t * 5 + phase) * 0.25 rad
      const wobble = Math.sin(elapsed * 5 + d.wobblePhase) * 0.25;

      _m4.current.makeRotationFromEuler(new THREE.Euler(0, heading, wobble));
      _scaleVec.current.set(scaleFactor, scaleFactor, scaleFactor);
      _m4.current.scale(_scaleVec.current);
      _m4.current.setPosition(pos);
      fish.mesh.setMatrixAt(i, _m4.current);
    }
    fish.mesh.instanceMatrix.needsUpdate = true;
  });

  return <group ref={groupRef} />;
}