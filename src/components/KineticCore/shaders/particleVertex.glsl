uniform float uTime;
uniform float uPulseIntensity;
uniform vec3 uAttractorPosition;
uniform float uGestureState;
uniform float uListening;
uniform float uFingerSpread;
uniform vec3 uPalmNormal;

attribute float aRandomness;
attribute float aPhase;
attribute float aScale;

varying float vDistanceToAttractor;
varying float vPulse;
varying float vRandomness;
varying float vGestureIntensity;

// Noise function for organic movement
float noise(vec3 p) {
  return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
}

// Rotation matrices
mat3 rotateY(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat3(c, 0, s, 0, 1, 0, -s, 0, c);
}

mat3 rotateX(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat3(1, 0, 0, 0, c, -s, 0, s, c);
}

mat3 rotateZ(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat3(c, -s, 0, s, c, 0, 0, 0, 1);
}

void main() {
  vec3 pos = position;
  vec3 originalPos = position;
  
  // Base pulsing effect - digital nervous system
  float pulse = sin(uTime * 2.0 + aPhase) * 0.5 + 0.5;
  float breathe = sin(uTime * 0.8 + aPhase * 0.5) * 0.3 + 0.7;
  
  // Organic base movement
  pos += normalize(pos) * pulse * uPulseIntensity * aRandomness * 0.12;
  
  // Attractor calculations
  vec3 toAttractor = uAttractorPosition - pos;
  float dist = length(toAttractor);
  vDistanceToAttractor = dist;
  
  float gestureBlend = 0.2;
  vGestureIntensity = 0.0;
  
  // ============ GESTURE-BASED FORMATIONS ============
  
  // 0: IDLE - Gentle spherical float
  if (uGestureState < 0.5) {
    float idleFloat = sin(uTime * 0.5 + aPhase) * 0.05;
    pos += normalize(pos) * idleFloat;
  }
  
  // 1: PINCH - Condense into tight rotating cube
  else if (uGestureState > 0.5 && uGestureState < 1.5) {
    vec3 cubePos = sign(originalPos) * vec3(0.35);
    cubePos = rotateY(uTime * 0.5) * cubePos;
    pos = mix(pos, cubePos, gestureBlend);
    vGestureIntensity = 0.8;
  }
  
  // 2: PALM - Expand into breathing cloud
  else if (uGestureState > 1.5 && uGestureState < 2.5) {
    float expandFactor = 1.3 + sin(uTime * 0.5) * 0.4;
    pos *= expandFactor;
    pos += vec3(
      sin(uTime + aPhase * 2.0) * 0.1,
      cos(uTime * 0.8 + aPhase) * 0.1,
      sin(uTime * 1.2 + aPhase * 0.5) * 0.1
    ) * aRandomness;
    vGestureIntensity = 0.5;
  }
  
  // 3: POINT - Spiral towards finger
  else if (uGestureState > 2.5 && uGestureState < 3.5) {
    float angle = uTime * 3.0 + aPhase * 6.28;
    float spiralRadius = 0.15 * smoothstep(0.0, 2.0, dist);
    vec3 spiral = vec3(cos(angle) * spiralRadius, sin(angle) * spiralRadius, 0.0);
    pos += spiral;
    float attractStrength = smoothstep(3.0, 0.3, dist) * 0.3;
    pos += normalize(toAttractor) * attractStrength;
    vGestureIntensity = 1.0;
  }
  
  // 4: FIST - Implode into tight sphere
  else if (uGestureState > 3.5 && uGestureState < 4.5) {
    float implodeRadius = 0.25;
    vec3 implodeTarget = normalize(originalPos) * implodeRadius;
    implodeTarget = rotateY(uTime * 2.0) * rotateX(uTime * 1.5) * implodeTarget;
    pos = mix(pos, implodeTarget, gestureBlend * 1.5);
    pos += vec3(noise(pos + uTime) - 0.5, noise(pos + uTime + 1.0) - 0.5, noise(pos + uTime + 2.0) - 0.5) * 0.03;
    vGestureIntensity = 1.0;
  }
  
  // 5: PEACE - DNA helix
  else if (uGestureState > 4.5 && uGestureState < 5.5) {
    float helixAngle = uTime * 2.0 + aPhase * 6.28;
    float helixY = (aPhase - 0.5) * 3.0;
    float helixRadius = 0.6 + sin(helixY * 2.0 + uTime) * 0.2;
    float side = step(0.5, aRandomness) * 2.0 - 1.0;
    vec3 helixPos = vec3(
      cos(helixAngle + side * 3.14159) * helixRadius,
      helixY,
      sin(helixAngle + side * 3.14159) * helixRadius
    );
    pos = mix(pos, helixPos, gestureBlend);
    vGestureIntensity = 0.7;
  }
  
  // 6: THUMB UP - Rise up
  else if (uGestureState > 5.5 && uGestureState < 6.5) {
    float rise = sin(uTime * 3.0 + aPhase * 6.28) * 0.5 + 0.5;
    pos.y += rise * 0.8;
    float funnelRadius = 0.3 + pos.y * 0.2;
    float funnelAngle = uTime * 2.0 + aPhase * 6.28;
    pos.x = cos(funnelAngle) * funnelRadius * (1.0 - rise * 0.5);
    pos.z = sin(funnelAngle) * funnelRadius * (1.0 - rise * 0.5);
    vGestureIntensity = 0.6;
  }
  
  // 7: PALM DOWN - Flatten into disc
  else if (uGestureState > 6.5 && uGestureState < 7.5) {
    pos.y *= 0.1;
    float discRadius = length(originalPos.xz);
    float discAngle = atan(originalPos.z, originalPos.x) + uTime * 0.5;
    pos.x = cos(discAngle) * discRadius * 1.5;
    pos.z = sin(discAngle) * discRadius * 1.5;
    pos.y += sin(discRadius * 10.0 - uTime * 3.0) * 0.05;
    pos = mix(position, pos, gestureBlend);
    vGestureIntensity = 0.5;
  }
  
  // 8: SPREAD - Explosion
  else if (uGestureState > 7.5 && uGestureState < 8.5) {
    float explosionForce = 2.5 + sin(uTime * 0.5) * 0.5;
    vec3 explodeDir = normalize(originalPos);
    pos = explodeDir * explosionForce * (0.5 + aRandomness * 0.5);
    pos += vec3(
      sin(uTime * 3.0 + aPhase * 10.0),
      cos(uTime * 2.5 + aPhase * 8.0),
      sin(uTime * 2.0 + aPhase * 12.0)
    ) * 0.3 * aRandomness;
    pos = mix(position, pos, gestureBlend * 0.5);
    vGestureIntensity = 1.0;
  }
  
  // 9: GRAB - Gravitational pull
  else if (uGestureState > 8.5 && uGestureState < 9.5) {
    vec3 pullTarget = uAttractorPosition;
    float pullStrength = smoothstep(4.0, 0.0, dist) * 0.5;
    pos = mix(pos, pullTarget, pullStrength * aRandomness);
    float orbitAngle = uTime * 4.0 + aPhase * 6.28;
    float orbitRadius = dist * 0.3;
    pos += vec3(cos(orbitAngle), sin(orbitAngle * 0.7), sin(orbitAngle)) * orbitRadius * 0.2;
    vGestureIntensity = 0.9;
  }
  
  // 10: WAVE - Ripple effect
  else if (uGestureState > 9.5 && uGestureState < 10.5) {
    float waveFreq = 4.0;
    float waveAmp = 0.3;
    float wavePhase = length(originalPos.xz) * waveFreq - uTime * 4.0;
    pos.y += sin(wavePhase + aPhase) * waveAmp;
    pos.x += cos(wavePhase * 0.5) * waveAmp * 0.3;
    pos.x *= 1.3;
    pos.z *= 1.3;
    pos = mix(position, pos, gestureBlend);
    vGestureIntensity = 0.6;
  }
  
  // 11: GUN - Beam focus
  else if (uGestureState > 10.5 && uGestureState < 11.5) {
    vec3 beamDir = normalize(uAttractorPosition);
    float beamPos = aPhase * 4.0 + uTime * 2.0;
    beamPos = mod(beamPos, 4.0);
    float beamRadius = 0.08 + sin(beamPos * 3.14159) * 0.02;
    float beamAngle = aRandomness * 6.28;
    vec3 beamTarget = beamDir * beamPos + vec3(cos(beamAngle), sin(beamAngle), 0.0) * beamRadius;
    beamTarget = rotateY(atan(beamDir.x, beamDir.z)) * beamTarget;
    pos = mix(pos, beamTarget, gestureBlend * 1.5);
    vGestureIntensity = 1.0;
  }
  
  // 12: ROCK - Chaotic vibration
  else if (uGestureState > 11.5) {
    float chaos = 0.4;
    pos += vec3(
      sin(uTime * 20.0 + aPhase * 50.0) * chaos,
      cos(uTime * 18.0 + aPhase * 45.0) * chaos,
      sin(uTime * 22.0 + aPhase * 55.0) * chaos
    ) * aRandomness;
    float spike = step(0.7, aRandomness);
    pos *= 1.0 + spike * sin(uTime * 10.0 + aPhase * 20.0) * 0.5;
    vGestureIntensity = 1.0;
  }
  
  // Basic finger attraction (idle)
  float baseAttraction = smoothstep(2.5, 0.3, dist) * 0.08;
  if (uGestureState < 0.5) {
    pos += normalize(toAttractor) * baseAttraction;
  }
  
  // Listening mode
  if (uListening > 0.5) {
    float listenPulse = sin(uTime * 6.0 + aPhase * 3.0) * 0.12;
    pos += normalize(pos) * listenPulse;
  }
  
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  
  float sizeScale = aScale * (0.8 + pulse * 0.4);
  sizeScale *= 1.0 + vGestureIntensity * 0.3;
  gl_PointSize = (35.0 / -mvPosition.z) * sizeScale;
  
  if (uListening > 0.5) {
    gl_PointSize *= 1.15;
  }
  
  vPulse = pulse * breathe;
  vRandomness = aRandomness;
}
