uniform vec3 uColorCore;
uniform vec3 uColorAccent;
uniform vec3 uColorEnergy;
uniform float uTime;
uniform float uListening;
uniform float uGestureState;

varying float vDistanceToAttractor;
varying float vPulse;
varying float vRandomness;
varying float vGestureIntensity;
varying float vTwoHandBlend;

// Cosmic color palette
vec3 colorDeepSpace = vec3(0.05, 0.05, 0.2);
vec3 colorNebulaPurple = vec3(0.6, 0.2, 0.9);
vec3 colorStarWhite = vec3(1.0, 0.95, 0.9);
vec3 colorCyan = vec3(0.0, 0.85, 1.0);
vec3 colorMagenta = vec3(1.0, 0.1, 0.6);
vec3 colorGold = vec3(1.0, 0.85, 0.3);
vec3 colorFire = vec3(1.0, 0.4, 0.1);
vec3 colorIce = vec3(0.4, 0.8, 1.0);

void main() {
  vec2 center = gl_PointCoord - vec2(0.5);
  float dist = length(center);
  
  if (dist > 0.5) discard;
  
  // Base color mixing with cosmic tones
  float colorMix = vPulse * 0.6 + vRandomness * 0.4;
  vec3 color = mix(uColorCore, uColorAccent, colorMix);
  
  // ============ SINGLE-HAND GESTURE COLORS ============
  
  // FIST (4) - Red/orange fire
  if (uGestureState > 3.5 && uGestureState < 4.5) {
    color = mix(color, colorFire, vGestureIntensity * 0.6);
  }
  // SPREAD (8) - Golden
  else if (uGestureState > 7.5 && uGestureState < 8.5) {
    color = mix(color, vec3(1.0, 0.8, 0.2), vGestureIntensity * 0.6);
  }
  // ROCK (12) - Magenta
  else if (uGestureState > 11.5 && uGestureState < 12.5) {
    color = mix(color, vec3(1.0, 0.1, 0.5), vGestureIntensity * 0.7);
  }
  // PEACE (5) - Dual colored
  else if (uGestureState > 4.5 && uGestureState < 5.5) {
    float side = step(0.5, vRandomness);
    color = mix(uColorCore, uColorEnergy, side);
  }
  // GUN (11) - Cyan beam
  else if (uGestureState > 10.5 && uGestureState < 11.5) {
    color = mix(color, vec3(0.2, 1.0, 0.8), vGestureIntensity * 0.8);
  }
  // THUMB UP (6) - Warm orange
  else if (uGestureState > 5.5 && uGestureState < 6.5) {
    color = mix(color, vec3(1.0, 0.6, 0.2), vGestureIntensity * 0.4);
  }
  // PALM DOWN (7) - Cool blue
  else if (uGestureState > 6.5 && uGestureState < 7.5) {
    color = mix(color, vec3(0.3, 0.5, 1.0), vGestureIntensity * 0.4);
  }
  // GALAXY (13) - Cosmic nebula colors
  else if (uGestureState > 12.5 && uGestureState < 13.5) {
    color = mix(colorNebulaPurple, colorCyan, vRandomness);
    color += colorStarWhite * vGestureIntensity * 0.4;
    color += vec3(0.3, 0.1, 0.4) * sin(vRandomness * 6.28 + uTime);
  }
  // VORTEX (14) - Green wind
  else if (uGestureState > 13.5 && uGestureState < 14.5) {
    color = mix(color, vec3(0.2, 0.9, 0.5), vGestureIntensity * 0.5);
  }
  // TORNADO (15) - Gray storm
  else if (uGestureState > 14.5 && uGestureState < 15.5) {
    color = mix(color, vec3(0.5, 0.6, 0.7), vGestureIntensity * 0.4);
  }
  // PULSE (16) - Electric blue
  else if (uGestureState > 15.5 && uGestureState < 16.5) {
    color = mix(color, vec3(0.3, 0.6, 1.0), vGestureIntensity * 0.8);
  }
  // SCATTER (18) - Rainbow chaos
  else if (uGestureState > 17.5 && uGestureState < 18.5) {
    color = mix(color, vec3(sin(vRandomness * 6.28) * 0.5 + 0.5, cos(vRandomness * 6.28) * 0.5 + 0.5, sin(vRandomness * 3.14) * 0.5 + 0.5), vGestureIntensity * 0.7);
  }
  // ATTRACT (19) - Bright pull
  else if (uGestureState > 18.5 && uGestureState < 19.5) {
    color = mix(color, vec3(1.0, 0.9, 0.6), vGestureIntensity * 0.6);
  }
  // REPEL (20) - Red push
  else if (uGestureState > 19.5 && uGestureState < 20.5) {
    color = mix(color, vec3(1.0, 0.3, 0.3), vGestureIntensity * 0.5);
  }
  // BURST (22) - Fire colors
  else if (uGestureState > 21.5 && uGestureState < 22.5) {
    float fireGradient = vGestureIntensity;
    color = mix(vec3(1.0, 0.2, 0.0), vec3(1.0, 0.8, 0.0), fireGradient);
  }
  // HEARTBEAT (23) - Pink pulse
  else if (uGestureState > 22.5 && uGestureState < 23.5) {
    color = mix(color, vec3(1.0, 0.4, 0.6), vGestureIntensity * 0.6);
  }
  
  // ============ TWO-HAND GESTURE COLORS (100-109) ============
  
  // STRETCH (100) - Gradient between hands
  else if (uGestureState > 99.5 && uGestureState < 100.5) {
    color = mix(uColorCore, uColorEnergy, vRandomness);
  }
  // COMPRESS (101) - Bright white core
  else if (uGestureState > 100.5 && uGestureState < 101.5) {
    color = mix(color, vec3(1.0), vGestureIntensity * 0.6);
  }
  // CLAP (102) - Shockwave gold
  else if (uGestureState > 101.5 && uGestureState < 102.5) {
    color = mix(color, vec3(1.0, 0.9, 0.4), vGestureIntensity * 0.8);
  }
  // MERGE (103) - Bright fusion
  else if (uGestureState > 102.5 && uGestureState < 103.5) {
    color = mix(color, vec3(1.0, 1.0, 0.8), vGestureIntensity * 0.7);
  }
  // TWIST (105) - DNA colors
  else if (uGestureState > 104.5 && uGestureState < 105.5) {
    float side = step(0.5, vRandomness);
    color = mix(vec3(0.2, 0.6, 1.0), vec3(1.0, 0.3, 0.5), side);
  }
  // TEAR (106) - Split colors
  else if (uGestureState > 105.5 && uGestureState < 106.5) {
    float side = step(0.5, vRandomness);
    color = mix(uColorCore, uColorAccent, side);
    color *= 1.0 + vGestureIntensity * 0.3;
  }
  
  // ============ COMMON EFFECTS ============
  
  // Proximity glow
  float proximityGlow = smoothstep(2.0, 0.0, vDistanceToAttractor);
  color += uColorEnergy * proximityGlow * 0.4;
  
  // Gesture intensity glow
  color += vec3(0.3, 0.6, 1.0) * vGestureIntensity * 0.2;
  
  // Two-hand special glow
  if (vTwoHandBlend > 0.5) {
    color += vec3(0.2, 0.4, 0.6) * 0.15;
  }
  
  // Listening mode glow
  if (uListening > 0.5) {
    float listenGlow = sin(uTime * 4.0) * 0.3 + 0.7;
    color += vec3(0.0, 0.6, 0.8) * listenGlow * 0.25;
  }
  
  // Core brightness - enhanced for cosmic glow
  float radialGradient = 1.0 - smoothstep(0.0, 0.5, dist);
  float coreBrightness = smoothstep(0.35, 0.0, dist);
  color += colorStarWhite * coreBrightness * 0.5;
  
  // Add subtle shimmer
  float shimmer = sin(uTime * 8.0 + vRandomness * 20.0) * 0.5 + 0.5;
  color += colorCyan * shimmer * 0.1 * vGestureIntensity;
  
  // Alpha with enhanced visibility
  float alpha = radialGradient * (0.6 + vPulse * 0.4);
  alpha *= 0.9 + vGestureIntensity * 0.1;
  
  gl_FragColor = vec4(color, alpha);
}
