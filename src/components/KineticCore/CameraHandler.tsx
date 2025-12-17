import { useEffect } from 'react';
import { useHandTracking } from './hooks/useHandTracking';
import { useGestureDetection } from './hooks/useGestureDetection';
import { CameraHandlerProps, HandLandmarks } from './types';

export const CameraHandler = ({ 
  onLandmarksUpdate, 
  onGestureDetected,
  enabled 
}: CameraHandlerProps) => {
  const { detectGesture } = useGestureDetection();
  
  const handleLandmarksUpdate = (landmarks: HandLandmarks | null) => {
    onLandmarksUpdate(landmarks);
    
    if (landmarks) {
      const gesture = detectGesture(landmarks);
      onGestureDetected(gesture);
    } else {
      onGestureDetected('idle');
    }
  };

  useHandTracking({
    enabled,
    onLandmarksUpdate: handleLandmarksUpdate
  });

  return null; // This is a logic-only component
};
