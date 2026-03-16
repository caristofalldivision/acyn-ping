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

vec3 colorDeepSpace = vec3(0.05, 0.05, 0.2);
vec3 colorNebulaPurple = vec3(0.6, 0.2, 0.9);
vec3 colorStarWhite = vec3(1.0, 0.97, 0.92);
vec3 colorCyan = vec3(0.0, 0.85, 1.0);
vec3 colorMagenta = vec3(1.0, 0.1, 0.6);
vec3 colorGold = vec3(1.0, 0.85, 0.3);
vec3 colorFire = vec3(1.0, 0.4, 0.1);

void main() {
  vec2 center = gl_PointCoord - vec2(0.5);
  float dist = length(center);
  
  // Soft star-like falloff instead of hard cutoff
  float starGlow = exp(-dist * dist * 8.0);
  if (starGlow < 0.01) discard;
  
  // Base color
  float colorMix = vPulse * 0.5 + vRandomness * 0.5;
  vec3 color = mix(uColorCore, uColorAccent, colorMix);
  
  // Bright star core for some particles
  float isBrightStar = step(0.85, vRandomness);
  color = mix(color, colorStarWhite, isBrightStar * 0.6);
  
  // ============ GESTURE COLORS ============
  
  // FIST (4) - Fire
  if (uGestureState > 3.5 && uGestureState < 4.5) {
    color = mix(color, colorFire, vGestureIntensity * 0.7);
  }
  // SPREAD (8) - Golden
  else if (uGestureState > 7.5 && uGestureState < 8.5) {
    color = mix(color, colorGold, vGestureIntensity * 0.7);
  }
  // ROCK (12) - Magenta
  else if (uGestureState > 11.5 && uGestureState < 12.5) {
    color = mix(color, colorMagenta, vGestureIntensity * 0.8);
  }
  // PEACE (5) - Dual
  else if (uGestureState > 4.5 && uGestureState < 5.5) {
    float side = step(0.5, vRandomness);
    color = mix(uColorCore, uColorEnergy, side);
  }
  // GUN (11) - Cyan beam
  else if (uGestureState > 10.5 && uGestureState < 11.5) {
    color = mix(color, vec3(0.2, 1.0, 0.9), vGestureIntensity * 0.9);
  }
  // THUMB UP (6)
  else if (uGestureState > 5.5 && uGestureState < 6.5) {
    color = mix(color, vec3(1.0, 0.6, 0.2), vGestureIntensity * 0.5);
  }
  // PALM DOWN (7)
  else if (uGestureState > 6.5 && uGestureState < 7.5) {
    color = mix(color, vec3(0.3, 0.5, 1.0), vGestureIntensity * 0.5);
  }
  // GALAXY (13) - Cosmic nebula
  else if (uGestureState > 12.5 && uGestureState < 13.5) {
    color = mix(colorNebulaPurple, colorCyan, vRandomness);
    color += colorStarWhite * vGestureIntensity * 0.5;
    color += vec3(0.3, 0.1, 0.5) * sin(vRandomness * 6.28 + uTime);
  }
  // VORTEX (14) - Green wind
  else if (uGestureState > 13.5 && uGestureState < 14.5) {
    color = mix(color, vec3(0.2, 0.9, 0.5), vGestureIntensity * 0.6);
  }
  // TORNADO (15)
  else if (uGestureState > 14.5 && uGestureState < 15.5) {
    color = mix(color, vec3(0.5, 0.6, 0.7), vGestureIntensity * 0.5);
  }
  // PULSE (16) - Electric
  else if (uGestureState > 15.5 && uGestureState < 16.5) {
    color = mix(color, vec3(0.3, 0.6, 1.0), vGestureIntensity * 0.9);
  }
  // SCATTER (18) - Rainbow
  else if (uGestureState > 17.5 && uGestureState < 18.5) {
    color = mix(color, vec3(
      sin(vRandomness * 6.28) * 0.5 + 0.5,
      cos(vRandomness * 6.28) * 0.5 + 0.5,
      sin(vRandomness * 3.14) * 0.5 + 0.5
    ), vGestureIntensity * 0.8);
  }
  // ATTRACT (19)
  else if (uGestureState > 18.5 && uGestureState < 19.5) {
    color = mix(color, vec3(1.0, 0.9, 0.6), vGestureIntensity * 0.7);
  }
  // REPEL (20)
  else if (uGestureState > 19.5 && uGestureState < 20.5) {
    color = mix(color, vec3(1.0, 0.3, 0.3), vGestureIntensity * 0.6);
  }
  // BURST (22) - Fire gradient
  else if (uGestureState > 21.5 && uGestureState < 22.5) {
    color = mix(vec3(1.0, 0.2, 0.0), vec3(1.0, 0.8, 0.0), vGestureIntensity);
  }
  // HEARTBEAT (23) - Pink
  else if (uGestureState > 22.5 && uGestureState < 23.5) {
    color = mix(color, vec3(1.0, 0.4, 0.6), vGestureIntensity * 0.7);
  }
  
  // ============ TWO-HAND COLORS ============
  
  else if (uGestureState > 99.5 && uGestureState < 100.5) {
    color = mix(uColorCore, uColorEnergy, vRandomness);
  }
  else if (uGestureState > 100.5 && uGestureState < 101.5) {
    color = mix(color, colorStarWhite, vGestureIntensity * 0.7);
  }
  else if (uGestureState > 101.5 && uGestureState < 102.5) {
    color = mix(color, colorGold, vGestureIntensity * 0.9);
  }
  else if (uGestureState > 102.5 && uGestureState < 103.5) {
    color = mix(color, vec3(1.0, 1.0, 0.8), vGestureIntensity * 0.8);
  }
  else if (uGestureState > 104.5 && uGestureState < 105.5) {
    float side = step(0.5, vRandomness);
    color = mix(vec3(0.2, 0.6, 1.0), vec3(1.0, 0.3, 0.5), side);
  }
  else if (uGestureState > 105.5 && uGestureState < 106.5) {
    float side = step(0.5, vRandomness);
    color = mix(uColorCore, uColorAccent, side);
    color *= 1.0 + vGestureIntensity * 0.4;
  }
  
  // ============ COMMON EFFECTS ============
  
  // Proximity glow
  float proximityGlow = smoothstep(2.5, 0.0, vDistanceToAttractor);
  color += uColorEnergy * proximityGlow * 0.5;
  
  // Gesture intensity glow
  color += vec3(0.3, 0.6, 1.0) * vGestureIntensity * 0.25;
  
  // Two-hand glow
  if (vTwoHandBlend > 0.5) {
    color += vec3(0.2, 0.4, 0.6) * 0.2;
  }
  
  // Listening glow
  if (uListening > 0.5) {
    float listenGlow = sin(uTime * 4.0) * 0.3 + 0.7;
    color += vec3(0.0, 0.6, 0.8) * listenGlow * 0.3;
  }
  
  // Hot white core per particle (star-like)
  float coreBrightness = exp(-dist * dist * 20.0);
  color += colorStarWhite * coreBrightness * 0.6;
  
  // Shimmer
  float shimmer = sin(uTime * 8.0 + vRandomness * 20.0) * 0.5 + 0.5;
  color += colorCyan * shimmer * 0.12 * vGestureIntensity;
  
  // Alpha with star glow
  float alpha = starGlow * (0.5 + vPulse * 0.5);
  alpha *= 0.85 + vGestureIntensity * 0.15;
  // Bright stars are more opaque
  alpha = mix(alpha, alpha * 1.5, isBrightStar);
  
  gl_FragColor = vec4(color, alpha);
}
