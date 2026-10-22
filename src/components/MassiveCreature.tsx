/**
 * ABYSS — Massive Creature Component
 * The enormous unknown entity in the distance, barely visible
 * Uses unified zone configuration from @/config/zones
 */

import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ZoneId } from '@/config/zones';

interface MassiveCreatureProps {
  zone: ZoneId;
  zoneProgress: number;
  reducedMotion: boolean;
  isPaused?: boolean;
}

export function MassiveCreature({ zone, zoneProgress, reducedMotion, isPaused = false }: MassiveCreatureProps) {
  const creatureRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);
  const revealProgressRef = useRef(0);
  const torusScaleRef = useRef(0);
  const eyeBlinkTimeoutsRef = useRef<number[]>([]);
  const eyeBlinkActiveRef = useRef({ left: false, right: false });

  const targetReveal = zone === 'abyss' ? 1 : zone === 'midnight' ? zoneProgress * 0.3 : 0;

  // ============ GEOMETRIES ============

  // Squid mantle (main body) - elongated teardrop with fins
  const mantleGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const indices: number[] = [];

    const rings = 16; // longitudinal segments
    const segments = 16; // around the mantle
    const mantleLength = 55; // total mantle length
    const maxRadius = 10; // maximum mantle radius

    for (let ring = 0; ring <= rings; ring++) {
      const v = ring / rings; // 0 at front (head), 1 at rear
      // Mantle profile: tapered front, widest at ~30%, tapered rear with fins
      let radius = 0;
      if (v < 0.25) {
        // Front taper to head
        radius = maxRadius * 0.7 * Math.sin((v / 0.25) * Math.PI * 0.5);
      } else if (v < 0.7) {
        // Main mantle body - slightly bulging
        const midV = (v - 0.25) / 0.45;
        radius = maxRadius * (1 + Math.sin(midV * Math.PI) * 0.15);
      } else {
        // Rear taper into fins
        radius = maxRadius * Math.cos(((v - 0.7) / 0.3) * Math.PI * 0.5) * 1.2;
      }

      const y = -v * mantleLength + mantleLength * 0.4; // center roughly at origin

      for (let seg = 0; seg < segments; seg++) {
        const theta = (seg / segments) * Math.PI * 2;
        positions.push(
          Math.cos(theta) * radius,
          y,
          Math.sin(theta) * radius
        );
      }
    }

    // Front cap (head end)
    const frontCapIdx = positions.length / 3;
    positions.push(0, mantleLength * 0.4, 0);

    // Rear cap
    const rearCapIdx = positions.length / 3;
    positions.push(0, -0.7 * mantleLength + mantleLength * 0.4, 0);

    // Generate indices for mantle tube
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

    // Front cap
    for (let seg = 0; seg < segments; seg++) {
      const curr = seg;
      const next = (seg + 1) % segments;
      indices.push(curr, frontCapIdx, next);
    }

    // Rear cap
    for (let seg = 0; seg < segments; seg++) {
      const curr = rings * segments + seg;
      const next = rings * segments + (seg + 1) % segments;
      indices.push(curr, next, rearCapIdx);
    }

    // Fin triangles removed - fins now use separate finGeometry to avoid z-fighting

    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, []);

  // Fin geometry - only the fin triangles, separate from mantle to avoid double rendering
  const finGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const indices: number[] = [];

    const mantleLength = 55;
    const maxRadius = 10;
    const finBaseY = -0.7 * mantleLength + mantleLength * 0.4;
    const finTipY = finBaseY - 8;
    const finOut = maxRadius * 1.8;

    // Left fin base
    const leftFinBaseIdx = 0;
    positions.push(-maxRadius * 1.1, finBaseY, 0);
    // Left fin tip
    const leftFinTipIdx = 1;
    positions.push(-finOut, finTipY, 0);
    // Right fin base
    const rightFinBaseIdx = 2;
    positions.push(maxRadius * 1.1, finBaseY, 0);
    // Right fin tip
    const rightFinTipIdx = 3;
    positions.push(finOut, finTipY, 0);
    // Rear cap center (for fin attachment)
    const rearCapIdx = 4;
    positions.push(0, finBaseY, 0);

    // Left fin triangles
    indices.push(leftFinBaseIdx, rearCapIdx, leftFinTipIdx);
    // Right fin triangles
    indices.push(rightFinTipIdx, rearCapIdx, rightFinBaseIdx);

    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, []);

  // Head - distinct from mantle, houses eyes and beak
  const headGeometry = useMemo(() => {
    // Rounded cube-ish shape for head
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const indices: number[] = [];

    const rings = 6;
    const segments = 12;
    const headHeight = 12;
    const headWidth = 14;
    const headDepth = 10;

    for (let ring = 0; ring <= rings; ring++) {
      const v = ring / rings;
      const y = -v * headHeight + headHeight * 0.5;
      const radiusX = headWidth * 0.5 * (1 - v * 0.2);
      const radiusZ = headDepth * 0.5 * (1 - v * 0.2);

      for (let seg = 0; seg < segments; seg++) {
        const theta = (seg / segments) * Math.PI * 2;
        positions.push(
          Math.cos(theta) * radiusX,
          y,
          Math.sin(theta) * radiusZ
        );
      }
    }

    // Bottom cap (connects to arms)
    const bottomCapIdx = positions.length / 3;
    positions.push(0, -headHeight * 0.5, 0);
    // Top cap
    const topCapIdx = positions.length / 3;
    positions.push(0, headHeight * 0.5, 0);

    // Tube indices
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

    // Caps
    for (let seg = 0; seg < segments; seg++) {
      const curr = seg;
      const next = (seg + 1) % segments;
      indices.push(curr, bottomCapIdx, next);
    }
    for (let seg = 0; seg < segments; seg++) {
      const curr = rings * segments + seg;
      const next = rings * segments + (seg + 1) % segments;
      indices.push(curr, next, topCapIdx);
    }

    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, []);

  // Arm geometry - 8 shorter, thick arms with suckers implied by taper
  const armGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const indices: number[] = [];

    const length = 35;
    const segments = 24; // longitudinal
    const rings = 6; // cross-section (6-sided for performance)
    const baseRadius = 1.8;
    const tipRadius = 0.15;

    for (let seg = 0; seg <= segments; seg++) {
      const v = seg / segments;
      const y = -v * length;
      const radius = baseRadius * (1 - v) + tipRadius * v;

      // Add subtle curve to the arm
      const curveX = Math.sin(v * Math.PI) * 2;
      const curveZ = Math.cos(v * Math.PI * 0.5) * 1.5;

      for (let ring = 0; ring < rings; ring++) {
        const theta = (ring / rings) * Math.PI * 2;
        positions.push(
          Math.cos(theta) * radius + curveX,
          y,
          Math.sin(theta) * radius + curveZ
        );
      }
    }

    // Tip cap
    const tipCapIdx = positions.length / 3;
    positions.push(0, -length, 0);

    // Base cap
    const baseCapIdx = positions.length / 3;
    positions.push(0, 0, 0);

    // Tube indices
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

    // Tip cap
    for (let ring = 0; ring < rings; ring++) {
      const curr = segments * rings + ring;
      const next = segments * rings + (ring + 1) % rings;
      indices.push(curr, next, tipCapIdx);
    }

    // Base cap
    for (let ring = 0; ring < rings; ring++) {
      const curr = ring;
      const next = (ring + 1) % rings;
      indices.push(curr, baseCapIdx, next);
    }

    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    // Store base positions for traveling wave animation
    geometry.userData.basePositions = new Float32Array(positions);
    geometry.computeVertexNormals();
    return geometry;
  }, []);

  // Feeding tentacle geometry - 2 long, thin tentacles with clubbed ends
  const feedingTentacleGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const indices: number[] = [];

    const length = 65;
    const segments = 32; // more segments for smoother wave animation
    const rings = 5; // 5-sided (thin)
    const baseRadius = 0.7;
    const midRadius = 0.4;
    const clubRadius = 1.2;
    const clubStart = 0.7; // club starts at 70% of length

    for (let seg = 0; seg <= segments; seg++) {
      const v = seg / segments;
      const y = -v * length;

      let radius: number;
      if (v < clubStart) {
        // Shaft - tapering
        radius = baseRadius * (1 - v / clubStart * 0.5) + midRadius * (v / clubStart);
      } else {
        // Club - widens then tapers to point
        const clubV = (v - clubStart) / (1 - clubStart);
        radius = midRadius + (clubRadius - midRadius) * Math.sin(clubV * Math.PI * 0.5);
        if (clubV > 0.8) {
          radius *= 1 - (clubV - 0.8) / 0.2; // taper to point
        }
      }

      for (let ring = 0; ring < rings; ring++) {
        const theta = (ring / rings) * Math.PI * 2;
        positions.push(
          Math.cos(theta) * radius,
          y,
          Math.sin(theta) * radius
        );
      }
    }

    // Tip cap
    const tipCapIdx = positions.length / 3;
    positions.push(0, -length, 0);

    // Base cap
    const baseCapIdx = positions.length / 3;
    positions.push(0, 0, 0);

    // Tube indices
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

    // Caps
    for (let ring = 0; ring < rings; ring++) {
      const curr = segments * rings + ring;
      const next = segments * rings + (ring + 1) % rings;
      indices.push(curr, next, tipCapIdx);
    }
    for (let ring = 0; ring < rings; ring++) {
      const curr = ring;
      const next = (ring + 1) % rings;
      indices.push(curr, baseCapIdx, next);
    }

    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    // Store base positions for traveling wave animation
    geometry.userData.basePositions = new Float32Array(positions);
    geometry.computeVertexNormals();
    return geometry;
  }, []);

  // Eye geometry - massive, barely visible
  const eyeGeometry = useMemo(() => {
    return new THREE.SphereGeometry(3, 32, 32);
  }, []);

  // Materials - restrained deep-sea colors, subtle variation
  // Deep-sea creatures: dark, desaturated tones with subtle iridescence
  const mantleMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x0a0f14), // Near-black deep sea tone
      roughness: 0.85,
      metalness: 0.05,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    });
  }, []);

  const headMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x0c1218),
      roughness: 0.8,
      metalness: 0.08,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
    });
  }, []);

  const armMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x080d12),
      roughness: 0.9,
      metalness: 0.03,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
    });
  }, []);

  const feedingTentacleMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x060a0e),
      roughness: 0.92,
      metalness: 0.02,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
    });
  }, []);

  const finMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x0a0f14),
      roughness: 0.95,
      metalness: 0.01,
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }, []);

  const spotMaterial = useMemo(() => {
    return new THREE.PointsMaterial({
      size: 0.8,
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: true,
      depthWrite: false,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      map: createSpotTexture(),
    });
  }, []);

  // Eyes - subtle, not glowing bright
  const eyeMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x001a1a), // Very dark teal
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
  }, []);

  const eyeGlowMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x003333), // Subtle glow
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  // Arm positions - 8 arms around the head base
  const armPositions = useMemo(() => {
    const positions: THREE.Vector3[] = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const radius = 7;
      positions.push(new THREE.Vector3(
        Math.cos(angle) * radius,
        -6, // at base of head
        Math.sin(angle) * radius
      ));
    }
    return positions;
  }, []);

  // Feeding tentacle positions - 2 longer ones between arms
  const feedingTentaclePositions = useMemo(() => {
    return [
      new THREE.Vector3(8, -6, 2),
      new THREE.Vector3(-8, -6, -2),
    ];
  }, []);

  // Bioluminescent spots on mantle
  const spotPositions = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const count = 120;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const spotColors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * Math.PI * 2;
      const phi = Math.acos(2 * v - 1);
      // On mantle surface (radius ~10)
      const r = 9.5 + Math.random() * 1.5;
      const y = -30 + Math.random() * 40; // Along mantle length

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      sizes[i] = 0.12 + Math.random() * 0.25;
      phases[i] = Math.random() * Math.PI * 2;

      // Subtle bioluminescence colors - mostly teal/blue
      const colorChoice = Math.random();
      if (colorChoice < 0.6) {
        spotColors[i * 3] = 0; spotColors[i * 3 + 1] = 0.8; spotColors[i * 3 + 2] = 0.6;
      } else if (colorChoice < 0.9) {
        spotColors[i * 3] = 0; spotColors[i * 3 + 1] = 0.5; spotColors[i * 3 + 2] = 0.9;
      } else {
        spotColors[i * 3] = 0.2; spotColors[i * 3 + 1] = 0.9; spotColors[i * 3 + 2] = 0.4;
      }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('color', new THREE.BufferAttribute(spotColors, 3));
    return geometry;
  }, []);

  // Ref for arm meshes to animate them
  const armRefs = useRef<THREE.Mesh[]>([]);
  const feedingTentacleRefs = useRef<THREE.Mesh[]>([]);

  // Animate reveal and subtle movement with traveling waves
  useFrame((_, delta) => {
    if (reducedMotion || isPaused) return;
    timeRef.current += delta;

    // Smooth reveal progress
    revealProgressRef.current = THREE.MathUtils.lerp(
      revealProgressRef.current,
      targetReveal,
      delta * 0.3
    );

    // Animate torus silhouette scale (for abyss zone)
    if (zone === 'abyss') {
      torusScaleRef.current = THREE.MathUtils.lerp(
        torusScaleRef.current,
        revealProgressRef.current,
        delta * 2
      );
    } else {
      torusScaleRef.current = THREE.MathUtils.lerp(torusScaleRef.current, 0, delta * 2);
    }

    const progress = revealProgressRef.current;

    if (creatureRef.current) {
      // Update mantle opacity
      const mantle = creatureRef.current.getObjectByName('mantle') as THREE.Mesh;
      if (mantle && mantle.material) {
        (mantle.material as THREE.MeshStandardMaterial).opacity = 0.04 + progress * 0.18;
      }

      // Update head opacity
      const head = creatureRef.current.getObjectByName('head') as THREE.Mesh;
      if (head && head.material) {
        (head.material as THREE.MeshStandardMaterial).opacity = 0.05 + progress * 0.2;
      }

      // Update fins opacity
      const fins = creatureRef.current.getObjectByName('fins') as THREE.Mesh;
      if (fins && fins.material) {
        (fins.material as THREE.MeshStandardMaterial).opacity = 0.02 + progress * 0.1;
      }

      // Update arms
      armRefs.current.forEach((arm, _i) => {
        if (arm && arm.material) {
          (arm.material as THREE.MeshStandardMaterial).opacity = 0.03 + progress * 0.15;
        }
      });

      // Update feeding tentacles
      feedingTentacleRefs.current.forEach((tentacle, _i) => {
        if (tentacle && tentacle.material) {
          (tentacle.material as THREE.MeshStandardMaterial).opacity = 0.02 + progress * 0.12;
        }
      });

      // Update spots
      const spots = creatureRef.current.getObjectByName('spots') as THREE.Points;
      if (spots) {
        (spots.material as THREE.PointsMaterial).opacity = 0.3 + progress * 0.5;
      }

      // Update eyes
      const eye = creatureRef.current.getObjectByName('eye') as THREE.Mesh;
      const eyeGlow = creatureRef.current.getObjectByName('eyeGlow') as THREE.Mesh;
      const eye2 = creatureRef.current.getObjectByName('eye2') as THREE.Mesh;
      const eyeGlow2 = creatureRef.current.getObjectByName('eyeGlow2') as THREE.Mesh;
      if (eye && eye.material) {
        (eye.material as THREE.MeshBasicMaterial).opacity = 0.15 + progress * 0.35;
      }
      if (eyeGlow && eyeGlow.material) {
        (eyeGlow.material as THREE.MeshBasicMaterial).opacity = 0.2 + progress * 0.4;
      }
      if (eye2 && eye2.material) {
        (eye2.material as THREE.MeshBasicMaterial).opacity = 0.15 + progress * 0.35;
      }
      if (eyeGlow2 && eyeGlow2.material) {
        (eyeGlow2.material as THREE.MeshBasicMaterial).opacity = 0.2 + progress * 0.4;
      }

      // ============ TRAVELING WAVE ANIMATION FOR TENTACLES ============
      // For each arm/feeding tentacle, we animate vertices directly for traveling waves
      // This is done by storing base positions and applying wave offset in useFrame

      // Subtle body movement - slow, deliberate
      creatureRef.current.position.y = Math.sin(timeRef.current * 0.03) * 1.5;
      creatureRef.current.rotation.y = Math.sin(timeRef.current * 0.015) * 0.015;
      creatureRef.current.rotation.x = Math.cos(timeRef.current * 0.01) * 0.008;

      // Animate arms with traveling waves
      armRefs.current.forEach((arm, i) => {
        if (!arm || !arm.geometry) return;
        const positions = arm.geometry.attributes.position;
        const basePositions = (arm.geometry as any).userData?.basePositions;
        if (!basePositions) return;

        const armPhaseOffset = i * 0.8; // Phase offset per arm
        const waveSpeed = 1.2;
        const waveLength = 0.15; // wavelength along arm
        const maxAmplitude = 0.8; // max displacement at tip

        for (let v = 0; v < positions.count; v++) {
          const y = basePositions[v * 3 + 1]; // Y position (0 to -35)
          const vNorm = Math.abs(y) / 35; // 0 at base, 1 at tip

          // Traveling wave: sin(time * speed - position * wavelength + phaseOffset)
          const wavePhase = timeRef.current * waveSpeed - vNorm * Math.PI * 2 / waveLength + armPhaseOffset;
          const amplitude = maxAmplitude * vNorm * vNorm; // Quadratic - small at base, large at tip
          const waveX = Math.sin(wavePhase) * amplitude;
          const waveZ = Math.cos(wavePhase * 0.7) * amplitude * 0.6;

          positions.setX(v, basePositions[v * 3] + waveX);
          positions.setZ(v, basePositions[v * 3 + 2] + waveZ);
        }
        positions.needsUpdate = true;
        // arm.geometry.computeVertexNormals(); // Removed for performance - normals don't change significantly
      });

      // Animate feeding tentacles with more pronounced traveling waves
      feedingTentacleRefs.current.forEach((tentacle, i) => {
        if (!tentacle || !tentacle.geometry) return;
        const positions = tentacle.geometry.attributes.position;
        const basePositions = (tentacle.geometry as any).userData?.basePositions;
        if (!basePositions) return;

        const tentaclePhaseOffset = i * 1.5 + 2; // Different phase
        const waveSpeed = 0.8;
        const waveLength = 0.08;
        const maxAmplitude = 1.5;

        for (let v = 0; v < positions.count; v++) {
          const y = basePositions[v * 3 + 1];
          const vNorm = Math.abs(y) / 65;

          const wavePhase = timeRef.current * waveSpeed - vNorm * Math.PI * 2 / waveLength + tentaclePhaseOffset;
          const amplitude = maxAmplitude * Math.pow(vNorm, 1.5); // Stronger at tip
          const waveX = Math.sin(wavePhase) * amplitude;
          const waveZ = Math.cos(wavePhase * 0.6 + 0.5) * amplitude * 0.8;

          positions.setX(v, basePositions[v * 3] + waveX);
          positions.setZ(v, basePositions[v * 3 + 2] + waveZ);
        }
        positions.needsUpdate = true;
        // tentacle.geometry.computeVertexNormals(); // Removed for performance - normals don't change significantly
      });

      // Animate bioluminescent spots - gentle pulse
      if (spots) {
        const sizes = spots.geometry.attributes.size;
        const phases = spots.geometry.attributes.phase;
        for (let i = 0; i < sizes.count; i++) {
          const phase = phases.getX(i);
          const pulse = Math.sin(timeRef.current * 0.6 + phase) * 0.5 + 0.5;
          sizes.setX(i, (0.12 + 0.25 * pulse) * progress);
        }
        sizes.needsUpdate = true;
      }

      // Eye blink occasionally - deterministic sine-based timing (no Math.random in useFrame)
      // Left eye: blink every ~55 seconds, offset by 2 seconds
      const leftBlinkCycle = Math.sin(timeRef.current / 55 + 2) > 0.99;
      if (eye && eyeGlow && !eyeBlinkActiveRef.current.left && leftBlinkCycle) {
        eyeBlinkActiveRef.current.left = true;
        eye.scale.y = 0.1;
        eyeGlow.scale.y = 0.1;
        const timeoutId = window.setTimeout(() => {
          if (eye) eye.scale.y = 1;
          if (eyeGlow) eyeGlow.scale.y = 1;
          eyeBlinkActiveRef.current.left = false;
        }, 200);
        eyeBlinkTimeoutsRef.current.push(timeoutId);
      }
      // Right eye: blink every ~60 seconds, offset by 5 seconds (staggered)
      const rightBlinkCycle = Math.sin(timeRef.current / 60 + 5) > 0.99;
      if (eye2 && eyeGlow2 && !eyeBlinkActiveRef.current.right && rightBlinkCycle) {
        eyeBlinkActiveRef.current.right = true;
        eye2.scale.y = 0.1;
        eyeGlow2.scale.y = 0.1;
        const timeoutId = window.setTimeout(() => {
          if (eye2) eye2.scale.y = 1;
          if (eyeGlow2) eyeGlow2.scale.y = 1;
          eyeBlinkActiveRef.current.right = false;
        }, 200);
        eyeBlinkTimeoutsRef.current.push(timeoutId);
      }
    }
  });

  // Cleanup eye blink timeouts on unmount
  useLayoutEffect(() => {
    return () => {
      eyeBlinkTimeoutsRef.current.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      eyeBlinkTimeoutsRef.current = [];
    };
  }, []);

  // Position far in the distance - impressive scale
  const creaturePosition = useMemo(() => {
    return new THREE.Vector3(0, -15, -250);
  }, []);

  return (
    <group
      ref={creatureRef}
      position={creaturePosition.toArray()}
      rotation={[0, Math.PI, 0]}
    >
      {/* Mantle (main body) */}
      <mesh
        name="mantle"
        geometry={mantleGeometry}
        material={mantleMaterial}
        castShadow={false}
        receiveShadow={false}
      />

      {/* Fins - separate mesh for different material */}
      <mesh
        name="fins"
        geometry={finGeometry}
        material={finMaterial}
        castShadow={false}
        receiveShadow={false}
      />

      {/* Head - distinct from mantle, positioned at front */}
      <mesh
        name="head"
        geometry={headGeometry}
        material={headMaterial}
        position={[0, 28, 0]}
        castShadow={false}
        receiveShadow={false}
      />

      {/* 8 Arms - positioned around head base */}
      {armPositions.map((pos, i) => (
        <mesh
          key={`arm-${i}`}
          name={`arm-${i}`}
          ref={(mesh) => { if (mesh) armRefs.current[i] = mesh; }}
          geometry={armGeometry}
          material={armMaterial}
          position={pos.toArray()}
          rotation={[0, (i / 8) * Math.PI * 2, 0]}
          castShadow={false}
          receiveShadow={false}
        />
      ))}

      {/* 2 Feeding Tentacles - longer, thinner, with clubbed ends */}
      {feedingTentaclePositions.map((pos, i) => (
        <mesh
          key={`feeding-tentacle-${i}`}
          name={`feeding-tentacle-${i}`}
          ref={(mesh) => { if (mesh) feedingTentacleRefs.current[i] = mesh; }}
          geometry={feedingTentacleGeometry}
          material={feedingTentacleMaterial}
          position={pos.toArray()}
          rotation={[0, i === 0 ? -0.3 : 0.3, 0]}
          castShadow={false}
          receiveShadow={false}
        />
      ))}

      {/* Bioluminescent Spots on mantle */}
      <points
        name="spots"
        geometry={spotPositions}
        material={spotMaterial}
      />

      {/* Massive Eye - left */}
      <group position={[-5, 35, 10]}>
        <mesh
          name="eye"
          geometry={eyeGeometry}
          material={eyeMaterial}
          scale={[1, 0.6, 1]}
        />
        <mesh
          name="eyeGlow"
          geometry={new THREE.SphereGeometry(4.2, 32, 32)}
          material={eyeGlowMaterial}
          scale={[1, 0.6, 1]}
        />
      </group>

      {/* Massive Eye - right */}
      <group position={[5, 35, 10]}>
        <mesh
          name="eye2"
          geometry={eyeGeometry}
          material={eyeMaterial}
          scale={[1, 0.6, 1]}
        />
        <mesh
          name="eyeGlow2"
          geometry={new THREE.SphereGeometry(4.2, 32, 32)}
          material={eyeGlowMaterial}
          scale={[1, 0.6, 1]}
        />
      </group>

      {/* Faint silhouette outline - only at full reveal in abyss */}
      {zone === 'abyss' && (
        <mesh
          geometry={new THREE.TorusGeometry(15, 0.1, 8, 32)}
          material={new THREE.MeshBasicMaterial({
            color: new THREE.Color(0x004444),
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          })}
          position={[0, 0, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[torusScaleRef.current, torusScaleRef.current, 1]}
        />
      )}
    </group>
  );
}

function createSpotTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}