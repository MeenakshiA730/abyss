/**
 * ABYSS — Debug Overlay (Development Only)
 * Shows FPS, frame time, WebGL renderer info, and React render counts
 * Only renders when ?debug=true query param is present
 */

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState, useMemo } from 'react';

interface DebugOverlayProps {
  enabled: boolean;
}

export function DebugOverlay({ enabled }: DebugOverlayProps) {
  const { gl, scene, camera } = useThree();
  const [stats, setStats] = useState({
    fps: 0,
    frameTime: 0,
    calls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
    programs: 0,
  });

  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const renderCountRef = useRef(0);
  const canvasMountRef = useRef(0);
  const isMountedRef = useRef(false);

  // Track canvas mount/unmount at component level (not in effect with changing deps)
  if (!isMountedRef.current) {
    isMountedRef.current = true;
    canvasMountRef.current += 1;
    console.log(`[ABYSS-DEBUG] Canvas MOUNTED (mount #${canvasMountRef.current})`);
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isMountedRef.current) {
        console.log(`[ABYSS-DEBUG] Canvas UNMOUNTED (was mount #${canvasMountRef.current})`);
        isMountedRef.current = false;
      }
    };
  }, []);

  // WebGL context loss/restore listeners
  useEffect(() => {
    const canvas = gl.domElement;

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      console.error('[ABYSS-DEBUG] webglcontextlost fired!');
    };

    const handleContextRestored = () => {
      console.log('[ABYSS-DEBUG] webglcontextrestored fired!');
    };

    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);

    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
    };
  }, [gl]);

  // Per-frame stats collection
  useFrame(() => {
    if (!enabled) return;

    const now = performance.now();
    frameCountRef.current++;

    // Update stats every 500ms
    if (now - lastTimeRef.current >= 500) {
      const elapsed = now - lastTimeRef.current;
      const fps = Math.round((frameCountRef.current / elapsed) * 1000);
      const frameTime = elapsed / frameCountRef.current;

      const info = gl.info.render;
      const memory = gl.info.memory;

      setStats({
        fps,
        frameTime: Math.round(frameTime * 100) / 100,
        calls: info.calls,
        triangles: info.triangles,
        geometries: memory.geometries,
        textures: memory.textures,
        programs: gl.info.programs?.length || 0,
      });

      frameCountRef.current = 0;
      lastTimeRef.current = now;
    }

    // Count React renders of this component
    renderCountRef.current++;
  });

  if (!enabled) return null;

  const style = useMemo(() => ({
    position: 'fixed' as const,
    top: '12px',
    right: '12px',
    zIndex: 9999,
    background: 'rgba(0, 10, 20, 0.95)',
    border: '1px solid #00d4ff',
    borderRadius: '8px',
    padding: '12px 16px',
    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
    fontSize: '11px',
    lineHeight: '1.6',
    color: '#00ffff',
    minWidth: '220px',
    boxShadow: '0 0 20px rgba(0, 212, 255, 0.3)',
    backdropFilter: 'blur(8px)',
    pointerEvents: 'none' as const,
  }), [enabled]);

  const rowStyle = useMemo(() => ({
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '2px 0',
  }), []);

  const labelStyle = useMemo(() => ({
    color: '#88ffff',
    opacity: 0.8,
  }), []);

  const valueStyle = useMemo(() => ({
    color: '#00ffff',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
  }), []);

  const sectionStyle = useMemo(() => ({
    borderTop: '1px solid rgba(0, 212, 255, 0.2)',
    marginTop: '8px',
    paddingTop: '8px',
  }), []);

  return (
    <div style={style} aria-hidden="true">
      <div style={{ fontWeight: 700, marginBottom: '8px', color: '#00ffff' }}>
        ABYSS DEBUG — Mount #{canvasMountRef.current} | Renders: {renderCountRef.current}
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>FPS:</span>
        <span style={valueStyle}>{stats.fps}</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Frame Time:</span>
        <span style={valueStyle}>{stats.frameTime} ms</span>
      </div>

      <div style={{ ...sectionStyle, marginTop: '4px' }}>
        <div style={{ fontWeight: 600, marginBottom: '4px', color: '#88ffff' }}>WebGL Renderer</div>
        <div style={rowStyle}>
          <span style={labelStyle}>Draw Calls:</span>
          <span style={valueStyle}>{stats.calls}</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Triangles:</span>
          <span style={valueStyle}>{stats.triangles.toLocaleString()}</span>
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={{ fontWeight: 600, marginBottom: '4px', color: '#88ffff' }}>Memory</div>
        <div style={rowStyle}>
          <span style={labelStyle}>Geometries:</span>
          <span style={valueStyle}>{stats.geometries}</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Textures:</span>
          <span style={valueStyle}>{stats.textures}</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Programs:</span>
          <span style={valueStyle}>{stats.programs}</span>
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={{ fontWeight: 600, marginBottom: '4px', color: '#88ffff' }}>Scene</div>
        <div style={rowStyle}>
          <span style={labelStyle}>Scene Children:</span>
          <span style={valueStyle}>{scene?.children?.length || 0}</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Camera:</span>
          <span style={valueStyle}>
            {camera ? `pos: [${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)}]` : 'N/A'}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to check for ?debug query parameter
 */
export function useDebugFlag(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const debug = params.get('debug') === 'true' || params.get('debug') === '1';
    setEnabled(debug);

    // Listen for URL changes (e.g., user adds ?debug manually)
    const handleHashChange = () => {
      const params = new URLSearchParams(window.location.search);
      setEnabled(params.get('debug') === 'true' || params.get('debug') === '1');
    };

    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, []);

  return enabled;
}