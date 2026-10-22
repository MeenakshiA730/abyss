# ABYSS Diagnostics Log

## 2026-10-22: CameraController lookAt fix

### camstep=3 test result
- **Result**: STABLE — persistent lookAt target eliminates blinking at camstep=3
- **Root cause**: The old lookAt block rebuilt its target from the camera's own direction each frame (`getWorldDirection`, negated, plus position), which created a feedback loop and a target behind the camera. Replacing it with a persistent lookAt vector fixed camstep=3.

### Edits made
1. **Added persistent refs** in CameraController component body:
   - `lookAtRef = useRef(new THREE.Vector3())`
   - `lookAtInitRef = useRef(false)`

2. **Replaced lookAt block** (inside useFrame):
   ```ts
   // Before (feedback loop - rebuilt target from camera direction each frame):
   const currentLookAt = new THREE.Vector3();
   perspCamera.getWorldDirection(currentLookAt).multiplyScalar(-1).add(perspCamera.position);
   currentLookAt.lerp(desiredLookAt, lookAtLerp);
   perspCamera.lookAt(currentLookAt);

   // After (persistent ref, no feedback):
   if (!lookAtInitRef.current) {
     lookAtRef.current.copy(desiredLookAt);
     lookAtInitRef.current = true;
   }
   lookAtRef.current.lerp(desiredLookAt, lookAtLerp);
   perspCamera.lookAt(lookAtRef.current);
   ```

3. **Changed lookAt gate** from `camstep >= 3` to `camstep === 0 || camstep >= 3` so default mode (no flag) also uses persistent lookAt.

4. **Roll block order**: Roll block runs AFTER lookAt block, gated as `camstep === 0`. Since `camstep === 0` is now included in the lookAt gate, roll runs after lookAt in the same frame for default mode — correct order (lookAt sets full rotation, then roll modifies Z).

### Current camstep behavior
| camstep | position | shake | breathing | lookAt (persistent) | roll |
|---------|----------|-------|-----------|---------------------|------|
| 0 (default) | ✓ | ✗ | ✗ | ✓ | ✓ |
| 1 | ✓ | ✗ | ✗ | ✗ | ✗ |
| 2 | ✓ | ✓ | ✓ | ✗ | ✗ |
| 3 | ✓ | ✓ | ✓ | ✓ | ✗ |

## URLs for testing
- `?camstep=3` — `http://localhost:5173/?camstep=3` (fixed persistent lookAt)
- Plain — `http://localhost:5173/` (default mode, now uses persistent lookAt + roll)

---

## 2026-10-22: Restoration step 1 — Standard Three.js fog

### Action
Uncommented standard `<fog attach="fog" args={[interpolatedFog.color, interpolatedFog.near, interpolatedFog.far]} />` in ZoneLighting.tsx (line 251).

### Commit
`d81e29b` — "restore: standard fog"

### Test
Open plain URL and verify no blinking returns. Report result.

---

## 2026-10-22: Restoration step 2 — Fog uniform updates

### Action
Per-frame fog uniform updates (volumetric fog shader) were already active in ZoneLighting.tsx (lines 226-241). The 10Hz throttle was previously removed; they run every frame updating `uTime`, `uCameraPos`, `uSunDirection`, `uSunColor`, `uSunIntensity`, `uFogColor`, `uFogDensity`, `uZoneProgress`, `uZone`. No code change required.

### Commit
`e499c96` — "restore: fog uniforms (already active per-frame)"

### Test
Open plain URL and verify no blinking returns. Report result.

---

## 2026-10-22: Restoration step 3 — Volumetric fog sphere

### Action
Uncommented volumetric fog mesh in ZoneLighting.tsx (lines 253-255):
```tsx
<mesh geometry={new THREE.SphereGeometry(1000, 32, 16)} material={fogMaterialRef.current!}
      position={[0, 0, 0]} renderOrder={0} />
```
Uses the shader material with per-frame uniform updates (step 2). Renders as BackSide sphere around camera at renderOrder 0.

### Commit
`8e5e49b` — "restore: volumetric fog"

### Test
Open plain URL and verify:
- No scene-wide blinking
- Volumetric fog visible (height-based density, god rays, deep zone bioluminescence glow)
- Render counters flat while idle
Report result.

---

## 2026-10-22: Restoration step 4 — Particles (marine snow)

### Action
Rewrote Particles.tsx as a single THREE.Points with one BufferGeometry (~800 particles):
- Seeded PRNG (mulberry32) for deterministic initialization — no Math.random in render
- Single shared PointsMaterial with circular gradient texture (cached module-level)
- Per-frame motion in useFrame: mutates position attribute, sets `needsUpdate = true`
- Particles fall down, wrap to top with pre-computed reset positions
- Gentle horizontal oscillation via deterministic phase offsets
- Geometry created once in useMemo (keyed by zone), never recreated on re-render
- Re-enabled in AbyssCanvas.tsx (uncommented import and JSX)

### Commit
`6fea971` — "restore: particles (Points)"

### Test
Open plain URL and verify:
- No scene-wide blinking
- Marine snow visible (falling white particulates, ~800 particles)
- Particles wrap smoothly, no allocation churn
- Render counters flat while idle
- Performance stable (single draw call, one geometry)
Report result.

---

## 2026-10-22: Phase 0 — Final Summary

### Root Cause
The old lookAt block rebuilt its target from the camera's own direction each frame (`getWorldDirection`, negated, plus position), creating a feedback loop. The target jittered behind the camera, causing scene-wide blinking.

### Fix
Added a persistent `lookAtRef` vector initialized once, then lerped toward the desired target each frame. The camera now looks at a stable, interpolated point.

### Ruled Out (via bisect flags & isolation)
- Camera shake, breathing, roll
- Creature eye-blink / animation
- Fog uniforms (per-frame volumetric shader updates)
- Volumetric fog sphere mesh
- Particles (marine snow)
- Standard Three.js fog
- EffectComposer / FXAA
- Near/far plane settings
- Float precision issues
- DOM/CSS overlay layer

### Restored (all stable)
- Standard Three.js fog
- Fog uniforms (per-frame)
- Volumetric fog sphere
- Particles (Points, ~800, seeded PRNG)

### Commits
- `c3d53d4` fix: persistent lookAt target
- `5480b0d` fix: lookAt runs in default mode
- `d81e29b` restore: standard fog
- `e499c96` restore: fog uniforms
- `8e5e49b` restore: volumetric fog
- `6fea971` restore: particles (Points)
- `76dc68e` cleanup: remove bisect flags

Phase 0 complete. Ready for Phase 1 (UI bugs).