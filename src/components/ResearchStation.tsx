/**
 * ABYSS — Research Station Component
 * An abandoned underwater research station/observatory
 * Uses unified zone configuration from @/config/zones
 */

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ZoneId } from '@/config/zones';
import { ZONE_COLORS, ZONE_VISIBILITY } from '@/config/zones';

interface ResearchStationProps {
  zone: ZoneId;
  zoneProgress: number;
  reducedMotion: boolean;
  isPaused?: boolean;
}

export function ResearchStation({ zone, zoneProgress: _zoneProgress, reducedMotion, isPaused = false }: ResearchStationProps) {
  const stationRef = useRef<THREE.Group>(null);
  const floodLightTargets = useMemo(() =>
    Array.from({ length: 6 }, () => new THREE.Object3D()), []);
  const timeRef = useRef(0);

  // Get visibility rules and colors for current zone
  const visibility = ZONE_VISIBILITY[zone];
  const colors = ZONE_COLORS[zone];

  // ============ MODULE GEOMETRIES ============
  const moduleGeometries = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];

    // Central hub - large cylinder
    const hubGeo = new THREE.CylinderGeometry(8, 8, 12, 16);
    geometries.push(hubGeo);

    // Habitat modules - cylinders
    for (let i = 0; i < 6; i++) {
      const geo = new THREE.CylinderGeometry(4, 4, 15, 12);
      geometries.push(geo);
    }

    // Connecting tunnels
    for (let i = 0; i < 6; i++) {
      const geo = new THREE.CylinderGeometry(1.5, 1.5, 20, 8);
      geometries.push(geo);
    }

    // Solar/array platform (collapsed)
    const arrayGeo = new THREE.BoxGeometry(25, 0.5, 15);
    geometries.push(arrayGeo);

    // Antenna mast
    const mastGeo = new THREE.CylinderGeometry(0.1, 0.2, 25, 6);
    geometries.push(mastGeo);

    // Docking ports
    for (let i = 0; i < 4; i++) {
      const geo = new THREE.CylinderGeometry(2.5, 2.5, 3, 12);
      geometries.push(geo);
    }

    // Instrument packages
    for (let i = 0; i < 8; i++) {
      const geo = new THREE.BoxGeometry(
        THREE.MathUtils.randFloat(1, 3),
        THREE.MathUtils.randFloat(0.5, 2),
        THREE.MathUtils.randFloat(1, 3)
      );
      geometries.push(geo);
    }

    // Cable runs
    for (let i = 0; i < 10; i++) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 5),
        new THREE.Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 10),
      ]);
      const geo = new THREE.TubeGeometry(curve, 10, THREE.MathUtils.randFloat(0.05, 0.15), 4, false);
      geometries.push(geo);
    }

    return geometries;
  }, []);

  // ============ MATERIALS ============
  const hullMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(colors.creatureBody),
      roughness: 0.5,
      metalness: 0.7,
      envMapIntensity: 0.6,
    });
  }, [colors]);

  const windowMaterial = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(colors.accentSecondary),
      roughness: 0.02,
      metalness: 0.95,
      transmission: 0.8,
      thickness: 0.5,
      transparent: true,
      opacity: 0.4,
      ior: 1.5,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
    });
  }, [colors]);

  const arrayMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(colors.creatureBody),
      roughness: 0.6,
      metalness: 0.55,
    });
  }, [colors]);

  const detailMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(colors.creatureBody),
      roughness: 0.45,
      metalness: 0.75,
    });
  }, [colors]);

  const emergencyLightMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: colors.uiDanger,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
    });
  }, [colors]);

  // ============ POSITION DATA ============
  const layout = useMemo(() => {
    const center = new THREE.Vector3(300, -15, -200);
    const modules: Array<{
      type: 'hub' | 'module' | 'tunnel' | 'array' | 'mast' | 'dock' | 'instrument' | 'cable';
      position: THREE.Vector3;
      rotation: THREE.Euler;
      geometryIndex: number;
    }> = [];

    // Central hub
    modules.push({
      type: 'hub',
      position: center.clone(),
      rotation: new THREE.Euler(0, 0, 0),
      geometryIndex: 0,
    });

    // Six habitat modules around hub
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const radius = 25;
      const pos = center.clone().add(new THREE.Vector3(
        Math.cos(angle) * radius,
        0,
        Math.sin(angle) * radius
      ));

      modules.push({
        type: 'module',
        position: pos,
        rotation: new THREE.Euler(Math.PI / 2, 0, 0),
        geometryIndex: 1 + i,
      });

      // Connecting tunnel
      modules.push({
        type: 'tunnel',
        position: center.clone().add(new THREE.Vector3(
          Math.cos(angle) * radius * 0.5,
          0,
          Math.sin(angle) * radius * 0.5
        )),
        rotation: new THREE.Euler(Math.PI / 2, 0, angle),
        geometryIndex: 7 + i,
      });
    }

    // Collapsed solar array
    modules.push({
      type: 'array',
      position: new THREE.Vector3(center.x + 40, 8, center.z),
      rotation: new THREE.Euler(-0.3, Math.PI / 4, 0.1),
      geometryIndex: 13,
    });

    // Antenna mast
    modules.push({
      type: 'mast',
      position: new THREE.Vector3(center.x, 18, center.z),
      rotation: new THREE.Euler(0, 0, 0),
      geometryIndex: 14,
    });

    // Docking ports
    const dockAngles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
    dockAngles.forEach((angle, i) => {
      modules.push({
        type: 'dock',
        position: center.clone().add(new THREE.Vector3(
          Math.cos(angle) * 10,
          -3,
          Math.sin(angle) * 10
        )),
        rotation: new THREE.Euler(Math.PI / 2, 0, 0),
        geometryIndex: 15 + i,
      });
    });

    // Instrument packages
    for (let i = 0; i < 8; i++) {
      modules.push({
        type: 'instrument',
        position: new THREE.Vector3(
          center.x + (Math.random() - 0.5) * 40,
          -15 + Math.random() * 5,
          center.z + (Math.random() - 0.5) * 40
        ),
        rotation: new THREE.Euler(
          (Math.random() - 0.5) * 0.3,
          Math.random() * Math.PI * 2,
          (Math.random() - 0.5) * 0.3
        ),
        geometryIndex: 19 + i,
      });
    }

    // Cables
    for (let i = 0; i < 10; i++) {
      modules.push({
        type: 'cable',
        position: new THREE.Vector3(
          center.x + (Math.random() - 0.5) * 30,
          -10 + Math.random() * 10,
          center.z + (Math.random() - 0.5) * 30
        ),
        rotation: new THREE.Euler(0, 0, 0),
        geometryIndex: 27 + i,
      });
    }

    return { center, modules };
  }, []);

  // ============ ANIMATION ============
  useFrame((_, delta) => {
    if (reducedMotion || isPaused || !stationRef.current) return;
    timeRef.current += delta;

    // Subtle settling
    if (stationRef.current) {
      stationRef.current.position.y = Math.sin(timeRef.current * 0.03) * 0.003;
    }

    // Position floodlight targets
    const center = layout.center;
    floodLightTargets.forEach((target, i) => {
      const angle = (i / 6) * Math.PI * 2;
      target.position.set(
        center.x + Math.cos(angle) * 45,
        center.y - 7,
        center.z + Math.sin(angle) * 45
      );
    });

    // Flicker emergency lights
    // Handled by light intensity animation in render
  });

  // Emergency light positions
  const emergencyLights = useMemo(() => {
    const lights: Array<{ position: THREE.Vector3; baseIntensity: number }> = [];
    const center = layout.center;

    // Hub lights
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      lights.push({
        position: center.clone().add(new THREE.Vector3(
          Math.cos(angle) * 7,
          2,
          Math.sin(angle) * 7
        )),
        baseIntensity: 0.15,
      });
    }

    // Module lights
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      lights.push({
        position: center.clone().add(new THREE.Vector3(
          Math.cos(angle) * 25,
          1,
          Math.sin(angle) * 25
        )),
        baseIntensity: 0.1,
      });
    }

    // Docking port lights
    const dockAngles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
    dockAngles.forEach((angle) => {
      lights.push({
        position: center.clone().add(new THREE.Vector3(
          Math.cos(angle) * 10,
          -4,
          Math.sin(angle) * 10
        )),
        baseIntensity: 0.2,
      });
    });

    return lights;
  }, [layout]);

  // Only render if visible in this zone
  if (!visibility.researchStation) return null;

  return (
    <group ref={stationRef}>
      {layout.modules.map((mod, i) => {
        const geo = moduleGeometries[mod.geometryIndex];
        let material = hullMaterial;

        if (mod.type === 'array') material = arrayMaterial;
        else if (mod.type === 'mast' || mod.type === 'cable') material = detailMaterial;

        return (
          <mesh
            key={`station-${mod.type}-${i}`}
            geometry={geo}
            material={material}
            position={mod.position.toArray()}
            rotation={mod.rotation.toArray()}
            castShadow
            receiveShadow
          />
        );
      })}

      {/* Hub Windows */}
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle, i) => (
        <mesh
          key={`hub-window-${i}`}
          geometry={new THREE.BoxGeometry(3, 2, 0.1)}
          material={windowMaterial}
          position={[
            layout.center.x + Math.cos(angle) * 8.1,
            layout.center.y + 1,
            layout.center.z + Math.sin(angle) * 8.1
          ]}
          rotation={[0, angle, 0]}
        />
      ))}

      {/* Module Windows */}
      {Array.from({ length: 6 }).map((_, i) => {
        const angle = (i / 6) * Math.PI * 2;
        return (
          <mesh
            key={`module-window-${i}`}
            geometry={new THREE.BoxGeometry(0.1, 1.5, 4)}
            material={windowMaterial}
            position={[
              layout.center.x + Math.cos(angle) * 26,
              layout.center.y + 1,
              layout.center.z + Math.sin(angle) * 26
            ]}
            rotation={[0, angle + Math.PI / 2, 0]}
          />
        );
      })}

      {/* Emergency Lights */}
      {emergencyLights.map((light, i) => (
        <group key={`emergency-light-${i}`} position={light.position.toArray()}>
          <pointLight
            color={colors.uiDanger}
            intensity={light.baseIntensity * (1 + Math.sin(timeRef.current * 1.5 + i) * 0.5)}
            distance={20}
            decay={2}
          />
          <mesh
            geometry={new THREE.SphereGeometry(0.15, 8, 8)}
            material={emergencyLightMaterial}
          />
        </group>
      ))}

      {/* Floodlights on modules - some working, some broken */}
      {Array.from({ length: 6 }).map((_, i) => {
        const angle = (i / 6) * Math.PI * 2;
        const isWorking = i % 3 !== 0;
        return (
          <group key={`floodlight-${i}`} position={[
            layout.center.x + Math.cos(angle) * 25,
            layout.center.y - 2,
            layout.center.z + Math.sin(angle) * 25
          ]} rotation={[0, angle + Math.PI, 0]}>
            {isWorking && (
              <>
                <spotLight
                  color={colors.sunColor}
                  intensity={0.8 * (1 + Math.sin(timeRef.current * 2 + i) * 0.1)}
                  distance={40}
                  angle={0.3}
                  penumbra={0.5}
                  decay={2}
                  target={floodLightTargets[i]}
                />
                <mesh
                  geometry={new THREE.SphereGeometry(0.25, 10, 10)}
                  material={new THREE.MeshBasicMaterial({
                    color: colors.sunColor,
                    transparent: true,
                    opacity: 0.9,
                    depthWrite: false,
                  })}
                />
              </>
            )}
            {!isWorking && (
              <mesh
                geometry={new THREE.SphereGeometry(0.25, 10, 10)}
                material={new THREE.MeshBasicMaterial({
                  color: colors.uiWarning,
                  transparent: true,
                  opacity: 0.3,
                  depthWrite: false,
                })}
              />
            )}
          </group>
        );
      })}
    </group>
  );
}