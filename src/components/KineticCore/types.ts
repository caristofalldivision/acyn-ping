import * as THREE from 'three';

// Extended gesture types for particle manipulation
export type GestureType = 
  | 'idle' 
  | 'pinch'           // 1 - Condense into cube
  | 'palm'            // 2 - Expand breathing cloud
  | 'point'           // 3 - Spiral towards finger
  | 'fist'            // 4 - Implode into tight sphere
  | 'peace'           // 5 - Split into dual vortex
  | 'thumbUp'         // 6 - Rise up / levitate
  | 'palmDown'        // 7 - Flatten into disc
  | 'spread'          // 8 - Explosion / disperse
  | 'grab'            // 9 - Gravitational pull
  | 'wave'            // 10 - Ripple wave effect
  | 'gun'             // 11 - Beam focus
  | 'rock';           // 12 - Chaotic vibration

export interface HandLandmarks {
  indexFingerTip: THREE.Vector3;
  thumbTip: THREE.Vector3;
  palmCenter: THREE.Vector3;
  palmNormal: THREE.Vector3;      // Direction palm is facing
  handRotation: number;           // Rotation of hand in radians
  fingerSpread: number;           // 0-1 how spread fingers are
  allLandmarks: THREE.Vector3[];
}

export interface TrailPoint {
  position: THREE.Vector3;
  timestamp: number;
  opacity: number;
}

export interface KineticCoreProps {
  isListening?: boolean;
  onMicClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export interface ParticleSwarmProps {
  handLandmarks: HandLandmarks | null;
  gesture: GestureType;
  isListening: boolean;
}

export interface OrbCoreProps {
  isListening: boolean;
}

export interface CameraHandlerProps {
  onLandmarksUpdate: (landmarks: HandLandmarks | null) => void;
  onGestureDetected: (gesture: GestureType) => void;
  enabled: boolean;
}

export interface TrailRendererProps {
  points: TrailPoint[];
}

// Gesture state mapping for shader
export const GESTURE_STATE_MAP: Record<GestureType, number> = {
  idle: 0,
  pinch: 1,
  palm: 2,
  point: 3,
  fist: 4,
  peace: 5,
  thumbUp: 6,
  palmDown: 7,
  spread: 8,
  grab: 9,
  wave: 10,
  gun: 11,
  rock: 12
};
