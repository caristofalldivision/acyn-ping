import { useRef } from 'react';
import { useHandTracking } from './hooks/useHandTracking';
import { useGestureDetection } from './hooks/useGestureDetection';
import { CameraHandlerProps, HandLandmarks, DualHandLandmarks } from './types';

export const CameraHandler = ({ 
  onLandmarksUpdate, 
  onDualHandUpdate,
  onGestureDetected,
  enabled 
}: CameraHandlerProps) => {
  const { detectGesture } = useGestureDetection();
  const currentDualHandsRef = useRef<DualHandLandmarks | null>(null);

  const handleLandmarksUpdate = (landmarks: HandLandmarks | null) => {
    onLandmarksUpdate(landmarks);
    
    if (landmarks) {
      const gesture = detectGesture(landmarks, currentDualHandsRef.current);
      onGestureDetected(gesture);
    } else {
      onGestureDetected('idle');
    }
  };

  const handleDualHandUpdate = (dual: DualHandLandmarks | null) => {
    currentDualHandsRef.current = dual;
    onDualHandUpdate(dual);
  };

  const { isInitialized, hasPermission } = useHandTracking({
    enabled,
    onLandmarksUpdate: handleLandmarksUpdate,
    onDualHandUpdate: handleDualHandUpdate
  });

  return null;
};
