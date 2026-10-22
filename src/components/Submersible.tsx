/**
 * ABYSS — Submersible Component
 * Professional deep-sea exploration vehicle with realistic geometry, materials, and animation
 * Uses unified zone configuration from @/config/zones
 */

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ZoneId } from '@/config/zones';
import { ZONE_COLORS } from '@/config/zones';
import { useDebugFlag } from './DebugOverlay';

// Submersible render counter (dev only)
function SubmersibleRenderCounter({ enabled }: { enabled: boolean }) {
  const renderRef = useRef(0);
  if (enabled) {
    renderRef.current += 1;
    if (renderRef.current % 60 === 1) {
      console.log(`[ABYSS-DEBUG] Submersible render #${renderRef.current}`);
    }
  }
  return null;
}

interface SubmersibleProps {
  zone: ZoneId;
  zoneProgress: number;
  reducedMotion: boolean;
  isPaused?: boolean;
}

export function Submersible({ zone, zoneProgress: _zoneProgress, reducedMotion, isPaused = false }: SubmersibleProps) {
  const subRef = useRef<THREE.Group>(null);
  const hullRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);
  const currentRotationRef = useRef(new THREE.Euler());
  const thrusterIntensityRef = useRef(0);
  const lightTargetRef = useRef<THREE.Object3D>(new THREE.Object3D());

  // Refs for animated thruster glows (to animate scale in useFrame, not JSX)
  const mainThrusterGlowRef = useRef<THREE.Mesh>(null);
  const mainThrusterGlow2Ref = useRef<THREE.Mesh>(null);
  const bowThrusterGlowRefs = useRef<THREE.Mesh[]>([]);
  const sternThrusterGlowRefs = useRef<THREE.Mesh[]>([]);
  const mastLightRef = useRef<THREE.Mesh>(null);

  // Get zone colors
  const colors = ZONE_COLORS[zone];
  const debugEnabled = useDebugFlag();

  // ============ GEOMETRIES ============

  // Main pressure hull - teardrop/cigar shape for deep sea
  const hullGeometry = useMemo(() => {
    const lathePoints: THREE.Vector2[] = [];
    const segments = 32;

    // Profile: tapered nose, cylindrical mid-section, tapered tail
    // y goes from -length/2 to length/2
    const length = 8;
    const maxRadius = 1.3;

    for (let i = 0; i <= segments; i++) {
      const t = i / segments; // 0 to 1
      const y = (t - 0.5) * length;
      let radius = 0;

      if (t < 0.15) {
        // Nose cone - ogive shape
        const noseT = t / 0.15;
        radius = Math.sin(noseT * Math.PI * 0.5) * maxRadius;
      } else if (t < 0.75) {
        // Cylindrical mid-section with subtle bulge for equipment
        const midT = (t - 0.15) / 0.6;
        radius = maxRadius * (1 + Math.sin(midT * Math.PI) * 0.08);
      } else {
        // Tail cone
        const tailT = (t - 0.75) / 0.25;
        radius = Math.cos(tailT * Math.PI * 0.5) * maxRadius * 0.9;
      }
      lathePoints.push(new THREE.Vector2(radius, y));
    }

    const latheGeometry = new THREE.LatheGeometry(lathePoints, 32);
    latheGeometry.rotateX(-Math.PI / 2); // Orient along Z axis
    return latheGeometry;
  }, []);

  // Cockpit/viewport - acrylic pressure hemisphere
  const viewportGeometry = useMemo(() => {
    // Forward-facing hemisphere with flat front port
    const geo = new THREE.SphereGeometry(0.85, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2.2);
    geo.scale(1, 1.1, 1.3); // Slightly elongated forward
    // Cut the back face for hull integration
    const positions = geo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const z = positions.getZ(i);
      if (z < 0) positions.setZ(i, 0);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  // Viewport frame/titanium ring
  const viewportFrameGeometry = useMemo(() => {
    return new THREE.TorusGeometry(0.88, 0.045, 8, 32);
  }, []);

  // Tail control fins (X-configuration for deep sea stability)
  const finGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    // Swept-back fin profile
    shape.moveTo(0, 0);
    shape.lineTo(0, 0.15); // Root chord
    shape.lineTo(1.8, 0.12); // Tip chord (tapered)
    shape.lineTo(2.2, 0); // Swept tip
    shape.lineTo(1.5, -0.02); // Trailing edge
    shape.lineTo(0, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false });
    geo.translate(0, -0.06, -3.8); // Position at tail
    return geo;
  }, []);

  // Vertical tail fin
  const verticalFinGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0, 0.15);
    shape.lineTo(1.6, 0.1);
    shape.lineTo(2.0, 0);
    shape.lineTo(1.3, -0.02);
    shape.lineTo(0, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false });
    geo.translate(0, -0.06, -3.8);
    return geo;
  }, []);

  // Main thrusters (vectoring nozzles)
  const thrusterGeometry = useMemo(() => {
    const geo = new THREE.CylinderGeometry(0.35, 0.42, 1.0, 16);
    // Add nozzle detail
    const positions = geo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      if (y > 0.4) { // Nozzle flare
        const factor = (y - 0.4) / 0.1;
        const x = positions.getX(i);
        const z = positions.getZ(i);
        positions.setX(i, x * (1 + factor * 0.3));
        positions.setZ(i, z * (1 + factor * 0.3));
      }
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  // Manipulator arm (articulated)
  const armSegmentGeometry = useMemo(() => {
    return new THREE.CylinderGeometry(0.07, 0.085, 1.1, 8);
  }, []);

  const armJointGeometry = useMemo(() => {
    return new THREE.SphereGeometry(0.095, 12, 12);
  }, []);

  // Claw/gripper
  const clawGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      // Finger 1
      0, 0, 0,  0.02, 0, 0,  0, 0.18, 0,
      0.02, 0, 0,  0.02, 0.18, 0,  0, 0.18, 0,
      // Finger 2
      0, 0, 0.03,  0.02, 0, 0.03,  0, 0.18, 0.03,
      0.02, 0, 0.03,  0.02, 0.18, 0.03,  0, 0.18, 0.03,
    ]);
    geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  // Sensor pod
  const sensorPodGeometry = useMemo(() => {
    return new THREE.CylinderGeometry(0.18, 0.22, 0.5, 12);
  }, []);

  // Side sonar array
  const sonarArrayGeometry = useMemo(() => {
    const geo = new THREE.BoxGeometry(0.12, 0.7, 2.2);
    const positions = geo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      if (y > 0.3) { // Tapered top
        const factor = (y - 0.3) / 0.4;
        const x = positions.getX(i);
        positions.setX(i, x * (1 - factor * 0.5));
      }
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  // External battery/power housing
  const batteryHousingGeometry = useMemo(() => {
    const geo = new THREE.BoxGeometry(0.7, 0.45, 1.6);
    const positions = geo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = Math.abs(positions.getX(i));
      const z = Math.abs(positions.getZ(i));
      if (x > 0.32 && z > 0.75) { // Round corners
        positions.setX(i, positions.getX(i) * 0.7);
        positions.setZ(i, positions.getZ(i) * 0.7);
      }
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  // Searchlight housing
  const searchlightHousingGeometry = useMemo(() => {
    const geo = new THREE.CylinderGeometry(0.18, 0.22, 0.35, 16);
    // Front lens recess
    const positions = geo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      if (y > 0.15) {
        positions.setY(i, 0.15);
      }
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  const searchlightLensGeometry = useMemo(() => {
    return new THREE.CylinderGeometry(0.16, 0.16, 0.02, 16);
  }, []);

  // Lifting points / tie-downs
  const liftingPointGeometry = useMemo(() => {
    const geo = new THREE.TorusGeometry(0.08, 0.02, 6, 12);
    return geo;
  }, []);

  // ============ MATERIALS ============

  // Hull - titanium/syntactic foam composite
  const hullMaterial = useMemo(() => {
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(colors.creatureBody),
      roughness: 0.45,
      metalness: 0.65,
      envMapIntensity: 0.9,
      clearcoat: 0.3,
      clearcoatRoughness: 0.25,
    });
    // Add subtle color variation based on viewing angle
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uZoneColor = { value: new THREE.Color(colors.creatureBody) };
    };
    return mat;
  }, [colors]);

  // Viewport - thick acrylic with internal anti-reflection coating
  const viewportMaterial = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(colors.accentSecondary),
      roughness: 0.01,
      metalness: 0.98,
      transmission: 0.96,
      thickness: 0.8,
      ior: 1.48,
      transparent: true,
      opacity: 0.35,
      envMapIntensity: 1.8,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      attenuationDistance: 2,
      attenuationColor: new THREE.Color(0x002244),
      side: THREE.DoubleSide,
    });
  }, [colors]);

  // Viewport frame - titanium
  const frameMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1a1f2a'),
      roughness: 0.25,
      metalness: 0.92,
      envMapIntensity: 1.2,
    });
  }, []);

  // Fin material - same as hull but slightly different finish
  const finMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(colors.creatureBody),
      roughness: 0.4,
      metalness: 0.6,
      envMapIntensity: 0.8,
    });
  }, [colors]);

  // Thruster housing - high-temp alloy
  const thrusterHousingMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1a1a1e'),
      roughness: 0.35,
      metalness: 0.85,
      envMapIntensity: 1.0,
    });
  }, []);

  // Thruster nozzle interior - ceramic/heat resistant
  const thrusterNozzleMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#0d0d12'),
      roughness: 0.8,
      metalness: 0.2,
    });
  }, []);

  // Thruster exhaust glow (emissive)
  const thrusterGlowMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: colors.accentPrimary,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, [colors]);

  // Maneuvering thruster glow materials (lower opacity)
  const maneuveringGlowBowMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: colors.accentPrimary,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, [colors]);

  const maneuveringGlowSternMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: colors.accentPrimary,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, [colors]);

  // Manipulator arm - matte grey steel
  const armMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2a2f3a'),
      roughness: 0.4,
      metalness: 0.7,
      envMapIntensity: 0.7,
    });
  }, []);

  // Sensor pod - matte with slight sheen
  const sensorMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(colors.creatureBody),
      roughness: 0.35,
      metalness: 0.75,
      envMapIntensity: 0.8,
    });
  }, [colors]);

  // Sonar array - rubbery/absorbent
  const sonarMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#0a0f1a'),
      roughness: 0.85,
      metalness: 0.1,
    });
  }, []);

  // Battery housing
  const batteryMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#151a25'),
      roughness: 0.5,
      metalness: 0.55,
      envMapIntensity: 0.6,
    });
  }, []);

  // Searchlight housing
  const searchlightHousingMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#181d28'),
      roughness: 0.3,
      metalness: 0.8,
      envMapIntensity: 1.0,
    });
  }, []);

  // Searchlight lens
  const searchlightLensMaterial = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(colors.sunColor),
      roughness: 0.01,
      metalness: 0.95,
      transmission: 0.98,
      thickness: 0.3,
      ior: 1.45,
      transparent: true,
      opacity: 0.9,
      emissive: new THREE.Color(colors.sunColor),
      emissiveIntensity: 0.5,
      clearcoat: 1,
      clearcoatRoughness: 0.01,
    });
  }, [colors]);

  // Lifting points - high-visibility orange
  const liftingPointMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ff6600'),
      roughness: 0.4,
      metalness: 0.6,
      emissive: new THREE.Color('#ff6600'),
      emissiveIntensity: 0.15,
    });
  }, []);

  // Navigation lights
  const navLightPortMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ff4400'), // Red - port
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
  }, []);

  const navLightStarboardMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color('#00aa33'), // Green - starboard
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
  }, []);

  const navLightSternMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ffff00'), // Yellow/white - stern
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
  }, []);

  const navLightMastMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(colors.accentPrimary),
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, [colors]);

  // ============ INITIALIZE LIGHT TARGET ============
  useMemo(() => {
    lightTargetRef.current.position.set(0, -0.5, 15);
  }, []);

  // ============ ANIMATION ============
  useFrame((_, delta) => {
    if (reducedMotion || isPaused || !subRef.current) return;
    timeRef.current += delta;

    // Gentle buoyancy - slow vertical oscillation
    const buoyancyY = Math.sin(timeRef.current * 0.28) * 0.04;
    const buoyancyX = Math.sin(timeRef.current * 0.19 + 1.3) * 0.015;
    const buoyancyZ = Math.cos(timeRef.current * 0.23 + 2.1) * 0.01;

    // Subtle pitch and roll from "currents"
    const pitch = Math.sin(timeRef.current * 0.15) * 0.004 + Math.sin(timeRef.current * 0.37) * 0.002;
    const roll = Math.cos(timeRef.current * 0.12 + 0.7) * 0.003 + Math.sin(timeRef.current * 0.29) * 0.0015;

    // Smooth interpolation for organic feel
    const lerpSpeed = 1.5;
    subRef.current.position.y = THREE.MathUtils.lerp(subRef.current.position.y, buoyancyY, delta * lerpSpeed);
    subRef.current.position.x = THREE.MathUtils.lerp(subRef.current.position.x, buoyancyX, delta * lerpSpeed);
    subRef.current.position.z = THREE.MathUtils.lerp(subRef.current.position.z, buoyancyZ, delta * lerpSpeed);

    currentRotationRef.current.x = THREE.MathUtils.lerp(currentRotationRef.current.x, pitch, delta * lerpSpeed);
    currentRotationRef.current.z = THREE.MathUtils.lerp(currentRotationRef.current.z, roll, delta * lerpSpeed);
    subRef.current.rotation.x = currentRotationRef.current.x;
    subRef.current.rotation.z = currentRotationRef.current.z;

    // Thruster intensity pulse (idle) - used for main thruster glow scale
    thrusterIntensityRef.current = 0.4 + Math.sin(timeRef.current * 1.8) * 0.1 + Math.sin(timeRef.current * 3.7) * 0.05;

    // Animate main thruster glows (scale pulse)
    if (mainThrusterGlowRef.current) {
      const pulse = 1 + Math.sin(timeRef.current * 15) * 0.15 * thrusterIntensityRef.current;
      mainThrusterGlowRef.current.scale.setScalar(pulse);
    }
    if (mainThrusterGlow2Ref.current) {
      const pulse = 1 + Math.sin(timeRef.current * 15 + 0.5) * 0.15 * thrusterIntensityRef.current;
      mainThrusterGlow2Ref.current.scale.setScalar(pulse);
    }

    // Animate bow maneuvering thrusters
    bowThrusterGlowRefs.current.forEach((mesh, i) => {
      if (mesh) {
        const pulse = 0.6 + Math.sin(timeRef.current * 20 + i * 0.5) * 0.1;
        mesh.scale.setScalar(pulse);
      }
    });

    // Animate stern maneuvering thrusters
    sternThrusterGlowRefs.current.forEach((mesh, i) => {
      if (mesh) {
        const pulse = 0.5 + Math.sin(timeRef.current * 18 + i * 0.5) * 0.1;
        mesh.scale.setScalar(pulse);
      }
    });

    // Animate mast light strobe
    if (mastLightRef.current) {
      const pulse = 1 + Math.sin(timeRef.current * 8) * 0.3;
      mastLightRef.current.scale.setScalar(pulse);
    }

    // Searchlight target - subtle sweep
    lightTargetRef.current.position.x = Math.sin(timeRef.current * 0.08) * 3;
    lightTargetRef.current.position.y = -0.5 + Math.sin(timeRef.current * 0.06) * 0.5;
    lightTargetRef.current.position.z = 15 + Math.sin(timeRef.current * 0.05) * 1;
  });

  // Spotlight intensity based on zone
  const spotlightIntensity = useMemo(() => {
    const intensities = { sunlight: 0.8, twilight: 1.5, midnight: 2.5, abyss: 4.0 };
    return intensities[zone];
  }, [zone]);

  const spotlightColor = useMemo(() => colors.sunColor, [colors]);

  return (
    <group ref={subRef} position={[0, 0, 0]}>
      {/* Submersible render counter (dev only) */}
      <SubmersibleRenderCounter enabled={debugEnabled} />
      {/* ============ MAIN PRESSURE HULL ============ */}
      <mesh
        ref={hullRef}
        geometry={hullGeometry}
        material={hullMaterial}
        castShadow
        receiveShadow
      />

      {/* ============ COCKPIT / VIEWPORT ============ */}
      <group position={[0, 0.55, 2.9]}>
        {/* Viewport glass */}
        <mesh
          geometry={viewportGeometry}
          material={viewportMaterial}
          castShadow
          receiveShadow
        />
        {/* Titanium frame ring */}
        <mesh
          geometry={viewportFrameGeometry}
          material={frameMaterial}
          rotation={[-Math.PI / 2, 0, 0]}
        />
        {/* Inner frame detail */}
        <mesh
          geometry={new THREE.TorusGeometry(0.78, 0.025, 6, 24)}
          material={frameMaterial}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, 0.15]}
        />
      </group>

      {/* ============ TAIL FINS (X-CONFIGURATION) ============ */}
      <mesh geometry={finGeometry} material={finMaterial} rotation={[0, 0, Math.PI / 4]} castShadow />
      <mesh geometry={finGeometry} material={finMaterial} rotation={[0, 0, -Math.PI / 4]} castShadow />
      <mesh geometry={finGeometry} material={finMaterial} rotation={[0, 0, Math.PI * 3 / 4]} castShadow />
      <mesh geometry={finGeometry} material={finMaterial} rotation={[0, 0, -Math.PI * 3 / 4]} castShadow />
      <mesh geometry={verticalFinGeometry} material={finMaterial} castShadow />

      {/* ============ MAIN THRUSTERS (TWIN VECTORING) ============ */}
      <group position={[-0.9, -0.4, -4.3]}>
        <mesh geometry={thrusterGeometry} material={thrusterHousingMaterial} rotation={[Math.PI / 2, 0, 0]} castShadow />
        <mesh
          ref={mainThrusterGlowRef}
          geometry={new THREE.ConeGeometry(0.38, 1.8, 16, 1, true)}
          material={thrusterGlowMaterial}
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, 0, -1.4]}
        />
        {/* Nozzle interior */}
        <mesh
          geometry={new THREE.CylinderGeometry(0.32, 0.35, 0.15, 16)}
          material={thrusterNozzleMaterial}
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, 0, -0.58]}
        />
      </group>
      <group position={[0.9, -0.4, -4.3]}>
        <mesh geometry={thrusterGeometry} material={thrusterHousingMaterial} rotation={[Math.PI / 2, 0, 0]} castShadow />
        <mesh
          ref={mainThrusterGlow2Ref}
          geometry={new THREE.ConeGeometry(0.38, 1.8, 16, 1, true)}
          material={thrusterGlowMaterial}
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, 0, -1.4]}
        />
        <mesh
          geometry={new THREE.CylinderGeometry(0.32, 0.35, 0.15, 16)}
          material={thrusterNozzleMaterial}
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, 0, -0.58]}
        />
      </group>

      {/* ============ MANEUVERING THRUSTERS (4x bow, 4x stern) ============ */}
      {[-1.2, 1.2].map((x, idx) => (
        <group key={`bow-thruster-${x}`} position={[x, 0, 2.2]} rotation={[0, 0, x > 0 ? -Math.PI / 2 : Math.PI / 2]}>
          <mesh
            geometry={new THREE.CylinderGeometry(0.11, 0.13, 0.5, 8)}
            material={thrusterHousingMaterial}
            rotation={[Math.PI / 2, 0, 0]}
          />
          <mesh
            ref={(mesh) => { if (mesh) bowThrusterGlowRefs.current[idx] = mesh; }}
            geometry={new THREE.ConeGeometry(0.13, 0.6, 8, 1, true)}
            material={maneuveringGlowBowMaterial}
            rotation={[Math.PI / 2, 0, 0]}
            position={[0, 0, -0.55]}
          />
        </group>
      ))}
      {[-1.1, 1.1].map((x, idx) => (
        <group key={`stern-thruster-${x}`} position={[x, -0.4, -3.6]} rotation={[0, 0, x > 0 ? -Math.PI / 2 : Math.PI / 2]}>
          <mesh
            geometry={new THREE.CylinderGeometry(0.1, 0.12, 0.45, 8)}
            material={thrusterHousingMaterial}
            rotation={[Math.PI / 2, 0, 0]}
          />
          <mesh
            ref={(mesh) => { if (mesh) sternThrusterGlowRefs.current[idx] = mesh; }}
            geometry={new THREE.ConeGeometry(0.12, 0.5, 8, 1, true)}
            material={maneuveringGlowSternMaterial}
            rotation={[Math.PI / 2, 0, 0]}
            position={[0, 0, -0.5]}
          />
        </group>
      ))}

      {/* ============ MANIPULATOR ARM (STARBOARD) ============ */}
      <group position={[1.45, -0.15, 1.2]} rotation={[0, -0.3, 0]}>
        {/* Shoulder joint */}
        <mesh geometry={armJointGeometry} material={armMaterial} />
        {/* Upper arm */}
        <mesh geometry={armSegmentGeometry} material={armMaterial} position={[0, -0.55, 0]} rotation={[-Math.PI / 5, 0, 0]} />
        {/* Elbow joint */}
        <mesh geometry={armJointGeometry} material={armMaterial} position={[0, -1.1, 0.1]} />
        {/* Forearm */}
        <mesh geometry={armSegmentGeometry} material={armMaterial} position={[0, -1.65, 0.25]} rotation={[-Math.PI / 3, 0, 0]} />
        {/* Wrist joint */}
        <mesh geometry={armJointGeometry} material={armMaterial} position={[0, -2.15, 0.4]} />
        {/* Claw */}
        <group position={[0, -2.6, 0.6]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh geometry={clawGeometry} material={armMaterial} />
        </group>
      </group>

      {/* ============ SENSOR PODS (PORT/STARBOARD) ============ */}
      <mesh geometry={sensorPodGeometry} material={sensorMaterial} position={[-1.6, 0.45, 1.5]} rotation={[Math.PI / 2, 0, 0]} castShadow />
      <mesh geometry={sensorPodGeometry} material={sensorMaterial} position={[1.6, 0.45, 1.5]} rotation={[Math.PI / 2, 0, 0]} castShadow />
      <mesh geometry={sensorPodGeometry} material={sensorMaterial} position={[-1.3, 0.45, -2.2]} rotation={[Math.PI / 2, 0, 0]} castShadow />
      <mesh geometry={sensorPodGeometry} material={sensorMaterial} position={[1.3, 0.45, -2.2]} rotation={[Math.PI / 2, 0, 0]} castShadow />

      {/* ============ SIDE SONAR ARRAYS ============ */}
      <mesh geometry={sonarArrayGeometry} material={sonarMaterial} position={[-1.55, 0, 0.2]} castShadow />
      <mesh geometry={sonarArrayGeometry} material={sonarMaterial} position={[1.55, 0, 0.2]} castShadow />

      {/* ============ BATTERY / POWER HOUSINGS ============ */}
      <mesh geometry={batteryHousingGeometry} material={batteryMaterial} position={[-1.9, 0.25, -0.5]} castShadow />
      <mesh geometry={batteryHousingGeometry} material={batteryMaterial} position={[1.9, 0.25, -0.5]} castShadow />

      {/* ============ SEARCHLIGHT HOUSING ============ */}
      <group position={[0, -0.3, 2.5]} rotation={[-0.15, 0, 0]}>
        <mesh geometry={searchlightHousingGeometry} material={searchlightHousingMaterial} rotation={[Math.PI / 2, 0, 0]} castShadow />
        <mesh geometry={searchlightLensGeometry} material={searchlightLensMaterial} position={[0, 0.185, 0]} rotation={[Math.PI / 2, 0, 0]} />
        {/* Actual spot light */}
        <spotLight
          position={[0, 0, 0]}
          target={lightTargetRef.current}
          color={spotlightColor}
          intensity={spotlightIntensity}
          angle={0.22}
          penumbra={0.45}
          decay={2}
          distance={80}
          castShadow={false}
        />
      </group>

      {/* ============ NAVIGATION LIGHTS ============ */}
      {/* Port (red) */}
      <mesh
        geometry={new THREE.SphereGeometry(0.07, 10, 10)}
        material={navLightPortMaterial}
        position={[-1.5, 0.1, 2.0]}
      />
      {/* Starboard (green) */}
      <mesh
        geometry={new THREE.SphereGeometry(0.07, 10, 10)}
        material={navLightStarboardMaterial}
        position={[1.5, 0.1, 2.0]}
      />
      {/* Stern (yellow) */}
      <mesh
        geometry={new THREE.SphereGeometry(0.055, 8, 8)}
        material={navLightSternMaterial}
        position={[-0.65, -0.45, -4.5]}
      />
      <mesh
        geometry={new THREE.SphereGeometry(0.055, 8, 8)}
        material={navLightSternMaterial}
        position={[0.65, -0.45, -4.5]}
      />
      {/* Mast top (blue-white strobe) */}
      <group position={[0, 1.55, -2.0]}>
        <mesh
          geometry={new THREE.CylinderGeometry(0.012, 0.02, 2.8, 6)}
          material={new THREE.MeshStandardMaterial({ color: '#1a1f2a', roughness: 0.3, metalness: 0.9 })}
        />
        <mesh
          ref={mastLightRef}
          geometry={new THREE.SphereGeometry(0.07, 8, 8)}
          material={navLightMastMaterial}
          position={[0, 1.5, 0]}
        />
      </group>

      {/* ============ LIFTING POINTS / TIE-DOWNS ============ */}
      {[-2.5, 2.5].map((z) => (
        <group key={`lift-${z}`} position={[0, 1.4, z]}>
          <mesh geometry={liftingPointGeometry} material={liftingPointMaterial} rotation={[Math.PI / 2, 0, 0]} />
          <mesh geometry={liftingPointGeometry} material={liftingPointMaterial} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.15, 0]} />
        </group>
      ))}

      {/* ============ EXTERNAL CABLE RUNS (subtle detail) ============ */}
      <group>
        {[-1, 1].map((side) => (
          <mesh
            key={`cable-${side}`}
            geometry={new THREE.CylinderGeometry(0.015, 0.015, 4, 4)}
            material={new THREE.MeshStandardMaterial({ color: '#0d121a', roughness: 0.7, metalness: 0.3 })}
            position={[side * 1.4, -0.2, 0.5]}
            rotation={[Math.PI / 2, 0, 0]}
          />
        ))}
      </group>
    </group>
  );
}