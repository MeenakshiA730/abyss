/**
 * ABYSS — ROV/AUV Component
 * Remotely Operated Vehicle / Autonomous Underwater Drone
 * Uses unified zone configuration from @/config/zones
 */

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ZoneId } from '@/config/zones';
import { ZONE_COLORS, ZONE_VISIBILITY } from '@/config/zones';

interface ROVProps {
  zone: ZoneId;
  zoneProgress: number;
  reducedMotion: boolean;
  isPaused?: boolean;
}

export function ROV({ zone, zoneProgress: _zoneProgress, reducedMotion, isPaused = false }: ROVProps) {
  const rovRef = useRef<THREE.Group>(null);
  const frontLightTarget1 = useRef<THREE.Object3D>(new THREE.Object3D());
  const frontLightTarget2 = useRef<THREE.Object3D>(new THREE.Object3D());
  const timeRef = useRef(0);
  const pathProgressRef = useRef(0.45);

  // Get visibility rules and colors for current zone
  const visibility = ZONE_VISIBILITY[zone];
  const colors = ZONE_COLORS[zone];

  // ============ ROV GEOMETRIES ============
  const rovGeometries = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];

    // Main body - boxy frame
    const bodyGeo = new THREE.BoxGeometry(3, 1.5, 4);
    const bodyPos = bodyGeo.attributes.position;
    for (let i = 0; i < bodyPos.count; i++) {
      // Round edges slightly
      const x = Math.abs(bodyPos.getX(i));
      const z = Math.abs(bodyPos.getZ(i));
      if (x > 1.4 && z > 1.9) {
        bodyPos.setX(i, bodyPos.getX(i) * 0.7);
        bodyPos.setZ(i, bodyPos.getZ(i) * 0.7);
      }
    }
    bodyGeo.computeVertexNormals();
    geometries.push(bodyGeo);

    // Thruster housings (4 main, 4 maneuvering)
    for (let i = 0; i < 8; i++) {
      const geo = new THREE.CylinderGeometry(0.3, 0.35, 0.8, 8);
      geometries.push(geo);
    }

    // Camera housing
    const camGeo = new THREE.CylinderGeometry(0.25, 0.3, 0.5, 10);
    geometries.push(camGeo);

    // Manipulator arm base
    const armBaseGeo = new THREE.BoxGeometry(0.5, 0.5, 0.8);
    geometries.push(armBaseGeo);

    // Arm segments
    for (let i = 0; i < 4; i++) {
      const geo = new THREE.CylinderGeometry(0.08, 0.1, 1.2, 6);
      geometries.push(geo);
    }

    // Claw
    const clawGeo = new THREE.BoxGeometry(0.4, 0.15, 0.15);
    geometries.push(clawGeo);

    // Tether spool
    const tetherGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.6, 8);
    geometries.push(tetherGeo);

    // Sensor pods
    for (let i = 0; i < 4; i++) {
      const geo = new THREE.BoxGeometry(
        THREE.MathUtils.randFloat(0.4, 0.8),
        THREE.MathUtils.randFloat(0.3, 0.6),
        THREE.MathUtils.randFloat(0.4, 0.8)
      );
      geometries.push(geo);
    }

    // Light housings
    for (let i = 0; i < 4; i++) {
      const geo = new THREE.CylinderGeometry(0.15, 0.15, 0.2, 8);
      geometries.push(geo);
    }

    // Skids
    for (let i = 0; i < 2; i++) {
      const geo = new THREE.BoxGeometry(0.3, 0.2, 3.5);
      geometries.push(geo);
    }

    return geometries;
  }, []);

  // ============ MATERIALS ============
  const frameMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(colors.creatureBody),
      roughness: 0.35,
      metalness: 0.7,
      envMapIntensity: 0.6,
    });
  }, [colors]);

  const thrusterMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(colors.creatureBody),
      roughness: 0.25,
      metalness: 0.85,
    });
  }, [colors]);

  const cameraMaterial = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(colors.accentSecondary),
      roughness: 0.02,
      metalness: 0.98,
      transmission: 0.9,
      thickness: 0.3,
      transparent: true,
      opacity: 0.4,
      ior: 1.5,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
    });
  }, [colors]);

  const armMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(colors.creatureBody),
      roughness: 0.4,
      metalness: 0.65,
    });
  }, [colors]);

  const tetherMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(colors.creatureBody),
      roughness: 0.6,
      metalness: 0.35,
    });
  }, [colors]);

  const sensorMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(colors.creatureBody),
      roughness: 0.35,
      metalness: 0.75,
    });
  }, [colors]);

  const lightLensMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: colors.accentPrimary,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
    });
  }, [colors]);

  // ============ ROV PATH ============
  const rovPath = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(100, -10, -100),
      new THREE.Vector3(80, -8, -80),
      new THREE.Vector3(60, -12, -60),
      new THREE.Vector3(40, -10, -40),
      new THREE.Vector3(20, -13, -20),
      new THREE.Vector3(0, -12, 0),
      new THREE.Vector3(-20, -10, 20),
      new THREE.Vector3(-40, -8, 40),
      new THREE.Vector3(-60, -11, 60),
      new THREE.Vector3(-80, -9, 80),
    ]);
    curve.closed = true;
    return curve;
  }, []);

  // ============ ANIMATION ============
  useFrame((_, delta) => {
    if (reducedMotion || isPaused || !rovRef.current) return;
    timeRef.current += delta;

    // Move along path
    pathProgressRef.current = (pathProgressRef.current + delta * 0.005) % 1;
    const point = rovPath.getPoint(pathProgressRef.current);
    const tangent = rovPath.getTangent(pathProgressRef.current);

    if (rovRef.current) {
      rovRef.current.position.lerp(point, delta * 2);

      // Orient to path direction
      const targetQuat = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, -1),
        tangent.clone().normalize()
      );
      rovRef.current.quaternion.slerp(targetQuat, delta * 3);

      // Slight bob
      rovRef.current.position.y += Math.sin(timeRef.current * 2) * 0.02;
      rovRef.current.rotation.z = Math.sin(timeRef.current * 1.5) * 0.02;

      // Position front light targets (in front of the ROV)
      const frontOffset = new THREE.Vector3(0, 0, -15);
      frontOffset.applyQuaternion(rovRef.current.quaternion);
      frontLightTarget1.current.position.copy(rovRef.current.position).add(
        new THREE.Vector3(-1.2, -0.3, 2).applyQuaternion(rovRef.current.quaternion)
      ).add(frontOffset);
      frontLightTarget2.current.position.copy(rovRef.current.position).add(
        new THREE.Vector3(1.2, -0.3, 2).applyQuaternion(rovRef.current.quaternion)
      ).add(frontOffset);
    }
  });

  // Thruster positions relative to body
  const thrusterPositions: readonly [number, number, number][] = [
    [-1.3, -0.5, -1.8], [1.3, -0.5, -1.8], [-1.3, -0.5, 1.8], [1.3, -0.5, 1.8], // Main
    [-1.5, 0, -1], [1.5, 0, -1], [-1.5, 0, 1], [1.5, 0, 1], // Maneuvering
  ];

  const thrusterRotations: readonly [number, number, number][] = [
    [Math.PI / 2, 0, 0], [Math.PI / 2, 0, 0], [Math.PI / 2, 0, 0], [Math.PI / 2, 0, 0],
    [0, 0, Math.PI / 2], [0, 0, -Math.PI / 2], [0, 0, Math.PI / 2], [0, 0, -Math.PI / 2],
  ];

  // Spotlight color and intensity based on zone
  const spotlightColor = useMemo(() => colors.sunColor, [colors]);
  const spotlightIntensity = useMemo(() => {
    const intensities = { sunlight: 1.0, twilight: 1.5, midnight: 2.0, abyss: 2.5 };
    return intensities[zone];
  }, [zone]);

  // Only render if visible in this zone
  if (!visibility.rov) return null;

  return (
    <group ref={rovRef}>
      {/* Main Body Frame */}
      <mesh
        geometry={rovGeometries[0]}
        material={frameMaterial}
        castShadow
        receiveShadow
      />

      {/* Skids */}
      <mesh
        geometry={rovGeometries[17]}
        material={frameMaterial}
        position={[-1.6, -1, 0]}
        castShadow
      />
      <mesh
        geometry={rovGeometries[18]}
        material={frameMaterial}
        position={[1.6, -1, 0]}
        castShadow
      />

      {/* Main Thrusters (rear) - with animated exhaust */}
      {thrusterPositions.slice(0, 4).map((pos, i) => (
        <group key={`thruster-main-${i}`} position={pos}>
          <mesh
            geometry={rovGeometries[i + 1]}
            material={thrusterMaterial}
            rotation={thrusterRotations[i]}
            castShadow
          />
          {/* Thruster exhaust glow */}
          <mesh
            geometry={new THREE.ConeGeometry(0.4, 1.5, 8, 1, true)}
            material={new THREE.MeshBasicMaterial({
              color: colors.accentPrimary,
              transparent: true,
              opacity: 0.3,
              depthWrite: false,
              blending: THREE.AdditiveBlending,
            })}
            rotation={[Math.PI / 2, 0, 0]}
            position={[0, 0, -1.2]}
            scale={1 + Math.sin(timeRef.current * 10 + i) * 0.2}
          />
        </group>
      ))}

      {/* Maneuvering Thrusters */}
      {thrusterPositions.slice(4, 8).map((pos, i) => (
        <mesh
          key={`thruster-maneuver-${i}`}
          geometry={rovGeometries[i + 5]}
          material={thrusterMaterial}
          position={pos}
          rotation={thrusterRotations[i + 4]}
        />
      ))}

      {/* Camera Housing (front) */}
      <group position={[0, 0, 2.2]}>
        <mesh
          geometry={rovGeometries[9]}
          material={frameMaterial}
          rotation={[Math.PI / 2, 0, 0]}
        />
        <mesh
          geometry={new THREE.SphereGeometry(0.28, 12, 12)}
          material={cameraMaterial}
          position={[0, 0, 0.3]}
        />
        <mesh
          geometry={new THREE.TorusGeometry(0.3, 0.03, 8, 16)}
          material={new THREE.MeshStandardMaterial({ color: '#0a1520', roughness: 0.2, metalness: 0.9 })}
          position={[0, 0, 0.3]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      </group>

      {/* Manipulator Arm (right side) */}
      <group position={[1.6, -0.2, 0.5]}>
        {/* Arm base */}
        <mesh
          geometry={rovGeometries[10]}
          material={armMaterial}
        />
        {/* Arm segments */}
        <mesh
          geometry={rovGeometries[11]}
          material={armMaterial}
          position={[0, -1.2, 0]}
          rotation={[-Math.PI / 6, 0, 0]}
        />
        <mesh
          geometry={rovGeometries[12]}
          material={armMaterial}
          position={[0, -2.4, 0.3]}
          rotation={[-Math.PI / 3, 0, 0]}
        />
        <mesh
          geometry={rovGeometries[13]}
          material={armMaterial}
          position={[0, -3.2, 0.8]}
          rotation={[-Math.PI / 2, 0, 0]}
        />
        {/* Claw */}
        <group position={[0, -4, 1.2]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh
            geometry={rovGeometries[14]}
            material={armMaterial}
            position={[-0.25, 0, 0]}
          />
          <mesh
            geometry={rovGeometries[14]}
            material={armMaterial}
            position={[0.25, 0, 0]}
            scale={[-1, 1, 1]}
          />
        </group>
      </group>

      {/* Tether Spool (top rear) */}
      <mesh
        geometry={rovGeometries[15]}
        material={tetherMaterial}
        position={[0, 0.9, -2]}
      />
      {/* Tether cable going up */}
      <mesh
        geometry={new THREE.CylinderGeometry(0.02, 0.02, 50, 4)}
        material={new THREE.MeshBasicMaterial({
          color: new THREE.Color(colors.creatureBody),
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
        })}
        position={[0, 25, -2]}
        rotation={[Math.PI / 2, 0, 0]}
      />

      {/* Sensor Pods */}
      <mesh
        geometry={rovGeometries[16]}
        material={sensorMaterial}
        position={[-1.8, 0.5, 1]}
      />
      <mesh
        geometry={rovGeometries[17]}
        material={sensorMaterial}
        position={[1.8, 0.5, 1]}
      />
      <mesh
        geometry={rovGeometries[18]}
        material={sensorMaterial}
        position={[-1.5, 0.5, -2]}
      />
      <mesh
        geometry={rovGeometries[19]}
        material={sensorMaterial}
        position={[1.5, 0.5, -2]}
      />

      {/* Front Lights */}
      <group position={[-1.2, -0.3, 2]} rotation={[-0.2, 0, 0]}>
        <spotLight
          color={spotlightColor}
          intensity={spotlightIntensity}
          distance={30}
          angle={0.35}
          penumbra={0.5}
          decay={2}
          target={frontLightTarget1.current}
        />
        <mesh
          geometry={rovGeometries[20]}
          material={lightLensMaterial}
        />
      </group>
      <group position={[1.2, -0.3, 2]} rotation={[-0.2, 0, 0]}>
        <spotLight
          color={spotlightColor}
          intensity={spotlightIntensity}
          distance={30}
          angle={0.35}
          penumbra={0.5}
          decay={2}
          target={frontLightTarget2.current}
        />
        <mesh
          geometry={rovGeometries[21]}
          material={lightLensMaterial}
        />
      </group>

      {/* Side Lights */}
      <mesh
        geometry={new THREE.SphereGeometry(0.1, 8, 8)}
        material={new THREE.MeshBasicMaterial({
          color: colors.accentPrimary,
          transparent: true,
          opacity: 0.8,
          depthWrite: false,
        })}
        position={[-1.7, 0, 0]}
      />
      <mesh
        geometry={new THREE.SphereGeometry(0.1, 8, 8)}
        material={new THREE.MeshBasicMaterial({
          color: colors.accentPrimary,
          transparent: true,
          opacity: 0.8,
          depthWrite: false,
        })}
        position={[1.7, 0, 0]}
      />

      {/* Rear Lights (Red) */}
      <mesh
        geometry={new THREE.SphereGeometry(0.08, 6, 6)}
        material={new THREE.MeshBasicMaterial({
          color: colors.uiDanger,
          transparent: true,
          opacity: 0.8,
          depthWrite: false,
        })}
        position={[-1.3, -0.5, -2.2]}
      />
      <mesh
        geometry={new THREE.SphereGeometry(0.08, 6, 6)}
        material={new THREE.MeshBasicMaterial({
          color: colors.uiDanger,
          transparent: true,
          opacity: 0.8,
          depthWrite: false,
        })}
        position={[1.3, -0.5, -2.2]}
      />

      {/* Top Strobe */}
      <mesh
        geometry={new THREE.SphereGeometry(0.06, 6, 6)}
        material={new THREE.MeshBasicMaterial({
          color: colors.uiWarning,
          transparent: true,
          opacity: 0.6 + Math.sin(timeRef.current * 5) * 0.4,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })}
        position={[0, 1, -1.5]}
      />
    </group>
  );
}