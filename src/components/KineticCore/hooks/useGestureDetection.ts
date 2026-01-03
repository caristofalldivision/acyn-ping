import { useCallback, useRef } from 'react';
import * as THREE from 'three';
import { GestureType, HandLandmarks, DualHandLandmarks } from '../types';

const distance = (a: THREE.Vector3, b: THREE.Vector3): number => {
  return a.distanceTo(b);
};

// Finger landmark indices
const THUMB_TIP = 4;
const INDEX_TIP = 8;
const INDEX_PIP = 6;
const MIDDLE_TIP = 12;
const MIDDLE_PIP = 10;
const RING_TIP = 16;
const RING_PIP = 14;
const PINKY_TIP = 20;
const PINKY_PIP = 18;

export const useGestureDetection = () => {
  const lastGestureRef = useRef<GestureType>('idle');
  const gestureStabilityRef = useRef(0);
  const velocityHistoryRef = useRef<number[]>([]);

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

  // Calculate average hand velocity magnitude
  const getVelocityMagnitude = useCallback((velocity: THREE.Vector3): number => {
    const mag = velocity.length();
    velocityHistoryRef.current.push(mag);
    if (velocityHistoryRef.current.length > 10) {
      velocityHistoryRef.current.shift();
    }
    return velocityHistoryRef.current.reduce((a, b) => a + b, 0) / velocityHistoryRef.current.length;
  }, []);

  // Detect two-hand gestures
  const detectTwoHandGesture = useCallback((dual: DualHandLandmarks): GestureType | null => {
    if (!dual.leftHand || !dual.rightHand) return null;

    const { interHandDistance, isApproaching, isSeparating, leftHand, rightHand } = dual;

    // Check both palms facing each other (palms toward center)
    const palmsFacing = leftHand.palmNormal.dot(rightHand.palmNormal) < -0.3;
    
    // Check both are fists
    const leftFist = isFingerCurled(leftHand.allLandmarks, INDEX_TIP, leftHand.palmCenter, 0.3) &&
                     isFingerCurled(leftHand.allLandmarks, MIDDLE_TIP, leftHand.palmCenter, 0.3);
    const rightFist = isFingerCurled(rightHand.allLandmarks, INDEX_TIP, rightHand.palmCenter, 0.3) &&
                      isFingerCurled(rightHand.allLandmarks, MIDDLE_TIP, rightHand.palmCenter, 0.3);

    // Check both palms open
    const leftOpen = isFingerExtended(leftHand.allLandmarks, INDEX_TIP, INDEX_PIP, leftHand.palmCenter) &&
                     isFingerExtended(leftHand.allLandmarks, MIDDLE_TIP, MIDDLE_PIP, leftHand.palmCenter);
    const rightOpen = isFingerExtended(rightHand.allLandmarks, INDEX_TIP, INDEX_PIP, rightHand.palmCenter) &&
                      isFingerExtended(rightHand.allLandmarks, MIDDLE_TIP, MIDDLE_PIP, rightHand.palmCenter);

    // Palm forward check
    const bothPalmsForward = leftHand.palmNormal.z > 0.4 && rightHand.palmNormal.z > 0.4;

    // CLAP - Hands approaching quickly
    if (isApproaching && interHandDistance < 0.8 && leftOpen && rightOpen) {
      return 'clap';
    }
    
    // MERGE - Both fists close together
    if (leftFist && rightFist && interHandDistance < 0.5) {
      return 'merge';
    }
    
    // STRETCH - Hands apart with palms facing each other
    if (palmsFacing && interHandDistance > 1.5 && leftOpen && rightOpen) {
      return 'stretch';
    }
    
    // COMPRESS - Hands close together with palms facing
    if (palmsFacing && interHandDistance < 0.6 && leftOpen && rightOpen) {
      return 'compress';
    }
    
    // TEAR - Hands separating quickly
    if (isSeparating && interHandDistance > 1.2) {
      return 'tear';
    }
    
    // SPHERE - Hands cupped (palms facing each other, moderate distance)
    if (palmsFacing && interHandDistance > 0.6 && interHandDistance < 1.2) {
      return 'sphere';
    }
    
    // PUSH - Both palms facing forward
    if (bothPalmsForward && leftOpen && rightOpen) {
      return 'push';
    }
    
    // TWIST - Hands rotating in opposite directions (different rotation angles)
    const rotationDiff = Math.abs(leftHand.handRotation - rightHand.handRotation);
    if (rotationDiff > 1.5 && interHandDistance < 1.5) {
      return 'twist';
    }
    
    // ORBITING - One hand relatively still, other moving
    const leftVelMag = leftHand.velocity.length();
    const rightVelMag = rightHand.velocity.length();
    if ((leftVelMag < 0.02 && rightVelMag > 0.08) || (rightVelMag < 0.02 && leftVelMag > 0.08)) {
      return 'orbiting';
    }
    
    // PULL - Both palms facing camera (toward viewer)
    if (leftHand.palmNormal.z < -0.4 && rightHand.palmNormal.z < -0.4 && leftOpen && rightOpen) {
      return 'pull';
    }

    return null;
  }, []);

  const detectGesture = useCallback((landmarks: HandLandmarks, dual: DualHandLandmarks | null): GestureType => {
    // First check for two-hand gestures
    if (dual && dual.leftHand && dual.rightHand) {
      const twoHandGesture = detectTwoHandGesture(dual);
      if (twoHandGesture) {
        // Stabilization for two-hand gestures
        if (twoHandGesture === lastGestureRef.current) {
          gestureStabilityRef.current++;
        } else {
          gestureStabilityRef.current = 0;
        }
        
        if (gestureStabilityRef.current >= 2) {
          lastGestureRef.current = twoHandGesture;
          return twoHandGesture;
        }
        return lastGestureRef.current;
      }
    }

    // Single-hand gesture detection
    if (!landmarks || landmarks.allLandmarks.length < 21) {
      return 'idle';
    }

    const { allLandmarks: lm, palmCenter, thumbTip, indexFingerTip, palmNormal, fingerSpread, velocity } = landmarks;
    
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

    const allFingersExtended = indexExtended && middleExtended && ringExtended && pinkyExtended;

    const pinchDistance = distance(thumbTip, indexFingerTip);
    
    // Palm orientation
    const palmFacingUp = palmNormal.y > 0.5;
    const palmFacingDown = palmNormal.y < -0.5;
    const palmFacingForward = palmNormal.z > 0.5;
    const palmFacingBack = palmNormal.z < -0.5;

    // Velocity-based detection
    const velMag = getVelocityMagnitude(velocity);
    const isMovingFast = velMag > 0.1;

    let detectedGesture: GestureType = 'idle';

    // ==== VELOCITY-ENHANCED GESTURES ====
    
    // BURST - Fast outward movement with spread fingers
    if (isMovingFast && fingerSpread > 0.6 && allFingersExtended) {
      detectedGesture = 'burst';
    }
    // SCATTER - Very fast chaotic movement
    else if (velMag > 0.15 && !allFingersCurled) {
      detectedGesture = 'scatter';
    }
    // ATTRACT - Fast movement toward center with grab-like pose
    else if (isMovingFast && pinchDistance > 0.15 && pinchDistance < 0.3) {
      detectedGesture = 'attract';
    }
    // REPEL - Fast palm push
    else if (isMovingFast && palmFacingForward && allFingersExtended) {
      detectedGesture = 'repel';
    }
    
    // ==== ORIENTATION-BASED GESTURES ====
    
    // GALAXY - Palm up with fingers spread (like holding a galaxy)
    else if (palmFacingUp && fingerSpread > 0.5 && allFingersExtended) {
      detectedGesture = 'galaxy';
    }
    // VORTEX - Palm down with fingers together, rotating
    else if (palmFacingDown && fingerSpread < 0.3 && middleExtended && indexExtended) {
      detectedGesture = 'vortex';
    }
    // TORNADO - Palm sideways with horizontal orientation
    else if (Math.abs(palmNormal.x) > 0.6 && allFingersExtended) {
      detectedGesture = 'tornado';
    }
    
    // ==== STATIC GESTURES (Original 12) ====
    
    // 1. PINCH - Thumb and index finger close
    else if (pinchDistance < 0.12 && middleExtended) {
      detectedGesture = 'pinch';
    }
    // 2. FIST - All fingers curled
    else if (allFingersCurled && !thumbExtended) {
      detectedGesture = 'fist';
    }
    // 3. ROCK - Index and pinky extended
    else if (indexExtended && pinkyExtended && !middleExtended && !ringExtended) {
      detectedGesture = 'rock';
    }
    // 4. PEACE - Index and middle extended
    else if (indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
      detectedGesture = 'peace';
    }
    // 5. GUN - Thumb up, index extended
    else if (thumbExtended && indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
      detectedGesture = 'gun';
    }
    // 6. THUMB UP
    else if (thumbExtended && thumbTip.y > palmCenter.y + 0.15 && allFingersCurled) {
      detectedGesture = 'thumbUp';
    }
    // 7. GRAB - Semi-curled fingers
    else if (pinchDistance > 0.12 && pinchDistance < 0.25 && !indexExtended && !middleExtended) {
      detectedGesture = 'grab';
    }
    // 8. SPREAD - All fingers spread wide
    else if (fingerSpread > 0.7 && allFingersExtended) {
      detectedGesture = 'spread';
    }
    // 9. PALM DOWN - Open palm facing down
    else if (palmFacingDown && indexExtended && middleExtended && ringExtended) {
      detectedGesture = 'palmDown';
    }
    // 10. PALM - Open palm facing forward
    else if (palmFacingForward && allFingersExtended) {
      detectedGesture = 'palm';
    }
    // 11. POINT - Only index extended
    else if (indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
      detectedGesture = 'point';
    }
    // 12. WAVE - Palm forward with slight curl
    else if (palmFacingForward && indexExtended && middleExtended && !pinkyExtended) {
      detectedGesture = 'wave';
    }
    
    // ==== NEW GESTURE EXTENSIONS ====
    
    // PULSE - Fist with thumb out (like pressing a button)
    else if (allFingersCurled && thumbExtended && thumbTip.y < palmCenter.y) {
      detectedGesture = 'pulse';
    }
    // ORBIT - Circular hand motion detected by velocity direction changes
    else if (!allFingersCurled && !allFingersExtended && velMag > 0.05 && velMag < 0.1) {
      detectedGesture = 'orbit';
    }
    // SWIRL - Palm up, gentle movement
    else if (palmFacingUp && !isMovingFast && fingerSpread < 0.4) {
      detectedGesture = 'swirl';
    }
    // HEARTBEAT - Rhythmic fist (detected as fist variant)
    else if (allFingersCurled && thumbExtended) {
      detectedGesture = 'heartbeat';
    }

    // Gesture stabilization
    if (detectedGesture === lastGestureRef.current) {
      gestureStabilityRef.current++;
    } else {
      gestureStabilityRef.current = 0;
    }

    if (gestureStabilityRef.current >= 3 || detectedGesture === lastGestureRef.current) {
      lastGestureRef.current = detectedGesture;
      return detectedGesture;
    }

    return lastGestureRef.current;
  }, [detectTwoHandGesture, getVelocityMagnitude]);

  return { detectGesture };
};
