/**
 * ABYSS — Main Application
 * Deep ocean exploration experience with scroll-driven descent
 */

import React, { useEffect, useRef, useState, useCallback, createContext, useContext } from 'react';
import { motion, useTransform, useSpring, useMotionValue, AnimatePresence } from 'motion/react';
import { AbyssCanvas } from './components/AbyssCanvas';
import { useScroll, useScrollTo, useScrollRefs, ScrollProvider } from './hooks/useScrollContext';
import { useReducedMotion } from './hooks/useReducedMotion';
import { creatures, getCreatureById, type Creature } from './data/creatures';
import { getZoneById } from './data/zones';
import type { ZoneId } from './components/CameraController';
import { DebugStatsDisplay, useDebugFlag } from './components/DebugOverlay';
import './styles/design-system.css';
import './App.css';

// ============================================
// Error Boundary
// ============================================

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ABYSS] Error Boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: '#0a0a12',
          color: '#00ffff',
          padding: '24px',
          fontFamily: 'monospace',
          zIndex: 10000,
          overflow: 'auto',
        }}>
          <h2 style={{ marginTop: 0 }}>Application Error</h2>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {this.state.error?.message}
            {this.state.error?.stack && '\n\n' + this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

interface PauseContextValue {
  isPaused: boolean;
  reducedMotion: boolean;
}

const PauseContext = createContext<PauseContextValue>({
  isPaused: false,
  reducedMotion: false,
});

export function usePause() {
  return useContext(PauseContext);
}

// ============================================
// Types & Constants
// ============================================

const ZONE_ORDER = ['sunlight', 'twilight', 'midnight', 'abyss'] as const;

// ============================================
// Utility Functions
// ============================================

const formatDepth = (meters: number): string => {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
};

const formatPressure = (depth: number): string => {
  const pressure = 1 + depth / 10.33;
  return `${pressure.toFixed(1)} atm`;
};

const formatTemperature = (depth: number): string => {
  if (depth < 200) return `${(20 - depth * 0.05).toFixed(1)}°C`;
  if (depth < 1000) return `${(10 - (depth - 200) * 0.01).toFixed(1)}°C`;
  return `${(2 - (depth - 1000) * 0.0005).toFixed(1)}°C`;
};

const formatOxygen = (depth: number): string => {
  const maxDepth = 6000;
  const percent = Math.max(100 - (depth / maxDepth) * 60, 15);
  return `${Math.round(percent)}%`;
};

const formatSignal = (depth: number): string => {
  if (depth < 200) return 'STRONG';
  if (depth < 1000) return 'GOOD';
  if (depth < 4000) return 'WEAK';
  return 'CRITICAL';
};

function SignalPill({ depth, reducedMotion }: { depth: number; reducedMotion: boolean }) {
  const signal = formatSignal(depth);
  const signalColors: Record<string, { bg: string; text: string }> = {
    STRONG: { bg: 'rgba(0, 255, 191, 0.15)', text: '#00ffbf' },
    GOOD: { bg: 'rgba(0, 212, 255, 0.15)', text: '#00d4ff' },
    WEAK: { bg: 'rgba(204, 119, 0, 0.15)', text: '#cc7700' },
    CRITICAL: { bg: 'rgba(204, 0, 0, 0.15)', text: '#ff4444' },
  };
  const colors = signalColors[signal] || signalColors.STRONG;

  return (
    <motion.span
      className="signal-pill"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.3, delay: 0.5 }}
      style={{
        background: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.text}40`,
      } as React.CSSProperties}
    >
      {signal}
    </motion.span>
  );
}

// ============================================
// UI Components
// ============================================

function Wordmark({ className = '' }: { className?: string }) {
  return (
    <motion.div
      className={`wordmark ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
    >
      <span className="wordmark-text" data-text="ABYSS">ABYSS</span>
      <span className="wordmark-divider" />
      <span className="wordmark-sub">INTO THE UNKNOWN</span>
    </motion.div>
  );
}

function ZoneNavigation({
  currentZone,
  onZoneClick,
  reducedMotion
}: {
  currentZone: string;
  onZoneClick: (zone: string) => void;
  reducedMotion: boolean;
}) {
  return (
    <nav className="zone-nav" aria-label="Ocean zones">
      <ul className="zone-list">
        {ZONE_ORDER.map((zoneId, index) => {
          const zone = getZoneById(zoneId)!;
          const isActive = currentZone === zoneId;
          const accentColor = zone.lightColor || '#00ffff';
          return (
            <li key={zoneId}>
              <motion.button
                className={`zone-btn ${isActive ? 'active' : ''}`}
                onClick={() => onZoneClick(zoneId)}
                initial={false}
                animate={{
                  opacity: isActive ? 1 : 0.5,
                  x: isActive ? 8 : 0,
                }}
                transition={reducedMotion ? { duration: 0 } : { duration: 0.3, ease: 'easeOut' }}
                style={{ '--accent-color': accentColor } as React.CSSProperties}
                aria-current={isActive ? 'location' : undefined}
              >
                <span className="zone-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="zone-name">{zone.shortName}</span>
                <span className="zone-depth">{zone.depthRange.min}–{zone.depthRange.max}m</span>
                <motion.div
                  className="zone-indicator"
                  initial={false}
                  animate={{ scaleX: isActive ? 1 : 0 }}
                  transition={reducedMotion ? { duration: 0 } : { duration: 0.4, ease: 'easeOut' }}
                />
              </motion.button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function HeroTitle({
  scrollProgress,
  scrollY = 0
}: {
  scrollProgress: number;
  scrollY?: number;
}) {
  const progressValue = useMotionValue(scrollProgress);
  const titleOpacity = useTransform(progressValue, [0, 0.15, 0.3], [1, 1, 0]);
  const taglineOpacity = useTransform(progressValue, [0, 0.1, 0.25], [0, 1, 0]);
  const titleY = useTransform(progressValue, [0, 0.3], [0, -100]);
  const titleScale = useTransform(progressValue, [0, 0.3], [1, 0.8]);

  // Update the motion value when scrollProgress changes
  useEffect(() => {
    progressValue.set(scrollProgress);
  }, [scrollProgress, progressValue]);

  // Unmount hero title once scrollY > 50
  if (scrollY > 50) return null;

  return (
    <div className="hero-content">
      <motion.h1
        className="hero-title"
        style={{ opacity: titleOpacity, y: titleY, scale: titleScale } as unknown as React.CSSProperties}
        aria-level={1}
      >
        ABYSS
      </motion.h1>

      <motion.p
        className="hero-tagline"
        style={{ opacity: taglineOpacity } as unknown as React.CSSProperties}
        aria-live="polite"
      >
        THE DEEP DOESN&apos;T WANT TO BE FOUND
      </motion.p>
    </div>
  );
}

export function DepthReadout({ depth, reducedMotion }: { depth: number; reducedMotion: boolean }) {
  const depthValue = useMotionValue(depth);
  const displayDepth = useSpring(depthValue, {
    stiffness: 100,
    damping: 20,
    restDelta: 0.1,
  });

  useEffect(() => {
    depthValue.set(depth);
  }, [depth, depthValue]);

  const formattedDepth = formatDepth(depth);
  const [value, unit] = formattedDepth.includes('km')
    ? [formattedDepth.replace(' km', ''), 'KM']
    : [formattedDepth.replace(' m', ''), 'M'];

  return (
    <div className="depth-readout" aria-live="polite" aria-label={`Current depth: ${formattedDepth}`}>
      <span className="depth-label">DEPTH</span>
      <motion.span
        className="depth-value"
        style={{ x: displayDepth } as unknown as React.CSSProperties}
        transition={reducedMotion ? { duration: 0 } : { stiffness: 100, damping: 20 }}
      >
        {value}
      </motion.span>
      <span className="depth-unit">{unit}</span>
    </div>
  );
}

function Coordinates({ depth }: { depth: number }) {
  const lat = 12.3456 + depth * 0.0001;
  const lon = -156.789 + depth * 0.00005;

  return (
    <div className="coordinates" aria-label="Expedition coordinates">
      <div className="coord-row">
        <span className="coord-label">LAT</span>
        <span className="coord-value">{lat.toFixed(4)}° N</span>
      </div>
      <div className="coord-row">
        <span className="coord-label">LON</span>
        <span className="coord-value">{Math.abs(lon).toFixed(4)}° W</span>
      </div>
      <div className="coord-row">
        <span className="coord-label">MISSION</span>
        <span className="coord-value mission-status">DESCENT ACTIVE</span>
      </div>
    </div>
  );
}

function DescendButton({
  onClick,
  scrollProgress,
  reducedMotion
}: {
  onClick: () => void;
  scrollProgress: number;
  reducedMotion: boolean;
}) {
  const progressValue = useMotionValue(scrollProgress);
  const buttonOpacity = useTransform(progressValue, [0, 0.05, 0.4], [0, 1, 0]);
  const buttonY = useTransform(progressValue, [0, 0.4], [0, 50]);

  useEffect(() => {
    progressValue.set(scrollProgress);
  }, [scrollProgress, progressValue]);

  return (
    <motion.button
      className="descend-btn btn btn-primary"
      onClick={onClick}
      initial={false}
      style={{ opacity: buttonOpacity, y: buttonY } as unknown as React.CSSProperties}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.3 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      aria-label="Begin descent into the abyss"
    >
      <span className="btn-text">DESCEND</span>
      <motion.svg
        className="btn-arrow"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        animate={{ y: [0, 4, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <path d="M12 5v14M19 12l-7 7-7-7" />
      </motion.svg>
    </motion.button>
  );
}

function ScrollIndicator({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <motion.div
      className="scroll-indicator"
      animate={{ opacity: [0, 1, 0] }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      style={{ transitionDuration: reducedMotion ? '0s' : undefined }}
      aria-hidden="true"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 5v14M19 12l-7 7-7-7" />
      </svg>
      <span>SCROLL TO DESCEND</span>
    </motion.div>
  );
}

function ZoneTitleOverlay({
  currentZone,
  zoneProgress,
  reducedMotion
}: {
  currentZone: string;
  zoneProgress: number;
  reducedMotion: boolean;
}) {
  const zone = getZoneById(currentZone)!;
  const progressValue = useMotionValue(zoneProgress);
  const progressSpring = useSpring(progressValue, { stiffness: 200, damping: 30 });
  const opacityTransformed = useTransform(progressValue, [0, 0.05, 0.95, 1], [0, 1, 1, 0]);
  const opacity = useSpring(opacityTransformed, { stiffness: 200, damping: 30 });

  useEffect(() => {
    progressValue.set(zoneProgress);
  }, [zoneProgress, progressValue]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        className="zone-title-overlay"
        initial={{ opacity: 0, y: 30 }}
        style={{ opacity, y: 0, '--zone-color': zone.lightColor } as unknown as React.CSSProperties}
        exit={{ opacity: 0, y: -30 }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.5, ease: 'easeOut' }}
      >
        <div className="zone-title-content">
          <span className="zone-title-label">ENTERING</span>
          <h2 className="zone-title-name">{zone.name.toUpperCase()}</h2>
          <p className="zone-title-narrative">"{zone.narrative}"</p>
          <div className="zone-title-bar">
            <motion.div
              className="zone-progress-fill"
              initial={{ scaleX: 0 }}
              style={{ scaleX: progressSpring, background: zone.lightColor } as unknown as React.CSSProperties}
              transition={reducedMotion ? { duration: 0 } : { duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function CreatureFieldGuide({
  currentZone,
  selectedCreatureId,
  onSelectCreature,
  reducedMotion
}: {
  currentZone: string;
  selectedCreatureId: string | null;
  onSelectCreature: (id: string | null) => void;
  reducedMotion: boolean;
}) {
  const zone = getZoneById(currentZone)!;
  const availableCreatures = creatures.filter(c => zone.creatureIds.includes(c.id));

  if (availableCreatures.length === 0 && currentZone !== 'abyss') {
    return null;
  }

  const selectedCreature = selectedCreatureId ? getCreatureById(selectedCreatureId) : null;

  return (
    <aside className="creature-guide" aria-label="Creature field guide">
      <div className="guide-header">
        <h3 className="guide-title">FIELD GUIDE</h3>
        <span className="guide-zone">{zone.shortName} ZONE</span>
      </div>

      <div className="creature-list">
        {availableCreatures.map((creature) => (
          <CreatureListItem
            key={creature.id}
            creature={creature}
            isSelected={selectedCreatureId === creature.id}
            onClick={() => onSelectCreature(creature.id)}
            reducedMotion={reducedMotion}
          />
        ))}
        {currentZone === 'abyss' && (
          <CreatureListItem
            creature={{
              id: 'unknown',
              name: 'UNKNOWN ENTITY',
              scientificName: 'CLASSIFIED',
              depthRange: { min: 6000, max: 6000, unit: 'm' },
              habitat: 'UNKNOWN',
              fieldNotes: 'SIGNATURE DETECTED. MASSIVE. UNIDENTIFIED. PROCEED WITH EXTREME CAUTION.',
              classification: 'CLASSIFICATION PENDING',
              discoveryStatus: 'expedition-observed' as const,
              bioluminescent: false,
              size: 'ESTIMATED >100m',
              thumbnailColor: '#000',
              accentColor: '#cc0000',
            }}
            isSelected={selectedCreatureId === 'unknown'}
            onClick={() => onSelectCreature('unknown')}
            reducedMotion={reducedMotion}
            isUnknown
          />
        )}
      </div>

      {selectedCreature && (
        <CreatureDetailPanel
          creature={selectedCreature}
          onClose={() => onSelectCreature(null)}
          reducedMotion={reducedMotion}
        />
      )}
    </aside>
  );
}

function CreatureListItem({
  creature,
  isSelected,
  onClick,
  reducedMotion,
  isUnknown = false
}: {
  creature: Creature & { id: string };
  isSelected: boolean;
  onClick: () => void;
  reducedMotion: boolean;
  isUnknown?: boolean;
}) {
  const accentColor = creature.accentColor || '#00ffff';
  return (
    <motion.button
      className={`creature-item ${isSelected ? 'selected' : ''} ${isUnknown ? 'unknown' : ''}`}
      onClick={onClick}
      initial={false}
      animate={{
        backgroundColor: isSelected ? 'rgba(0, 212, 255, 0.1)' : 'transparent',
        borderColor: isSelected ? '#00ffff' : 'rgba(255,255,255,0.05)',
      }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.2 }}
      whileHover={{ x: 4 }}
      style={{
        '--creature-accent': accentColor,
        '--creature-accent-color': accentColor
      } as React.CSSProperties}
    >
      <div className="creature-thumb" style={{ background: creature.thumbnailColor }} />
      <div className="creature-info">
        <span className="creature-name">{creature.name}</span>
        <span className="creature-scientific">{creature.scientificName}</span>
        <span className="creature-depth">{creature.depthRange.min}–{creature.depthRange.max}m</span>
      </div>
      {creature.bioluminescent && (
        <motion.span
          className="bio-badge"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{ transitionDuration: reducedMotion ? '0s' : undefined }}
        >
          ● BIO
        </motion.span>
      )}
    </motion.button>
  );
}

function CreatureDetailPanel({
  creature,
  onClose,
  reducedMotion
}: {
  creature: Creature;
  onClose: () => void;
  reducedMotion: boolean;
}) {
  return (
    <motion.div
      className="creature-detail"
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 50 }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.4, ease: 'easeOut' }}
    >
      <button className="detail-close" onClick={onClose} aria-label="Close creature details">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      <div className="detail-header">
        <span className="detail-name">{creature.name}</span>
        <span className="detail-scientific">{creature.scientificName}</span>
        <span className={`detail-status ${creature.discoveryStatus}`}>
          {creature.discoveryStatus.toUpperCase().replace('-', ' ')}
        </span>
      </div>

      <div className="detail-meta">
        <div className="meta-item">
          <span className="meta-label">DEPTH RANGE</span>
          <span className="meta-value">{creature.depthRange.min}–{creature.depthRange.max}m</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">SIZE</span>
          <span className="meta-value">{creature.size}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">CLASSIFICATION</span>
          <span className="meta-value">{creature.classification}</span>
        </div>
      </div>

      <div className="detail-notes">
        <h4>FIELD NOTES</h4>
        <p>{creature.fieldNotes}</p>
      </div>

      <div className="detail-habitat">
        <h4>HABITAT</h4>
        <p>{creature.habitat}</p>
      </div>
    </motion.div>
  );
}

function TelemetryPanel({
  isPaused,
  onTogglePause,
  reducedMotion
}: {
  isPaused: boolean;
  onTogglePause: () => void;
  reducedMotion: boolean;
}) {
  // Use live scroll refs for HUD; do not put per-frame depth in React state for 3D
  const scrollRefs = useScrollRefs();
  const [telemetry, setTelemetry] = useState({
    depth: '0 m',
    pressure: '1.0 atm',
    temperature: '20.0°C',
    oxygen: '100%',
    signal: 'STRONG',
    status: 'NOMINAL',
  });
  const rafRef = useRef<number | null>(null);
  const frameRef = useRef(0);

  // Throttled HUD update at ~15Hz (every 4 frames at 60fps)
  useEffect(() => {
    if (reducedMotion) return;

    const animate = () => {
      frameRef.current = (frameRef.current + 1) % 4;
      if (frameRef.current === 0) {
        const depth = scrollRefs.depth;
        setTelemetry({
          depth: formatDepth(depth),
          pressure: formatPressure(depth),
          temperature: formatTemperature(depth),
          oxygen: formatOxygen(depth),
          signal: formatSignal(depth),
          status: depth > 5000 ? 'SIGNAL DEGRADING' : depth > 4000 ? 'CAUTION' : 'NOMINAL',
        });
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [scrollRefs, reducedMotion]);

  return (
    <div className="telemetry-panel" aria-label="Expedition telemetry">
      <div className="telemetry-header">
        <span className="telemetry-title">TELEMETRY</span>
        <span className={`telemetry-status ${telemetry.status === 'NOMINAL' ? 'nominal' : telemetry.status === 'CAUTION' ? 'caution' : 'critical'}`}>
          {telemetry.status}
        </span>
      </div>

      <div className="telemetry-grid">
        <TelemetryItem label="DEPTH" value={telemetry.depth} reducedMotion={reducedMotion} />
        <TelemetryItem label="PRESSURE" value={telemetry.pressure} reducedMotion={reducedMotion} />
        <TelemetryItem label="TEMP" value={telemetry.temperature} reducedMotion={reducedMotion} />
        <TelemetryItem label="O₂ RESERVE" value={telemetry.oxygen} reducedMotion={reducedMotion} />
        <TelemetryItem label="SIGNAL" value={telemetry.signal} reducedMotion={reducedMotion} isText={true} />
      </div>

      <SonarDisplay depth={scrollRefs.depth} isPaused={isPaused} reducedMotion={reducedMotion} />

      <motion.button
        className={`telemetry-control ${isPaused ? 'paused' : ''}`}
        onClick={onTogglePause}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        aria-pressed={isPaused}
        aria-label={isPaused ? 'Resume ambient motion' : 'Pause ambient motion'}
      >
        <svg
          className={isPaused ? 'icon-play' : 'icon-pause'}
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          {isPaused ? (
            <path d="M8 5v14l11-7z" />
          ) : (
            <g>
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </g>
          )}
        </svg>
        <span>{isPaused ? 'RESUME' : 'PAUSE'}</span>
      </motion.button>
    </div>
  );
}

function TelemetryItem({
  label,
  value,
  unit,
  reducedMotion,
  isText = false
}: {
  label: string;
  value: string;
  unit?: string;
  reducedMotion: boolean;
  isText?: boolean;
}) {
  return (
    <motion.div
      className="telemetry-item"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.4, delay: 0.1 }}
    >
      <span className="telemetry-label">{label}</span>
      <div className="telemetry-value-wrapper">
        <span className={`telemetry-value ${isText ? 'text' : ''}`}>{value}</span>
        {unit && <span className="telemetry-unit">{unit}</span>}
      </div>
    </motion.div>
  );
}

function SonarDisplay({
  depth,
  isPaused,
  reducedMotion
}: {
  depth: number;
  isPaused: boolean;
  reducedMotion: boolean;
}) {
  const sweepAngle = useMotionValue(0);
  const pingProgress = useMotionValue(0);
  const rafRef = useRef<number | null>(null);
  const blipsRef = useRef<Array<{ angle: number; distance: number; alpha: number; size: number }>>([]);

  // Sonar circles represent fixed depth ranges: 0-2000m, 2000-4000m, 4000-6000m
  // Map depth to circle radii
  const maxDepth = 6000;
  const innerRadius = 30;   // 0-2000m
  const midRadius = 60;     // 2000-4000m
  const outerRadius = 90;   // 4000-6000m

  // Generate static blips for the zone
  useEffect(() => {
    const zone = depth < 200 ? 'sunlight' : depth < 1000 ? 'twilight' : depth < 4000 ? 'midnight' : 'abyss';
    const blipCount = zone === 'abyss' ? 2 : zone === 'midnight' ? 4 : zone === 'twilight' ? 6 : 8;

    blipsRef.current = Array.from({ length: blipCount }, () => ({
      angle: Math.random() * Math.PI * 2,
      distance: 0.3 + Math.random() * 0.6,
      alpha: 0.3 + Math.random() * 0.5,
      size: 2 + Math.random() * 4,
    }));
  }, [depth]);

  // Animate sonar sweep with proper cleanup
  useEffect(() => {
    if (reducedMotion || isPaused) return;

    const animate = () => {
      sweepAngle.set((sweepAngle.get() + 0.01) % (Math.PI * 2));
      pingProgress.set((pingProgress.get() + 0.005) % 1);

      // Fade blips
      blipsRef.current.forEach(blip => {
        blip.alpha *= 0.995;
        if (blip.alpha < 0.1) {
          blip.alpha = 0.3 + Math.random() * 0.5;
          blip.angle = Math.random() * Math.PI * 2;
          blip.distance = 0.3 + Math.random() * 0.6;
        }
      });

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPaused, reducedMotion]);

  // Current depth indicator angle on the sweep
  const depthAngle = (depth / maxDepth) * Math.PI * 2;

  return (
    <div className="sonar-display" aria-label="Sonar display">
      <svg
        className="sonar-svg"
        viewBox="0 0 200 200"
        width="160"
        height="160"
        aria-hidden="true"
      >
        {/* Depth range circles - fixed zones */}
        <circle cx="100" cy="100" r={outerRadius} fill="none" stroke="rgba(0,212,255,0.1)" strokeWidth="1" />
        <circle cx="100" cy="100" r={midRadius} fill="none" stroke="rgba(0,212,255,0.1)" strokeWidth="1" />
        <circle cx="100" cy="100" r={innerRadius} fill="none" stroke="rgba(0,212,255,0.1)" strokeWidth="1" />

        {/* Current depth marker ring */}
        <circle
          cx="100"
          cy="100"
          r={(depth / maxDepth) * outerRadius}
          fill="none"
          stroke="var(--color-cyan-primary)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          opacity={0.5}
        />

        {/* Sweep line */}
        <motion.line
          x1={100}
          y1={100}
          x2={100 + outerRadius * Math.cos(sweepAngle.get() - Math.PI / 2)}
          y2={100 + outerRadius * Math.sin(sweepAngle.get() - Math.PI / 2)}
          stroke="#00ffff"
          strokeWidth="2"
          opacity={0.6}
          style={{ filter: 'drop-shadow(0 0 4px #00ffff)' } as React.CSSProperties}
          animate={{
            x2: 100 + outerRadius * Math.cos(sweepAngle.get() - Math.PI / 2),
            y2: 100 + outerRadius * Math.sin(sweepAngle.get() - Math.PI / 2),
          }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0, ease: 'linear' }}
        />

        {/* Ping ripple */}
        <motion.circle
          cx="100"
          cy="100"
          r={pingProgress.get() * outerRadius}
          fill="none"
          stroke="#00ffff"
          strokeWidth="1"
          opacity={1 - pingProgress.get()}
          animate={{
            r: pingProgress.get() * outerRadius,
            opacity: 1 - pingProgress.get(),
          }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0, ease: 'linear' }}
        />

        {/* Blips */}
        {blipsRef.current.map((blip, i) => (
          <motion.circle
            key={i}
            cx={100 + blip.distance * outerRadius * Math.cos(blip.angle)}
            cy={100 + blip.distance * outerRadius * Math.sin(blip.angle)}
            r={blip.size}
            fill="#00ffff"
            opacity={blip.alpha}
            style={{ filter: 'drop-shadow(0 0 4px #00ffff)' } as React.CSSProperties}
            animate={{
              r: [blip.size, blip.size * 1.5, blip.size],
              opacity: [blip.alpha, blip.alpha * 0.5, blip.alpha],
            }}
            transition={reducedMotion ? { duration: 0 } : { duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}

        {/* Center submersible */}
        <circle cx="100" cy="100" r="4" fill="#00ffff" opacity={0.8} />

        {/* Depth indicator on sweep line - shows current depth position */}
        <motion.line
          x1={100}
          y1={100}
          x2={100 + ((depth / maxDepth) * outerRadius) * Math.cos(depthAngle - Math.PI / 2)}
          y2={100 + ((depth / maxDepth) * outerRadius) * Math.sin(depthAngle - Math.PI / 2)}
          stroke="#00ffbf"
          strokeWidth="2"
          opacity={0.8}
          style={{ filter: 'drop-shadow(0 0 4px #00ffbf)' } as React.CSSProperties}
        />
      </svg>

      <div className="sonar-labels">
        <span>0m</span>
        <span>2000m</span>
        <span>4000m</span>
        <span>6000m</span>
      </div>
    </div>
  );
}

function FinalReveal({
  depth,
  scrollProgress,
  reducedMotion
}: {
  depth: number;
  scrollProgress: number;
  reducedMotion: boolean;
}) {
  const progressValue = useMotionValue(scrollProgress);
  const textOpacity = useTransform(progressValue, [0.94, 0.98], [0, 1]);
  const creatureOpacity = useTransform(progressValue, [0.9, 0.98], [0, 1]);
  const vignetteIntensity = useTransform(progressValue, [0.9, 1], [0, 1]);

  useEffect(() => {
    progressValue.set(scrollProgress);
  }, [scrollProgress, progressValue]);

  return (
    <AnimatePresence>
      {depth > 5500 && (
        <motion.div
          className="final-reveal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={reducedMotion ? { duration: 0 } : { duration: 2 }}
          style={{ '--vignette': vignetteIntensity } as React.CSSProperties}
        >
          <div className="final-content">
            <motion.div
              className="final-silhouette"
              style={{ opacity: creatureOpacity }}
              initial={{ scale: 0.5, filter: 'blur(20px)' }}
              animate={{ scale: 1, filter: 'blur(0px)' }}
              transition={reducedMotion ? { duration: 0 } : { duration: 3, ease: 'easeOut' }}
            >
              <div className="silhouette-shape" />
              <div className="silhouette-eyes">
                <span className="eye-left" />
                <span className="eye-right" />
              </div>
            </motion.div>

            <motion.blockquote
              className="final-quote"
              style={{ opacity: textOpacity }}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reducedMotion ? { duration: 0 } : { duration: 1.5, delay: 1, ease: 'easeOut' }}
            >
              "WE WERE NEVER THE ONLY ONES DOWN HERE."
            </motion.blockquote>

            <motion.div
              className="final-status"
              style={{ opacity: textOpacity }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reducedMotion ? { duration: 0 } : { duration: 1, delay: 2, ease: 'easeOut' }}
            >
              <div className="status-line">
                <span>EXPEDITION STATUS:</span>
                <span className="status-value critical">SIGNAL LOST</span>
              </div>
              <div className="status-line">
                <span>LAST CONTACT:</span>
                <span className="status-value">DEPTH 5,847m</span>
              </div>
              <div className="status-line">
                <span>TIME ELAPSED:</span>
                <span className="status-value">00:47:32</span>
              </div>
            </motion.div>

            <motion.button
              className="btn btn-secondary return-btn"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reducedMotion ? { duration: 0 } : { duration: 0.5, delay: 3, ease: 'easeOut' }}
            >
              RETURN TO SURFACE
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AudioToggle() {
  const [isPlaying, setIsPlaying] = useState(false);

  const toggle = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  return (
    <motion.button
      className={`audio-toggle ${isPlaying ? 'playing' : ''}`}
      onClick={toggle}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-pressed={isPlaying}
      aria-label={isPlaying ? 'Disable ambient audio' : 'Enable ambient audio'}
    >
      <svg
        className="audio-icon"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        {isPlaying ? (
          <>
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
          </>
        ) : (
          <>
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </>
        )}
      </svg>
      <span className="audio-label">{isPlaying ? 'AUDIO ON' : 'AUDIO OFF'}</span>
    </motion.button>
  );
}

function LoadingScreen({ onComplete }: { onComplete: () => void }) {
  const [progress, setProgress] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Fallback timeout - force complete after 10 seconds max
    timeoutRef.current = setTimeout(() => {
      setProgress(100);
    }, 10000);

    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          setTimeout(onComplete, 500);
          return 100;
        }
        return p + Math.random() * 10;
      });
    }, 100);

    return () => {
      clearInterval(interval);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [onComplete]);

  return (
    <motion.div
      className="loading-screen"
      initial={{ opacity: 1 }}
      animate={{ opacity: progress >= 100 ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      role="status"
      aria-label="Loading abyss expedition"
    >
      <div className="loading-content">
        <motion.div
          className="loading-wordmark"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          ABYSS
        </motion.div>
        <motion.div
          className="loading-tagline"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
        >
          INITIALIZING EXPEDITION SYSTEMS
        </motion.div>

        <motion.div
          className="loading-bar"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: progress / 100 }}
          transition={{ duration: 0.3, ease: 'linear' }}
        >
          <div className="loading-bar-fill" />
        </motion.div>

        <motion.span
          className="loading-percent"
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {Math.round(progress)}%
        </motion.span>
      </div>
    </motion.div>
  );
}

// ============================================
// Main App Component
// ============================================

export default function App() {
  return (
    <ErrorBoundary>
      <ScrollProvider>
        <AppInner />
      </ScrollProvider>
    </ErrorBoundary>
  );
}

function AppInner() {
  const {
    scrollProgress,
    scrollY,
    depth,
    currentZone,
    zoneProgress
  } = useScroll();
  const { scrollToZone } = useScrollTo();
  const reducedMotion = useReducedMotion();
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedCreature, setSelectedCreature] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [webglError, setWebglError] = useState<Error | null>(null);
  const [uiVisible, setUiVisible] = useState(true);

  // Toggle UI overlay with 'H' key for debugging
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') {
        setUiVisible(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle canvas load with timeout fallback
  const handleCanvasLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);

  // Handle WebGL errors
  const handleWebglError = useCallback((error: Error | Event | React.SyntheticEvent) => {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    console.error('[ABYSS] WebGL Context Error:', errorObj);
    setWebglError(errorObj);
  }, []);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Close creature detail on zone change
  useEffect(() => {
    setSelectedCreature(null);
  }, [currentZone]);

  // Diagnostic: Check WebGL support on mount
  useEffect(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (gl) {
      console.log('[ABYSS] WebGL supported:', {
        version: gl.getParameter(gl.VERSION),
        shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
        vendor: gl.getParameter(gl.VENDOR),
        renderer: gl.getParameter(gl.RENDERER),
        maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      });
    } else {
      console.error('[ABYSS] WebGL NOT supported by browser');
      setWebglError(new Error('WebGL not supported'));
    }
  }, []);

  // Debug flag for stats display
  const debugEnabled = useDebugFlag();

  if (!isLoaded) {
    return <LoadingScreen onComplete={handleCanvasLoad} />;
  }

  return (
    <ErrorBoundary>
      <PauseContext.Provider value={{ isPaused, reducedMotion }}>
        {/* 3D Canvas - Full Screen */}
        <div className="canvas-container">
          <AbyssCanvas
            onLoad={handleCanvasLoad}
            onError={handleWebglError}
            className="abyss-canvas"
            isPaused={isPaused}
            reducedMotion={reducedMotion}
            depth={depth}
            currentZone={currentZone as ZoneId}
            zoneProgress={zoneProgress}
          />
          <div className="film-grain vignette" aria-hidden="true" />
        </div>

        {/* Debug stats display - OUTSIDE Canvas */}
        <DebugStatsDisplay enabled={debugEnabled} />

        {/* UI Overlay */}
      <div className="ui-overlay" style={{ display: uiVisible ? 'block' : 'none' }}>
        <header className="top-bar">
          <div className="top-left">
            <Wordmark />
          </div>
          <div className="top-center">
            <ZoneNavigation
              currentZone={currentZone}
              onZoneClick={scrollToZone}
              reducedMotion={reducedMotion}
            />
          </div>
          <div className="top-right">
            <SignalPill depth={depth} reducedMotion={reducedMotion} />
            <AudioToggle />
          </div>
        </header>

        <main className="hero-section">
          <HeroTitle scrollProgress={scrollProgress} scrollY={scrollY} />

          <div className="hero-bottom" style={{ marginTop: 24, position: 'relative' }}>
            <DescendButton
              onClick={() => scrollToZone('twilight')}
              scrollProgress={scrollProgress}
              reducedMotion={reducedMotion}
            />
            <ScrollIndicator reducedMotion={reducedMotion} />
          </div>
        </main>

        {/* Coordinates card - fixed position bottom right */}
        <div style={{ position: 'fixed', right: 24, bottom: 24, width: 220 }} aria-label="Expedition coordinates">
          <Coordinates depth={depth} />
        </div>

        <ZoneTitleOverlay
          currentZone={currentZone}
          zoneProgress={zoneProgress}
          reducedMotion={reducedMotion}
        />

        <CreatureFieldGuide
          currentZone={currentZone}
          selectedCreatureId={selectedCreature}
          onSelectCreature={setSelectedCreature}
          reducedMotion={reducedMotion}
        />

        <TelemetryPanel
          isPaused={isPaused}
          onTogglePause={() => setIsPaused(!isPaused)}
          reducedMotion={reducedMotion}
        />

        <FinalReveal
          depth={depth}
          scrollProgress={scrollProgress}
          reducedMotion={reducedMotion}
        />
      </div>

      {reducedMotion && (
        <div className="reduced-motion-notice" role="status" aria-live="polite">
          Reduced motion enabled. Animations simplified for comfort.
        </div>
      )}

      {webglError && (
        <div className="webgl-fallback" role="alert" aria-live="assertive">
          <div className="fallback-content">
            <h2>WebGL Not Supported</h2>
            <p>Your browser or device does not support WebGL, which is required for the 3D experience.</p>
            <p>The abyss remains hidden. Please try a modern browser with hardware acceleration enabled.</p>
            <details style={{ marginTop: 'var(--space-4)', textAlign: 'left' }}>
              <summary>Error Details</summary>
              <pre style={{ fontSize: 'var(--text-xs)', overflow: 'auto', maxHeight: '200px' }}>
                {webglError.message}
                {webglError.stack && '\n\n' + webglError.stack}
              </pre>
            </details>
          </div>
        </div>
      )}
    </PauseContext.Provider>
      </ErrorBoundary>
    );
}