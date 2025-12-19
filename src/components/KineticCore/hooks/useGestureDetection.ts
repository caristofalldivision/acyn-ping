import { useCallback, useRef } from 'react';
import * as THREE from 'three';
import { GestureType, HandLandmarks } from '../types';

const distance = (a: THREE.Vector3, b: THREE.Vector3): number => {
  return a.distanceTo(b);
};

// Finger landmark indices
const THUMB_TIP = 4;
const THUMB_IP = 3;
const INDEX_TIP = 8;
const INDEX_PIP = 6;
const MIDDLE_TIP = 12;
const MIDDLE_PIP = 10;
const RING_TIP = 16;
const RING_PIP = 14;
const PINKY_TIP = 20;
const PINKY_PIP = 18;
const WRIST = 0;
const PALM_BASE = 9;

export const useGestureDetection = () => {
  const lastGestureRef = useRef<GestureType>('idle');
  const gestureStabilityRef = useRef(0);

  const isFingerExtended = (
    landmarks: THREE.Vector3[],
    tipIdx: number,
    pipIdx: number,
    palmCenter: THREE.Vector3
  ): boolean => {
    const tip = landmarks[tipIdx];
    const pip = landmarks[pipIdx];
    if (!tip || !pip) return false;
    
    const tipDist = distance(tip, palmCenter);
    const pipDist = distance(pip, palmCenter);
    return tipDist > pipDist * 1.1;
  };

  const isFingerCurled = (
    landmarks: THREE.Vector3[],
    tipIdx: number,
    palmCenter: THREE.Vector3,
    threshold = 0.25
  ): boolean => {
    const tip = landmarks[tipIdx];
    if (!tip) return false;
    return distance(tip, palmCenter) < threshold;
  };

  const detectGesture = useCallback((landmarks: HandLandmarks): GestureType => {
    if (!landmarks || landmarks.allLandmarks.length < 21) {
      return 'idle';
    }

    const { allLandmarks: lm, palmCenter, thumbTip, indexFingerTip, palmNormal, fingerSpread } = landmarks;
    
    const indexTip = lm[INDEX_TIP];
    const middleTip = lm[MIDDLE_TIP];
    const ringTip = lm[RING_TIP];
    const pinkyTip = lm[PINKY_TIP];
    const wrist = lm[WRIST];

    // Helper calculations
    const indexExtended = isFingerExtended(lm, INDEX_TIP, INDEX_PIP, palmCenter);
    const middleExtended = isFingerExtended(lm, MIDDLE_TIP, MIDDLE_PIP, palmCenter);
    const ringExtended = isFingerExtended(lm, RING_TIP, RING_PIP, palmCenter);
    const pinkyExtended = isFingerExtended(lm, PINKY_TIP, PINKY_PIP, palmCenter);
    const thumbExtended = distance(thumbTip, palmCenter) > 0.2;
    
    const allFingersCurled = 
      isFingerCurled(lm, INDEX_TIP, palmCenter, 0.3) &&
      isFingerCurled(lm, MIDDLE_TIP, palmCenter, 0.3) &&
      isFingerCurled(lm, RING_TIP, palmCenter, 0.3) &&
      isFingerCurled(lm, PINKY_TIP, palmCenter, 0.25);

    const pinchDistance = distance(thumbTip, indexFingerTip);
    
    // Palm orientation (up vs down)
    const palmFacingUp = palmNormal.y > 0.5;
    const palmFacingDown = palmNormal.y < -0.5;
    const palmFacingForward = palmNormal.z > 0.5;

    let detectedGesture: GestureType = 'idle';

    // 1. PINCH - Thumb and index finger close
    if (pinchDistance < 0.12 && middleExtended) {
      detectedGesture = 'pinch';
    }
    // 2. FIST - All fingers curled, thumb tucked
    else if (allFingersCurled && !thumbExtended) {
      detectedGesture = 'fist';
    }
    // 3. ROCK (devil horns) - Index and pinky extended, others curled
    else if (indexExtended && pinkyExtended && !middleExtended && !ringExtended) {
      detectedGesture = 'rock';
    }
    // 4. PEACE (V sign) - Index and middle extended, others curled
    else if (indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
      detectedGesture = 'peace';
    }
    // 5. GUN - Thumb up, index extended, others curled
    else if (thumbExtended && indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
      detectedGesture = 'gun';
    }
    // 6. THUMB UP - Only thumb extended upward
    else if (thumbExtended && thumbTip.y > palmCenter.y + 0.15 && allFingersCurled) {
      detectedGesture = 'thumbUp';
    }
    // 7. GRAB - Fingers semi-curled, like grabbing motion (pinch distance medium)
    else if (pinchDistance > 0.12 && pinchDistance < 0.25 && !indexExtended && !middleExtended) {
      detectedGesture = 'grab';
    }
    // 8. SPREAD - All fingers spread wide apart (high finger spread value)
    else if (fingerSpread > 0.7 && indexExtended && middleExtended && ringExtended && pinkyExtended) {
      detectedGesture = 'spread';
    }
    // 9. PALM DOWN - Open palm facing downward
    else if (palmFacingDown && indexExtended && middleExtended && ringExtended) {
      detectedGesture = 'palmDown';
    }
    // 10. PALM - Open palm facing forward (default palm)
    else if (palmFacingForward && indexExtended && middleExtended && ringExtended && pinkyExtended) {
      detectedGesture = 'palm';
    }
    // 11. POINT - Only index extended
    else if (indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
      detectedGesture = 'point';
    }
    // 12. WAVE - Detect based on hand movement (simplified - use palm facing forward with slight curl)
    else if (palmFacingForward && indexExtended && middleExtended && !pinkyExtended) {
      detectedGesture = 'wave';
    }

    // Gesture stabilization (prevent flickering)
    if (detectedGesture === lastGestureRef.current) {
      gestureStabilityRef.current++;
    } else {
      gestureStabilityRef.current = 0;
    }

    // Only change gesture after stable for a few frames
    if (gestureStabilityRef.current >= 3 || detectedGesture === lastGestureRef.current) {
      lastGestureRef.current = detectedGesture;
      return detectedGesture;
    }

    return lastGestureRef.current;
  }, []);

  return { detectGesture };
};
