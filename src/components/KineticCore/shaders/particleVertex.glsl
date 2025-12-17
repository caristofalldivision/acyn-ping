uniform float uTime;
uniform float uPulseIntensity;
uniform vec3 uAttractorPosition;
uniform float uGestureState;
uniform float uListening;

attribute float aRandomness;
attribute float aPhase;
attribute float aScale;

varying float vDistanceToAttractor;
varying float vPulse;
varying float vRandomness;

void main() {
  vec3 pos = position;
  
  // Pulsing effect - digital nervous system
  float pulse = sin(uTime * 2.0 + aPhase) * 0.5 + 0.5;
  float breathe = sin(uTime * 0.8 + aPhase * 0.5) * 0.3 + 0.7;
  
  // Base organic movement
  pos += normalize(pos) * pulse * uPulseIntensity * aRandomness * 0.15;
  
  // Attraction to finger
  vec3 toAttractor = uAttractorPosition - pos;
  float dist = length(toAttractor);
  vDistanceToAttractor = dist;
  
  // Gesture-based behavior
  if (uGestureState > 0.5 && uGestureState < 1.5) {
    // PINCH: Condense into tight cube formation
    vec3 cubePos = sign(pos) * vec3(0.4);
    pos = mix(pos, cubePos, 0.15);
  } else if (uGestureState > 1.5 && uGestureState < 2.5) {
    // OPEN PALM: Expand breathing cloud
    float expandFactor = 1.0 + sin(uTime * 0.5) * 0.4;
    pos *= expandFactor;
  } else if (uGestureState > 2.5) {
    // POINT: Spiral towards finger
    float angle = uTime * 2.0 + aPhase;
    vec3 spiral = vec3(cos(angle), sin(angle), 0.0) * 0.1;
    pos += spiral * smoothstep(3.0, 0.5, dist);
  }
  
  // Attract particles to finger tip
  float attractStrength = smoothstep(2.5, 0.3, dist) * 0.15;
  pos += normalize(toAttractor) * attractStrength;
  
  // Listening mode - more energetic movement
  if (uListening > 0.5) {
    float listenPulse = sin(uTime * 6.0 + aPhase * 3.0) * 0.1;
    pos += normalize(pos) * listenPulse;
  }
  
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  
  // Point size based on depth and pulse
  float sizeScale = aScale * (0.8 + pulse * 0.4);
  gl_PointSize = (35.0 / -mvPosition.z) * sizeScale;
  
  // Increase size when listening
  if (uListening > 0.5) {
    gl_PointSize *= 1.2;
  }
  
  vPulse = pulse * breathe;
  vRandomness = aRandomness;
}
