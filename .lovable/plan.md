

# Fix: Broken Gesture System & Galaxy-Like Particle Orb

## Root Cause Analysis

After thorough code review, here are the critical bugs:

### Bug 1: Dual gesture detection conflict
`CameraHandler.tsx` calls `detectGesture()` and sends the result via `onGestureDetected`. But `KineticCore.tsx` **also** runs its own `useEffect` calling `detectGesture()` independently (line 161-168). This creates **two competing gesture detectors** that overwrite each other, causing flickering and inconsistent behavior.

### Bug 2: CameraHandler uses a plain variable for dual hand state
In `CameraHandler.tsx` line 14: `let currentDualHands` is a local variable that resets every render. When `handleLandmarksUpdate` fires, `currentDualHands` is always `null` because it's not persisted via `useRef`. So two-hand gestures **never** detect.

### Bug 3: `gestureBlend` is only 0.25
In the vertex shader (line 59), `gestureBlend = 0.25` means gestures only apply at 25% intensity. Particles barely move from their original positions. This is why formations look weak and identical.

### Bug 4: Particle distribution is too small
Particles spawn in radius 0.3-1.5 (line 38 of ParticleSwarm), packed into a tiny sphere. With the glass orb at radius 1.8, most particles are hidden inside it. The orb itself obscures the particle effects.

### Bug 5: The glass OrbCore blocks particle visibility
The `MeshTransmissionMaterial` sphere at radius 1.8 with `transmission=0.92` heavily distorts and occludes the 6000 particles behind it, making them look like a foggy blob rather than dispersed galaxy grains.

---

## Implementation Plan

### Task 1: Fix gesture detection pipeline
**Files:** `CameraHandler.tsx`, `KineticCore.tsx`

- Use `useRef` for `currentDualHands` in `CameraHandler` instead of `let` variable
- Remove the duplicate `useEffect` gesture detection in `KineticCore.tsx` (lines 161-168) and the `useGestureFromLandmarks` import - let `CameraHandler` be the single source of truth
- This alone should fix most gesture detection

### Task 2: Make particles look like a galaxy (billions of stars feel)
**Files:** `ParticleSwarm.tsx`, `particleVertex.glsl`, `particleFragment.glsl`, `OrbCore.tsx`

- **Remove or heavily reduce the glass OrbCore** - make it a tiny inner core (radius 0.3) or remove entirely. The particles ARE the orb
- **Increase particle spread radius** from 0.3-1.5 to 0.5-2.5 so particles fill more space
- **Increase `gestureBlend`** from 0.25 to **0.85** so gestures actually transform the particle cloud dramatically
- **Reduce particle size** (gl_PointSize from 35 to 20) for finer grain, more star-like appearance
- **Add size variation** - some particles tiny (distant stars), some larger (nearby stars)
- Make idle state show a slowly rotating galaxy spiral by default instead of a static sphere
- Add depth-based brightness: distant particles dimmer, close ones brighter

### Task 3: Enhance shader effects for dramatic formations
**File:** `particleVertex.glsl`

- Increase formation intensities across all gestures - make explosions truly explosive (force multipliers 2x-4x current)
- Galaxy idle: particles should slowly swirl in spiral arm patterns by default
- Burst/scatter/spread: particles should fly to edges of view, not just expand slightly
- Fist: collapse to a dense bright point
- Palm: massive cloud expansion with gentle drift

### Task 4: Fix fragment shader for star-like appearance
**File:** `particleFragment.glsl`

- Make particles render as bright point stars with soft glow halos
- Add brightness variation based on `aScale` - some particles are bright white "stars"
- Increase overall brightness and add a core white-hot center per particle
- Remove the hard `dist > 0.5` cutoff, use smoother falloff for softer stars

### Task 5: Add hand tracking status indicator
**File:** `KineticCore.tsx`

- Show a small status indicator: "Initializing camera...", "Camera active", "No hands detected"
- Enable `showDebug` by default temporarily so users can verify tracking works
- Add the loading/error states from `useHandTracking` to the UI

---

## Summary of Changes

| File | Change |
|------|--------|
| `CameraHandler.tsx` | Fix `currentDualHands` with `useRef` |
| `KineticCore.tsx` | Remove duplicate gesture detection, add tracking status UI |
| `OrbCore.tsx` | Shrink glass sphere dramatically or replace with tiny glowing core |
| `ParticleSwarm.tsx` | Wider particle spread, more particles feel |
| `particleVertex.glsl` | Increase `gestureBlend` to 0.85, amplify all formations, add galaxy idle |
| `particleFragment.glsl` | Star-like rendering, brighter, softer glow, more variation |

