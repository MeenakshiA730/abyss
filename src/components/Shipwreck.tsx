/**
 * ABYSS — Shipwreck Component
 * A partially buried research vessel wreckage on the seafloor
 * Uses unified zone configuration from @/config/zones
 */

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ZoneId } from '@/config/zones';
import { ZONE_COLORS, ZONE_VISIBILITY } from '@/config/zones';

interface ShipwreckProps {
  zone: ZoneId;
  zoneProgress: number;
  reducedMotion: boolean;
  isPaused?: boolean;
}

export function Shipwreck({ zone, zoneProgress: _zoneProgress, reducedMotion, isPaused = false }: ShipwreckProps) {
  const wreckRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);

  // Get visibility rules and colors for current zone
  const visibility = ZONE_VISIBILITY[zone];
  const colors = ZONE_COLORS[zone];

  // ============ HULL SECTIONS ============
  const hullSections = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];

    // Main hull - long cylindrical section, broken in half
    const hullGeo = new THREE.CylinderGeometry(6, 6, 60, 16, 4, true);
    const positions = hullGeo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      const taper = 1 - Math.abs(y) / 30 * 0.3;
      positions.setX(i, positions.getX(i) * taper);
      positions.setZ(i, positions.getZ(i) * taper);
      const twist = (y / 30) * 0.3;
      const x = positions.getX(i);
      const z = positions.getZ(i);
      positions.setX(i, x * Math.cos(twist) - z * Math.sin(twist));
      positions.setZ(i, x * Math.sin(twist) + z * Math.cos(twist));
      if (Math.abs(y) < 3) {
        positions.setY(i, y + (Math.random() - 0.5) * 2);
      }
    }
    hullGeo.computeVertexNormals();
    geometries.push(hullGeo);

    // Forward section (bow)
    const bowGeo = new THREE.ConeGeometry(5, 20, 12, 2, true);
    const bowPos = bowGeo.attributes.position;
    for (let i = 0; i < bowPos.count; i++) {
      const y = bowPos.getY(i);
      if (y > 5) {
        bowPos.setY(i, y + (Math.random() - 0.5) * 1.5);
      }
    }
    bowGeo.computeVertexNormals();
    geometries.push(bowGeo);

    // Stern section
    const sternGeo = new THREE.CylinderGeometry(4, 6, 25, 12, 2, true);
    sternGeo.computeVertexNormals();
    geometries.push(sternGeo);

    // Superstructure / bridge
    const bridgeGeo = new THREE.BoxGeometry(12, 8, 15);
    const bridgePos = bridgeGeo.attributes.position;
    for (let i = 0; i < bridgePos.count; i++) {
      const y = bridgePos.getY(i);
      if (y > 2) {
        bridgePos.setX(i, bridgePos.getX(i) + (Math.random() - 0.5) * 1);
        bridgePos.setZ(i, bridgePos.getZ(i) + (Math.random() - 0.5) * 1);
      }
    }
    bridgeGeo.computeVertexNormals();
    geometries.push(bridgeGeo);

    // Debris pieces
    for (let i = 0; i < 15; i++) {
      const type = Math.floor(Math.random() * 4);
      let geo: THREE.BufferGeometry;
      if (type === 0) {
        geo = new THREE.BoxGeometry(
          THREE.MathUtils.randFloat(2, 8),
          THREE.MathUtils.randFloat(1, 4),
          THREE.MathUtils.randFloat(2, 10)
        );
      } else if (type === 1) {
        geo = new THREE.CylinderGeometry(
          THREE.MathUtils.randFloat(0.5, 2),
          THREE.MathUtils.randFloat(0.5, 2),
          THREE.MathUtils.randFloat(3, 15),
          8
        );
      } else if (type === 2) {
        geo = new THREE.SphereGeometry(THREE.MathUtils.randFloat(1, 3), 8, 6);
      } else {
        geo = new THREE.TorusGeometry(THREE.MathUtils.randFloat(1, 3), THREE.MathUtils.randFloat(0.3, 0.8), 6, 12);
      }
      geometries.push(geo);
    }

    return geometries;
  }, []);

  // ============ DETAIL GEOMETRIES ============
  const detailGeometries = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];

    // Railings
    for (let i = 0; i < 8; i++) {
      const geo = new THREE.BoxGeometry(THREE.MathUtils.randFloat(5, 15), 0.15, 0.15);
      geometries.push(geo);
    }

    // Pipes and cables
    for (let i = 0; i < 12; i++) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 3),
        new THREE.Vector3((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 5),
      ]);
      const geo = new THREE.TubeGeometry(curve, 10, THREE.MathUtils.randFloat(0.08, 0.2), 6, false);
      geometries.push(geo);
    }

    // Antenna / mast (broken)
    const mastGeo = new THREE.CylinderGeometry(0.05, 0.15, 15, 6);
    geometries.push(mastGeo);

    // Propeller
    const propGeo = new THREE.CylinderGeometry(3, 3, 0.5, 4);
    geometries.push(propGeo);

    // Hatches
    for (let i = 0; i < 6; i++) {
      const geo = new THREE.CylinderGeometry(1.5, 1.5, 0.3, 8);
      geometries.push(geo);
    }

    // Lifeboat davits
    for (let i = 0; i < 4; i++) {
      const geo = new THREE.BoxGeometry(0.3, 6, 0.3);
      geometries.push(geo);
    }

    return geometries;
  }, []);

  // ============ MATERIALS ============
  const hullMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(colors.creatureBody),
      roughness: 0.75,
      metalness: 0.65,
      envMapIntensity: 0.5,
    });
  }, [colors]);

  const debrisMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(colors.creatureBody),
      roughness: 0.8,
      metalness: 0.55,
    });
  }, [colors]);

  const detailMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(colors.creatureBody),
      roughness: 0.7,
      metalness: 0.75,
    });
  }, [colors]);

  const glassMaterial = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(colors.accentSecondary),
      roughness: 0.03,
      metalness: 0.95,
      transmission: 0.7,
      thickness: 0.5,
      transparent: true,
      opacity: 0.5,
      ior: 1.5,
      side: THREE.DoubleSide,
    });
  }, [colors]);

  // ============ POSITION DATA ============
  const wreckPositions = useMemo(() => {
    return {
      hull: new THREE.Vector3(-200, -12, 50),
      bow: new THREE.Vector3(-200, -8, 95),
      stern: new THREE.Vector3(-200, -12, 10),
      bridge: new THREE.Vector3(-200, -4, 55),
    };
  }, []);

  const debrisPositions = useMemo(() => {
    const positions: THREE.Vector3[] = [];
    const center = wreckPositions.hull;
    for (let i = 0; i < 15; i++) {
      positions.push(new THREE.Vector3(
        center.x + (Math.random() - 0.5) * 60,
        -15 + Math.random() * 5,
        center.z + (Math.random() - 0.5) * 80
      ));
    }
    return positions;
  }, [wreckPositions]);

  const detailPositions = useMemo(() => {
    const positions: Array<{ pos: THREE.Vector3; rot: THREE.Euler; scale: number }> = [];
    const center = wreckPositions.hull;

    // Railings along hull
    for (let i = 0; i < 4; i++) {
      positions.push({
        pos: new THREE.Vector3(center.x, -5 + i * 2, center.z),
        rot: new THREE.Euler(0, 0, 0),
        scale: 1,
      });
      positions.push({
        pos: new THREE.Vector3(center.x, -5 + i * 2, center.z + 30),
        rot: new THREE.Euler(0, 0, 0),
        scale: 1,
      });
    }

    // Pipes
    for (let i = 0; i < 12; i++) {
      positions.push({
        pos: new THREE.Vector3(
          center.x + (Math.random() - 0.5) * 15,
          -10 + Math.random() * 10,
          center.z + (Math.random() - 0.5) * 40
        ),
        rot: new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI * 2, Math.random() * Math.PI),
        scale: 0.5 + Math.random(),
      });
    }

    return positions;
  }, [wreckPositions]);

  // ============ ANIMATION ============
  useFrame((_, delta) => {
    if (reducedMotion || isPaused || !wreckRef.current) return;
    timeRef.current += delta;

    if (wreckRef.current) {
      wreckRef.current.position.y = Math.sin(timeRef.current * 0.05) * 0.005;
    }
  });

  // ============ LIGHT SOURCES ON WRECK ============
  const wreckLights = useMemo(() => {
    const lights: Array<{ position: THREE.Vector3; color: string; intensity: number }> = [];
    // Emergency lights still functioning
    lights.push({ position: new THREE.Vector3(-200, -4, 90), color: colors.uiDanger, intensity: 0.3 });
    lights.push({ position: new THREE.Vector3(-200, -4, 60), color: colors.uiDanger, intensity: 0.2 });
    lights.push({ position: new THREE.Vector3(-200, -4, 20), color: colors.uiDanger, intensity: 0.2 });
    // Floodlights (broken, flickering)
    lights.push({ position: new THREE.Vector3(-200, -6, 55), color: colors.uiWarning, intensity: 0.1 });
    return lights;
  }, [colors]);

  // Only render if visible in this zone
  if (!visibility.shipwreck) return null;

  return (
    <group ref={wreckRef}>
      {/* Main Hull - Broken in two */}
      <mesh
        geometry={hullSections[0]}
        material={hullMaterial}
        position={wreckPositions.hull.toArray()}
        rotation={[Math.PI / 2, 0, Math.PI / 12]}
        castShadow
        receiveShadow
      />

      {/* Bow Section */}
      <mesh
        geometry={hullSections[1]}
        material={hullMaterial}
        position={wreckPositions.bow.toArray()}
        rotation={[Math.PI / 2, 0, Math.PI / 8]}
        castShadow
        receiveShadow
      />

      {/* Stern Section */}
      <mesh
        geometry={hullSections[2]}
        material={hullMaterial}
        position={wreckPositions.stern.toArray()}
        rotation={[Math.PI / 2, Math.PI * 0.1, -Math.PI / 10]}
        castShadow
        receiveShadow
      />

      {/* Bridge / Superstructure */}
      <mesh
        geometry={hullSections[3]}
        material={hullMaterial}
        position={wreckPositions.bridge.toArray()}
        rotation={[0, Math.PI / 6, 0]}
        castShadow
        receiveShadow
      />

      {/* Bridge Windows */}
      <mesh
        geometry={new THREE.BoxGeometry(10, 4, 0.1)}
        material={glassMaterial}
        position={[-200, -1, 55]}
        rotation={[0, Math.PI / 6, 0]}
      />

      {/* Propeller at stern */}
      <mesh
        geometry={hullSections[4]}
        material={detailMaterial}
        position={[-200, -12, 5]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
      />

      {/* Debris Field */}
      {debrisPositions.map((pos, i) => (
        <mesh
          key={`debris-${i}`}
          geometry={hullSections[4 + i % 15]}
          material={debrisMaterial}
          position={pos.toArray()}
          rotation={[
            Math.random() * Math.PI,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI
          ]}
          scale={[0.5 + Math.random() * 1.5, 0.5 + Math.random() * 1.5, 0.5 + Math.random() * 1.5]}
          castShadow
          receiveShadow
        />
      ))}

      {/* Details - Railings, Pipes, etc. */}
      {detailPositions.map((detail, i) => (
        <mesh
          key={`detail-${i}`}
          geometry={detailGeometries[i % detailGeometries.length]}
          material={detailMaterial}
          position={detail.pos.toArray()}
          rotation={detail.rot.toArray()}
          scale={[detail.scale, detail.scale, detail.scale]}
        />
      ))}

      {/* Mast - broken */}
      <mesh
        geometry={hullSections[5]}
        material={detailMaterial}
        position={[-200, 2, 55]}
        rotation={[Math.PI / 6, 0, Math.PI / 12]}
      />

      {/* Hatches */}
      {[-200, -190, -210].map((x, i) => (
        <mesh
          key={`hatch-${i}`}
          geometry={hullSections[6 + i % 6]}
          material={hullMaterial}
          position={[x, -10, 50]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      ))}

      {/* Davits */}
      {[-205, -215, -185, -195].map((x, i) => (
        <mesh
          key={`davit-${i}`}
          geometry={hullSections[10 + i % 4]}
          material={detailMaterial}
          position={[x, -9, 50]}
        />
      ))}

      {/* Flickering Emergency Lights */}
      {wreckLights.map((light, i) => (
        <group key={`wreck-light-${i}`} position={light.position.toArray()}>
          <pointLight
            color={light.color}
            intensity={light.intensity}
            distance={15}
            decay={2}
          />
          <mesh
            geometry={new THREE.SphereGeometry(0.2, 8, 8)}
            material={new THREE.MeshBasicMaterial({
              color: light.color,
              transparent: true,
              opacity: 0.8,
              depthWrite: false,
            })}
          />
        </group>
      ))}
    </group>
  );
}