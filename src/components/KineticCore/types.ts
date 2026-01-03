import * as THREE from 'three';

// Single-hand gesture types (0-23)
export type SingleHandGestureType = 
  | 'idle'           // 0 - Gentle float
  | 'pinch'          // 1 - Cube
  | 'palm'           // 2 - Breathing cloud
  | 'point'          // 3 - Spiral
  | 'fist'           // 4 - Implode
  | 'peace'          // 5 - DNA helix
  | 'thumbUp'        // 6 - Rise up
  | 'palmDown'       // 7 - Disc
  | 'spread'         // 8 - Explosion
  | 'grab'           // 9 - Pull
  | 'wave'           // 10 - Ripple
  | 'gun'            // 11 - Beam
  | 'rock'           // 12 - Chaos
  | 'galaxy'         // 13 - Spiral arms
  | 'vortex'         // 14 - Tornado funnel
  | 'tornado'        // 15 - Horizontal cyclone
  | 'pulse'          // 16 - Shockwave rings
  | 'orbit'          // 17 - Planetary orbits
  | 'scatter'        // 18 - Random dispersion
  | 'attract'        // 19 - Magnetic pull
  | 'repel'          // 20 - Force push
  | 'swirl'          // 21 - Gentle spiral
  | 'burst'          // 22 - Firework
  | 'heartbeat';     // 23 - Rhythmic pulse

// Two-hand gesture types (100-109)
export type TwoHandGestureType =
  | 'stretch'        // 100 - Particles between hands
  | 'compress'       // 101 - Squeeze together
  | 'clap'           // 102 - Shockwave on impact
  | 'merge'          // 103 - Converge to point
  | 'orbiting'       // 104 - Orbit around center
  | 'twist'          // 105 - Double helix
  | 'tear'           // 106 - Split into two
  | 'push'           // 107 - Push away
  | 'pull'           // 108 - Pull toward
  | 'sphere';        // 109 - Contained sphere

export type GestureType = SingleHandGestureType | TwoHandGestureType;

export interface HandLandmarks {
  indexFingerTip: THREE.Vector3;
  thumbTip: THREE.Vector3;
  palmCenter: THREE.Vector3;
  palmNormal: THREE.Vector3;
  handRotation: number;
  fingerSpread: number;
  allLandmarks: THREE.Vector3[];
  handedness: 'Left' | 'Right';
  velocity: THREE.Vector3;
}

export interface DualHandLandmarks {
  leftHand: HandLandmarks | null;
  rightHand: HandLandmarks | null;
  interHandDistance: number;
  centerPoint: THREE.Vector3;
  isApproaching: boolean;
  isSeparating: boolean;
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
  dualHands: DualHandLandmarks | null;
  gesture: GestureType;
  isListening: boolean;
  isMobile: boolean;
}

export interface OrbCoreProps {
  isListening: boolean;
}

export interface CameraHandlerProps {
  onLandmarksUpdate: (landmarks: HandLandmarks | null) => void;
  onDualHandUpdate: (dual: DualHandLandmarks | null) => void;
  onGestureDetected: (gesture: GestureType) => void;
  enabled: boolean;
}

export interface TrailRendererProps {
  points: TrailPoint[];
}

// Single-hand gesture state map (0-23)
export const GESTURE_STATE_MAP: Record<SingleHandGestureType, number> = {
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
  rock: 12,
  galaxy: 13,
  vortex: 14,
  tornado: 15,
  pulse: 16,
  orbit: 17,
  scatter: 18,
  attract: 19,
  repel: 20,
  swirl: 21,
  burst: 22,
  heartbeat: 23
};

// Two-hand gesture state map (100-109)
export const TWO_HAND_GESTURE_MAP: Record<TwoHandGestureType, number> = {
  stretch: 100,
  compress: 101,
  clap: 102,
  merge: 103,
  orbiting: 104,
  twist: 105,
  tear: 106,
  push: 107,
  pull: 108,
  sphere: 109
};

// Combined gesture map
export const getGestureState = (gesture: GestureType): number => {
  if (gesture in GESTURE_STATE_MAP) {
    return GESTURE_STATE_MAP[gesture as SingleHandGestureType];
  }
  return TWO_HAND_GESTURE_MAP[gesture as TwoHandGestureType];
};
