import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ParticleSwarmProps } from './types';

// Inline shaders to avoid import issues
const vertexShader = `
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
  
  float pulse = sin(uTime * 2.0 + aPhase) * 0.5 + 0.5;
  float breathe = sin(uTime * 0.8 + aPhase * 0.5) * 0.3 + 0.7;
  
  pos += normalize(pos) * pulse * uPulseIntensity * aRandomness * 0.15;
  
  vec3 toAttractor = uAttractorPosition - pos;
  float dist = length(toAttractor);
  vDistanceToAttractor = dist;
  
  if (uGestureState > 0.5 && uGestureState < 1.5) {
    vec3 cubePos = sign(pos) * vec3(0.4);
    pos = mix(pos, cubePos, 0.15);
  } else if (uGestureState > 1.5 && uGestureState < 2.5) {
    float expandFactor = 1.0 + sin(uTime * 0.5) * 0.4;
    pos *= expandFactor;
  } else if (uGestureState > 2.5) {
    float angle = uTime * 2.0 + aPhase;
    vec3 spiral = vec3(cos(angle), sin(angle), 0.0) * 0.1;
    pos += spiral * smoothstep(3.0, 0.5, dist);
  }
  
  float attractStrength = smoothstep(2.5, 0.3, dist) * 0.15;
  pos += normalize(toAttractor) * attractStrength;
  
  if (uListening > 0.5) {
    float listenPulse = sin(uTime * 6.0 + aPhase * 3.0) * 0.1;
    pos += normalize(pos) * listenPulse;
  }
  
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  
  float sizeScale = aScale * (0.8 + pulse * 0.4);
  gl_PointSize = (35.0 / -mvPosition.z) * sizeScale;
  
  if (uListening > 0.5) {
    gl_PointSize *= 1.2;
  }
  
  vPulse = pulse * breathe;
  vRandomness = aRandomness;
}
`;

const fragmentShader = `
uniform vec3 uColorCore;
uniform vec3 uColorAccent;
uniform float uTime;
uniform float uListening;

varying float vDistanceToAttractor;
varying float vPulse;
varying float vRandomness;

void main() {
  vec2 center = gl_PointCoord - vec2(0.5);
  float dist = length(center);
  
  if (dist > 0.5) discard;
  
  float colorMix = vPulse * 0.6 + vRandomness * 0.4;
  vec3 color = mix(uColorCore, uColorAccent, colorMix);
  
  float proximityGlow = smoothstep(2.0, 0.0, vDistanceToAttractor);
  color += vec3(0.2, 0.9, 1.0) * proximityGlow * 0.4;
  
  if (uListening > 0.5) {
    float listenGlow = sin(uTime * 4.0) * 0.3 + 0.7;
    color += vec3(0.0, 0.6, 0.8) * listenGlow * 0.3;
  }
  
  float radialGradient = 1.0 - smoothstep(0.0, 0.5, dist);
  float coreBrightness = smoothstep(0.4, 0.0, dist);
  color += vec3(1.0) * coreBrightness * 0.3;
  
  float alpha = radialGradient * (0.5 + vPulse * 0.5);
  alpha *= 0.85;
  
  gl_FragColor = vec4(color, alpha);
}
`;

const PARTICLE_COUNT = 5000;

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
      const radius = 0.3 + Math.random() * 1.2; // Between 0.3 and 1.5

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);

      randomness[i] = Math.random();
      phases[i] = Math.random() * Math.PI * 2;
      scales[i] = 0.5 + Math.random() * 0.8;
    }

    return { positions, randomness, phases, scales };
  }, []);

  // Convert gesture to numeric state
  const gestureState = useMemo(() => {
    switch (gesture) {
      case 'pinch': return 1.0;
      case 'palm': return 2.0;
      case 'point': return 3.0;
      default: return 0.0;
    }
  }, [gesture]);

  // Animation loop
  useFrame((state) => {
    if (!materialRef.current) return;

    const time = state.clock.elapsedTime;
    materialRef.current.uniforms.uTime.value = time;
    materialRef.current.uniforms.uGestureState.value = gestureState;
    materialRef.current.uniforms.uListening.value = isListening ? 1.0 : 0.0;

    if (handLandmarks) {
      materialRef.current.uniforms.uAttractorPosition.value.copy(handLandmarks.indexFingerTip);
    } else {
      // Default attractor position when no hand is detected
      const defaultPos = new THREE.Vector3(
        Math.sin(time * 0.5) * 0.5,
        Math.cos(time * 0.3) * 0.5,
        0
      );
      materialRef.current.uniforms.uAttractorPosition.value.copy(defaultPos);
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
          uColorCore: { value: new THREE.Color('#00d4ff') },
          uColorAccent: { value: new THREE.Color('#9945ff') }
        }}
      />
    </points>
  );
};
