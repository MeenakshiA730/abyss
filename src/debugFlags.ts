/**
 * ABYSS — Debug Flags
 * URL query parameter flags for bisecting rendering issues.
 * Read once at startup, no runtime reactivity.
 * With no flags, app behaves exactly as before.
 */

export interface DebugFlags {
  nopost: boolean;       // Disable EffectComposer/FXAA entirely
  noenv: boolean;        // Disable Environment component (HDR/env map)
  nolights: boolean;     // Disable ZoneLighting lights (keep one ambient)
  noterrain: boolean;    // Disable Terrain
  nomarine: boolean;     // Disable MarineLife
  nosub: boolean;        // Disable Submersible
  nowreck: boolean;      // Disable Shipwreck/ResearchStation/ROV
  noshadows: boolean;    // Disable shadows on renderer and all lights
  dpr: boolean;          // Force DPR to 1
  noaa: boolean;         // Disable antialias
  cube: boolean;         // Render ONLY a single rotating cube (baseline)
  nocamera: boolean;     // Disable CameraController (static camera)
  frozen: boolean;       // Disable ALL useFrame animations in scene components
}

/**
 * Parse debug flags from URL search params.
 * Call ONCE at app startup.
 */
export function parseDebugFlags(): DebugFlags {
  if (typeof window === 'undefined') {
    return defaultFlags();
  }

  const params = new URLSearchParams(window.location.search);
  const flags: DebugFlags = {
    nopost: params.get('nopost') === '1',
    noenv: params.get('noenv') === '1',
    nolights: params.get('nolights') === '1',
    noterrain: params.get('noterrain') === '1',
    nomarine: params.get('nomarine') === '1',
    nosub: params.get('nosub') === '1',
    nowreck: params.get('nowreck') === '1',
    noshadows: params.get('noshadows') === '1',
    dpr: params.get('dpr') === '1',
    noaa: params.get('noaa') === '1',
    cube: params.get('cube') === '1',
    nocamera: params.get('nocamera') === '1',
    frozen: params.get('frozen') === '1',
  };

  // Log active flags at startup
  const active = Object.entries(flags)
    .filter(([, v]) => v)
    .map(([k]) => k);
  if (active.length > 0) {
    console.log(`[ABYSS-DEBUG] Active flags: ${active.join(', ')}`);
  }

  return flags;
}

function defaultFlags(): DebugFlags {
  return {
    nopost: false,
    noenv: false,
    nolights: false,
    noterrain: false,
    nomarine: false,
    nosub: false,
    nowreck: false,
    noshadows: false,
    dpr: false,
    noaa: false,
    cube: false,
    nocamera: false,
    frozen: false,
  };
}

/**
 * Singleton accessor — parse once, reuse everywhere.
 */
let cachedFlags: DebugFlags | null = null;

export function getDebugFlags(): DebugFlags {
  if (!cachedFlags) {
    cachedFlags = parseDebugFlags();
  }
  return cachedFlags;
}