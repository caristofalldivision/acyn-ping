uniform vec3 uColorCore;
uniform vec3 uColorAccent;
uniform float uTime;
uniform float uListening;

varying float vDistanceToAttractor;
varying float vPulse;
varying float vRandomness;

void main() {
  // Circular particle shape with soft edges
  vec2 center = gl_PointCoord - vec2(0.5);
  float dist = length(center);
  
  if (dist > 0.5) discard;
  
  // Color gradient based on pulse and randomness
  float colorMix = vPulse * 0.6 + vRandomness * 0.4;
  vec3 color = mix(uColorCore, uColorAccent, colorMix);
  
  // Glow based on proximity to finger
  float proximityGlow = smoothstep(2.0, 0.0, vDistanceToAttractor);
  color += vec3(0.2, 0.9, 1.0) * proximityGlow * 0.4;
  
  // Listening mode - brighter cyan glow
  if (uListening > 0.5) {
    float listenGlow = sin(uTime * 4.0) * 0.3 + 0.7;
    color += vec3(0.0, 0.6, 0.8) * listenGlow * 0.3;
  }
  
  // Soft radial gradient for glow effect
  float radialGradient = 1.0 - smoothstep(0.0, 0.5, dist);
  
  // Core brightness
  float coreBrightness = smoothstep(0.4, 0.0, dist);
  color += vec3(1.0) * coreBrightness * 0.3;
  
  // Edge softening and alpha
  float alpha = radialGradient * (0.5 + vPulse * 0.5);
  alpha *= 0.85;
  
  gl_FragColor = vec4(color, alpha);
}
