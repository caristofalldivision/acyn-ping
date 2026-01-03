import { useEffect } from 'react';
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
  
  let currentDualHands: DualHandLandmarks | null = null;

  const handleLandmarksUpdate = (landmarks: HandLandmarks | null) => {
    onLandmarksUpdate(landmarks);
    
    if (landmarks) {
      const gesture = detectGesture(landmarks, currentDualHands);
      onGestureDetected(gesture);
    } else {
      onGestureDetected('idle');
    }
  };

  const handleDualHandUpdate = (dual: DualHandLandmarks | null) => {
    currentDualHands = dual;
    onDualHandUpdate(dual);
  };

  useHandTracking({
    enabled,
    onLandmarksUpdate: handleLandmarksUpdate,
    onDualHandUpdate: handleDualHandUpdate
  });

  return null;
};

// Export the gesture detection hook for use in parent components
export const useGestureFromLandmarks = () => {
  const { detectGesture } = useGestureDetection();
  return detectGesture;
};
