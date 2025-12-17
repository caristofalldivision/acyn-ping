import { useCallback } from 'react';
import * as THREE from 'three';
import { GestureType, HandLandmarks } from '../types';

const distance = (a: THREE.Vector3, b: THREE.Vector3): number => {
  return a.distanceTo(b);
};

export const useGestureDetection = () => {
  const detectGesture = useCallback((landmarks: HandLandmarks): GestureType => {
    if (!landmarks || landmarks.allLandmarks.length < 21) {
      return 'idle';
    }

    const thumbTip = landmarks.thumbTip;
    const indexTip = landmarks.indexFingerTip;
    const palmCenter = landmarks.palmCenter;
    
    // Get other finger tips from allLandmarks
    const middleTip = landmarks.allLandmarks[12];
    const ringTip = landmarks.allLandmarks[16];
    const pinkyTip = landmarks.allLandmarks[20];

    // Pinch detection - thumb and index finger close together
    const pinchDistance = distance(thumbTip, indexTip);
    if (pinchDistance < 0.15) {
      return 'pinch';
    }

    // Open palm detection - all fingers spread from palm
    const indexSpread = distance(indexTip, palmCenter) > 0.4;
    const middleSpread = distance(middleTip, palmCenter) > 0.4;
    const ringSpread = distance(ringTip, palmCenter) > 0.35;
    const pinkySpread = distance(pinkyTip, palmCenter) > 0.3;
    
    if (indexSpread && middleSpread && ringSpread && pinkySpread) {
      return 'palm';
    }

    // Point gesture - only index extended
    const indexExtended = distance(indexTip, palmCenter) > 0.5;
    const middleCurled = distance(middleTip, palmCenter) < 0.35;
    const ringCurled = distance(ringTip, palmCenter) < 0.3;
    const pinkyCurled = distance(pinkyTip, palmCenter) < 0.25;
    
    if (indexExtended && middleCurled && ringCurled && pinkyCurled) {
      return 'point';
    }

    return 'idle';
  }, []);

  return { detectGesture };
};
