import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ParticleSwarmProps, getGestureState } from './types';

import vertexShader from './shaders/particleVertex.glsl?raw';
import fragmentShader from './shaders/particleFragment.glsl?raw';

const getParticleCount = (isMobile: boolean): number => {
  if (isMobile) return 4000;
  return 8000;
};

export const ParticleSwarm = ({ 
  handLandmarks, 
  dualHands,
  gesture, 
  isListening,
  isMobile 
}: ParticleSwarmProps) => {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const PARTICLE_COUNT = useMemo(() => getParticleCount(isMobile), [isMobile]);

  const { positions, randomness, phases, scales } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const randomness = new Float32Array(PARTICLE_COUNT);
    const phases = new Float32Array(PARTICLE_COUNT);
    const scales = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      // Wider spread: galaxy-like distribution
      const radius = 0.3 + Math.pow(Math.random(), 0.6) * 2.5;

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.4; // Flatten for disc shape
      positions[i * 3 + 2] = radius * Math.cos(phi);

      randomness[i] = Math.random();
      phases[i] = Math.random() * Math.PI * 2;
      // More size variation: tiny distant stars + some bright ones
      scales[i] = 0.2 + Math.pow(Math.random(), 2.0) * 1.2;
    }

    return { positions, randomness, phases, scales };
  }, [PARTICLE_COUNT]);

  useFrame((state) => {
    if (!materialRef.current) return;

    const time = state.clock.elapsedTime;
    const uniforms = materialRef.current.uniforms;
    
    uniforms.uTime.value = time;
    uniforms.uGestureState.value = getGestureState(gesture);
    uniforms.uListening.value = isListening ? 1.0 : 0.0;

    if (handLandmarks) {
      uniforms.uAttractorPosition.value.copy(handLandmarks.indexFingerTip);
      uniforms.uFingerSpread.value = handLandmarks.fingerSpread;
      uniforms.uPalmNormal.value.copy(handLandmarks.palmNormal);
      uniforms.uGestureVelocity.value = handLandmarks.velocity.length();
    } else {
      const defaultPos = new THREE.Vector3(
        Math.sin(time * 0.5) * 0.5,
        Math.cos(time * 0.3) * 0.5,
        Math.sin(time * 0.4) * 0.3
      );
      uniforms.uAttractorPosition.value.copy(defaultPos);
    }

    if (dualHands && dualHands.leftHand && dualHands.rightHand) {
      uniforms.uAttractorPosition2.value.copy(dualHands.rightHand.indexFingerTip);
      uniforms.uInterHandDistance.value = dualHands.interHandDistance;
    } else {
      uniforms.uAttractorPosition2.value.set(0, 0, 0);
      uniforms.uInterHandDistance.value = 0;
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
          uAttractorPosition2: { value: new THREE.Vector3(0, 0, 0) },
          uInterHandDistance: { value: 0 },
          uGestureState: { value: 0 },
          uListening: { value: 0 },
          uFingerSpread: { value: 0 },
          uPalmNormal: { value: new THREE.Vector3(0, 0, 1) },
          uGestureVelocity: { value: 0 },
          uColorCore: { value: new THREE.Color('#00d4ff') },
          uColorAccent: { value: new THREE.Color('#9945ff') },
          uColorEnergy: { value: new THREE.Color('#00ffcc') }
        }}
      />
    </points>
  );
};
