/**
 * ABYSS — Environment Component
 * Ocean floor, distant geological silhouettes, and ambient geometry
 * Uses unified zone configuration from @/config/zones
 */

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ZoneId, ZoneColors } from '@/config/zones';
import { ZONE_COLORS, ZONE_VISIBILITY } from '@/config/zones';

interface EnvironmentProps {
  zone: ZoneId;
  zoneProgress: number;
  reducedMotion: boolean;
  isPaused?: boolean;
}

export function Environment({ zone, zoneProgress: _zoneProgress, reducedMotion, isPaused = false }: EnvironmentProps) {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);

  // Get visibility rules for current zone
  const visibility = ZONE_VISIBILITY[zone];
  const colors = ZONE_COLORS[zone];

  // Create ocean floor geometry
  const floorGeometry = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(500, 500, 100, 100);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const noise = THREE.MathUtils.seededRandom(i * 0.01) * 0.5;
      positions.setZ(i, noise);
    }
    geometry.computeVertexNormals();
    return geometry;
  }, []);

  // Create rock formations
  const rockGeometries = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 15; i++) {
      const geo = new THREE.DodecahedronGeometry(
        THREE.MathUtils.randFloat(2, 8),
        0
      );
      const positions = geo.attributes.position;
      for (let j = 0; j < positions.count; j++) {
        const scale = 1 + THREE.MathUtils.randFloat(-0.3, 0.3);
        positions.setXYZ(
          j,
          positions.getX(j) * scale,
          positions.getY(j) * scale,
          positions.getZ(j) * scale
        );
      }
      geo.computeVertexNormals();
      geometries.push(geo);
    }
    return geometries;
  }, []);

  // Create distant silhouettes (large geological structures)
  const silhouetteGeometries = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 8; i++) {
      const geo = new THREE.ConeGeometry(
        THREE.MathUtils.randFloat(15, 40),
        THREE.MathUtils.randFloat(30, 80),
        6,
        1,
        true
      );
      const positions = geo.attributes.position;
      for (let j = 0; j < positions.count; j++) {
        positions.setX(j, positions.getX(j) * THREE.MathUtils.randFloat(0.7, 1.3));
        positions.setZ(j, positions.getZ(j) * THREE.MathUtils.randFloat(0.7, 1.3));
      }
      geo.computeVertexNormals();
      geometries.push(geo);
    }
    return geometries;
  }, []);

  // Materials based on zone - using unified colors
  const floorMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(colors.waterColorDeep),
      roughness: 0.85,
      metalness: 0.1,
      depthWrite: true,
    });
  }, [colors]);

  const rockMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(colors.creatureBody),
      roughness: 0.9,
      metalness: 0.08,
    });
  }, [colors]);

  const silhouetteMaterial = useMemo(() => {
    // Smooth opacity per zone to prevent abrupt changes at boundaries
    const zoneOpacities = {
      sunlight: 0.5,
      twilight: 0.4,
      midnight: 0.25,
      abyss: 0.15,
    };

    const opacity = zoneOpacities[zone as keyof typeof zoneOpacities] || 0.15;

    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(colors.fogColor),
      transparent: true,
      opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }, [zone, colors]);

  // Animate subtle movement
  useFrame((_, delta) => {
    if (reducedMotion || isPaused) return;
    timeRef.current += delta * 0.05;

    if (groupRef.current) {
      groupRef.current.rotation.z = Math.sin(timeRef.current) * 0.002;
      groupRef.current.rotation.x = Math.cos(timeRef.current * 0.7) * 0.001;
    }
  });

  // Rock positions (memoized)
  const rockPositions = useMemo(() => {
    const positions: THREE.Vector3[] = [];
    for (let i = 0; i < 15; i++) {
      const angle = (i / 15) * Math.PI * 2;
      const radius = THREE.MathUtils.randFloat(25, 80);
      positions.push(new THREE.Vector3(
        Math.cos(angle) * radius,
        -15 + THREE.MathUtils.randFloat(-5, 2),
        Math.sin(angle) * radius
      ));
    }
    return positions;
  }, []);

  // Silhouette positions (far in the distance)
  const silhouettePositions = useMemo(() => {
    const positions: THREE.Vector3[] = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + Math.PI / 16;
      const radius = THREE.MathUtils.randFloat(120, 200);
      positions.push(new THREE.Vector3(
        Math.cos(angle) * radius,
        -15 - THREE.MathUtils.randFloat(0, 20),
        Math.sin(angle) * radius
      ));
    }
    return positions;
  }, []);

  return (
    <group ref={groupRef} position={[0, -15, 0]}>
      {/* Ocean Floor */}
      <mesh
        geometry={floorGeometry}
        material={floorMaterial}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      />

      {/* Rock Formations */}
      {rockGeometries.map((geo, i) => (
        <mesh
          key={`rock-${i}`}
          geometry={geo}
          material={rockMaterial}
          position={rockPositions[i].toArray()}
          rotation={[0, THREE.MathUtils.randFloat(0, Math.PI * 2), 0]}
          scale={[1, THREE.MathUtils.randFloat(0.5, 1.5), 1]}
          receiveShadow
        />
      ))}

      {/* Distant Silhouettes - massive geological structures */}
      {silhouetteGeometries.map((geo, i) => (
        <mesh
          key={`silhouette-${i}`}
          geometry={geo}
          material={silhouetteMaterial}
          position={silhouettePositions[i].toArray()}
          rotation={[Math.PI, THREE.MathUtils.randFloat(0, Math.PI * 2), 0]}
        />
      ))}

      {/* Thermal vent-like structures in abyss zone only */}
      {visibility.thermalVents && <ThermalVents reducedMotion={reducedMotion} isPaused={isPaused} zoneColors={colors} />}
    </group>
  );
}

/**
 * Thermal vent structures for the abyss zone
 */
interface ThermalVentsProps {
  reducedMotion: boolean;
  isPaused: boolean;
  zoneColors: ZoneColors;
}

function ThermalVents({ reducedMotion, isPaused, zoneColors }: ThermalVentsProps) {
  const ventsRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);

  const ventGeometry = useMemo(() => {
    return new THREE.CylinderGeometry(0.5, 1.5, 8, 8, 1, true);
  }, []);

  const ventMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: '#1a0a05',
      roughness: 0.8,
      metalness: 0.2,
      emissive: new THREE.Color('#331100'),
      emissiveIntensity: 0.3,
    });
  }, []);

  const particleMaterial = useMemo(() => {
    return new THREE.PointsMaterial({
      color: zoneColors.accentPrimary,
      size: 0.15,
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: true,
      depthWrite: false,
    });
  }, [zoneColors]);

  useFrame((_, delta) => {
    if (reducedMotion || isPaused) return;
    timeRef.current += delta;

    if (ventsRef.current) {
      ventsRef.current.children.forEach((child) => {
        if (child instanceof THREE.Points) {
          const positions = child.geometry.attributes.position;
          const resetPositions = child.geometry.attributes.resetPosition;
          const resetYVariation = child.geometry.attributes.resetYVariation;
          for (let j = 0; j < positions.count; j++) {
            const y = positions.getY(j);
            positions.setY(j, y + delta * 2);
            if (y > 4) {
              // Use pre-computed reset positions from attribute
              const idx = j * 2;
              // Use pre-computed Y variation instead of Math.random()
              positions.setY(j, -4 + resetYVariation.getX(j));
              positions.setX(j, resetPositions.getX(idx));
              positions.setZ(j, resetPositions.getY(idx));
            }
          }
          positions.needsUpdate = true;
        }
      });
    }
  });

  const ventPositions = useMemo(() => {
    const positions: THREE.Vector3[] = [];
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const radius = THREE.MathUtils.randFloat(40, 100);
      positions.push(new THREE.Vector3(
        Math.cos(angle) * radius,
        -15,
        Math.sin(angle) * radius
      ));
    }
    return positions;
  }, []);

  return (
    <group ref={ventsRef}>
      {ventPositions.map((pos, i) => (
        <group key={`vent-${i}`} position={pos.toArray()}>
          <mesh
            geometry={ventGeometry}
            material={ventMaterial}
            rotation={[Math.PI / 2, 0, 0]}
          />
          <points geometry={createVentParticles()} material={particleMaterial} />
        </group>
      ))}
    </group>
  );

  function createVentParticles() {
    const geometry = new THREE.BufferGeometry();
    const count = 100;
    const positions = new Float32Array(count * 3);
    // Pre-computed reset positions to avoid Math.random() in useFrame
    const resetPositions = new Float32Array(count * 2);
    const resetYVariation = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 0.5;
      positions[i * 3 + 1] = Math.random() * 8 - 4;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
      // Pre-compute reset X, Z positions
      resetPositions[i * 2] = (Math.random() - 0.5) * 0.5;
      resetPositions[i * 2 + 1] = (Math.random() - 0.5) * 0.5;
      // Pre-compute Y variation for reset (0 to 0.5)
      resetYVariation[i] = Math.random() * 0.5;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('resetPosition', new THREE.BufferAttribute(resetPositions, 2));
    geometry.setAttribute('resetYVariation', new THREE.BufferAttribute(resetYVariation, 1));
    return geometry;
  }
}