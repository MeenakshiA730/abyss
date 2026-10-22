/**
 * ABYSS — Unified Zone Configuration
 * Four-zone art direction system with coordinated palettes, lighting, fog, and visibility
 */

export type ZoneId = 'sunlight' | 'twilight' | 'midnight' | 'abyss';

export const ZONE_ORDER: ZoneId[] = ['sunlight', 'twilight', 'midnight', 'abyss'];

export const ZONE_DEPTH_RANGES: Record<ZoneId, [number, number]> = {
  sunlight: [0, 200],
  twilight: [200, 1000],
  midnight: [1000, 4000],
  abyss: [4000, 6000],
};

// ============================================================================
// COLOR PALETTES - Four distinct zones with coherent identity
// ============================================================================

export interface ZoneColors {
  // Water/background colors
  waterColor: string;
  waterColorDeep: string;
  // Fog colors
  fogColor: string;
  fogColorSun: string;
  // Ambient light colors
  ambientColor: string;
  ambientColorGround: string;
  // Main directional light
  sunColor: string;
  sunIntensity: number;
  // Fill/bounce lights
  fillColor: string;
  fillIntensity: number;
  rimColor: string;
  rimIntensity: number;
  // Accent/bioluminescence colors
  accentPrimary: string;
  accentSecondary: string;
  accentTertiary: string;
  // Creature/marine life colors
  creatureGlow: string;
  creatureBody: string;
  // Particle colors
  marineSnowColor: string;
  bioParticleColor: string;
  // UI/Indicator colors
  uiPrimary: string;
  uiSecondary: string;
  uiWarning: string;
  uiDanger: string;
}

export const ZONE_COLORS: Record<ZoneId, ZoneColors> = {
  sunlight: {
    // Bright, clear tropical water - turquoise to blue transition
    waterColor: '#0077aa',
    waterColorDeep: '#005588',
    fogColor: '#4aa8e8',
    fogColorSun: '#88ccee',
    ambientColor: '#88ccff',
    ambientColorGround: '#4a88aa',
    sunColor: '#fff8e8',
    sunIntensity: 1.2,
    fillColor: '#88ddff',
    fillIntensity: 0.4,
    rimColor: '#aaddff',
    rimIntensity: 0.3,
    accentPrimary: '#00ff88',
    accentSecondary: '#44ffaa',
    accentTertiary: '#88ffcc',
    creatureGlow: '#00ff88',
    creatureBody: '#2a6a4a',
    marineSnowColor: '#4aa8e8',
    bioParticleColor: '#00ff88',
    uiPrimary: '#00cc88',
    uiSecondary: '#44ddaa',
    uiWarning: '#ffaa00',
    uiDanger: '#ff4444',
  },
  twilight: {
    // Deepening blue - mysterious, fading light
    waterColor: '#004477',
    waterColorDeep: '#003366',
    fogColor: '#2a6b9e',
    fogColorSun: '#4a8bc8',
    ambientColor: '#4a88aa',
    ambientColorGround: '#2a5a7a',
    sunColor: '#aaccff',
    sunIntensity: 0.6,
    fillColor: '#66aacc',
    fillIntensity: 0.5,
    rimColor: '#88ccff',
    rimIntensity: 0.25,
    accentPrimary: '#00ccaa',
    accentSecondary: '#00aa88',
    accentTertiary: '#008877',
    creatureGlow: '#00ccaa',
    creatureBody: '#1a5a6a',
    marineSnowColor: '#2a6b9e',
    bioParticleColor: '#00ccaa',
    uiPrimary: '#00aa88',
    uiSecondary: '#00ccaa',
    uiWarning: '#ff8800',
    uiDanger: '#ff3333',
  },
  midnight: {
    // Near-total darkness - bioluminescence dominant
    waterColor: '#001a33',
    waterColorDeep: '#001122',
    fogColor: '#003355',
    fogColorSun: '#004466',
    ambientColor: '#004466',
    ambientColorGround: '#002244',
    sunColor: '#446688',
    sunIntensity: 0.15,
    fillColor: '#006688',
    fillIntensity: 0.6,
    rimColor: '#0088aa',
    rimIntensity: 0.2,
    accentPrimary: '#00ffbf',
    accentSecondary: '#00aa88',
    accentTertiary: '#008866',
    creatureGlow: '#00ffbf',
    creatureBody: '#0a3a4a',
    marineSnowColor: '#0088cc',
    bioParticleColor: '#00ffbf',
    uiPrimary: '#00ffbf',
    uiSecondary: '#00ddaa',
    uiWarning: '#ff6600',
    uiDanger: '#ff2222',
  },
  abyss: {
    // Crushing darkness - minimal light, maximal contrast
    waterColor: '#000814',
    waterColorDeep: '#00040a',
    fogColor: '#001a2a',
    fogColorSun: '#002233',
    ambientColor: '#002233',
    ambientColorGround: '#00111a',
    sunColor: '#223344',
    sunIntensity: 0.03,
    fillColor: '#004455',
    fillIntensity: 0.5,
    rimColor: '#005566',
    rimIntensity: 0.15,
    accentPrimary: '#00aa88',
    accentSecondary: '#008866',
    accentTertiary: '#006644',
    creatureGlow: '#00aa88',
    creatureBody: '#082a30',
    marineSnowColor: '#006699',
    bioParticleColor: '#00aa88',
    uiPrimary: '#00aa88',
    uiSecondary: '#008866',
    uiWarning: '#ff4400',
    uiDanger: '#ff0000',
  },
};

// ============================================================================
// FOG CONFIGURATION - Exponential fog per zone for depth perception
// ============================================================================

export interface ZoneFog {
  mode: 'exp' | 'exp2' | 'linear';
  density: number;
  near: number;
  far: number;
  color: string;
}

export const ZONE_FOG: Record<ZoneId, ZoneFog> = {
  sunlight: {
    mode: 'exp',
    density: 0.0008,
    near: 50,
    far: 2000,
    color: '#4aa8e8',
  },
  twilight: {
    mode: 'exp',
    density: 0.0012,
    near: 30,
    far: 1500,
    color: '#2a6b9e',
  },
  midnight: {
    mode: 'exp2',
    density: 0.0018,
    near: 20,
    far: 1000,
    color: '#003355',
  },
  abyss: {
    mode: 'exp2',
    density: 0.0025,
    near: 10,
    far: 600,
    color: '#001a2a',
  },
};

// ============================================================================
// LIGHTING CONFIGURATION - 5-light setup per zone
// ============================================================================

export interface ZoneLighting {
  // Main sun/moon directional
  directional: {
    color: string;
    intensity: number;
    position: [number, number, number];
    castShadow: boolean;
    shadowMapSize: number;
    shadowCameraNear: number;
    shadowCameraFar: number;
    shadowCameraLeft: number;
    shadowCameraRight: number;
    shadowCameraTop: number;
    shadowCameraBottom: number;
    shadowBias: number;
  };
  // Hemisphere/ambient
  hemisphere: {
    skyColor: string;
    groundColor: string;
    intensity: number;
  };
  // Fill light (opposite sun)
  fill: {
    color: string;
    intensity: number;
    position: [number, number, number];
  };
  // Rim/back light
  rim: {
    color: string;
    intensity: number;
    position: [number, number, number];
  };
  // Accent/bioluminescence bounce
  accent: {
    color: string;
    intensity: number;
    position: [number, number, number];
  };
}

export const ZONE_LIGHTING: Record<ZoneId, ZoneLighting> = {
  sunlight: {
    directional: {
      color: '#fff8e8',
      intensity: 1.2,
      position: [100, 200, 50],
      castShadow: true,
      shadowMapSize: 2048,
      shadowCameraNear: 10,
      shadowCameraFar: 500,
      shadowCameraLeft: -100,
      shadowCameraRight: 100,
      shadowCameraTop: 100,
      shadowCameraBottom: -100,
      shadowBias: -0.0005,
    },
    hemisphere: {
      skyColor: '#88ccff',
      groundColor: '#4a88aa',
      intensity: 0.8,
    },
    fill: {
      color: '#88ddff',
      intensity: 0.4,
      position: [-80, 50, -50],
    },
    rim: {
      color: '#aaddff',
      intensity: 0.3,
      position: [0, 100, -100],
    },
    accent: {
      color: '#00ff88',
      intensity: 0.15,
      position: [0, -50, 0],
    },
  },
  twilight: {
    directional: {
      color: '#aaccff',
      intensity: 0.6,
      position: [60, 150, 30],
      castShadow: true,
      shadowMapSize: 2048,
      shadowCameraNear: 10,
      shadowCameraFar: 500,
      shadowCameraLeft: -80,
      shadowCameraRight: 80,
      shadowCameraTop: 80,
      shadowCameraBottom: -80,
      shadowBias: -0.0005,
    },
    hemisphere: {
      skyColor: '#4a88aa',
      groundColor: '#2a5a7a',
      intensity: 0.6,
    },
    fill: {
      color: '#66aacc',
      intensity: 0.5,
      position: [-60, 40, -40],
    },
    rim: {
      color: '#88ccff',
      intensity: 0.25,
      position: [0, 80, -80],
    },
    accent: {
      color: '#00ccaa',
      intensity: 0.2,
      position: [0, -40, 0],
    },
  },
  midnight: {
    directional: {
      color: '#446688',
      intensity: 0.15,
      position: [30, 80, 15],
      castShadow: false,
      shadowMapSize: 1024,
      shadowCameraNear: 5,
      shadowCameraFar: 300,
      shadowCameraLeft: -60,
      shadowCameraRight: 60,
      shadowCameraTop: 60,
      shadowCameraBottom: -60,
      shadowBias: -0.0003,
    },
    hemisphere: {
      skyColor: '#004466',
      groundColor: '#002244',
      intensity: 0.4,
    },
    fill: {
      color: '#006688',
      intensity: 0.6,
      position: [-40, 30, -30],
    },
    rim: {
      color: '#0088aa',
      intensity: 0.2,
      position: [0, 60, -60],
    },
    accent: {
      color: '#00ffbf',
      intensity: 0.3,
      position: [0, -30, 0],
    },
  },
  abyss: {
    directional: {
      color: '#223344',
      intensity: 0.03,
      position: [15, 40, 8],
      castShadow: false,
      shadowMapSize: 1024,
      shadowCameraNear: 5,
      shadowCameraFar: 200,
      shadowCameraLeft: -40,
      shadowCameraRight: 40,
      shadowCameraTop: 40,
      shadowCameraBottom: -40,
      shadowBias: -0.0002,
    },
    hemisphere: {
      skyColor: '#002233',
      groundColor: '#00111a',
      intensity: 0.25,
    },
    fill: {
      color: '#004455',
      intensity: 0.5,
      position: [-20, 20, -20],
    },
    rim: {
      color: '#005566',
      intensity: 0.15,
      position: [0, 40, -40],
    },
    accent: {
      color: '#00aa88',
      intensity: 0.4,
      position: [0, -20, 0],
    },
  },
};

// ============================================================================
// OBJECT VISIBILITY RULES - What exists in each zone
// ============================================================================

export interface ZoneVisibility {
  // Environment
  seabed: boolean;
  seamounts: boolean;
  arches: boolean;
  caves: boolean;
  trenches: boolean;
  thermalVents: boolean;
  // Vegetation
  coral: boolean;
  kelp: boolean;
  sponges: boolean;
  // Marine life
  schoolingFish: boolean;
  jellyfish: boolean;
  bioluminescentOrgs: boolean;
  anglerfish: boolean;
  deepSeaJellyfish: boolean;
  abyssalCreatures: boolean;
  massiveCreature: boolean;
  // Artificial
  rov: boolean;
  shipwreck: boolean;
  researchStation: boolean;
  // Particles
  marineSnowLayers: number;
  bioParticleDensity: number;
  // Searchlight
  searchlightIntensity: number;
  searchlightDistance: number;
}

export const ZONE_VISIBILITY: Record<ZoneId, ZoneVisibility> = {
  sunlight: {
    seabed: true,
    seamounts: true,
    arches: true,
    caves: true,
    trenches: true,
    thermalVents: false,
    coral: true,
    kelp: true,
    sponges: true,
    schoolingFish: true,
    jellyfish: true,
    bioluminescentOrgs: false,
    anglerfish: false,
    deepSeaJellyfish: false,
    abyssalCreatures: false,
    massiveCreature: false,
    rov: true,
    shipwreck: true,
    researchStation: true,
    marineSnowLayers: 3,
    bioParticleDensity: 0.3,
    searchlightIntensity: 0.5,
    searchlightDistance: 40,
  },
  twilight: {
    seabed: true,
    seamounts: true,
    arches: true,
    caves: true,
    trenches: true,
    thermalVents: false,
    coral: true,
    kelp: false,
    sponges: true,
    schoolingFish: true,
    jellyfish: true,
    bioluminescentOrgs: true,
    anglerfish: false,
    deepSeaJellyfish: false,
    abyssalCreatures: false,
    massiveCreature: false,
    rov: true,
    shipwreck: true,
    researchStation: true,
    marineSnowLayers: 3,
    bioParticleDensity: 0.5,
    searchlightIntensity: 1.5,
    searchlightDistance: 60,
  },
  midnight: {
    seabed: true,
    seamounts: true,
    arches: false,
    caves: true,
    trenches: true,
    thermalVents: false,
    coral: true,
    kelp: false,
    sponges: true,
    schoolingFish: false,
    jellyfish: true,
    bioluminescentOrgs: true,
    anglerfish: true,
    deepSeaJellyfish: true,
    abyssalCreatures: false,
    massiveCreature: true,
    rov: true,
    shipwreck: false,
    researchStation: false,
    marineSnowLayers: 3,
    bioParticleDensity: 0.8,
    searchlightIntensity: 3,
    searchlightDistance: 80,
  },
  abyss: {
    seabed: true,
    seamounts: false,
    arches: false,
    caves: false,
    trenches: true,
    thermalVents: true,
    coral: true,
    kelp: false,
    sponges: false,
    schoolingFish: false,
    jellyfish: false,
    bioluminescentOrgs: true,
    anglerfish: true,
    deepSeaJellyfish: true,
    abyssalCreatures: true,
    massiveCreature: true,
    rov: false,
    shipwreck: false,
    researchStation: false,
    marineSnowLayers: 3,
    bioParticleDensity: 1.0,
    searchlightIntensity: 5,
    searchlightDistance: 100,
  },
};

// ============================================================================
// CAMERA CONFIGURATION PER ZONE
// ============================================================================

export interface ZoneCameraConfig {
  offset: [number, number, number];
  lookAtOffset: [number, number, number];
  fov: number;
  near: number;
  far: number;
}

export const ZONE_CAMERA: Record<ZoneId, ZoneCameraConfig> = {
  sunlight: {
    offset: [12, 8, 20],
    lookAtOffset: [0, -2, -5],
    fov: 55,
    near: 0.1,
    far: 5000,
  },
  twilight: {
    offset: [10, 6, 18],
    lookAtOffset: [0, -3, -8],
    fov: 52,
    near: 0.1,
    far: 5000,
  },
  midnight: {
    offset: [8, 4, 15],
    lookAtOffset: [0, -4, -10],
    fov: 48,
    near: 0.1,
    far: 5000,
  },
  abyss: {
    offset: [6, 3, 12],
    lookAtOffset: [0, -5, -12],
    fov: 45,
    near: 0.1,
    far: 5000,
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getZoneAtDepth(depth: number): ZoneId {
  if (depth >= 4000) return 'abyss';
  if (depth >= 1000) return 'midnight';
  if (depth >= 200) return 'twilight';
  return 'sunlight';
}

export function getZoneProgress(depth: number, zone: ZoneId): number {
  const [min, max] = ZONE_DEPTH_RANGES[zone];
  return Math.min(Math.max((depth - min) / (max - min), 0), 1);
}

const THREE_MATH = {
  lerp: (a: number, b: number, t: number) => a + (b - a) * t,
};

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

export function lerpZoneColors(
  zoneA: ZoneId,
  zoneB: ZoneId,
  t: number
): Partial<ZoneColors> {
  const colorsA = ZONE_COLORS[zoneA];
  const colorsB = ZONE_COLORS[zoneB];
  const result: Record<string, string | number> = {};

  for (const key of Object.keys(colorsA) as Array<keyof ZoneColors>) {
    const colorA = colorsA[key];
    const colorB = colorsB[key];
    if (typeof colorA === 'string' && typeof colorB === 'string' && colorA.startsWith('#') && colorB.startsWith('#')) {
      result[key] = lerpHexColor(colorA, colorB, t);
    } else if (typeof colorA === 'number' && typeof colorB === 'number') {
      result[key] = THREE_MATH.lerp(colorA, colorB, t);
    }
  }
  return result as Partial<ZoneColors>;
}

export function getInterpolatedLighting(
  currentZone: ZoneId,
  zoneProgress: number
): ZoneLighting {
  const currentIndex = ZONE_ORDER.indexOf(currentZone);
  if (currentIndex === ZONE_ORDER.length - 1 || zoneProgress <= 0) {
    return ZONE_LIGHTING[currentZone];
  }

  const nextZone = ZONE_ORDER[currentIndex + 1];
  const current = ZONE_LIGHTING[currentZone];
  const next = ZONE_LIGHTING[nextZone];

  return {
    directional: {
      color: lerpHexColor(current.directional.color, next.directional.color, zoneProgress),
      intensity: THREE_MATH.lerp(current.directional.intensity, next.directional.intensity, zoneProgress),
      position: [
        THREE_MATH.lerp(current.directional.position[0], next.directional.position[0], zoneProgress),
        THREE_MATH.lerp(current.directional.position[1], next.directional.position[1], zoneProgress),
        THREE_MATH.lerp(current.directional.position[2], next.directional.position[2], zoneProgress),
      ] as [number, number, number],
      castShadow: current.directional.castShadow,
      shadowMapSize: current.directional.shadowMapSize,
      shadowCameraNear: current.directional.shadowCameraNear,
      shadowCameraFar: current.directional.shadowCameraFar,
      shadowCameraLeft: current.directional.shadowCameraLeft,
      shadowCameraRight: current.directional.shadowCameraRight,
      shadowCameraTop: current.directional.shadowCameraTop,
      shadowCameraBottom: current.directional.shadowCameraBottom,
      shadowBias: current.directional.shadowBias,
    },
    hemisphere: {
      skyColor: lerpHexColor(current.hemisphere.skyColor, next.hemisphere.skyColor, zoneProgress),
      groundColor: lerpHexColor(current.hemisphere.groundColor, next.hemisphere.groundColor, zoneProgress),
      intensity: THREE_MATH.lerp(current.hemisphere.intensity, next.hemisphere.intensity, zoneProgress),
    },
    fill: {
      color: lerpHexColor(current.fill.color, next.fill.color, zoneProgress),
      intensity: THREE_MATH.lerp(current.fill.intensity, next.fill.intensity, zoneProgress),
      position: [
        THREE_MATH.lerp(current.fill.position[0], next.fill.position[0], zoneProgress),
        THREE_MATH.lerp(current.fill.position[1], next.fill.position[1], zoneProgress),
        THREE_MATH.lerp(current.fill.position[2], next.fill.position[2], zoneProgress),
      ] as [number, number, number],
    },
    rim: {
      color: lerpHexColor(current.rim.color, next.rim.color, zoneProgress),
      intensity: THREE_MATH.lerp(current.rim.intensity, next.rim.intensity, zoneProgress),
      position: [
        THREE_MATH.lerp(current.rim.position[0], next.rim.position[0], zoneProgress),
        THREE_MATH.lerp(current.rim.position[1], next.rim.position[1], zoneProgress),
        THREE_MATH.lerp(current.rim.position[2], next.rim.position[2], zoneProgress),
      ] as [number, number, number],
    },
    accent: {
      color: lerpHexColor(current.accent.color, next.accent.color, zoneProgress),
      intensity: THREE_MATH.lerp(current.accent.intensity, next.accent.intensity, zoneProgress),
      position: [
        THREE_MATH.lerp(current.accent.position[0], next.accent.position[0], zoneProgress),
        THREE_MATH.lerp(current.accent.position[1], next.accent.position[1], zoneProgress),
        THREE_MATH.lerp(current.accent.position[2], next.accent.position[2], zoneProgress),
      ] as [number, number, number],
    },
  };
}

export function getInterpolatedFog(
  currentZone: ZoneId,
  zoneProgress: number
): ZoneFog {
  const currentIndex = ZONE_ORDER.indexOf(currentZone);
  if (currentIndex === ZONE_ORDER.length - 1 || zoneProgress <= 0) {
    return ZONE_FOG[currentZone];
  }

  const nextZone = ZONE_ORDER[currentIndex + 1];
  const current = ZONE_FOG[currentZone];
  const next = ZONE_FOG[nextZone];

  return {
    mode: zoneProgress < 0.5 ? current.mode : next.mode,
    density: THREE_MATH.lerp(current.density, next.density, zoneProgress),
    near: THREE_MATH.lerp(current.near, next.near, zoneProgress),
    far: THREE_MATH.lerp(current.far, next.far, zoneProgress),
    color: lerpHexColor(current.color, next.color, zoneProgress),
  };
}