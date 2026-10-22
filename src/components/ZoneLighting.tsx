/**
 * ABYSS — Cinematic Zone-Aware Lighting & Atmosphere
 * Volumetric fog, layered lighting, caustics, god rays, and smooth zone transitions
 * Uses unified zone configuration from @/config/zones
 */

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { ZoneId } from '@/config/zones';
import { ZONE_ORDER, ZONE_COLORS, getInterpolatedLighting, getInterpolatedFog } from '@/config/zones';
import { useDebugFlag } from './DebugOverlay';

// ZoneLighting render counter (dev only)
function ZoneLightingRenderCounter({ enabled }: { enabled: boolean }) {
  const renderRef = useRef(0);
  if (enabled) {
    renderRef.current += 1;
    if (renderRef.current % 60 === 1) {
      console.log(`[ABYSS-DEBUG] ZoneLighting render #${renderRef.current}`);
    }
  }
  return null;
}

interface ZoneLightingProps {
  zone: ZoneId;
  zoneProgress: number;
  _depth: number;
  nolights?: boolean;
}

export function ZoneLighting({ zone, zoneProgress, nolights = false }: ZoneLightingProps) {
  const { camera } = useThree();
  const interpolatedLighting = useMemo(() => getInterpolatedLighting(zone, zoneProgress), [zone, zoneProgress]);
  const interpolatedFog = useMemo(() => getInterpolatedFog(zone, zoneProgress), [zone, zoneProgress]);
  const currentColors = ZONE_COLORS[zone];
  const debugEnabled = useDebugFlag();

  // When nolights is true, render minimal lighting (background + one ambient)
  if (nolights) {
    const bgColor = useMemo(() => {
      const currentIndex = ZONE_ORDER.indexOf(zone);
      if (currentIndex === ZONE_ORDER.length - 1 || zoneProgress <= 0) {
        return currentColors.waterColorDeep;
      }
      const nextZone = ZONE_ORDER[currentIndex + 1];
      const nextColors = ZONE_COLORS[nextZone];
      return lerpHexColor(currentColors.waterColorDeep, nextColors.waterColorDeep, zoneProgress * 0.3);
    }, [zone, zoneProgress, currentColors]);

    return (
      <>
        <ZoneLightingRenderCounter enabled={debugEnabled} />
        <color attach="background" args={[bgColor]} />
        <ambientLight color="#ffffff" intensity={0.5} />
      </>
    );
  }

  // Refs for volumetric effects
  const fogMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const causticsRef = useRef<THREE.Texture | null>(null);
  const timeRef = useRef(0);
  const sunTargetRef = useRef<THREE.Object3D>(new THREE.Object3D());

  // Background color - use water color from zone config
  const bgColor = useMemo(() => {
    const currentIndex = ZONE_ORDER.indexOf(zone);
    if (currentIndex === ZONE_ORDER.length - 1 || zoneProgress <= 0) {
      return currentColors.waterColorDeep;
    }
    const nextZone = ZONE_ORDER[currentIndex + 1];
    const nextColors = ZONE_COLORS[nextZone];
    return lerpHexColor(currentColors.waterColorDeep, nextColors.waterColorDeep, zoneProgress * 0.3);
  }, [zone, zoneProgress, currentColors]);

  // Create caustics texture procedurally
  useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Generate organic caustic pattern
    const imageData = ctx.createImageData(512, 512);
    const data = imageData.data;

    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const nx = x / 512;
        const ny = y / 512;

        // Multiple octaves of noise for caustic patterns
        let v = 0;
        v += Math.sin(nx * 40 + ny * 30) * 0.5;
        v += Math.sin(nx * 80 - ny * 60 + Math.sin(nx * 20) * 5) * 0.25;
        v += Math.sin(nx * 160 + ny * 120 + Math.cos(ny * 40) * 3) * 0.125;
        v += Math.sin(nx * 320 - ny * 240) * 0.0625;

        // Sharpen for caustic look
        v = Math.pow(Math.max(0, v), 2.5);

        const idx = (y * 512 + x) * 4;
        const val = Math.floor(v * 255);
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    causticsRef.current = texture;
  }, []);

  // Volumetric fog shader material for full-screen quad
  useMemo(() => {
    fogMaterialRef.current = new THREE.ShaderMaterial({
      uniforms: {
        uFogColor: { value: new THREE.Color(interpolatedFog.color) },
        uFogDensity: { value: interpolatedFog.density },
        uFogNear: { value: interpolatedFog.near },
        uFogFar: { value: interpolatedFog.far },
        uCameraPos: { value: new THREE.Vector3() },
        uTime: { value: 0 },
        uSunDirection: { value: new THREE.Vector3().fromArray(interpolatedLighting.directional.position).normalize() },
        uSunColor: { value: new THREE.Color(interpolatedLighting.directional.color) },
        uSunIntensity: { value: interpolatedLighting.directional.intensity },
        uZoneProgress: { value: zoneProgress },
        uZone: { value: ZONE_ORDER.indexOf(zone) },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        varying vec3 vViewDir;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          vViewDir = normalize(cameraPosition - worldPos.xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uFogColor;
        uniform float uFogDensity;
        uniform float uFogNear;
        uniform float uFogFar;
        uniform vec3 uCameraPos;
        uniform float uTime;
        uniform vec3 uSunDirection;
        uniform vec3 uSunColor;
        uniform float uSunIntensity;
        uniform float uZoneProgress;
        uniform float uZone;

        varying vec3 vWorldPosition;
        varying vec3 vViewDir;

        // Volumetric fog with height-based density and light scattering
        float fogFactor(vec3 pos, vec3 cameraPos) {
          float dist = length(pos - cameraPos);
          if (dist < uFogNear) return 0.0;

          // Height-based density (denser near seabed)
          float heightFactor = 1.0 - smoothstep(-100.0, 50.0, pos.y);
          float density = uFogDensity * (0.5 + heightFactor * 0.5);

          // Exponential fog
          float fog = 1.0 - exp(-density * density * dist * dist * 0.0001);
          return clamp(fog, 0.0, 1.0);
        }

        // Mie scattering for god rays
        float mieScattering(vec3 viewDir, vec3 lightDir, float fog) {
          float cosTheta = dot(viewDir, lightDir);
          float g = 0.8; // Mie asymmetry parameter
          float phase = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * cosTheta, 1.5);
          return phase * fog * 0.15;
        }

        // Rayleigh scattering
        float rayleighScattering(vec3 viewDir, vec3 lightDir, float fog) {
          float cosTheta = dot(viewDir, lightDir);
          float phase = 0.75 * (1.0 + cosTheta * cosTheta);
          return phase * fog * 0.05;
        }

        void main() {
          float fog = fogFactor(vWorldPosition, uCameraPos);

          // Base fog color
          vec3 color = uFogColor;

          // Light scattering (god rays / crepuscular rays)
          float mie = mieScattering(vViewDir, uSunDirection, fog);
          float rayleigh = rayleighScattering(vViewDir, uSunDirection, fog);

          color += uSunColor * (mie + rayleigh) * uSunIntensity;

          // Deep zone bioluminescence glow near seabed
          if (uZone >= 2.0) { // midnight/abyss
            float depthGlow = smoothstep(-50.0, -10.0, vWorldPosition.y) * (1.0 - fog);
            vec3 bioGlow = vec3(0.0, 0.7, 0.5) * depthGlow * 0.1 * uZoneProgress;
            color += bioGlow;
          }

          // Subtle static noise for atmospheric variation (no time variation to prevent flicker)
          float noise = sin(vWorldPosition.x * 0.01) *
                       sin(vWorldPosition.z * 0.01) * 0.01;
          color += vec3(noise);

          gl_FragColor = vec4(color, fog);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
    });
  }, []);

  // Update fog uniforms every frame (diagnostic: removed 10Hz throttle to test for scene-wide blinking)
  useFrame((_, delta) => {
    timeRef.current += delta;
    if (fogMaterialRef.current) {
      fogMaterialRef.current.uniforms.uTime.value = timeRef.current;
      fogMaterialRef.current.uniforms.uCameraPos.value.copy(camera.position);
      fogMaterialRef.current.uniforms.uSunDirection.value
        .fromArray(interpolatedLighting.directional.position)
        .normalize();
      fogMaterialRef.current.uniforms.uSunColor.value.set(interpolatedLighting.directional.color);
      fogMaterialRef.current.uniforms.uSunIntensity.value = interpolatedLighting.directional.intensity;
      fogMaterialRef.current.uniforms.uFogColor.value.set(interpolatedFog.color);
      fogMaterialRef.current.uniforms.uFogDensity.value = interpolatedFog.density;
      fogMaterialRef.current.uniforms.uZoneProgress.value = zoneProgress;
      fogMaterialRef.current.uniforms.uZone.value = ZONE_ORDER.indexOf(zone);
    }
  });

  return (
    <>
      {/* ZoneLighting render counter (dev only) */}
      <ZoneLightingRenderCounter enabled={debugEnabled} />
      {/* Background */}
      <color attach="background" args={[bgColor]} />

      {/* Standard Three.js fog as fallback */}
      <fog attach="fog" args={[interpolatedFog.color, interpolatedFog.near, interpolatedFog.far]} />

      {/* Volumetric Fog Mesh - large sphere around camera (DISABLED for diagnostic) */}
      {/* <mesh geometry={new THREE.SphereGeometry(1000, 32, 16)} material={fogMaterialRef.current!}
            position={[0, 0, 0]} renderOrder={0} /> */}

      {/* Caustics projector - projects animated caustics onto seabed */}
      <directionalLight
        position={interpolatedLighting.directional.position}
        color={interpolatedLighting.directional.color}
        intensity={interpolatedLighting.directional.intensity * 0.3}
        castShadow={false}
      >
        <spotLight
          position={[0, 200, 0]}
          target={sunTargetRef.current}
          color={interpolatedLighting.directional.color}
          intensity={interpolatedLighting.directional.intensity * 0.5}
          angle={Math.PI / 3}
          penumbra={0.5}
          decay={2}
          distance={500}
          map={causticsRef.current}
        />
      </directionalLight>

      {/* Ambient & Hemisphere Lights */}
      <ambientLight color={interpolatedLighting.hemisphere.groundColor}
                    intensity={interpolatedLighting.hemisphere.intensity * 0.4} />
      <hemisphereLight
        color={interpolatedLighting.hemisphere.skyColor}
        groundColor={interpolatedLighting.hemisphere.groundColor}
        intensity={interpolatedLighting.hemisphere.intensity}
      />

      {/* Main Directional Light (Sun/Moon) with shadows */}
      <directionalLight
        position={interpolatedLighting.directional.position}
        color={interpolatedLighting.directional.color}
        intensity={interpolatedLighting.directional.intensity}
        castShadow={interpolatedLighting.directional.castShadow}
      />

      {/* Fill Light */}
      <directionalLight
        position={interpolatedLighting.fill.position}
        color={interpolatedLighting.fill.color}
        intensity={interpolatedLighting.fill.intensity}
        castShadow={false}
      />

      {/* Rim/Back Light */}
      <directionalLight
        position={interpolatedLighting.rim.position}
        color={interpolatedLighting.rim.color}
        intensity={interpolatedLighting.rim.intensity}
        castShadow={false}
      />

      {/* Accent/Bioluminescence Bounce Light */}
      <directionalLight
        position={interpolatedLighting.accent.position}
        color={interpolatedLighting.accent.color}
        intensity={interpolatedLighting.accent.intensity}
        castShadow={false}
      />

      {/* Subtle point lights for bioluminescence in deep zones */}
      {zone === 'midnight' || zone === 'abyss' ? (
        <>
          <pointLight
            position={[0, -30, 0]}
            color={currentColors.creatureGlow}
            intensity={interpolatedLighting.accent.intensity * 2}
            distance={100}
            decay={2}
          />
          <pointLight
            position={[50, -40, -50]}
            color={currentColors.accentSecondary}
            intensity={interpolatedLighting.accent.intensity}
            distance={80}
            decay={2}
          />
          <pointLight
            position={[-50, -35, 50]}
            color={currentColors.accentTertiary}
            intensity={interpolatedLighting.accent.intensity * 0.8}
            distance={80}
            decay={2}
          />
        </>
      ) : null}
    </>
  );
}

function lerpHexColor(colorA: string, colorB: string, t: number): string {
  const rA = parseInt(colorA.slice(1, 3), 16);
  const gA = parseInt(colorA.slice(3, 5), 16);
  const bA = parseInt(colorA.slice(5, 7), 16);
  const rB = parseInt(colorB.slice(1, 3), 16);
  const gB = parseInt(colorB.slice(3, 5), 16);
  const bB = parseInt(colorB.slice(5, 7), 16);

  const r = Math.round(rA + (rB - rA) * t);
  const g = Math.round(gA + (gB - gA) * t);
  const b = Math.round(bA + (bB - bA) * t);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}