/**
 * ABYSS — Terrain Component
 * Detailed underwater terrain: mountains, ridges, cliffs, seabed, arches, caves, trenches
 * Uses unified zone configuration from @/config/zones
 */

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import type { ZoneId } from '@/config/zones';
import { ZONE_COLORS, ZONE_VISIBILITY } from '@/config/zones';

// Terrain render counter (dev only)
function TerrainRenderCounter({ enabled }: { enabled: boolean }) {
  const renderRef = useRef(0);
  if (enabled) {
    renderRef.current += 1;
    if (renderRef.current % 60 === 1) {
      console.log(`[ABYSS-DEBUG] Terrain render #${renderRef.current}`);
    }
  }
  return null;
}

interface TerrainProps {
  zone: ZoneId;
  zoneProgress: number;
  reducedMotion: boolean;
  isPaused?: boolean;
}

export function Terrain({ zone, zoneProgress: _zoneProgress, reducedMotion, isPaused = false }: TerrainProps) {
  const terrainRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);

  // Get visibility rules and colors for current zone
  const visibility = ZONE_VISIBILITY[zone];
  const colors = ZONE_COLORS[zone];

  // ============ SEABED WITH PROCEDURAL DISPLACEMENT ============
  const seabedGeometry = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(2000, 2000, 400, 400);
    const positions = geometry.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);

      // Multi-octave noise for realistic seabed
      let height = 0;
      // Large scale features (mountains, ridges)
      height += Math.sin(x * 0.008 + y * 0.005) * 15;
      height += Math.cos(x * 0.012 - y * 0.008) * 10;
      height += Math.sin(x * 0.005 + y * 0.01) * 8;
      // Medium scale (rocky outcrops)
      height += Math.sin(x * 0.03 + y * 0.02) * 3;
      height += Math.cos(x * 0.04 - y * 0.03) * 2;
      // Small scale (rocks, pebbles)
      height += Math.sin(x * 0.1 + y * 0.08) * 0.5;
      height += Math.cos(x * 0.15 - y * 0.12) * 0.3;

      // Add trenches and canyons
      const trenchFactor = Math.exp(-((x + 200) ** 2 + (y - 100) ** 2) / 50000);
      height -= trenchFactor * 25;

      const canyonFactor = Math.exp(-((x - 300) ** 2 + (y + 150) ** 2) / 80000);
      height -= canyonFactor * 15;

      // Ridge lines
      const ridge1 = Math.exp(-((y - 50) ** 2) / 2000) * Math.sin(x * 0.02) * 12;
      const ridge2 = Math.exp(-((x + 100) ** 2) / 3000) * Math.cos(y * 0.015) * 10;
      height += ridge1 + ridge2;

      positions.setZ(i, height);
    }

    geometry.computeVertexNormals();
    return geometry;
  }, []);

  // ============ UNDERWATER MOUNTAINS / SEAMOUNTS ============
  const seamountGeometries = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 12; i++) {
      const radius = THREE.MathUtils.randFloat(30, 80);
      const height = THREE.MathUtils.randFloat(60, 180);
      const segments = 8;

      const geo = new THREE.ConeGeometry(radius, height, segments, 4, true);

      // Distort for natural look
      const positions = geo.attributes.position;
      for (let j = 0; j < positions.count; j++) {
        const x = positions.getX(j);
        const y = positions.getY(j);
        const z = positions.getZ(j);
        const noise = (Math.sin(x * 0.1) * 0.3 + Math.cos(z * 0.08) * 0.2) * (1 - y / height) * 0.5;
        positions.setX(j, x * (1 + noise));
        positions.setZ(j, z * (1 + noise));
        // Flatten top slightly
        if (y > height * 0.85) {
          positions.setY(j, height * 0.85 + (y - height * 0.85) * 0.3);
        }
      }
      geo.computeVertexNormals();
      geometries.push(geo);
    }
    return geometries;
  }, []);

  // ============ ROCK ARCHES ============
  const archGeometries = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 6; i++) {
      // Base pillars
      const pillarGeo = new THREE.CylinderGeometry(3, 5, 25, 8, 1, true);
      // Arch top
      const archRadius = THREE.MathUtils.randFloat(12, 20);
      const archGeo = new THREE.TorusGeometry(archRadius, 2.5, 8, 16, Math.PI);

      geometries.push(pillarGeo, archGeo);
    }
    return geometries;
  }, []);

  // ============ CAVE ENTRANCES ============
  const caveGeometries = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
      // Cave mouth as a semi-sphere cut into terrain
      const geo = new THREE.SphereGeometry(THREE.MathUtils.randFloat(8, 15), 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
      geo.scale(1.5, 0.8, 1.2);
      geometries.push(geo);
    }
    return geometries;
  }, []);

  // ============ TRENCH WALLS ============
  const trenchGeometries = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 8; i++) {
      const geo = new THREE.BoxGeometry(
        THREE.MathUtils.randFloat(80, 200),
        THREE.MathUtils.randFloat(50, 120),
        THREE.MathUtils.randFloat(15, 40)
      );
      // Erode edges
      const positions = geo.attributes.position;
      for (let j = 0; j < positions.count; j++) {
        const noise = (Math.random() - 0.5) * 5;
        if (positions.getY(j) < 0) {
          positions.setX(j, positions.getX(j) + noise);
          positions.setZ(j, positions.getZ(j) + noise);
        }
      }
      geo.computeVertexNormals();
      geometries.push(geo);
    }
    return geometries;
  }, []);

  // ============ BOULDERS AND ROCKS (INSTANCED) ============
  const boulderGeometry = useMemo(() => {
    const geo = new THREE.DodecahedronGeometry(1, 0);
    const positions = geo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const scale = 0.5 + Math.random() * 0.8;
      positions.setXYZ(i,
        positions.getX(i) * scale,
        positions.getY(i) * scale,
        positions.getZ(i) * scale
      );
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  // ============ CORAL/SPONGE GEOMETRIES ============
  const coralGeometries = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    // Branching coral
    for (let i = 0; i < 5; i++) {
      const trunkCount = THREE.MathUtils.randInt(3, 8);
      for (let t = 0; t < trunkCount; t++) {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3((Math.random() - 0.5) * 2, THREE.MathUtils.randFloat(1, 3), (Math.random() - 0.5) * 2),
          new THREE.Vector3((Math.random() - 0.5) * 3, THREE.MathUtils.randFloat(3, 5), (Math.random() - 0.5) * 3),
        ]);
        const geo = new THREE.TubeGeometry(curve, 10, THREE.MathUtils.randFloat(0.15, 0.35), 6, false);
        geometries.push(geo);
      }
    }
    // Sea fans
    for (let i = 0; i < 4; i++) {
      const geo = new THREE.PlaneGeometry(4, 5, 10, 12);
      const positions = geo.attributes.position;
      for (let j = 0; j < positions.count; j++) {
        const x = positions.getX(j);
        const y = positions.getY(j);
        positions.setZ(j, Math.sin(x * 1.5) * Math.cos(y * 0.8) * 0.8);
      }
      geo.computeVertexNormals();
      geometries.push(geo);
    }
    // Tube sponges
    for (let i = 0; i < 6; i++) {
      const geo = new THREE.CylinderGeometry(
        THREE.MathUtils.randFloat(0.3, 0.6),
        THREE.MathUtils.randFloat(0.5, 1),
        THREE.MathUtils.randFloat(1.5, 3),
        8, 4, true
      );
      geometries.push(geo);
    }
    return geometries;
  }, []);

  // ============ KELP/SEAWEED ============
  const kelpGeometries = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 8; i++) {
      const bladeCount = THREE.MathUtils.randInt(5, 12);
      for (let b = 0; b < bladeCount; b++) {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3((Math.random() - 0.5) * 1, THREE.MathUtils.randFloat(2, 5), (Math.random() - 0.5) * 1),
          new THREE.Vector3((Math.random() - 0.5) * 1.5, THREE.MathUtils.randFloat(5, 8), (Math.random() - 0.5) * 1.5),
        ]);
        const geo = new THREE.TubeGeometry(curve, 15, THREE.MathUtils.randFloat(0.08, 0.15), 4, false);
        geometries.push(geo);
      }
    }
    return geometries;
  }, []);

  // ============ MATERIALS ============
  const seabedMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(colors.waterColorDeep),
      roughness: 0.85,
      metalness: 0.1,
      flatShading: false,
    });
  }, [colors]);

  const rockMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(colors.creatureBody),
      roughness: 0.9,
      metalness: 0.08,
    });
  }, [colors]);

  const coralMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(colors.accentSecondary),
      roughness: 0.7,
      metalness: 0.15,
      side: THREE.DoubleSide,
    });
  }, [colors]);

  const kelpMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: zone === 'sunlight' ? '#2a6a2a' : '#1a4a1a',
      roughness: 0.85,
      metalness: 0.05,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
  }, [zone]);

  const boulderMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(colors.creatureBody),
      roughness: 0.9,
      metalness: 0.05,
    });
  }, [colors]);

  // Boulder instanced mesh ref
  const boulderMeshRef = useRef<THREE.InstancedMesh>(null);

  // ============ POSITIONS (MEMOIZED) ============
  const seamountPositions = useMemo(() => {
    const positions: THREE.Vector3[] = [];
    const centers = [
      [-400, -300], [450, 200], [-200, 500], [350, -400],
      [-500, -100], [200, -500], [-350, 350], [400, 400],
      [-100, -450], [500, 100], [-450, 150], [150, -350],
    ];
    centers.forEach(([x, z]) => {
      positions.push(new THREE.Vector3(x, -15, z));
    });
    return positions;
  }, []);

  const archPositions = useMemo(() => {
    const positions: THREE.Vector3[] = [];
    const arches = [
      [-150, -50], [180, 120], [-280, -200], [300, -100], [-80, 300], [220, 280]
    ];
    arches.forEach(([x, z]) => {
      positions.push(new THREE.Vector3(x, -15, z));
    });
    return positions;
  }, []);

  const cavePositions = useMemo(() => {
    return [
      new THREE.Vector3(-200, -15, 180),
      new THREE.Vector3(350, -15, -250),
      new THREE.Vector3(-400, -15, -300),
      new THREE.Vector3(150, -15, 400),
    ];
  }, []);

  const trenchPositions = useMemo(() => {
    const positions: THREE.Vector3[] = [];
    // Main trench walls
    positions.push(new THREE.Vector3(-200, -15, -50)); // Left wall
    positions.push(new THREE.Vector3(200, -15, -50));  // Right wall
    positions.push(new THREE.Vector3(50, -15, 300));   // Canyon left
    positions.push(new THREE.Vector3(350, -15, 300));  // Canyon right
    positions.push(new THREE.Vector3(-300, -15, 100));
    positions.push(new THREE.Vector3(-100, -15, 100));
    positions.push(new THREE.Vector3(400, -15, -300));
    positions.push(new THREE.Vector3(600, -15, -300));
    return positions;
  }, []);

  // Boulder positions - instanced
  const boulderData = useMemo(() => {
    const data: Array<{ position: THREE.Vector3; rotation: THREE.Euler; scale: number }> = [];
    for (let i = 0; i < 500; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 20 + Math.random() * 900;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      // Sample height from terrain noise approximation
      const y = -15 + Math.sin(x * 0.01) * 2 + Math.cos(z * 0.008) * 1.5 + (Math.random() - 0.5) * 3;
      data.push({
        position: new THREE.Vector3(x, y, z),
        rotation: new THREE.Euler(Math.random() * 0.5, Math.random() * Math.PI * 2, Math.random() * 0.5),
        scale: 0.5 + Math.random() * 4,
      });
    }
    return data;
  }, []);

  // Initialize boulder instance matrices
  useEffect(() => {
    if (!boulderMeshRef.current) return;
    const mesh = boulderMeshRef.current;
    const dummy = new THREE.Object3D();

    boulderData.forEach((boulder, i) => {
      dummy.position.copy(boulder.position);
      dummy.rotation.copy(boulder.rotation);
      dummy.scale.setScalar(boulder.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
  }, [boulderData]);

  // Coral positions (clustered near seamounts and ridges)
  const coralData = useMemo(() => {
    const data: Array<{ position: THREE.Vector3; rotation: THREE.Euler; scale: number; type: number }> = [];
    // Sunlight/twilight: coral reefs
    if (visibility.coral && (zone === 'sunlight' || zone === 'twilight')) {
      for (let i = 0; i < 200; i++) {
        // Cluster around ridges and seamounts
        const cluster = Math.floor(Math.random() * 4);
        let centerX = 0, centerZ = 0;
        if (cluster === 0) { centerX = -100; centerZ = 50; }
        else if (cluster === 1) { centerX = 200; centerZ = -100; }
        else if (cluster === 2) { centerX = -300; centerZ = 200; }
        else { centerX = 400; centerZ = 300; }

        data.push({
          position: new THREE.Vector3(
            centerX + (Math.random() - 0.5) * 80,
            -15 + Math.random() * 5,
            centerZ + (Math.random() - 0.5) * 80
          ),
          rotation: new THREE.Euler(-Math.PI / 2 + (Math.random() - 0.5) * 0.3, Math.random() * Math.PI * 2, 0),
          scale: 0.5 + Math.random() * 1.5,
          type: Math.floor(Math.random() * coralGeometries.length),
        });
      }
    }
    // Deep sea corals (sparse) - midnight and abyss
    if (visibility.coral && (zone === 'midnight' || zone === 'abyss')) {
      for (let i = 0; i < 50; i++) {
        data.push({
          position: new THREE.Vector3(
            (Math.random() - 0.5) * 1000,
            -15 + Math.random() * 30,
            (Math.random() - 0.5) * 1000
          ),
          rotation: new THREE.Euler(-Math.PI / 2 + (Math.random() - 0.5) * 0.3, Math.random() * Math.PI * 2, 0),
          scale: 0.5 + Math.random() * 1,
          type: Math.floor(Math.random() * coralGeometries.length),
        });
      }
    }
    return data;
  }, [zone, visibility.coral, coralGeometries]);

  // Kelp positions (only sunlight zone)
  const kelpData = useMemo(() => {
    const data: Array<{ position: THREE.Vector3; rotation: THREE.Euler; scale: number }> = [];
    if (visibility.kelp && zone === 'sunlight') {
      for (let i = 0; i < 150; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 50 + Math.random() * 300; // Near shore-ish areas
        data.push({
          position: new THREE.Vector3(
            Math.cos(angle) * radius,
            -15,
            Math.sin(angle) * radius
          ),
          rotation: new THREE.Euler(0, Math.random() * Math.PI * 2, 0),
          scale: 0.8 + Math.random() * 0.6,
        });
      }
    }
    return data;
  }, [zone, visibility.kelp]);

  // ============ ANIMATION ============
  useFrame((_, delta) => {
    if (reducedMotion || isPaused) return;
    timeRef.current += delta;

    if (terrainRef.current) {
      // Very subtle terrain breathing
      terrainRef.current.rotation.z = Math.sin(timeRef.current * 0.02) * 0.0005;
      terrainRef.current.rotation.x = Math.cos(timeRef.current * 0.015) * 0.0003;
    }

    // Animate kelp swaying
    if (visibility.kelp && zone === 'sunlight') {
      kelpGeometries.forEach((geo, i) => {
        const positions = geo.attributes.position;
        for (let j = 0; j < positions.count; j++) {
          const y = positions.getY(j);
          if (y > 1) { // Only sway upper parts
            const sway = Math.sin(timeRef.current * 1.5 + i + y * 0.5) * 0.02 * (y / 8);
            positions.setX(j, positions.getX(j) + sway);
          }
        }
        positions.needsUpdate = true;
      });
    }

    // Animate coral gentle sway
    if (visibility.coral) {
      coralGeometries.forEach((geo, i) => {
        if (geo.type === 'TubeGeometry') {
          const positions = geo.attributes.position;
          for (let j = 0; j < positions.count; j++) {
            const y = positions.getY(j);
            if (y > 0.5) {
              const sway = Math.sin(timeRef.current * 0.8 + i + y * 0.3) * 0.01;
              positions.setX(j, positions.getX(j) + sway);
              positions.setZ(j, positions.getZ(j) + sway * 0.5);
            }
          }
          positions.needsUpdate = true;
        }
      });
    }
  });

  // ============ RENDER ============
  return (
    <group ref={terrainRef} position={[0, -15, 0]}>
      {/* Terrain render counter (dev only) */}
      <TerrainRenderCounter enabled={false} />
      {/* Seabed */}
      <mesh
        geometry={seabedGeometry}
        material={seabedMaterial}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      />

      {/* Seamounts / Underwater Mountains - only in visible zones */}
      {visibility.seamounts && seamountGeometries.map((geo, i) => (
        <mesh
          key={`seamount-${i}`}
          geometry={geo}
          material={rockMaterial}
          position={seamountPositions[i].toArray()}
          rotation={[0, THREE.MathUtils.randFloat(0, Math.PI * 2), 0]}
          receiveShadow
          castShadow
        />
      ))}

      {/* Trench Walls */}
      {visibility.trenches && trenchGeometries.map((geo, i) => (
        <mesh
          key={`trench-${i}`}
          geometry={geo}
          material={rockMaterial}
          position={trenchPositions[i].toArray()}
          rotation={[0, THREE.MathUtils.randFloat(-0.3, 0.3), 0]}
          receiveShadow
          castShadow
        />
      ))}

      {/* Rock Arches - only in visible zones */}
      {visibility.arches && archGeometries.map((geo, i) => {
        const archIndex = Math.floor(i / 2);
        const isPillar = i % 2 === 0;
        const pos = archPositions[archIndex];
        return (
          <group key={`arch-${archIndex}-${isPillar ? 'pillar' : 'top'}`} position={pos.toArray()}>
            {isPillar ? (
              <>
                <mesh
                  geometry={geo}
                  material={rockMaterial}
                  position={[-8, 12.5, 0]}
                  castShadow
                  receiveShadow
                />
                <mesh
                  geometry={geo}
                  material={rockMaterial}
                  position={[8, 12.5, 0]}
                  castShadow
                  receiveShadow
                />
              </>
            ) : (
              <mesh
                geometry={geo}
                material={rockMaterial}
                position={[0, 25, 0]}
                rotation={[0, 0, Math.PI / 2]}
                castShadow
                receiveShadow
              />
            )}
          </group>
        );
      })}

      {/* Cave Entrances - only in visible zones */}
      {visibility.caves && caveGeometries.map((geo, i) => (
        <mesh
          key={`cave-${i}`}
          geometry={geo}
          material={new THREE.MeshBasicMaterial({
            color: '#000000',
            side: THREE.DoubleSide,
            depthWrite: true,
          })}
          position={cavePositions[i].toArray()}
          rotation={[Math.PI / 2, Math.random() * Math.PI * 2, 0]}
          scale={[1, 1, 1.5]}
        />
      ))}

      {/* Boulders - Instanced for performance */}
      <instancedMesh
        ref={boulderMeshRef}
        args={[boulderGeometry, boulderMaterial, boulderData.length]}
        receiveShadow
        castShadow
      />

      {/* Coral/Sponges/Sea Fans - only in visible zones */}
      {visibility.coral && coralData.map((coral, i) => (
        <mesh
          key={`coral-${i}`}
          geometry={coralGeometries[coral.type % coralGeometries.length]}
          material={coralMaterial}
          position={coral.position.toArray()}
          rotation={coral.rotation.toArray()}
          scale={[coral.scale, coral.scale, coral.scale]}
        />
      ))}

      {/* Kelp/Seaweed (Sunlight zone only) */}
      {visibility.kelp && zone === 'sunlight' && kelpData.map((kelp, i) => (
        <mesh
          key={`kelp-${i}`}
          geometry={kelpGeometries[i % kelpGeometries.length]}
          material={kelpMaterial}
          position={kelp.position.toArray()}
          rotation={kelp.rotation.toArray()}
          scale={[kelp.scale, kelp.scale, kelp.scale]}
        />
      ))}
    </group>
  );
}