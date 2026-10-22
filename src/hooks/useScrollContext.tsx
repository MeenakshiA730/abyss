/**
 * ABYSS — Scroll Context
 * Provides per-frame scroll/depth/zone refs to components that need them
 * without triggering React re-renders
 */

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

const MAX_SCROLL_HEIGHT = 20000;
const MAX_DEPTH = 6000;

const ZONE_BOUNDARIES = [
  { id: 'sunlight', minDepth: 0, maxDepth: 200 },
  { id: 'twilight', minDepth: 200, maxDepth: 1000 },
  { id: 'midnight', minDepth: 1000, maxDepth: 4000 },
  { id: 'abyss', minDepth: 4000, maxDepth: 6000 },
] as const;

type ZoneId = 'sunlight' | 'twilight' | 'midnight' | 'abyss';

interface ScrollRefs {
  scrollY: number;
  scrollProgress: number;
  depth: number;
  currentZone: ZoneId;
  zoneProgress: number;
  direction: 'up' | 'down' | 'none';
  velocity: number;
}

interface ScrollContextValue {
  refs: ScrollRefs;
  // Stable React state (only updates on zone change)
  state: {
    currentZone: ZoneId;
    zoneProgress: number;
    depth: number;
  };
}

const ScrollContext = createContext<ScrollContextValue | null>(null);

export function ScrollProvider({ children }: { children: ReactNode }) {
  // Refs for per-frame values (updated every rAF, NO re-render)
  const refs = useRef<ScrollRefs>({
    scrollY: 0,
    scrollProgress: 0,
    depth: 0,
    currentZone: 'sunlight',
    zoneProgress: 0,
    direction: 'none',
    velocity: 0,
  });

  // React state - ONLY updates when zone changes
  const [state, setState] = useState({
    currentZone: 'sunlight' as ZoneId,
    zoneProgress: 0,
    depth: 0,
  });

  const currentZoneRef = useRef<ZoneId>('sunlight');

  function getZoneFromDepth(depth: number): { zone: ZoneId; progress: number } {
    for (const z of ZONE_BOUNDARIES) {
      if (depth >= z.minDepth && depth < z.maxDepth) {
        const progress = (depth - z.minDepth) / (z.maxDepth - z.minDepth);
        return { zone: z.id, progress: Math.min(Math.max(progress, 0), 1) };
      }
    }
    return { zone: 'abyss', progress: 1 };
  }

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let lastTime = performance.now();
    let rafId: number;

    const updateState = () => {
      const scrollY = window.scrollY;
      const now = performance.now();
      const deltaTime = now - lastTime;
      const deltaY = scrollY - lastScrollY;

      const scrollProgress = Math.min(Math.max(scrollY / MAX_SCROLL_HEIGHT, 0), 1);
      const depth = scrollProgress * MAX_DEPTH;

      const { zone, progress } = getZoneFromDepth(depth);

      const velocity = deltaTime > 0 ? (deltaY / deltaTime) * 1000 : 0;
      const direction = deltaY > 1 ? 'down' : deltaY < -1 ? 'up' : 'none';

      // Update refs every frame (no React re-render)
      refs.current = {
        scrollY,
        scrollProgress,
        depth,
        currentZone: zone,
        zoneProgress: progress,
        direction,
        velocity,
      };

      // ONLY trigger React re-render if zone actually changed
      if (zone !== currentZoneRef.current) {
        currentZoneRef.current = zone;
        setState({
          currentZone: zone,
          zoneProgress: progress,
          depth,
        });
      }

      lastScrollY = scrollY;
      lastTime = now;
      rafId = requestAnimationFrame(updateState);
    };

    rafId = requestAnimationFrame(updateState);
    window.addEventListener('scroll', () => {}, { passive: true });

    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <ScrollContext.Provider value={{ refs: refs.current, state }}>
      {children}
    </ScrollContext.Provider>
  );
}

export function useScroll() {
  const context = useContext(ScrollContext);
  if (!context) {
    throw new Error('useScroll must be used within ScrollProvider');
  }
  // Return the stable state (only updates on zone change)
  return {
    scrollY: context.refs.scrollY,
    scrollProgress: context.refs.scrollProgress,
    depth: context.refs.depth,
    currentZone: context.state.currentZone,
    zoneProgress: context.state.zoneProgress,
    direction: context.refs.direction,
    velocity: context.refs.velocity,
  };
}

// For components that need per-frame values WITHOUT re-rendering
// Use this inside useFrame: const refs = useScrollRefs(); refs.current.depth
export function useScrollRefs() {
  const context = useContext(ScrollContext);
  if (!context) {
    throw new Error('useScrollRefs must be used within ScrollProvider');
  }
  return context.refs;
}

export function useScrollTo() {
  const scrollToDepth = (depth: number) => {
    const progress = Math.min(Math.max(depth / MAX_DEPTH, 0), 1);
    const targetY = progress * MAX_SCROLL_HEIGHT;
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  };

  const scrollToZone = (zoneId: string) => {
    const zones: Record<string, number> = {
      sunlight: 0,
      twilight: 200,
      midnight: 1000,
      abyss: 4000,
    };
    const depth = zones[zoneId] ?? 0;
    scrollToDepth(depth);
  };

  return { scrollToDepth, scrollToZone };
}