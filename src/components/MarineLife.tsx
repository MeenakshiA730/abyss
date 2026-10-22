/**
 * ABYSS — Marine Life Components
 * Zone-specific marine organisms with realistic behaviors
 * Uses unified zone configuration from @/config/zones
 */

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ZoneId, ZoneColors } from '@/config/zones';
import { ZONE_COLORS, ZONE_VISIBILITY } from '@/config/zones';
import { useDebugFlag } from './DebugOverlay';

// MarineLife render counter (dev only)
function MarineLifeRenderCounter({ enabled }: { enabled: boolean }) {
  const renderRef = useRef(0);
  if (enabled) {
    renderRef.current += 1;
    if (renderRef.current % 60 === 1) {
      console.log(`[ABYSS-DEBUG] MarineLife render #${renderRef.current}`);
    }
  }
  return null;
}

interface MarineLifeProps {
  zone: ZoneId;
  zoneProgress: number;
  reducedMotion: boolean;
  isPaused?: boolean;
}

interface MarineLifeChildProps {
  zone?: ZoneId;
  zoneProgress: number;
  reducedMotion: boolean;
  isPaused: boolean;
  zoneColors: ZoneColors;
}

interface MarineLifeChildPropsNoZone {
  zoneProgress: number;
  reducedMotion: boolean;
  isPaused: boolean;
  zoneColors: ZoneColors;
}

/**
 * Schooling fish for sunlight zone
 */
function SchoolingFish({ zoneProgress: _zoneProgress, reducedMotion, isPaused, zoneColors }: MarineLifeChildPropsNoZone) {
  const fishRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);
  const fishDataRef = useRef<Array<{
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    phase: number;
    speed: number;
    turnSpeed: number;
    targetDirection: THREE.Vector3;
    tailPhase: number;
    bodyScale: number;
  }>>([]);

  // Create fish geometries - body and tail fin as separate meshes for tail oscillation
  const fishBodyGeometry = useMemo(() => {
    // Streamlined fish body - elongated with tapered ends
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const indices: number[] = [];

    // Body profile: head at z=0.4, tail base at z=-0.5
    const segments = 8; // cross-section segments
    const rings = 6; // longitudinal rings

    for (let ring = 0; ring <= rings; ring++) {
      const t = ring / rings; // 0 at head, 1 at tail base
      const z = 0.4 - t * 0.9; // z from 0.4 to -0.5

      // Body radius profile - thicker in middle, tapered at ends
      let radius = 0;
      if (t < 0.2) {
        // Head taper
        radius = 0.08 * Math.sin((t / 0.2) * Math.PI * 0.5);
      } else if (t < 0.7) {
        // Main body
        const midT = (t - 0.2) / 0.5;
        radius = 0.08 * (1 + Math.sin(midT * Math.PI) * 0.3);
      } else {
        // Tail taper
        radius = 0.08 * Math.cos(((t - 0.7) / 0.3) * Math.PI * 0.5);
      }

      for (let seg = 0; seg < segments; seg++) {
        const angle = (seg / segments) * Math.PI * 2;
        positions.push(Math.cos(angle) * radius, Math.sin(angle) * radius, z);
      }
    }

    // Add vertices for caps
    const headIdx = positions.length / 3;
    positions.push(0, 0, 0.4); // head tip
    const tailBaseIdx = positions.length / 3;
    positions.push(0, 0, -0.5); // tail base center

    // Generate indices
    for (let ring = 0; ring < rings; ring++) {
      for (let seg = 0; seg < segments; seg++) {
        const curr = ring * segments + seg;
        const next = ring * segments + (seg + 1) % segments;
        const currNext = (ring + 1) * segments + seg;
        const nextNext = (ring + 1) * segments + (seg + 1) % segments;

        indices.push(curr, currNext, next);
        indices.push(next, currNext, nextNext);
      }
    }

    // Cap the head
    for (let seg = 0; seg < segments; seg++) {
      const curr = seg;
      const next = (seg + 1) % segments;
      indices.push(curr, headIdx, next);
    }

    // Cap the tail base
    for (let seg = 0; seg < segments; seg++) {
      const curr = rings * segments + seg;
      const next = rings * segments + (seg + 1) % segments;
      indices.push(curr, next, tailBaseIdx);
    }

    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, []);

  const tailFinGeometry = useMemo(() => {
    // Forked tail fin - two lobes
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array([
      // Upper lobe
      0, 0, 0,      // 0 - tail base center
      -0.06, 0.08, -0.15, // 1 - upper inner
      -0.08, 0.15, -0.35, // 2 - upper tip
      -0.02, 0.05, -0.3,  // 3 - upper outer
      // Lower lobe
      0.06, 0.08, -0.15,  // 4 - lower inner
      0.08, 0.15, -0.35,  // 5 - lower tip
      0.02, 0.05, -0.3,   // 6 - lower outer
    ]);
    const indices = [
      // Upper lobe triangles
      0, 1, 2,  0, 2, 3,
      // Lower lobe triangles
      0, 4, 6,  0, 6, 5,
      // Sides
      1, 4, 2,  4, 6, 2,
      3, 2, 6,  3, 6, 5,
    ];
    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, []);

  const dorsalFinGeometry = useMemo(() => {
    // Dorsal fin
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array([
      0, 0.06, 0.1,   // 0 - front base
      0, 0.12, -0.05, // 1 - tip
      0, 0.04, -0.15, // 2 - rear base
    ]);
    const indices = [0, 1, 2];
    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, []);

  const pectoralFinGeometry = useMemo(() => {
    // Pectoral fins (pair)
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array([
      0, 0, 0,        // 0 - body attachment
      -0.12, 0.02, -0.08, // 1 - tip
      -0.08, -0.02, -0.06, // 2 - rear
    ]);
    const indices = [0, 1, 2];
    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, []);

  const fishMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: zoneColors.creatureBody,
      roughness: 0.7,
      metalness: 0.3,
      emissive: zoneColors.creatureGlow,
      emissiveIntensity: 0.1,
      side: THREE.DoubleSide,
    });
  }, [zoneColors]);

  useMemo(() => {
    if (fishRef.current) {
      fishRef.current.clear();
    }
    fishDataRef.current = [];
    const count = 60;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 8 + Math.random() * 12;
      const height = (Math.random() - 0.5) * 20;
      const position = new THREE.Vector3(
        Math.cos(angle) * radius,
        height,
        Math.sin(angle) * radius
      );
      const velocity = new THREE.Vector3(
        -Math.sin(angle) * 0.5,
        (Math.random() - 0.5) * 0.2,
        Math.cos(angle) * 0.5
      );
      const bodyScale = 0.3 + Math.random() * 0.2;
      fishDataRef.current.push({
        position,
        velocity,
        phase: Math.random() * Math.PI * 2,
        speed: 0.8 + Math.random() * 0.4,
        turnSpeed: 0.5 + Math.random() * 0.5,
        targetDirection: velocity.clone().normalize(),
        tailPhase: Math.random() * Math.PI * 2,
        bodyScale,
      });

      // Create fish as a group with body + tail + fins
      const fishGroup = new THREE.Group();

      // Body
      const body = new THREE.Mesh(fishBodyGeometry, fishMaterial);
      body.scale.setScalar(bodyScale);
      fishGroup.add(body);

      // Tail fin (positioned at tail base)
      const tailFin = new THREE.Mesh(tailFinGeometry, fishMaterial);
      tailFin.position.z = -0.5 * bodyScale;
      tailFin.scale.setScalar(bodyScale);
      tailFin.name = 'tailFin';
      fishGroup.add(tailFin);

      // Dorsal fin
      const dorsalFin = new THREE.Mesh(dorsalFinGeometry, fishMaterial);
      dorsalFin.scale.setScalar(bodyScale);
      fishGroup.add(dorsalFin);

      // Pectoral fins (left and right)
      const pectoralFinL = new THREE.Mesh(pectoralFinGeometry, fishMaterial);
      pectoralFinL.position.set(0.06 * bodyScale, 0, 0.1 * bodyScale);
      pectoralFinL.rotation.y = -Math.PI / 2;
      pectoralFinL.scale.setScalar(bodyScale);
      fishGroup.add(pectoralFinL);

      const pectoralFinR = new THREE.Mesh(pectoralFinGeometry, fishMaterial);
      pectoralFinR.position.set(-0.06 * bodyScale, 0, 0.1 * bodyScale);
      pectoralFinR.rotation.y = Math.PI / 2;
      pectoralFinR.scale.setScalar(bodyScale);
      fishGroup.add(pectoralFinR);

      fishGroup.position.copy(position);
      fishRef.current?.add(fishGroup);
    }
  }, [fishBodyGeometry, tailFinGeometry, dorsalFinGeometry, pectoralFinGeometry, fishMaterial]);

  useFrame((_, delta) => {
    if (reducedMotion || isPaused || !fishRef.current) return;
    timeRef.current += delta;

    fishRef.current.children.forEach((fishGroup, i) => {
      const data = fishDataRef.current[i];
      if (!data) return;

      data.phase += delta * data.speed * 2;
      data.tailPhase += delta * data.speed * 8; // Faster tail oscillation

      data.velocity.x += Math.sin(timeRef.current * 0.5 + i) * delta * 0.1;
      data.velocity.z += Math.cos(timeRef.current * 0.3 + i) * delta * 0.1;
      data.velocity.y += Math.sin(data.phase) * delta * 0.05;

      const speed = data.velocity.length();
      if (speed > 0) {
        data.velocity.normalize().multiplyScalar(Math.min(speed, 1.5));
      }

      data.targetDirection.lerp(data.velocity.clone().normalize(), delta * data.turnSpeed);
      const targetQuat = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, -1),
        data.targetDirection.clone().normalize()
      );
      fishGroup.quaternion.slerp(targetQuat, delta * 5);

      // Gentle body roll during turns
      fishGroup.rotation.z = Math.sin(timeRef.current * 8 + data.phase) * 0.1;

      // Tail fin oscillation - the key animation for realistic fish swimming
      const tailFin = fishGroup.getObjectByName('tailFin') as THREE.Mesh;
      if (tailFin) {
        const tailAngle = Math.sin(data.tailPhase) * 0.4; // ~23 degrees max
        tailFin.rotation.y = tailAngle;
      }
    });
  });

  return <group ref={fishRef} position={[0, -5, -10]} />;
}

/**
 * Jellyfish for sunlight and twilight zones
 */
function Jellyfish({ zone, zoneProgress: _zoneProgress, reducedMotion, isPaused, zoneColors }: MarineLifeChildProps) {
  const jellyfishRef = useRef<THREE.Group[]>([]);
  const timeRef = useRef(0);

  // Improved bell geometry - more bell-shaped with proper curvature
  const bellGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const indices: number[] = [];

    const rings = 12; // vertical segments
    const segments = 16; // around the bell

    for (let ring = 0; ring <= rings; ring++) {
      const v = ring / rings; // 0 at top center, 1 at bell rim
      const phi = v * Math.PI * 0.5; // 0 to 90 degrees

      // Bell profile: rounded top, flaring out at bottom
      // Using a combination of cosine for the dome and a flare at the bottom
      const radius = Math.sin(phi) * 0.55 * (1 + v * 0.3); // flares slightly at bottom
      const y = Math.cos(phi) * 0.55 - 0.1; // center the bell

      for (let seg = 0; seg < segments; seg++) {
        const theta = (seg / segments) * Math.PI * 2;
        positions.push(
          Math.cos(theta) * radius,
          y,
          Math.sin(theta) * radius
        );
      }
    }

    // Add top center vertex
    const topCenterIdx = positions.length / 3;
    positions.push(0, 0.45, 0);

    // Generate indices
    for (let ring = 0; ring < rings; ring++) {
      for (let seg = 0; seg < segments; seg++) {
        const curr = ring * segments + seg;
        const next = ring * segments + (seg + 1) % segments;
        const currNext = (ring + 1) * segments + seg;
        const nextNext = (ring + 1) * segments + (seg + 1) % segments;

        indices.push(curr, currNext, next);
        indices.push(next, currNext, nextNext);
      }
    }

    // Cap the top
    for (let seg = 0; seg < segments; seg++) {
      const curr = seg;
      const next = (seg + 1) % segments;
      indices.push(curr, topCenterIdx, next);
    }

    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, []);

  // Oral arms geometry (frilly arms under the bell)
  const oralArmGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const indices: number[] = [];

    // Create a ruffled curtain shape
    const armLength = 0.8;
    const armWidth = 0.15;
    const segments = 8;
    const rings = 10;

    for (let ring = 0; ring <= rings; ring++) {
      const v = ring / rings;
      const y = -v * armLength;
      // Ruffled edge - varies with ring
      const ruffle = Math.sin(v * Math.PI * 4) * 0.02;
      const w = armWidth * (1 - v * 0.5) + ruffle;

      for (let seg = 0; seg <= segments; seg++) {
        const u = seg / segments;
        const x = (u - 0.5) * w * 2;
        positions.push(x, y, 0);
      }
    }

    for (let ring = 0; ring < rings; ring++) {
      for (let seg = 0; seg < segments; seg++) {
        const curr = ring * (segments + 1) + seg;
        const next = curr + 1;
        const currNext = (ring + 1) * (segments + 1) + seg;
        const nextNext = currNext + 1;

        indices.push(curr, currNext, next);
        indices.push(next, currNext, nextNext);
      }
    }

    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, []);

  // Tentacle geometry - thin, long, segmented for smooth animation
  const tentacleGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const indices: number[] = [];
    const uvs: number[] = [];

    const length = 3.5;
    const segments = 24; // vertical segments for smooth bending
    const rings = 4; // around the tentacle (thin = 4 sides)
    const baseRadius = 0.015;
    const tipRadius = 0.003;

    for (let seg = 0; seg <= segments; seg++) {
      const v = seg / segments;
      const y = -v * length;
      const radius = baseRadius * (1 - v * 0.8) + tipRadius * v;

      for (let ring = 0; ring < rings; ring++) {
        const theta = (ring / rings) * Math.PI * 2;
        positions.push(
          Math.cos(theta) * radius,
          y,
          Math.sin(theta) * radius
        );
        uvs.push(ring / (rings - 1), v);
      }
    }

    for (let seg = 0; seg < segments; seg++) {
      for (let ring = 0; ring < rings; ring++) {
        const curr = seg * rings + ring;
        const next = seg * rings + (ring + 1) % rings;
        const currNext = (seg + 1) * rings + ring;
        const nextNext = (seg + 1) * rings + (ring + 1) % rings;

        indices.push(curr, currNext, next);
        indices.push(next, currNext, nextNext);
      }
    }

    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.computeVertexNormals();
    return geometry;
  }, []);

  const bellMaterial = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(zoneColors.accentPrimary),
      roughness: 0.2,
      metalness: 0.05,
      transmission: 0.9,
      thickness: 0.5,
      transparent: true,
      opacity: 0.55,
      emissive: new THREE.Color(zoneColors.creatureGlow),
      emissiveIntensity: zone === 'sunlight' ? 0.25 : zone === 'twilight' ? 0.4 : 0.55,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      ior: 1.35,
      side: THREE.DoubleSide,
    });
  }, [zone, zoneColors]);

  const oralArmMaterial = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(zoneColors.accentPrimary),
      roughness: 0.3,
      metalness: 0.1,
      transmission: 0.8,
      thickness: 0.3,
      transparent: true,
      opacity: 0.65,
      emissive: new THREE.Color(zoneColors.creatureGlow),
      emissiveIntensity: zone === 'sunlight' ? 0.3 : 0.45,
      side: THREE.DoubleSide,
    });
  }, [zone, zoneColors]);

  const tentacleMaterial = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(zoneColors.accentPrimary),
      roughness: 0.25,
      metalness: 0.05,
      transmission: 0.7,
      thickness: 0.2,
      transparent: true,
      opacity: 0.6,
      emissive: new THREE.Color(zoneColors.creatureGlow),
      emissiveIntensity: zone === 'sunlight' ? 0.2 : 0.4,
      side: THREE.DoubleSide,
    });
  }, [zone, zoneColors]);

  // Store per-jellyfish animation data
  const jellyDataRef = useRef<Array<{
    pulsePhase: number;
    pulseSpeed: number;
    driftPhase: number;
    driftSpeed: number;
    tentaclePhases: number[];
  }>>([]);

  useMemo(() => {
    jellyfishRef.current = [];
    jellyDataRef.current = [];
    const count = zone === 'sunlight' ? 8 : zone === 'twilight' ? 5 : 2;

    for (let i = 0; i < count; i++) {
      const group = new THREE.Group();
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const radius = 15 + Math.random() * 20;
      const baseY = -10 + Math.random() * 20;
      group.position.set(
        Math.cos(angle) * radius,
        baseY,
        Math.sin(angle) * radius
      );

      // Bell with random size variation
      const scale = 0.5 + Math.random() * 0.4;
      const bell = new THREE.Mesh(bellGeometry, bellMaterial);
      bell.scale.setScalar(scale);
      bell.name = 'bell';
      group.add(bell);

      // Oral arms (4-6 frilly arms hanging from center)
      const oralArmCount = 4 + Math.floor(Math.random() * 3);
      for (let a = 0; a < oralArmCount; a++) {
        const oralArm = new THREE.Mesh(oralArmGeometry, oralArmMaterial);
        oralArm.rotation.y = (a / oralArmCount) * Math.PI * 2;
        oralArm.position.y = -0.15 * scale;
        oralArm.scale.setScalar(scale);
        oralArm.name = `oralArm-${a}`;
        group.add(oralArm);
      }

      // Long trailing tentacles (12-16 thin tentacles)
      const tentacleCount = 12 + Math.floor(Math.random() * 5);
      const tentaclePhases: number[] = [];

      for (let t = 0; t < tentacleCount; t++) {
        const tentacle = new THREE.Mesh(tentacleGeometry, tentacleMaterial);
        const tentacleAngle = (t / tentacleCount) * Math.PI * 2;
        // Position at bell rim
        const rimRadius = 0.55 * scale;
        tentacle.position.set(
          Math.cos(tentacleAngle) * rimRadius * 0.8,
          -0.45 * scale,
          Math.sin(tentacleAngle) * rimRadius * 0.8
        );
        tentacle.rotation.y = tentacleAngle;
        // Random length variation
        tentacle.scale.y = 0.7 + Math.random() * 0.6;
        tentacle.name = `tentacle-${t}`;
        group.add(tentacle);

        tentaclePhases.push(Math.random() * Math.PI * 2);
      }

      jellyfishRef.current.push(group);

      // Store animation data
      jellyDataRef.current.push({
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.4 + Math.random() * 0.3,
        driftPhase: Math.random() * Math.PI * 2,
        driftSpeed: 0.15 + Math.random() * 0.1,
        tentaclePhases,
      });
    }
  }, [zone, bellGeometry, oralArmGeometry, tentacleGeometry, bellMaterial, oralArmMaterial, tentacleMaterial]);

  useFrame((_, delta) => {
    if (reducedMotion || isPaused) return;
    timeRef.current += delta;

    jellyfishRef.current.forEach((jelly, i) => {
      const data = jellyDataRef.current[i];
      if (!data) return;

      data.pulsePhase += delta * data.pulseSpeed;
      data.driftPhase += delta * data.driftSpeed;

      const bell = jelly.getObjectByName('bell') as THREE.Mesh;
      if (bell) {
        // Natural bell pulsing: contract quickly, expand slowly
        const pulse = Math.sin(data.pulsePhase);
        // Asymmetric pulse - faster contraction, slower expansion
        const pulseFactor = pulse > 0 ? 1 + pulse * 0.12 : 1 + pulse * 0.08;
        const verticalSquash = pulse > 0 ? 1 - pulse * 0.15 : 1 - pulse * 0.1;

        bell.scale.y = 0.6 * verticalSquash;
        bell.scale.x = bell.scale.z = 1 * pulseFactor;
      }

      // Animate oral arms - they flow with the bell pulse but lag slightly
      for (let a = 0; a < 7; a++) {
        const oralArm = jelly.getObjectByName(`oralArm-${a}`) as THREE.Mesh;
        if (oralArm) {
          const armPhase = data.pulsePhase + a * 0.5;
          oralArm.rotation.z = Math.sin(armPhase * 0.8) * 0.15;
          oralArm.rotation.x = Math.cos(armPhase * 0.6) * 0.1;
          oralArm.scale.y = 1 + Math.sin(data.pulsePhase * 1.2 + a) * 0.05;
        }
      }

      // Animate tentacles with wave-like motion
      const tentacles: THREE.Mesh[] = [];
      for (let t = 0; t < 20; t++) {
        const tentacle = jelly.getObjectByName(`tentacle-${t}`) as THREE.Mesh;
        if (tentacle) tentacles.push(tentacle);
      }

      tentacles.forEach((tentacle, t) => {
        const tentaclePhase = data.tentaclePhases[t] || 0;
        const waveSpeed = 1.5 + (t % 3) * 0.3;
        const wave = Math.sin(timeRef.current * waveSpeed + tentaclePhase);
        const wave2 = Math.cos(timeRef.current * waveSpeed * 0.7 + tentaclePhase + 1);

        // Tentacle bends in a wave pattern - rotate at base, with decreasing influence toward tip
        // Since tentacle is a single mesh, we approximate with rotation
        tentacle.rotation.z = wave * 0.25 + wave2 * 0.1;
        tentacle.rotation.x = wave * 0.15 - wave2 * 0.08;

        // Subtle length pulsing
        tentacle.scale.y = 1 + Math.sin(timeRef.current * 0.8 + tentaclePhase) * 0.03;
      });

      // Smooth drifting motion
      jelly.position.x += Math.sin(data.driftPhase * 0.7) * delta * 0.3;
      jelly.position.z += Math.cos(data.driftPhase * 0.5) * delta * 0.3;
      jelly.position.y += Math.sin(data.driftPhase * 1.2) * delta * 0.15;

      // Very slow rotation as it drifts
      jelly.rotation.y += delta * 0.02 * (i % 2 === 0 ? 1 : -1);
    });
  });

  return (
    <group>
      {jellyfishRef.current.map((jelly, i) => (
        <primitive key={`jelly-${i}`} object={jelly} dispose={null} />
      ))}
    </group>
  );
}

/**
 * Bioluminescent organisms for midnight and abyss zones
 */
function BioluminescentOrganisms({ zone, zoneProgress: _zoneProgress, reducedMotion, isPaused, zoneColors: _zoneColors }: MarineLifeChildProps & { zone: ZoneId }) {
  const organismsRef = useRef<THREE.Points | null>(null);
  const timeRef = useRef(0);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const count = zone === 'midnight' ? 200 : zone === 'abyss' ? 100 : 0;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    const lifetimes = new Float32Array(count);
    const offsets = new Float32Array(count * 3);
    // Pre-computed reset positions to avoid Math.random() in useFrame
    const resetPositions = new Float32Array(count * 2);

    for (let i = 0; i < count; i++) {
      const radius = 5 + Math.random() * 40;
      const height = (Math.random() - 0.5) * 60;
      const angle = Math.random() * Math.PI * 2;

      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = height;
      positions[i * 3 + 2] = Math.sin(angle) * radius;

      sizes[i] = 0.1 + Math.random() * 0.3;
      phases[i] = Math.random() * Math.PI * 2;
      lifetimes[i] = 2 + Math.random() * 4;
      offsets[i * 3] = (Math.random() - 0.5) * 2;
      offsets[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
      offsets[i * 3 + 2] = (Math.random() - 0.5) * 2;

      // Store pre-computed reset positions (x, z)
      resetPositions[i * 2] = (Math.random() - 0.5) * 80;
      resetPositions[i * 2 + 1] = (Math.random() - 0.5) * 80;

      const colorChoice = Math.random();
      if (colorChoice < 0.5) {
        colors[i * 3] = 0; colors[i * 3 + 1] = 1; colors[i * 3 + 2] = 0.8;
      } else if (colorChoice < 0.8) {
        colors[i * 3] = 0; colors[i * 3 + 1] = 0.6; colors[i * 3 + 2] = 1;
      } else {
        colors[i * 3] = 0.5; colors[i * 3 + 1] = 1; colors[i * 3 + 2] = 0.3;
      }
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
    geo.setAttribute('offset', new THREE.BufferAttribute(offsets, 3));
    // Store reset positions as attribute for useFrame access
    geo.setAttribute('resetPosition', new THREE.BufferAttribute(resetPositions, 2));

    return geo;
  }, [zone]);

  const material = useMemo(() => {
    return new THREE.PointsMaterial({
      size: 1,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
      depthWrite: false,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      map: createGlowTexture(),
    });
  }, []);

  function createGlowTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.3, 'rgba(255,255,255,0.5)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  useFrame((_, delta) => {
    if (reducedMotion || isPaused || !organismsRef.current) return;
    timeRef.current += delta;

    const positions = organismsRef.current.geometry.attributes.position;
    const sizes = organismsRef.current.geometry.attributes.size;
    const phases = organismsRef.current.geometry.attributes.phase;
    const offsets = organismsRef.current.geometry.attributes.offset;
    const resetPositions = organismsRef.current.geometry.attributes.resetPosition;

    for (let i = 0; i < positions.count; i++) {
      const phase = phases.getX(i);
      // Slower, gentler pulse to prevent flickering
      const pulse = Math.sin(timeRef.current * 0.6 + phase) * 0.5 + 0.5;
      sizes.setX(i, (0.1 + 0.3 * pulse) * (0.7 + Math.sin(timeRef.current * 0.2 + phase) * 0.1));

      positions.setX(i, positions.getX(i) + offsets.getX(i) * delta * 0.1);
      positions.setY(i, positions.getY(i) + offsets.getY(i) * delta * 0.1);
      positions.setZ(i, positions.getZ(i) + offsets.getZ(i) * delta * 0.1);

      if (positions.getY(i) > 40) {
        positions.setY(i, -30);
        // Use pre-computed reset positions from attribute
        positions.setX(i, resetPositions.getX(i));
        positions.setZ(i, resetPositions.getY(i));
      }
    }
    positions.needsUpdate = true;
    sizes.needsUpdate = true;
  });

  if (!ZONE_VISIBILITY[zone].bioluminescentOrgs) return null;

  return (
    <points ref={organismsRef} geometry={geometry} material={material} />
  );
}

/**
 * Anglerfish for midnight zone
 */
function Anglerfish({ zoneProgress: _zoneProgress, reducedMotion, isPaused, zoneColors }: MarineLifeChildPropsNoZone) {
  const fishRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);

  const bodyGeometry = useMemo(() => {
    const geo = new THREE.SphereGeometry(0.5, 12, 12);
    geo.scale(1.5, 1, 1.2);
    return geo;
  }, []);

  const lureGeometry = useMemo(() => new THREE.SphereGeometry(0.05, 8, 8), []);

  const bodyMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: zoneColors.creatureBody,
    roughness: 0.9,
    metalness: 0.1,
  }), [zoneColors]);

  const lureMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: new THREE.Color(zoneColors.accentPrimary),
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
  }), [zoneColors]);

  useMemo(() => {
    fishRef.current = new THREE.Group();
    const count = 3;
    for (let i = 0; i < count; i++) {
      const fish = new THREE.Group();
      const angle = (i / count) * Math.PI * 2;
      const radius = 10 + Math.random() * 15;
      fish.position.set(
        Math.cos(angle) * radius,
        -20 + Math.random() * 10,
        Math.sin(angle) * radius
      );

      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      fish.add(body);

      const lureGroup = new THREE.Group();
      lureGroup.position.set(0.8, 0.2, 0);
      const lure = new THREE.Mesh(lureGeometry, lureMaterial);
      lureGroup.add(lure);
      const light = new THREE.PointLight(zoneColors.accentPrimary, 0.5, 3);
      lureGroup.add(light);
      fish.add(lureGroup);

      fishRef.current.add(fish);
    }
  }, [bodyGeometry, lureGeometry, bodyMaterial, lureMaterial, zoneColors]);

  useFrame((_, delta) => {
    if (reducedMotion || isPaused || !fishRef.current) return;
    timeRef.current += delta;

    fishRef.current.children.forEach((fish, i) => {
      fish.position.x += Math.sin(timeRef.current * 0.1 + i) * delta * 0.3;
      fish.position.z += Math.cos(timeRef.current * 0.08 + i) * delta * 0.3;

      const lureGroup = fish.children[1] as THREE.Group;
      if (lureGroup) {
        const lure = lureGroup.children[0] as THREE.Mesh;
        const light = lureGroup.children[1] as THREE.PointLight;
        // Slower, more natural lure pulse
        const pulse = Math.sin(timeRef.current * 0.6 + i) * 0.5 + 0.5;
        lure.scale.setScalar(0.7 + pulse * 0.3);
        light.intensity = 0.4 + pulse * 0.3;
      }

      fish.rotation.y += delta * 0.05 * Math.sin(timeRef.current * 0.1 + i);
    });
  });

  if (!fishRef.current) return null;
  return <primitive object={fishRef.current} dispose={null} />;
}

/**
 * Deep sea jellyfish (Atolla) for midnight zone
 */
function DeepSeaJellyfish({ zoneProgress: _zoneProgress, reducedMotion, isPaused, zoneColors }: MarineLifeChildPropsNoZone) {
  const jellyfishRef = useRef<THREE.Group[]>([]);
  const timeRef = useRef(0);

  const bellGeometry = useMemo(() => {
    const geo = new THREE.SphereGeometry(0.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    geo.scale(1, 0.5, 1);
    return geo;
  }, []);

  const bellMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(zoneColors.accentPrimary),
    roughness: 0.1,
    metalness: 0.15,
    transmission: 0.9,
    thickness: 0.3,
    transparent: true,
    opacity: 0.75,
    emissive: new THREE.Color(zoneColors.creatureGlow),
    emissiveIntensity: 1.5,
    clearcoat: 1,
  }), [zoneColors]);

  const tentacleMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(zoneColors.accentPrimary),
    roughness: 0.3,
    metalness: 0.05,
    transmission: 0.8,
    thickness: 0.2,
    transparent: true,
    opacity: 0.7,
    emissive: new THREE.Color(zoneColors.creatureGlow),
    emissiveIntensity: 1.2,
    side: THREE.DoubleSide,
  }), [zoneColors]);

  useMemo(() => {
    jellyfishRef.current = [];
    const count = 4;
    for (let i = 0; i < count; i++) {
      const group = new THREE.Group();
      const angle = (i / count) * Math.PI * 2 + Math.PI / 4;
      const radius = 12 + Math.random() * 18;
      group.position.set(
        Math.cos(angle) * radius,
        -15 + Math.random() * 25,
        Math.sin(angle) * radius
      );

      const bell = new THREE.Mesh(bellGeometry, bellMaterial);
      bell.scale.setScalar(0.8 + Math.random() * 0.4);
      group.add(bell);

      for (let t = 0; t < 12; t++) {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3((Math.random() - 0.5) * 0.5, -0.5, (Math.random() - 0.5) * 0.5),
          new THREE.Vector3((Math.random() - 0.5) * 1, -1.5, (Math.random() - 0.5) * 1),
          new THREE.Vector3((Math.random() - 0.5) * 1.5, -3, (Math.random() - 0.5) * 1.5),
        ]);
        const tentacleGeo = new THREE.TubeGeometry(curve, 15, 0.02, 3, false);
        const tentacle = new THREE.Mesh(tentacleGeo, tentacleMaterial);
        tentacle.rotation.y = (t / 12) * Math.PI * 2;
        tentacle.position.y = -0.15;
        group.add(tentacle);
      }

      jellyfishRef.current.push(group);
    }
  }, [bellGeometry, bellMaterial, tentacleMaterial]);

  useFrame((_, delta) => {
    if (reducedMotion || isPaused) return;
    timeRef.current += delta;

    jellyfishRef.current.forEach((jelly, i) => {
      const bell = jelly.children[0] as THREE.Mesh;
      if (bell) {
        // Slower, more natural pulse
        const pulse = Math.sin(timeRef.current * 0.8 + i) * 0.5 + 0.5;
        (bell.material as THREE.MeshPhysicalMaterial).emissiveIntensity = 0.5 + pulse * 0.3;
        bell.scale.y = 0.5 * (1 + pulse * 0.2);
      }

      for (let t = 1; t < jelly.children.length; t++) {
        const tentacle = jelly.children[t];
        tentacle.rotation.z = Math.sin(timeRef.current * 0.8 + t * 0.5 + i) * 0.3;
        tentacle.rotation.x = Math.cos(timeRef.current * 0.6 + t * 0.3 + i) * 0.15;
      }

      jelly.position.y += Math.sin(timeRef.current * 0.15 + i) * delta * 0.15;
      jelly.position.x += Math.sin(timeRef.current * 0.08 + i) * delta * 0.08;
    });
  });

  return (
    <group>
      {jellyfishRef.current.map((jelly, i) => (
        <primitive key={`ds-jelly-${i}`} object={jelly} dispose={null} />
      ))}
    </group>
  );
}

/**
 * Abyssal creatures - sea cucumbers, brittle stars, amphipods
 */
function AbyssalCreatures({ zoneProgress: _zoneProgress, reducedMotion, isPaused, zoneColors }: MarineLifeChildPropsNoZone) {
  const creaturesRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);

  const cucumberGeometry = useMemo(() => {
    const geo = new THREE.CapsuleGeometry(0.15, 0.6, 6, 12);
    return geo;
  }, []);

  const starGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.3);
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
      shape.lineTo(Math.cos(angle) * 0.3, Math.sin(angle) * 0.3);
      shape.lineTo(Math.cos(angle + Math.PI / 5) * 0.1, Math.sin(angle + Math.PI / 5) * 0.1);
    }
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false });
  }, []);

  const amphipodGeometry = useMemo(() => {
    const geo = new THREE.CapsuleGeometry(0.03, 0.1, 4, 8);
    return geo;
  }, []);

  const cucumberMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: zoneColors.creatureBody,
    roughness: 0.9,
    metalness: 0.05,
  }), [zoneColors]);

  const starMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: zoneColors.creatureBody,
    roughness: 0.8,
    metalness: 0.1,
  }), [zoneColors]);

  const amphipodMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: zoneColors.creatureBody,
    roughness: 0.7,
    metalness: 0.15,
  }), [zoneColors]);

  useMemo(() => {
    if (creaturesRef.current) {
      creaturesRef.current.clear();
    }
    const group = new THREE.Group();

    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 5 + Math.random() * 50;
      const cucumber = new THREE.Mesh(cucumberGeometry, cucumberMaterial);
      cucumber.position.set(
        Math.cos(angle) * radius,
        -14.8 + Math.random() * 0.5,
        Math.sin(angle) * radius
      );
      cucumber.rotation.set(
        Math.random() * 0.3,
        Math.random() * Math.PI * 2,
        Math.random() * 0.3
      );
      cucumber.scale.setScalar(0.8 + Math.random() * 0.5);
      group.add(cucumber);
    }

    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 5 + Math.random() * 50;
      const star = new THREE.Mesh(starGeometry, starMaterial);
      star.position.set(
        Math.cos(angle) * radius,
        -14.9,
        Math.sin(angle) * radius
      );
      star.rotation.set(-Math.PI / 2, Math.random() * Math.PI * 2, 0);
      star.scale.setScalar(0.5 + Math.random() * 0.5);
      group.add(star);
    }

    for (let i = 0; i < 50; i++) {
      const amphipod = new THREE.Mesh(amphipodGeometry, amphipodMaterial);
      const angle = Math.random() * Math.PI * 2;
      const radius = 10 + Math.random() * 40;
      amphipod.position.set(
        Math.cos(angle) * radius,
        -14 + Math.random() * 3,
        Math.sin(angle) * radius
      );
      amphipod.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI * 2, 0);
      amphipod.scale.setScalar(0.7 + Math.random() * 0.5);
      group.add(amphipod);
    }

    creaturesRef.current = group;
  }, [cucumberGeometry, starGeometry, amphipodGeometry, cucumberMaterial, starMaterial, amphipodMaterial]);

  useFrame((_, delta) => {
    if (reducedMotion || isPaused || !creaturesRef.current) return;
    timeRef.current += delta;

    creaturesRef.current.children.forEach((creature, i) => {
      if (i < 20) {
        creature.position.y += Math.sin(timeRef.current * 0.05 + i) * delta * 0.01;
      } else if (i < 35) {
        creature.rotation.z += delta * 0.005;
      } else {
        creature.position.x += Math.sin(timeRef.current * 0.3 + i) * delta * 0.05;
        creature.position.z += Math.cos(timeRef.current * 0.25 + i) * delta * 0.05;
      }
    });
  });

  if (!creaturesRef.current) return null;
  return <primitive object={creaturesRef.current} dispose={null} />;
}

/**
 * Main MarineLife component - renders appropriate life for each zone
 */
export function MarineLife({ zone, zoneProgress, reducedMotion, isPaused = false }: MarineLifeProps) {
  const colors = ZONE_COLORS[zone];
  const visibility = ZONE_VISIBILITY[zone];
  const debugEnabled = useDebugFlag();

  return (
    <group>
      {/* MarineLife render counter (dev only) */}
      <MarineLifeRenderCounter enabled={debugEnabled} />
      {/* Sunlight zone - schooling fish and jellyfish */}
      {visibility.schoolingFish && (
        <SchoolingFish zoneProgress={zoneProgress} reducedMotion={reducedMotion} isPaused={isPaused} zoneColors={colors} />
      )}
      {visibility.jellyfish && (
        <Jellyfish zone={zone} zoneProgress={zoneProgress} reducedMotion={reducedMotion} isPaused={isPaused} zoneColors={colors} />
      )}

      {/* Midnight zone - anglerfish, deep sea jellyfish, bioluminescent organisms */}
      {visibility.anglerfish && (
        <Anglerfish zoneProgress={zoneProgress} reducedMotion={reducedMotion} isPaused={isPaused} zoneColors={colors} />
      )}
      {visibility.deepSeaJellyfish && (
        <DeepSeaJellyfish zoneProgress={zoneProgress} reducedMotion={reducedMotion} isPaused={isPaused} zoneColors={colors} />
      )}
      {visibility.bioluminescentOrgs && (
        <BioluminescentOrganisms zone={zone} zoneProgress={zoneProgress} reducedMotion={reducedMotion} isPaused={isPaused} zoneColors={colors} />
      )}

      {/* Abyss zone - abyssal creatures, bioluminescent organisms */}
      {visibility.abyssalCreatures && (
        <AbyssalCreatures zoneProgress={zoneProgress} reducedMotion={reducedMotion} isPaused={isPaused} zoneColors={colors} />
      )}
    </group>
  );
}