uniform float uTime;
uniform float uPulseIntensity;
uniform vec3 uAttractorPosition;
uniform vec3 uAttractorPosition2;
uniform float uInterHandDistance;
uniform float uGestureState;
uniform float uListening;
uniform float uFingerSpread;
uniform vec3 uPalmNormal;
uniform float uGestureVelocity;

attribute float aRandomness;
attribute float aPhase;
attribute float aScale;

varying float vDistanceToAttractor;
varying float vPulse;
varying float vRandomness;
varying float vGestureIntensity;
varying float vTwoHandBlend;

// Optimized noise function
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
  
  float pulse = sin(uTime * 2.0 + aPhase) * 0.5 + 0.5;
  float breathe = sin(uTime * 0.8 + aPhase * 0.5) * 0.3 + 0.7;
  
  pos += normalize(pos) * pulse * uPulseIntensity * aRandomness * 0.1;
  
  vec3 toAttractor = uAttractorPosition - pos;
  float dist = length(toAttractor);
  vDistanceToAttractor = dist;
  
  float gestureBlend = 0.25;
  vGestureIntensity = 0.0;
  vTwoHandBlend = 0.0;
  
  // ============ SINGLE-HAND GESTURES (0-23) ============
  
  // 0: IDLE
  if (uGestureState < 0.5) {
    float idleFloat = sin(uTime * 0.5 + aPhase) * 0.05;
    pos += normalize(pos) * idleFloat;
  }
  
  // 1: PINCH - Cube
  else if (uGestureState > 0.5 && uGestureState < 1.5) {
    vec3 cubePos = sign(originalPos) * vec3(0.35);
    cubePos = rotateY(uTime * 0.5) * cubePos;
    pos = mix(pos, cubePos, gestureBlend);
    vGestureIntensity = 0.8;
  }
  
  // 2: PALM - Breathing cloud
  else if (uGestureState > 1.5 && uGestureState < 2.5) {
    float expandFactor = 1.3 + sin(uTime * 0.5) * 0.4;
    pos *= expandFactor;
    pos += vec3(sin(uTime + aPhase * 2.0), cos(uTime * 0.8 + aPhase), sin(uTime * 1.2 + aPhase * 0.5)) * 0.1 * aRandomness;
    vGestureIntensity = 0.5;
  }
  
  // 3: POINT - Spiral
  else if (uGestureState > 2.5 && uGestureState < 3.5) {
    float angle = uTime * 3.0 + aPhase * 6.28;
    float spiralRadius = 0.15 * smoothstep(0.0, 2.0, dist);
    vec3 spiral = vec3(cos(angle) * spiralRadius, sin(angle) * spiralRadius, 0.0);
    pos += spiral;
    float attractStrength = smoothstep(3.0, 0.3, dist) * 0.3;
    pos += normalize(toAttractor) * attractStrength;
    vGestureIntensity = 1.0;
  }
  
  // 4: FIST - Implode
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
    vec3 helixPos = vec3(cos(helixAngle + side * 3.14159) * helixRadius, helixY, sin(helixAngle + side * 3.14159) * helixRadius);
    pos = mix(pos, helixPos, gestureBlend);
    vGestureIntensity = 0.7;
  }
  
  // 6: THUMB UP - Rise
  else if (uGestureState > 5.5 && uGestureState < 6.5) {
    float rise = sin(uTime * 3.0 + aPhase * 6.28) * 0.5 + 0.5;
    pos.y += rise * 0.8;
    float funnelRadius = 0.3 + pos.y * 0.2;
    float funnelAngle = uTime * 2.0 + aPhase * 6.28;
    pos.x = cos(funnelAngle) * funnelRadius * (1.0 - rise * 0.5);
    pos.z = sin(funnelAngle) * funnelRadius * (1.0 - rise * 0.5);
    vGestureIntensity = 0.6;
  }
  
  // 7: PALM DOWN - Disc
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
    pos += vec3(sin(uTime * 3.0 + aPhase * 10.0), cos(uTime * 2.5 + aPhase * 8.0), sin(uTime * 2.0 + aPhase * 12.0)) * 0.3 * aRandomness;
    pos = mix(position, pos, gestureBlend * 0.5);
    vGestureIntensity = 1.0;
  }
  
  // 9: GRAB - Pull
  else if (uGestureState > 8.5 && uGestureState < 9.5) {
    vec3 pullTarget = uAttractorPosition;
    float pullStrength = smoothstep(4.0, 0.0, dist) * 0.5;
    pos = mix(pos, pullTarget, pullStrength * aRandomness);
    float orbitAngle = uTime * 4.0 + aPhase * 6.28;
    float orbitRadius = dist * 0.3;
    pos += vec3(cos(orbitAngle), sin(orbitAngle * 0.7), sin(orbitAngle)) * orbitRadius * 0.2;
    vGestureIntensity = 0.9;
  }
  
  // 10: WAVE - Ripple
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
  
  // 11: GUN - Beam
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
  
  // 12: ROCK - Chaos
  else if (uGestureState > 11.5 && uGestureState < 12.5) {
    float chaos = 0.4;
    pos += vec3(sin(uTime * 20.0 + aPhase * 50.0), cos(uTime * 18.0 + aPhase * 45.0), sin(uTime * 22.0 + aPhase * 55.0)) * chaos * aRandomness;
    float spike = step(0.7, aRandomness);
    pos *= 1.0 + spike * sin(uTime * 10.0 + aPhase * 20.0) * 0.5;
    vGestureIntensity = 1.0;
  }
  
  // 13: GALAXY - Spiral arms
  else if (uGestureState > 12.5 && uGestureState < 13.5) {
    float armCount = 3.0;
    float armAngle = atan(originalPos.z, originalPos.x);
    float radius = length(originalPos.xz);
    float spiralOffset = radius * 2.0 - uTime * 0.5;
    float armPhase = mod(armAngle + spiralOffset, 6.28318 / armCount);
    float armDensity = smoothstep(0.5, 0.0, abs(armPhase - 3.14159 / armCount));
    
    float newRadius = radius * (0.8 + armDensity * 0.6);
    float newAngle = armAngle + uTime * 0.3;
    pos.x = cos(newAngle) * newRadius * 1.8;
    pos.z = sin(newAngle) * newRadius * 1.8;
    pos.y = originalPos.y * 0.2 + sin(radius * 3.0 + uTime) * 0.1;
    pos = mix(position, pos, gestureBlend);
    vGestureIntensity = 0.8;
  }
  
  // 14: VORTEX - Tornado funnel
  else if (uGestureState > 13.5 && uGestureState < 14.5) {
    float height = (aPhase - 0.5) * 4.0;
    float vortexRadius = 0.3 + abs(height) * 0.4;
    float vortexSpeed = 3.0 - abs(height) * 0.5;
    float vortexAngle = uTime * vortexSpeed + aPhase * 6.28;
    
    pos.x = cos(vortexAngle) * vortexRadius;
    pos.z = sin(vortexAngle) * vortexRadius;
    pos.y = height;
    pos += vec3(noise(pos + uTime) - 0.5) * 0.1;
    pos = mix(position, pos, gestureBlend);
    vGestureIntensity = 0.9;
  }
  
  // 15: TORNADO - Horizontal cyclone
  else if (uGestureState > 14.5 && uGestureState < 15.5) {
    float length = (aPhase - 0.5) * 4.0;
    float cycloneRadius = 0.4 + sin(length * 2.0 + uTime) * 0.2;
    float cycloneAngle = uTime * 4.0 + aPhase * 6.28 + length;
    
    pos.y = cos(cycloneAngle) * cycloneRadius;
    pos.z = sin(cycloneAngle) * cycloneRadius;
    pos.x = length;
    pos = rotateY(uTime * 0.5) * pos;
    pos = mix(position, pos, gestureBlend);
    vGestureIntensity = 0.85;
  }
  
  // 16: PULSE - Shockwave rings
  else if (uGestureState > 15.5 && uGestureState < 16.5) {
    float waveTime = mod(uTime * 2.0, 3.0);
    float ringRadius = waveTime * 1.5;
    float particleRadius = length(originalPos);
    float ringDist = abs(particleRadius - ringRadius);
    float onRing = smoothstep(0.3, 0.0, ringDist);
    
    vec3 ringPos = normalize(originalPos) * ringRadius;
    ringPos.y *= 0.3;
    pos = mix(pos, ringPos, onRing * gestureBlend);
    vGestureIntensity = onRing;
  }
  
  // 17: ORBIT - Planetary orbits
  else if (uGestureState > 16.5 && uGestureState < 17.5) {
    float orbitIndex = floor(aRandomness * 5.0);
    float orbitRadius = 0.5 + orbitIndex * 0.3;
    float orbitSpeed = 1.0 + orbitIndex * 0.5;
    float orbitTilt = orbitIndex * 0.3;
    float orbitAngle = uTime * orbitSpeed + aPhase * 6.28;
    
    vec3 orbitPos = vec3(cos(orbitAngle) * orbitRadius, 0.0, sin(orbitAngle) * orbitRadius);
    orbitPos = rotateX(orbitTilt) * rotateZ(orbitIndex) * orbitPos;
    pos = mix(pos, orbitPos, gestureBlend);
    vGestureIntensity = 0.6;
  }
  
  // 18: SCATTER - Random dispersion
  else if (uGestureState > 17.5 && uGestureState < 18.5) {
    vec3 scatterDir = vec3(noise(originalPos + uTime) - 0.5, noise(originalPos + uTime + 10.0) - 0.5, noise(originalPos + uTime + 20.0) - 0.5);
    float scatterDist = 2.0 + aRandomness * 2.0;
    pos = scatterDir * scatterDist;
    pos += vec3(sin(uTime * 5.0 + aPhase * 8.0), cos(uTime * 4.0 + aPhase * 7.0), sin(uTime * 6.0 + aPhase * 9.0)) * 0.3;
    pos = mix(position, pos, gestureBlend * 0.7);
    vGestureIntensity = 1.0;
  }
  
  // 19: ATTRACT - Magnetic pull
  else if (uGestureState > 18.5 && uGestureState < 19.5) {
    float attractPower = smoothstep(4.0, 0.0, dist) * 0.8;
    vec3 curveOffset = vec3(sin(aPhase * 6.28 + uTime), cos(aPhase * 6.28 + uTime * 0.7), 0.0) * dist * 0.2;
    pos = mix(pos, uAttractorPosition + curveOffset, attractPower);
    vGestureIntensity = attractPower;
  }
  
  // 20: REPEL - Force push
  else if (uGestureState > 19.5 && uGestureState < 20.5) {
    vec3 repelDir = normalize(pos - uAttractorPosition);
    float repelStrength = smoothstep(0.0, 3.0, dist) * 2.5;
    pos += repelDir * repelStrength * (0.5 + aRandomness * 0.5);
    pos += vec3(noise(pos + uTime * 2.0) - 0.5) * 0.2;
    pos = mix(position, pos, gestureBlend);
    vGestureIntensity = 1.0 - smoothstep(0.0, 2.0, dist);
  }
  
  // 21: SWIRL - Gentle spiral
  else if (uGestureState > 20.5 && uGestureState < 21.5) {
    float swirlAngle = atan(originalPos.z, originalPos.x) + uTime * 0.5;
    float swirlRadius = length(originalPos.xz) * (1.0 + sin(uTime * 0.3) * 0.2);
    float swirlY = originalPos.y + sin(swirlAngle * 3.0 + uTime) * 0.15;
    pos.x = cos(swirlAngle) * swirlRadius;
    pos.z = sin(swirlAngle) * swirlRadius;
    pos.y = swirlY;
    pos = mix(position, pos, gestureBlend);
    vGestureIntensity = 0.4;
  }
  
  // 22: BURST - Firework
  else if (uGestureState > 21.5 && uGestureState < 22.5) {
    float burstTime = mod(uTime, 3.0);
    float burstPhase = smoothstep(0.0, 0.5, burstTime) * (1.0 - smoothstep(1.5, 3.0, burstTime));
    vec3 burstDir = normalize(originalPos);
    float burstDist = burstPhase * 3.0 * (0.5 + aRandomness * 0.5);
    pos = burstDir * burstDist;
    pos += vec3(0.0, -burstTime * 0.3 * burstPhase, 0.0); // Gravity
    pos = mix(position, pos, gestureBlend);
    vGestureIntensity = burstPhase;
  }
  
  // 23: HEARTBEAT - Rhythmic pulse
  else if (uGestureState > 22.5 && uGestureState < 23.5) {
    float heartbeat = sin(uTime * 5.0) * 0.5 + 0.5;
    heartbeat = pow(heartbeat, 3.0); // Sharper pulse
    float heartScale = 1.0 + heartbeat * 0.4;
    pos = normalize(originalPos) * length(originalPos) * heartScale;
    vGestureIntensity = heartbeat;
  }
  
  // ============ TWO-HAND GESTURES (100-109) ============
  
  // 100: STRETCH - Particles between hands
  else if (uGestureState > 99.5 && uGestureState < 100.5) {
    vec3 handDir = normalize(uAttractorPosition2 - uAttractorPosition);
    float t = aPhase;
    vec3 linePos = mix(uAttractorPosition, uAttractorPosition2, t);
    float waveOffset = sin(t * 10.0 + uTime * 3.0) * 0.1 * (1.0 - abs(t - 0.5) * 2.0);
    linePos += cross(handDir, vec3(0, 1, 0)) * waveOffset * aRandomness;
    pos = mix(pos, linePos, gestureBlend);
    vGestureIntensity = 0.8;
    vTwoHandBlend = 1.0;
  }
  
  // 101: COMPRESS - Squeeze together
  else if (uGestureState > 100.5 && uGestureState < 101.5) {
    vec3 center = (uAttractorPosition + uAttractorPosition2) * 0.5;
    float compressFactor = smoothstep(2.0, 0.3, uInterHandDistance);
    vec3 compressed = mix(originalPos, center, compressFactor * 0.8);
    compressed += vec3(noise(originalPos + uTime) - 0.5) * 0.1 * compressFactor;
    pos = mix(pos, compressed, gestureBlend);
    vGestureIntensity = compressFactor;
    vTwoHandBlend = 1.0;
  }
  
  // 102: CLAP - Shockwave
  else if (uGestureState > 101.5 && uGestureState < 102.5) {
    vec3 impactPoint = (uAttractorPosition + uAttractorPosition2) * 0.5;
    float shockwave = mod(uTime * 3.0, 2.0);
    float distFromImpact = length(originalPos - impactPoint);
    float onWave = smoothstep(0.3, 0.0, abs(distFromImpact - shockwave * 2.0));
    vec3 waveDir = normalize(originalPos - impactPoint);
    pos += waveDir * onWave * 0.5;
    pos = mix(position, pos, gestureBlend);
    vGestureIntensity = onWave;
    vTwoHandBlend = 1.0;
  }
  
  // 103: MERGE - Converge to point
  else if (uGestureState > 102.5 && uGestureState < 103.5) {
    vec3 mergePoint = (uAttractorPosition + uAttractorPosition2) * 0.5;
    float mergePull = smoothstep(3.0, 0.0, length(originalPos - mergePoint)) * 0.9;
    pos = mix(pos, mergePoint, mergePull * aRandomness);
    pos += vec3(sin(uTime * 8.0 + aPhase * 10.0), cos(uTime * 7.0 + aPhase * 9.0), sin(uTime * 9.0 + aPhase * 11.0)) * 0.05 * (1.0 - mergePull);
    vGestureIntensity = mergePull;
    vTwoHandBlend = 1.0;
  }
  
  // 104: ORBITING - Orbit around center
  else if (uGestureState > 103.5 && uGestureState < 104.5) {
    vec3 orbitCenter = uAttractorPosition;
    float orbitDist = uInterHandDistance * 0.5;
    float orbitAngle = uTime * 2.0 + aPhase * 6.28;
    float orbitHeight = sin(orbitAngle * 2.0) * 0.3;
    vec3 orbitPos = orbitCenter + vec3(cos(orbitAngle), orbitHeight, sin(orbitAngle)) * orbitDist * (0.5 + aRandomness * 0.5);
    pos = mix(pos, orbitPos, gestureBlend);
    vGestureIntensity = 0.7;
    vTwoHandBlend = 1.0;
  }
  
  // 105: TWIST - Double helix
  else if (uGestureState > 104.5 && uGestureState < 105.5) {
    vec3 axis = normalize(uAttractorPosition2 - uAttractorPosition);
    float t = aPhase;
    vec3 basePos = mix(uAttractorPosition, uAttractorPosition2, t);
    float twistAngle = uTime * 3.0 + t * 10.0;
    float side = step(0.5, aRandomness) * 2.0 - 1.0;
    float helixRadius = 0.3 * sin(t * 3.14159);
    vec3 perpendicular = normalize(cross(axis, vec3(0, 1, 0)));
    vec3 perpendicular2 = cross(axis, perpendicular);
    vec3 helixOffset = (perpendicular * cos(twistAngle + side * 3.14159) + perpendicular2 * sin(twistAngle + side * 3.14159)) * helixRadius;
    pos = mix(pos, basePos + helixOffset, gestureBlend);
    vGestureIntensity = 0.8;
    vTwoHandBlend = 1.0;
  }
  
  // 106: TEAR - Split into two
  else if (uGestureState > 105.5 && uGestureState < 106.5) {
    float side = step(0.5, aRandomness);
    vec3 target = mix(uAttractorPosition, uAttractorPosition2, side);
    float tearFactor = smoothstep(1.0, 2.0, uInterHandDistance);
    pos = mix(pos, target, tearFactor * 0.6);
    pos += vec3(noise(originalPos + uTime) - 0.5) * 0.15 * tearFactor;
    vGestureIntensity = tearFactor;
    vTwoHandBlend = 1.0;
  }
  
  // 107: PUSH - Push away
  else if (uGestureState > 106.5 && uGestureState < 107.5) {
    vec3 pushCenter = (uAttractorPosition + uAttractorPosition2) * 0.5;
    vec3 pushDir = vec3(0, 0, 1); // Push toward camera
    float pushDist = 2.0 + aRandomness;
    pos.z += pushDist * gestureBlend;
    pos.xy *= 0.7; // Flatten spread
    pos = mix(position, pos, gestureBlend);
    vGestureIntensity = 0.9;
    vTwoHandBlend = 1.0;
  }
  
  // 108: PULL - Pull toward
  else if (uGestureState > 107.5 && uGestureState < 108.5) {
    pos.z -= 1.5 * gestureBlend * (0.5 + aRandomness * 0.5);
    float convergeFactor = 1.0 - gestureBlend * 0.3;
    pos.xy *= convergeFactor;
    pos = mix(position, pos, gestureBlend);
    vGestureIntensity = 0.85;
    vTwoHandBlend = 1.0;
  }
  
  // 109: SPHERE - Contained sphere
  else if (uGestureState > 108.5 && uGestureState < 109.5) {
    vec3 sphereCenter = (uAttractorPosition + uAttractorPosition2) * 0.5;
    float sphereRadius = uInterHandDistance * 0.4;
    vec3 dirFromCenter = normalize(originalPos - sphereCenter);
    vec3 spherePos = sphereCenter + dirFromCenter * sphereRadius;
    spherePos += vec3(sin(uTime + aPhase * 3.0), cos(uTime * 0.8 + aPhase * 2.0), sin(uTime * 1.2 + aPhase)) * 0.05;
    pos = mix(pos, spherePos, gestureBlend);
    vGestureIntensity = 0.6;
    vTwoHandBlend = 1.0;
  }
  
  // ============ COMMON EFFECTS ============
  
  // Idle attraction
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
