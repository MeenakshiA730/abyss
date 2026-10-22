/**
 * ABYSS — Cinematic Camera Controller
 * Smooth camera that follows the submersible descent with cinematic framing,
 * dynamic FOV, rule-of-thirds composition, and dramatic zone transitions
 */

import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { getDebugFlags } from '@/debugFlags';

export type ZoneId = 'sunlight' | 'twilight' | 'midnight' | 'abyss';

interface ZoneCameraConfig {
  offset: THREE.Vector3;
  lookAtOffset: THREE.Vector3;
  fov: number;
  near: number;
  far: number;
  // Cinematic framing
  horizontalOffset: number; // Rule of thirds offset
  verticalOffset: number;
  roll: number; // Subtle dutch angle for tension
}

interface CameraControllerProps {
  depth: number;
  currentZone: ZoneId;
  zoneProgress?: number;
  reducedMotion: boolean;
  isPaused?: boolean;
  targetPosition?: THREE.Vector3;
  targetRotation?: THREE.Euler;
}

const ZONE_ORDER: ZoneId[] = ['sunlight', 'twilight', 'midnight', 'abyss'];

// Debug flags (parsed once at startup)
const debugFlags = getDebugFlags();
const debugEnabled = typeof window !== 'undefined' && (new URLSearchParams(window.location.search).get('debug') === 'true' || new URLSearchParams(window.location.search).get('debug') === '1');
const mountTimeRef = { current: performance.now() };

export function CameraController({
  depth,
  currentZone,
  reducedMotion,
  isPaused = false,
  targetPosition = new THREE.Vector3(0, 0, 0),
}: CameraControllerProps) {
  const { camera, gl } = useThree();
  const perspCamera = camera as THREE.PerspectiveCamera;

  const lerpFactorRef = useRef(reducedMotion ? 1 : 0.03);
  const currentZoneRef = useRef<ZoneId>(currentZone);
  const transitionProgressRef = useRef(0);
  const depthRef = useRef(depth);
  const timeRef = useRef(0);
  const shakeIntensityRef = useRef(0);
  const lastZoneChangeRef = useRef(currentZone);
  const cinematicOffsetRef = useRef(new THREE.Vector3());

  // Zone-specific camera configurations with cinematic framing
  const zoneCameraConfigs = useMemo((): Record<ZoneId, ZoneCameraConfig> => ({
    sunlight: {
      // Bright, wide view - show environment context, rule of thirds
      offset: new THREE.Vector3(14, 10, 24),
      lookAtOffset: new THREE.Vector3(-2, -1, -6), // Submersible slightly off-center
      fov: 58,
      near: 0.1,
      far: 5000,
      horizontalOffset: -1.5, // Rule of thirds: subject at 1/3
      verticalOffset: 0.5,
      roll: 0,
    },
    twilight: {
      // Slightly lower, tighter - descending feeling
      offset: new THREE.Vector3(11, 7, 20),
      lookAtOffset: new THREE.Vector3(-1.5, -2, -8),
      fov: 54,
      near: 0.1,
      far: 5000,
      horizontalOffset: -1,
      verticalOffset: 0.8,
      roll: 0.02, // Very slight unease
    },
    midnight: {
      // Low, close - oppressive, focused on hero lights
      offset: new THREE.Vector3(9, 5, 16),
      lookAtOffset: new THREE.Vector3(-1, -3, -10),
      fov: 48,
      near: 0.1,
      far: 5000,
      horizontalOffset: -0.5,
      verticalOffset: 1.2,
      roll: 0.05, // Subtle tension
    },
    abyss: {
      // Very low, tight - claustrophobic, creature silhouette focus
      offset: new THREE.Vector3(7, 3, 13),
      lookAtOffset: new THREE.Vector3(0, -4, -12),
      fov: 42,
      near: 0.1,
      far: 5000,
      horizontalOffset: 0,
      verticalOffset: 1.5,
      roll: 0.08, // Unease increases
    },
  }), []);


// Smooth zone transition and cinematic camera movement
useFrame((_, delta) => {
    if (reducedMotion || isPaused) return;

    const camstep = debugFlags.camstep || 0;

    // Dev-only diagnostic guards behind ?debug (read once at module level)
if (debugEnabled) {
  const pos = perspCamera.position;
  const quat = perspCamera.quaternion;
  const fov = perspCamera.fov;
  const bad = [];
  if (!isFinite(pos.x)) bad.push('pos.x');
  if (!isFinite(pos.y)) bad.push('pos.y');
  if (!isFinite(pos.z)) bad.push('pos.z');
  if (!isFinite(quat.x)) bad.push('quat.x');
  if (!isFinite(quat.y)) bad.push('quat.y');
  if (!isFinite(quat.z)) bad.push('quat.z');
  if (!isFinite(quat.w)) bad.push('quat.w');
  if (!isFinite(fov)) bad.push('fov');
  if (bad.length) {
    console.warn('[ABYSS-CAM] NaN/Inf in ' + bad.join(', ') + ' zone=' + currentZone);
  }
  if (delta > 0.1) {
    const sinceMount = (performance.now() - mountTimeRef.current) / 1000;
    console.warn('[ABYSS-CAM] large delta=' + delta.toFixed(3) + 's sinceMount=' + sinceMount.toFixed(2) + 's zone=' + currentZone);
  }
}

timeRef.current += delta;

// Detect zone change for transition
    if (currentZoneRef.current !== currentZone) {
      currentZoneRef.current = currentZone;
      transitionProgressRef.current = 0;
      lastZoneChangeRef.current = currentZone;
      // Add a subtle "impact" shake on zone transition
      shakeIntensityRef.current = 0.3;
    }

    // Decay shake
    if (shakeIntensityRef.current > 0) {
      shakeIntensityRef.current = Math.max(0, shakeIntensityRef.current - delta * 0.5);
    }

    // Smooth transition between zone camera configs
    if (transitionProgressRef.current < 1) {
      transitionProgressRef.current = Math.min(1, transitionProgressRef.current + delta * 0.4);
    }

    const currentConfig = zoneCameraConfigs[currentZoneRef.current] || zoneCameraConfigs.sunlight;
    const currentIndex = ZONE_ORDER.indexOf(currentZoneRef.current);
    const prevZone = ZONE_ORDER[Math.max(0, currentIndex - 1)];
    const prevConfig = zoneCameraConfigs[prevZone] || currentConfig;

    const t = transitionProgressRef.current;
    const easedT = t * t * (3 - 2 * t); // smoothstep

    // Smoothly track depth changes
    depthRef.current = THREE.MathUtils.lerp(depthRef.current, depth, reducedMotion ? 1 : 0.08);

    // Interpolate camera offset and lookAt
    const targetOffset = new THREE.Vector3().lerpVectors(prevConfig.offset, currentConfig.offset, easedT);
    const targetLookAtOffset = new THREE.Vector3().lerpVectors(prevConfig.lookAtOffset, currentConfig.lookAtOffset, easedT);
    const targetHorizontalOffset = THREE.MathUtils.lerp(prevConfig.horizontalOffset, currentConfig.horizontalOffset, easedT);
    const targetVerticalOffset = THREE.MathUtils.lerp(prevConfig.verticalOffset, currentConfig.verticalOffset, easedT);
    const targetRoll = THREE.MathUtils.lerp(prevConfig.roll, currentConfig.roll, easedT);

    // Dynamic FOV based on depth - narrows as we go deeper for cinematic feel
    const baseFov = THREE.MathUtils.lerp(prevConfig.fov, currentConfig.fov, easedT);
    const depthFovReduction = Math.min(depthRef.current / 6000, 1) * 12; // Up to 12° reduction at max depth
    const targetFov = baseFov - depthFovReduction;

    // Calculate desired camera position relative to submersible with cinematic framing
    // The targetPosition already includes the descent Y position from AbyssCanvas
    const desiredPosition = targetPosition.clone().add(targetOffset);

    // Apply rule-of-thirds horizontal offset (perpendicular to view direction)
    const rightDir = new THREE.Vector3(1, 0, 0).applyQuaternion(perspCamera.quaternion);
    desiredPosition.addScaledVector(rightDir, targetHorizontalOffset);
    desiredPosition.y += targetVerticalOffset;

    const desiredLookAt = targetPosition.clone().add(targetLookAtOffset);

    // Add camera shake - deterministic sine-based to avoid per-frame flicker
    if (camstep >= 2 && shakeIntensityRef.current > 0) {
      const shakeSpeed = 25; // High frequency for shake feel
      const t = timeRef.current * shakeSpeed;
      const shakeX = Math.sin(t * 1.0) * shakeIntensityRef.current * 0.5;
      const shakeY = Math.sin(t * 1.3 + 0.7) * shakeIntensityRef.current * 0.3;
      const shakeZ = Math.sin(t * 0.9 + 1.9) * shakeIntensityRef.current * 0.2;
      desiredPosition.add(new THREE.Vector3(shakeX, shakeY, shakeZ));
    }

    // Subtle cinematic breathing - very slow, organic movement
    if (camstep >= 2 && !reducedMotion && shakeIntensityRef.current === 0) {
      const breathSpeed = 0.15;
      const breathAmount = 0.08;
      cinematicOffsetRef.current.x = Math.sin(timeRef.current * breathSpeed) * breathAmount;
      cinematicOffsetRef.current.y = Math.sin(timeRef.current * breathSpeed * 0.7 + 1.3) * breathAmount * 0.5;
      cinematicOffsetRef.current.z = Math.cos(timeRef.current * breathSpeed * 0.5 + 2.1) * breathAmount * 0.3;
      desiredPosition.add(cinematicOffsetRef.current);
    }

    // Smooth camera movement with adaptive lerp (slower for cinematic feel)
    const lerp = lerpFactorRef.current;
    perspCamera.position.lerp(desiredPosition, lerp);

    // Smooth look-at with slight lag for organic feel
    if (camstep >= 3) {
      const lookAtLerp = lerp * 0.7;
      const currentLookAt = new THREE.Vector3();
      perspCamera.getWorldDirection(currentLookAt).multiplyScalar(-1).add(perspCamera.position);
      currentLookAt.lerp(desiredLookAt, lookAtLerp);
      perspCamera.lookAt(currentLookAt);
    }

    // Apply subtle roll for tension in deep zones
    if (camstep === 0) {
      const currentRoll = perspCamera.rotation.z;
      const targetRollLerped = THREE.MathUtils.lerp(currentRoll, targetRoll, lerp * 0.3);
      perspCamera.rotation.z = targetRollLerped;
    }

    // Smooth FOV transition (skip if ?camfov=0)
    if (!debugFlags.camfov) {
      perspCamera.fov = THREE.MathUtils.lerp(perspCamera.fov, targetFov, lerp * 0.3);
      perspCamera.updateProjectionMatrix();
    }

    // Update renderer for proper projection
    if (gl) {
      gl.getRenderTarget();
    }
  });

  // Initialize camera
  useFrame((_, _delta) => {
    if (perspCamera.position.equals(new THREE.Vector3(0, 0, 0))) {
      const config = zoneCameraConfigs[currentZone] || zoneCameraConfigs.sunlight;
      perspCamera.position.copy(targetPosition.clone().add(config.offset));
      perspCamera.lookAt(targetPosition.clone().add(config.lookAtOffset));
      perspCamera.fov = config.fov;
      perspCamera.near = config.near;
      perspCamera.far = config.far;
      perspCamera.updateProjectionMatrix();
    }
  }, 1); // Run once

  return null; // This component doesn't render anything, just controls camera
}