import * as THREE from 'three';

export type GestureType = 'idle' | 'pinch' | 'palm' | 'point';

export interface HandLandmarks {
  indexFingerTip: THREE.Vector3;
  thumbTip: THREE.Vector3;
  palmCenter: THREE.Vector3;
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
