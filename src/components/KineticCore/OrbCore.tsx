import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshTransmissionMaterial, Sphere } from '@react-three/drei';
import * as THREE from 'three';
import { OrbCoreProps } from './types';

export const OrbCore = ({ isListening }: OrbCoreProps) => {
  const outerRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    
    // Subtle rotation
    if (outerRef.current) {
      outerRef.current.rotation.y = time * 0.1;
      outerRef.current.rotation.x = Math.sin(time * 0.2) * 0.1;
    }
    
    // Inner core pulsing
    if (innerRef.current) {
      const pulseScale = isListening 
        ? 0.4 + Math.sin(time * 4) * 0.08
        : 0.35 + Math.sin(time * 1.5) * 0.05;
      innerRef.current.scale.setScalar(pulseScale);
    }
  });

  return (
    <group>
      {/* Outer glass sphere */}
      <Sphere ref={outerRef} args={[1.8, 64, 64]}>
        <MeshTransmissionMaterial
          transmission={0.92}
          roughness={0.35}
          thickness={1.5}
          chromaticAberration={0.08}
          anisotropy={0.2}
          distortion={0.15}
          distortionScale={0.3}
          temporalDistortion={0.1}
          color="#00d4ff"
          backside
          backsideThickness={0.5}
        />
      </Sphere>

      {/* Inner glowing core */}
      <Sphere ref={innerRef} args={[0.35, 32, 32]}>
        <meshStandardMaterial
          color="#00ffcc"
          emissive="#00d4ff"
          emissiveIntensity={isListening ? 2.5 : 1.5}
          transparent
          opacity={0.9}
        />
      </Sphere>

      {/* Rim light ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.85, 0.02, 16, 100]} />
        <meshStandardMaterial
          color="#00ffcc"
          emissive="#00ffcc"
          emissiveIntensity={1}
          transparent
          opacity={0.6}
        />
      </mesh>
    </group>
  );
};
