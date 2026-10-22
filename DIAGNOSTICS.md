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