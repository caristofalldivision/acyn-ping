import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere } from '@react-three/drei';
import * as THREE from 'three';
import { OrbCoreProps } from './types';

export const OrbCore = ({ isListening }: OrbCoreProps) => {
  const innerRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    
    if (innerRef.current) {
      const pulseScale = isListening 
        ? 0.15 + Math.sin(time * 4) * 0.04
        : 0.12 + Math.sin(time * 1.5) * 0.03;
      innerRef.current.scale.setScalar(pulseScale);
    }
  });

  return (
    <group>
      {/* Tiny glowing core - particles are the main visual */}
      <Sphere ref={innerRef} args={[1, 32, 32]}>
        <meshStandardMaterial
          color="#00ffcc"
          emissive="#00d4ff"
          emissiveIntensity={isListening ? 4.0 : 2.5}
          transparent
          opacity={0.8}
        />
      </Sphere>
    </group>
  );
};
