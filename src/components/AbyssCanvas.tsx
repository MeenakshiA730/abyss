/**
 * ABYSS — Main 3D Canvas
 * React Three Fiber canvas for the deep ocean experience
 * PHASE 1: Camera and composition fix - proper framing, scale, depth layering
 */

import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, FXAA } from '@react-three/postprocessing';
import { Suspense, useEffect, useState, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { Environment } from './Environment';
import { Submersible } from './Submersible';
import { Searchlight } from './Searchlight';
import { Particles } from './Particles';
import { MassiveCreature } from './MassiveCreature';
import { MarineLife } from './MarineLife';
import { Terrain } from './Terrain';
import { Shipwreck } from './Shipwreck';
import { ResearchStation } from './ResearchStation';
import { ROV } from './ROV';
import { CameraController } from './CameraController';
import { ZoneLighting } from './ZoneLighting';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { DebugStatsCollector, useDebugFlag } from './DebugOverlay';
import { getDebugFlags } from '../debugFlags';

// Scene root render counter (dev only)
function SceneRenderCounter({ enabled }: { enabled: boolean }) {
  const renderRef = useRef(0);
  if (enabled) {
    renderRef.current += 1;
    if (renderRef.current % 60 === 1) {
      console.log(`[ABYSS-DEBUG] Scene root render #${renderRef.current}`);
    }
  }
  return null;
}

// AbyssCanvas render counter (dev only)
function AbyssCanvasRenderCounter({ enabled }: { enabled: boolean }) {
  const renderRef = useRef(0);
  if (enabled) {
    renderRef.current += 1;
    if (renderRef.current % 60 === 1) {
      console.log(`[ABYSS-DEBUG] AbyssCanvas render #${renderRef.current}`);
    }
  }
  return null;
}

// Debug Cube for ?cube=1 baseline testing
function DebugCube({ frozen }: { frozen: boolean }) {
  const cubeRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    if (frozen) return;
    timeRef.current += delta;
    if (cubeRef.current) {
      cubeRef.current.rotation.x = timeRef.current * 0.5;
      cubeRef.current.rotation.y = timeRef.current * 0.3;
    }
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 7]} intensity={1} />
      <mesh ref={cubeRef}>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="#00d4ff" roughness={0.3} metalness={0.7} />
      </mesh>
    </>
  );
}

type ZoneId = 'sunlight' | 'twilight' | 'midnight' | 'abyss';

interface AbyssCanvasProps {
  className?: string;
  onLoad?: () => void;
  onError?: (error: Error | Event | React.SyntheticEvent) => void;
  isPaused?: boolean;
  reducedMotion?: boolean;
  depth?: number;
  currentZone?: ZoneId;
  zoneProgress?: number;
}

// Module-level constants for Canvas props (hoisted from inline objects)
const CAMERA_DEFAULTS = { position: [12, 8, 20], fov: 55, near: 0.1, far: 5000 } as const;
const GL_DEFAULTS = {
  antialias: true,
  alpha: true,
  preserveDrawingBuffer: false,
  powerPreference: 'high-performance',
  stencil: false,
  depth: true,
  logarithmicDepthBuffer: true,
} as const;

// Debug flags (parsed once at startup)
const debugFlags = getDebugFlags();

export function AbyssCanvas({
  className = '',
  onLoad,
  onError,
  isPaused = false,
  reducedMotion: propReducedMotion,
  depth = 0,
  currentZone = 'sunlight',
  zoneProgress = 0,
}: AbyssCanvasProps) {
  const hookReducedMotion = useReducedMotion();
  const reducedMotion = propReducedMotion ?? hookReducedMotion;
  const [sceneReady, setSceneReady] = useState(false);
  const debugEnabled = useDebugFlag();

  // Notify parent when scene is ready
  useEffect(() => {
    if (sceneReady && onLoad) {
      onLoad();
    }
  }, [sceneReady, onLoad]);

  // Submersible position (hero focal point) - at origin, descends with depth
  const submersiblePosition = useMemo(() => new THREE.Vector3(0, -depth / 1000, 0), [depth]);

  return (
    <Canvas
      className={className}
      camera={CAMERA_DEFAULTS}
      gl={GL_DEFAULTS}
      shadows={false}
      onError={(error) => {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        console.error('[ABYSS] WebGL Error:', errorObj);
        onError?.(errorObj);
      }}
      onCreated={({ gl }) => {
        gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.0;
        setSceneReady(true);
      }}
    >
      <Suspense fallback={null}>
        {/* Scene root render counter (dev only) */}
        <SceneRenderCounter enabled={debugEnabled} />
        {/* AbyssCanvas render counter (dev only) */}
        <AbyssCanvasRenderCounter enabled={debugEnabled} />

        {/* CUBE MODE - render ONLY a single rotating cube (baseline) */}
        {debugFlags.cube && <DebugCube frozen={debugFlags.frozen} />}

        {!debugFlags.cube && (
          <>
            {/* Zone-aware background & fog — handled by ZoneLighting */}
            <ZoneLighting
              zone={currentZone}
              zoneProgress={zoneProgress}
              _depth={depth}
              nolights={debugFlags.nolights}
            />

            {/* ============ CAMERA CONTROLLER ============ */}
            {!debugFlags.nocamera && (
              <CameraController
                currentZone={currentZone}
                zoneProgress={zoneProgress}
                reducedMotion={reducedMotion}
                isPaused={isPaused}
                targetPosition={submersiblePosition}
                depth={depth}
              />
            )}

            {/* ============ TERRAIN (seabed, mountains, arches) ============ */}
            {/* Huge 2000x2000 seabed centered at origin, y=-15 */}
            {!debugFlags.noterrain && (
              <Terrain
                zone={currentZone}
                zoneProgress={zoneProgress}
                reducedMotion={reducedMotion}
                isPaused={isPaused}
              />
            )}

            {/* ============ ENVIRONMENT (ocean floor, rocks, silhouettes) ============ */}
            {/* 500x500 floor at y=-15, rocks at radius 25-80, silhouettes at radius 120-200 */}
            {!debugFlags.noenv && (
              <Environment
                zone={currentZone}
                zoneProgress={zoneProgress}
                reducedMotion={reducedMotion}
                isPaused={isPaused}
              />
            )}

            {/* ============ SHIPWRECK - At natural position [-200, -12, 50] ============ */}
            {/* Far in midground - should be visible as silhouette against fog */}
            {!debugFlags.nowreck && (
              <Shipwreck
                zone={currentZone}
                zoneProgress={zoneProgress}
                reducedMotion={reducedMotion}
                isPaused={isPaused}
              />
            )}

            {/* ============ RESEARCH STATION - At natural position [300, -15, -200] ============ */}
            {/* Far background - distant silhouette */}
            {!debugFlags.nowreck && (
              <ResearchStation
                zone={currentZone}
                zoneProgress={zoneProgress}
                reducedMotion={reducedMotion}
                isPaused={isPaused}
              />
            )}

            {/* ============ ROV - Passes near origin naturally ============ */}
            {!debugFlags.nowreck && (
              <ROV
                zone={currentZone}
                zoneProgress={zoneProgress}
                reducedMotion={reducedMotion}
                isPaused={isPaused}
              />
            )}

            {/* ============ PARTICLES (marine snow) ============ */}
            <Particles
              zone={currentZone}
              zoneProgress={zoneProgress}
              reducedMotion={reducedMotion}
              isPaused={isPaused}
            />

            {/* ============ SUBMERSIBLE - Hero at origin, facing camera at 3/4 angle ============ */}
            {/* Rotate slightly so front faces camera at default position */}
            {!debugFlags.nosub && (
              <group rotation={[0, -0.4, 0]}>
                <Submersible
                  zone={currentZone}
                  zoneProgress={zoneProgress}
                  reducedMotion={reducedMotion}
                  isPaused={isPaused}
                />
              </group>
            )}

            {/* ============ SEARCHLIGHT ============ */}
            {!debugFlags.nowreck && (
              <Searchlight
                zone={currentZone}
                zoneProgress={zoneProgress}
                reducedMotion={reducedMotion}
                isPaused={isPaused}
              />
            )}

            {/* ============ MARINE LIFE - Already positioned near origin ============ */}
            {/* SchoolingFish at [0, -5, -10], Jellyfish at radius 15-35 */}
            {!debugFlags.nomarine && (
              <MarineLife
                zone={currentZone}
                zoneProgress={zoneProgress}
                reducedMotion={reducedMotion}
                isPaused={isPaused}
              />
            )}

            {/* ============ MASSIVE CREATURE - At natural position [0, -20, -200] ============ */}
            {/* Far background, only visible in midnight/abyss */}
            {!debugFlags.nomarine && (
              <MassiveCreature
                zone={currentZone}
                zoneProgress={zoneProgress}
                reducedMotion={reducedMotion}
                isPaused={isPaused}
              />
            )}
          </>
        )}
      </Suspense>

      {/* Post-processing - minimal FXAA only for Phase 1 */}
      {!debugFlags.nopost && !debugFlags.cube && (
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <FXAA />
        </EffectComposer>
      )}

      {/* Debug Overlay - only renders when ?debug=true */}
      <DebugStatsCollector enabled={debugEnabled} />
    </Canvas>
  );
}