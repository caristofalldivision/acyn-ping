import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ParticleSwarmProps, GESTURE_STATE_MAP } from './types';

// Enhanced vertex shader with all gesture formations
const vertexShader = `
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

// Smooth rotation
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
  
  float gestureBlend = 0.2; // Transition smoothness
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
    // Add some turbulence
    pos += vec3(
      sin(uTime + aPhase * 2.0) * 0.1,
      cos(uTime * 0.8 + aPhase) * 0.1,
      sin(uTime * 1.2 + aPhase * 0.5) * 0.1
    ) * aRandomness;
    vGestureIntensity = 0.5;
  }
  
  // 3: POINT - Spiral towards finger with trail
  else if (uGestureState > 2.5 && uGestureState < 3.5) {
    float angle = uTime * 3.0 + aPhase * 6.28;
    float spiralRadius = 0.15 * smoothstep(0.0, 2.0, dist);
    vec3 spiral = vec3(cos(angle) * spiralRadius, sin(angle) * spiralRadius, 0.0);
    pos += spiral;
    float attractStrength = smoothstep(3.0, 0.3, dist) * 0.3;
    pos += normalize(toAttractor) * attractStrength;
    vGestureIntensity = 1.0;
  }
  
  // 4: FIST - Implode into tight dense sphere
  else if (uGestureState > 3.5 && uGestureState < 4.5) {
    float implodeRadius = 0.25;
    vec3 implodeTarget = normalize(originalPos) * implodeRadius;
    implodeTarget = rotateY(uTime * 2.0) * rotateX(uTime * 1.5) * implodeTarget;
    pos = mix(pos, implodeTarget, gestureBlend * 1.5);
    // Vibration when compressed
    pos += vec3(noise(pos + uTime) - 0.5, noise(pos + uTime + 1.0) - 0.5, noise(pos + uTime + 2.0) - 0.5) * 0.03;
    vGestureIntensity = 1.0;
  }
  
  // 5: PEACE - Split into dual vortex (DNA helix)
  else if (uGestureState > 4.5 && uGestureState < 5.5) {
    float helixAngle = uTime * 2.0 + aPhase * 6.28;
    float helixY = (aPhase - 0.5) * 3.0;
    float helixRadius = 0.6 + sin(helixY * 2.0 + uTime) * 0.2;
    float side = step(0.5, aRandomness) * 2.0 - 1.0; // Split into two sides
    vec3 helixPos = vec3(
      cos(helixAngle + side * 3.14159) * helixRadius,
      helixY,
      sin(helixAngle + side * 3.14159) * helixRadius
    );
    pos = mix(pos, helixPos, gestureBlend);
    vGestureIntensity = 0.7;
  }
  
  // 6: THUMB UP - Rise up / levitate with upward stream
  else if (uGestureState > 5.5 && uGestureState < 6.5) {
    float rise = sin(uTime * 3.0 + aPhase * 6.28) * 0.5 + 0.5;
    pos.y += rise * 0.8;
    // Funnel shape rising up
    float funnelRadius = 0.3 + pos.y * 0.2;
    float funnelAngle = uTime * 2.0 + aPhase * 6.28;
    pos.x = cos(funnelAngle) * funnelRadius * (1.0 - rise * 0.5);
    pos.z = sin(funnelAngle) * funnelRadius * (1.0 - rise * 0.5);
    vGestureIntensity = 0.6;
  }
  
  // 7: PALM DOWN - Flatten into rotating disc
  else if (uGestureState > 6.5 && uGestureState < 7.5) {
    pos.y *= 0.1; // Flatten Y
    float discRadius = length(originalPos.xz);
    float discAngle = atan(originalPos.z, originalPos.x) + uTime * 0.5;
    pos.x = cos(discAngle) * discRadius * 1.5;
    pos.z = sin(discAngle) * discRadius * 1.5;
    // Ripple effect
    pos.y += sin(discRadius * 10.0 - uTime * 3.0) * 0.05;
    pos = mix(position, pos, gestureBlend);
    vGestureIntensity = 0.5;
  }
  
  // 8: SPREAD - Explosion / disperse outward
  else if (uGestureState > 7.5 && uGestureState < 8.5) {
    float explosionForce = 2.5 + sin(uTime * 0.5) * 0.5;
    vec3 explodeDir = normalize(originalPos);
    pos = explodeDir * explosionForce * (0.5 + aRandomness * 0.5);
    // Add chaos
    pos += vec3(
      sin(uTime * 3.0 + aPhase * 10.0),
      cos(uTime * 2.5 + aPhase * 8.0),
      sin(uTime * 2.0 + aPhase * 12.0)
    ) * 0.3 * aRandomness;
    pos = mix(position, pos, gestureBlend * 0.5);
    vGestureIntensity = 1.0;
  }
  
  // 9: GRAB - Gravitational pull / attract to palm
  else if (uGestureState > 8.5 && uGestureState < 9.5) {
    vec3 pullTarget = uAttractorPosition;
    float pullStrength = smoothstep(4.0, 0.0, dist) * 0.5;
    pos = mix(pos, pullTarget, pullStrength * aRandomness);
    // Orbit around the grab point
    float orbitAngle = uTime * 4.0 + aPhase * 6.28;
    float orbitRadius = dist * 0.3;
    pos += vec3(cos(orbitAngle), sin(orbitAngle * 0.7), sin(orbitAngle)) * orbitRadius * 0.2;
    vGestureIntensity = 0.9;
  }
  
  // 10: WAVE - Ripple wave effect
  else if (uGestureState > 9.5 && uGestureState < 10.5) {
    float waveFreq = 4.0;
    float waveAmp = 0.3;
    float wavePhase = length(originalPos.xz) * waveFreq - uTime * 4.0;
    pos.y += sin(wavePhase + aPhase) * waveAmp;
    pos.x += cos(wavePhase * 0.5) * waveAmp * 0.3;
    // Horizontal spread
    pos.x *= 1.3;
    pos.z *= 1.3;
    pos = mix(position, pos, gestureBlend);
    vGestureIntensity = 0.6;
  }
  
  // 11: GUN - Beam focus / laser stream
  else if (uGestureState > 10.5 && uGestureState < 11.5) {
    // Form a beam pointing towards attractor
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
  
  // 12: ROCK - Chaotic vibration / thrash
  else if (uGestureState > 11.5) {
    float chaos = 0.4;
    pos += vec3(
      sin(uTime * 20.0 + aPhase * 50.0) * chaos,
      cos(uTime * 18.0 + aPhase * 45.0) * chaos,
      sin(uTime * 22.0 + aPhase * 55.0) * chaos
    ) * aRandomness;
    // Spiky formations
    float spike = step(0.7, aRandomness);
    pos *= 1.0 + spike * sin(uTime * 10.0 + aPhase * 20.0) * 0.5;
    vGestureIntensity = 1.0;
  }
  
  // ============ COMMON EFFECTS ============
  
  // Basic attraction to finger (reduced when other gestures active)
  float baseAttraction = smoothstep(2.5, 0.3, dist) * 0.08;
  if (uGestureState < 0.5) {
    pos += normalize(toAttractor) * baseAttraction;
  }
  
  // Listening mode - energetic pulsing
  if (uListening > 0.5) {
    float listenPulse = sin(uTime * 6.0 + aPhase * 3.0) * 0.12;
    pos += normalize(pos) * listenPulse;
  }
  
  // ============ FINAL OUTPUT ============
  
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  
  // Dynamic point size
  float sizeScale = aScale * (0.8 + pulse * 0.4);
  sizeScale *= 1.0 + vGestureIntensity * 0.3;
  gl_PointSize = (35.0 / -mvPosition.z) * sizeScale;
  
  // Larger when listening
  if (uListening > 0.5) {
    gl_PointSize *= 1.15;
  }
  
  vPulse = pulse * breathe;
  vRandomness = aRandomness;
}
`;

// Enhanced fragment shader with gesture-based coloring
const fragmentShader = `
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
    // PEACE - Dual colored
    float side = step(0.5, vRandomness);
    color = mix(uColorCore, uColorEnergy, side);
  } else if (uGestureState > 10.5 && uGestureState < 11.5) {
    // GUN - Bright beam
    color = mix(color, vec3(0.2, 1.0, 0.8), vGestureIntensity * 0.8);
  }
  
  // Proximity glow (finger attraction)
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
  
  // Alpha with gesture boost
  float alpha = radialGradient * (0.5 + vPulse * 0.5);
  alpha *= 0.85 + vGestureIntensity * 0.15;
  
  gl_FragColor = vec4(color, alpha);
}
`;

const PARTICLE_COUNT = 6000;

export const ParticleSwarm = ({ handLandmarks, gesture, isListening }: ParticleSwarmProps) => {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // Generate particle attributes
  const { positions, randomness, phases, scales } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const randomness = new Float32Array(PARTICLE_COUNT);
    const phases = new Float32Array(PARTICLE_COUNT);
    const scales = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Spherical distribution inside the orb
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 0.3 + Math.random() * 1.2;

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);

      randomness[i] = Math.random();
      phases[i] = Math.random() * Math.PI * 2;
      scales[i] = 0.5 + Math.random() * 0.8;
    }

    return { positions, randomness, phases, scales };
  }, []);

  // Animation loop
  useFrame((state) => {
    if (!materialRef.current) return;

    const time = state.clock.elapsedTime;
    const uniforms = materialRef.current.uniforms;
    
    uniforms.uTime.value = time;
    uniforms.uGestureState.value = GESTURE_STATE_MAP[gesture];
    uniforms.uListening.value = isListening ? 1.0 : 0.0;

    if (handLandmarks) {
      uniforms.uAttractorPosition.value.copy(handLandmarks.indexFingerTip);
      uniforms.uFingerSpread.value = handLandmarks.fingerSpread;
      uniforms.uPalmNormal.value.copy(handLandmarks.palmNormal);
    } else {
      // Default attractor position - gentle orbit
      const defaultPos = new THREE.Vector3(
        Math.sin(time * 0.5) * 0.5,
        Math.cos(time * 0.3) * 0.5,
        Math.sin(time * 0.4) * 0.3
      );
      uniforms.uAttractorPosition.value.copy(defaultPos);
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={PARTICLE_COUNT}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aRandomness"
          count={PARTICLE_COUNT}
          array={randomness}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aPhase"
          count={PARTICLE_COUNT}
          array={phases}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aScale"
          count={PARTICLE_COUNT}
          array={scales}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{
          uTime: { value: 0 },
          uPulseIntensity: { value: 1.0 },
          uAttractorPosition: { value: new THREE.Vector3(0, 0, 0) },
          uGestureState: { value: 0 },
          uListening: { value: 0 },
          uFingerSpread: { value: 0 },
          uPalmNormal: { value: new THREE.Vector3(0, 0, 1) },
          uColorCore: { value: new THREE.Color('#00d4ff') },
          uColorAccent: { value: new THREE.Color('#9945ff') },
          uColorEnergy: { value: new THREE.Color('#00ffcc') }
        }}
      />
    </points>
  );
};
