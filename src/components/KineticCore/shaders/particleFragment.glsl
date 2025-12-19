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

void main() {
  vec2 center = gl_PointCoord - vec2(0.5);
  float dist = length(center);
  
  if (dist > 0.5) discard;
  
  // Base color mixing
  float colorMix = vPulse * 0.6 + vRandomness * 0.4;
  vec3 color = mix(uColorCore, uColorAccent, colorMix);
  
  // Gesture-specific coloring
  if (uGestureState > 3.5 && uGestureState < 4.5) {
    // FIST - Red/orange intense
    color = mix(color, vec3(1.0, 0.3, 0.1), vGestureIntensity * 0.5);
  } else if (uGestureState > 7.5 && uGestureState < 8.5) {
    // SPREAD - Golden explosion
    color = mix(color, vec3(1.0, 0.8, 0.2), vGestureIntensity * 0.6);
  } else if (uGestureState > 11.5) {
    // ROCK - Red/magenta chaos
    color = mix(color, vec3(1.0, 0.1, 0.5), vGestureIntensity * 0.7);
  } else if (uGestureState > 4.5 && uGestureState < 5.5) {
    // PEACE - Dual colored helix
    float side = step(0.5, vRandomness);
    color = mix(uColorCore, uColorEnergy, side);
  } else if (uGestureState > 10.5 && uGestureState < 11.5) {
    // GUN - Bright beam
    color = mix(color, vec3(0.2, 1.0, 0.8), vGestureIntensity * 0.8);
  } else if (uGestureState > 5.5 && uGestureState < 6.5) {
    // THUMB UP - Warm rising glow
    color = mix(color, vec3(1.0, 0.6, 0.2), vGestureIntensity * 0.4);
  } else if (uGestureState > 6.5 && uGestureState < 7.5) {
    // PALM DOWN - Cool disc
    color = mix(color, vec3(0.3, 0.5, 1.0), vGestureIntensity * 0.4);
  }
  
  // Proximity glow
  float proximityGlow = smoothstep(2.0, 0.0, vDistanceToAttractor);
  color += uColorEnergy * proximityGlow * 0.4;
  
  // Gesture intensity glow
  color += vec3(0.3, 0.6, 1.0) * vGestureIntensity * 0.2;
  
  // Listening mode glow
  if (uListening > 0.5) {
    float listenGlow = sin(uTime * 4.0) * 0.3 + 0.7;
    color += vec3(0.0, 0.6, 0.8) * listenGlow * 0.25;
  }
  
  // Core brightness
  float radialGradient = 1.0 - smoothstep(0.0, 0.5, dist);
  float coreBrightness = smoothstep(0.4, 0.0, dist);
  color += vec3(1.0) * coreBrightness * 0.35;
  
  // Alpha
  float alpha = radialGradient * (0.5 + vPulse * 0.5);
  alpha *= 0.85 + vGestureIntensity * 0.15;
  
  gl_FragColor = vec4(color, alpha);
}
