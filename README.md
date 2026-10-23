# ABYSS

A cinematic, scroll-driven deep-sea exploration website. Scroll to descend through four ocean zones, from sunlit shallows to the black floor of the abyss, with a live 3D scene, sea life and an expedition HUD.

**Live site:** https://abyss-green-eight.vercel.app/

## The experience

You descend 6,000 m through four zones:

| Zone | Depth |
|---|---|
| Sunlight | 0 - 200 m |
| Twilight | 200 - 1,000 m |
| Midnight | 1,000 - 4,000 m |
| Abyss | 4,000 - 6,000 m |

- 3D scene: terrain, shipwreck, research station, submersible, ROV and a massive creature in the Abyss
- Procedural sea life: schooling reef fish, glowing jellyfish, anglerfish, plankton and swaying sea plants
- HUD: live depth, pressure, temperature and O2 reserve, sonar, zone navigation, pause / resume and an audio toggle
- Field Guide and a final reveal

## Tech stack

React, TypeScript, Vite, Three.js (React Three Fiber and Drei), Motion, Lenis (smooth scroll), Lucide React.

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173). Add `?debug` to the URL for an overlay with render stats.

Production build:

```bash
npm run build
npm run preview
```

## Engineering notes

**The blinking bug.** The 3D scene flickered continuously, even when idle. Earlier guesses (fog, particles, camera shake) changed nothing, so I built URL flags to switch parts of the scene off and bisected it. The cause was in the camera controller: the lookAt target was rebuilt from the camera's own direction every frame, a feedback loop that left the target behind the camera. A persistent, lerped lookAt vector fixed it. The full write-up is in [`DIAGNOSTICS.md`](./DIAGNOSTICS.md).

**Live telemetry.** The HUD values used to freeze between zone changes because the parent component only re-rendered on zone transitions. A shared `useLiveDepth` hook now reads the live scroll depth and updates the HUD at about 15 Hz, with pressure, temperature and O2 computed as continuous functions of depth.

**Performance.** Profiling on an integrated GPU showed that the logarithmic depth buffer, a separate FXAA pass and a high pixel ratio were the main costs. Removing them took the frame rate from single digits into the 45 - 60 range in testing. See the limitations below for the current state of the deployed build.

**Sea life.** Fish, jellyfish and plants are drawn procedurally (instanced meshes and simple per-frame animation) with no external model files, which keeps the bundle small.

## Known limitations

- **Frame rate on integrated GPUs.** The deployed build is lower than the optimized variant: it ran at roughly 27 fps on my laptop with DevTools open. The fixes above are identified but were not applied to the submitted build because a combined change blanked the scene during testing; they need to be re-applied one at a time.
- **Zone transitions.** Some scene components read zone state rather than the live scroll depth, so they change in steps at zone boundaries and not smoothly. A depth-driven rewrite was attempted and rolled back.
- **Sunlight god rays** are drafted but not included in this build.
- Not tested across all browsers and mobile devices.

## Project structure

```
src/
  components/   3D scene (terrain, lighting, sea life, camera) and HUD pieces
  config/       zone definitions and palettes
  design/       design tokens
  hooks/        scroll context, live depth, design token sync
  data/         Field Guide creature data
```