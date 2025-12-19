import { useState, useCallback, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import { CameraHandler } from './CameraHandler';
import { OrbCore } from './OrbCore';
import { ParticleSwarm } from './ParticleSwarm';
import { TrailRenderer } from './TrailRenderer';
import { KineticCoreProps, HandLandmarks, GestureType, TrailPoint } from './types';

// Gesture display names
const GESTURE_DISPLAY: Record<GestureType, string> = {
  idle: '',
  pinch: '🤏 Pinch → Cube',
  palm: '🖐️ Palm → Expand',
  point: '👆 Point → Spiral',
  fist: '✊ Fist → Implode',
  peace: '✌️ Peace → Helix',
  thumbUp: '👍 Thumb Up → Rise',
  palmDown: '🫳 Palm Down → Disc',
  spread: '🖐️ Spread → Explode',
  grab: '🫴 Grab → Pull',
  wave: '👋 Wave → Ripple',
  gun: '🔫 Gun → Beam',
  rock: '🤘 Rock → Chaos'
};

// Fallback component while loading
const LoadingFallback = () => (
  <mesh>
    <sphereGeometry args={[1, 32, 32]} />
    <meshStandardMaterial color="#00d4ff" opacity={0.3} transparent />
  </mesh>
);

// Scene component with all 3D elements
const Scene = ({ 
  handLandmarks, 
  gesture, 
  trailPoints, 
  isListening 
}: { 
  handLandmarks: HandLandmarks | null;
  gesture: GestureType;
  trailPoints: TrailPoint[];
  isListening: boolean;
}) => {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.15} />
      <pointLight position={[10, 10, 10]} intensity={0.4} color="#ffffff" />
      <pointLight position={[-10, -10, -10]} intensity={0.2} color="#00d4ff" />
      <spotLight
        position={[0, 5, 5]}
        angle={0.4}
        penumbra={0.5}
        intensity={0.5}
        color="#00ffcc"
      />

      {/* Environment for reflections */}
      <Environment preset="night" />

      {/* Main orb components */}
      <Suspense fallback={<LoadingFallback />}>
        <OrbCore isListening={isListening} />
        <ParticleSwarm 
          handLandmarks={handLandmarks} 
          gesture={gesture} 
          isListening={isListening}
        />
        <TrailRenderer points={trailPoints} />
      </Suspense>

      {/* Post-processing effects */}
      <EffectComposer>
        <Bloom
          intensity={1.2}
          luminanceThreshold={0.15}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
        {/* @ts-ignore - ChromaticAberration type issue with postprocessing */}
        <ChromaticAberration
          blendFunction={BlendFunction.NORMAL}
          offset={new THREE.Vector2(0.002, 0.002)}
        />
      </EffectComposer>

      {/* Controls - limited interaction */}
      <OrbitControls 
        enableZoom={false} 
        enablePan={false}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={Math.PI / 1.5}
        autoRotate
        autoRotateSpeed={0.3}
      />
    </>
  );
};

export const KineticCore = ({ 
  isListening = false, 
  onMicClick,
  size = 'lg'
}: KineticCoreProps) => {
  const [handLandmarks, setHandLandmarks] = useState<HandLandmarks | null>(null);
  const [gesture, setGesture] = useState<GestureType>('idle');
  const [trailPoints, setTrailPoints] = useState<TrailPoint[]>([]);
  const [handTrackingEnabled] = useState(true);

  const handleLandmarksUpdate = useCallback((landmarks: HandLandmarks | null) => {
    setHandLandmarks(landmarks);
    
    // Add trail points when pointing
    if (landmarks && gesture === 'point') {
      setTrailPoints(prev => {
        const newPoint: TrailPoint = {
          position: landmarks.indexFingerTip.clone(),
          timestamp: Date.now(),
          opacity: 1
        };
        
        // Keep last 100 points, remove old ones
        const filtered = [...prev, newPoint].filter(
          p => Date.now() - p.timestamp < 3000
        ).slice(-100);
        
        return filtered;
      });
    }
  }, [gesture]);

  const handleGestureDetected = useCallback((detectedGesture: GestureType) => {
    setGesture(detectedGesture);
  }, []);

  const sizeClasses = {
    sm: 'w-32 h-32',
    md: 'w-48 h-48',
    lg: 'w-72 h-72 md:w-96 md:h-96'
  };

  return (
    <div className="relative flex flex-col items-center justify-center">
      {/* Camera handler for MediaPipe */}
      <CameraHandler
        onLandmarksUpdate={handleLandmarksUpdate}
        onGestureDetected={handleGestureDetected}
        enabled={handTrackingEnabled}
      />

      {/* 3D Canvas */}
      <div 
        className={`${sizeClasses[size]} cursor-pointer`}
        onClick={onMicClick}
      >
        <Canvas
          camera={{ position: [0, 0, 5], fov: 45 }}
          dpr={[1, 2]}
          gl={{ 
            antialias: true, 
            alpha: true,
            powerPreference: 'high-performance'
          }}
          style={{ background: 'transparent' }}
        >
          <Scene
            handLandmarks={handLandmarks}
            gesture={gesture}
            trailPoints={trailPoints}
            isListening={isListening}
          />
        </Canvas>
      </div>

      {/* Status indicator */}
      {size === 'lg' && (
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            {isListening ? 'Listening...' : 'Tap to speak'}
          </p>
          {gesture !== 'idle' && (
            <p className="text-xs text-primary/80 mt-1 font-medium animate-pulse">
              {GESTURE_DISPLAY[gesture]}
            </p>
          )}
          {gesture === 'idle' && handLandmarks && (
            <p className="text-xs text-muted-foreground/60 mt-1">
              Hand detected - try a gesture!
            </p>
          )}
        </div>
      )}
    </div>
  );
};
