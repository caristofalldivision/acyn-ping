import { useState, useCallback, Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import { CameraHandler } from './CameraHandler';
import { OrbCore } from './OrbCore';
import { ParticleSwarm } from './ParticleSwarm';
import { TrailRenderer } from './TrailRenderer';
import { 
  KineticCoreProps, 
  HandLandmarks, 
  DualHandLandmarks,
  GestureType, 
  TrailPoint
} from './types';

const GESTURE_DISPLAY: Record<GestureType, string> = {
  idle: '',
  pinch: '🤏 Pinch → Cube',
  palm: '🖐️ Palm → Cloud',
  point: '👆 Point → Spiral',
  fist: '✊ Fist → Implode',
  peace: '✌️ Peace → Helix',
  thumbUp: '👍 Thumb Up → Rise',
  palmDown: '🫳 Palm Down → Disc',
  spread: '🖐️ Spread → Explode',
  grab: '🫴 Grab → Pull',
  wave: '👋 Wave → Ripple',
  gun: '🔫 Gun → Beam',
  rock: '🤘 Rock → Chaos',
  galaxy: '🌌 Galaxy → Spiral Arms',
  vortex: '🌪️ Vortex → Tornado',
  tornado: '💨 Tornado → Cyclone',
  pulse: '💫 Pulse → Shockwave',
  orbit: '🪐 Orbit → Planets',
  scatter: '✨ Scatter → Disperse',
  attract: '🧲 Attract → Magnetize',
  repel: '💥 Repel → Push',
  swirl: '🌀 Swirl → Gentle Spin',
  burst: '🎆 Burst → Firework',
  heartbeat: '💓 Heartbeat → Pulse',
  stretch: '↔️ Stretch → Elastic',
  compress: '🫂 Compress → Squeeze',
  clap: '👏 Clap → Shockwave',
  merge: '🔮 Merge → Fusion',
  orbiting: '🔄 Orbiting → Satellite',
  twist: '🧬 Twist → DNA',
  tear: '💔 Tear → Split',
  push: '🙌 Push → Away',
  pull: '🫳 Pull → Toward',
  sphere: '⚪ Sphere → Contain'
};

const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.matchMedia('(max-width: 768px)').matches;
};

const LoadingFallback = () => (
  <mesh>
    <sphereGeometry args={[1, 32, 32]} />
    <meshStandardMaterial color="#00d4ff" opacity={0.3} transparent />
  </mesh>
);

const Scene = ({ 
  handLandmarks, 
  dualHands,
  gesture, 
  trailPoints, 
  isListening,
  isMobile
}: { 
  handLandmarks: HandLandmarks | null;
  dualHands: DualHandLandmarks | null;
  gesture: GestureType;
  trailPoints: TrailPoint[];
  isListening: boolean;
  isMobile: boolean;
}) => {
  return (
    <>
      <ambientLight intensity={0.1} />
      <pointLight position={[10, 10, 10]} intensity={0.3} color="#ffffff" />
      <pointLight position={[-10, -10, -10]} intensity={0.15} color="#00d4ff" />

      <Environment preset="night" />

      <Suspense fallback={<LoadingFallback />}>
        <OrbCore isListening={isListening} />
        <ParticleSwarm 
          handLandmarks={handLandmarks} 
          dualHands={dualHands}
          gesture={gesture} 
          isListening={isListening}
          isMobile={isMobile}
        />
        <TrailRenderer points={trailPoints} />
      </Suspense>

      <EffectComposer>
        <Bloom
          intensity={isMobile ? 1.0 : 1.8}
          luminanceThreshold={0.1}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
        {!isMobile && (
          // @ts-ignore
          <ChromaticAberration
            blendFunction={BlendFunction.NORMAL}
            offset={new THREE.Vector2(0.003, 0.003)}
          />
        )}
      </EffectComposer>

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
  const [dualHands, setDualHands] = useState<DualHandLandmarks | null>(null);
  const [gesture, setGesture] = useState<GestureType>('idle');
  const [trailPoints, setTrailPoints] = useState<TrailPoint[]>([]);
  const [handTrackingEnabled] = useState(true);
  
  const isMobile = useMemo(() => isMobileDevice(), []);

  const handleLandmarksUpdate = useCallback((landmarks: HandLandmarks | null) => {
    setHandLandmarks(landmarks);
    
    if (landmarks && gesture === 'point') {
      setTrailPoints(prev => {
        const newPoint: TrailPoint = {
          position: landmarks.indexFingerTip.clone(),
          timestamp: Date.now(),
          opacity: 1
        };
        
        const filtered = [...prev, newPoint].filter(
          p => Date.now() - p.timestamp < 3000
        ).slice(-100);
        
        return filtered;
      });
    }
  }, [gesture]);

  const handleDualHandUpdate = useCallback((dual: DualHandLandmarks | null) => {
    setDualHands(dual);
  }, []);

  const handleGestureDetected = useCallback((detectedGesture: GestureType) => {
    setGesture(detectedGesture);
  }, []);

  const sizeClasses = {
    sm: 'w-32 h-32',
    md: 'w-48 h-48',
    lg: 'w-64 h-64 xs:w-72 xs:h-72 sm:w-80 sm:h-80 md:w-96 md:h-96'
  };

  const handsDetected = dualHands?.leftHand && dualHands?.rightHand ? 2 : handLandmarks ? 1 : 0;
  const isTwoHandGesture = gesture in { stretch: 1, compress: 1, clap: 1, merge: 1, orbiting: 1, twist: 1, tear: 1, push: 1, pull: 1, sphere: 1 };

  return (
    <div className="relative flex flex-col items-center justify-center">
      <CameraHandler
        onLandmarksUpdate={handleLandmarksUpdate}
        onDualHandUpdate={handleDualHandUpdate}
        onGestureDetected={handleGestureDetected}
        enabled={handTrackingEnabled}
      />

      <div 
        className={`${sizeClasses[size]} cursor-pointer`}
        onClick={onMicClick}
      >
        <Canvas
          camera={{ position: [0, 0, 5], fov: 45 }}
          dpr={isMobile ? [1, 1.5] : [1, 2]}
          gl={{ 
            antialias: !isMobile, 
            alpha: true,
            powerPreference: isMobile ? 'low-power' : 'high-performance'
          }}
          style={{ background: 'transparent' }}
        >
          <Scene
            handLandmarks={handLandmarks}
            dualHands={dualHands}
            gesture={gesture}
            trailPoints={trailPoints}
            isListening={isListening}
            isMobile={isMobile}
          />
        </Canvas>
      </div>

      {size === 'lg' && (
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            {isListening ? (
              <span className="text-primary animate-pulse">● Listening...</span>
            ) : (
              'Tap to speak'
            )}
          </p>
          
          {handsDetected > 0 && (
            <p className="text-xs text-muted-foreground/70 mt-1">
              {handsDetected === 2 ? '✋✋ Two hands' : '✋ One hand'}
            </p>
          )}
          
          {gesture !== 'idle' && (
            <p className={`text-sm mt-2 font-medium ${isTwoHandGesture ? 'text-accent' : 'text-primary'}`}>
              {GESTURE_DISPLAY[gesture]}
            </p>
          )}
          
          {gesture === 'idle' && handLandmarks && (
            <p className="text-xs text-muted-foreground/60 mt-1">
              Try a gesture!
            </p>
          )}
        </div>
      )}
    </div>
  );
};
