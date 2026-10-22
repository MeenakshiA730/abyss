/**
 * ABYSS — Debug Flags
 * Only the ?debug flag remains for the dev overlay.
 * All bisect flags removed after root cause fixed.
 */

export interface DebugFlags {
  debug: boolean; // Enables dev overlay (FPS, gl.info, Canvas mount counter)
}

/**
 * Parse debug flag from URL search params.
 * Call ONCE at app startup.
 */
export function parseDebugFlags(): DebugFlags {
  if (typeof window === 'undefined') {
    return { debug: false };
  }

  const params = new URLSearchParams(window.location.search);
  return {
    debug: params.get('debug') === 'true' || params.get('debug') === '1',
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