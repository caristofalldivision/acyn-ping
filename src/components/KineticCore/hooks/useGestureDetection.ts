import { useCallback, useRef } from 'react';
import * as THREE from 'three';
import { GestureType, HandLandmarks, DualHandLandmarks } from '../types';

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
    return tipDist > pipDist * 1.05; // Slightly more sensitive
  };

  const isFingerCurled = (
    landmarks: THREE.Vector3[],
    tipIdx: number,
    palmCenter: THREE.Vector3,
    threshold = 0.28
  ): boolean => {
    const tip = landmarks[tipIdx];
    if (!tip) return false;
    return distance(tip, palmCenter) < threshold;
  };

  // Calculate average hand velocity magnitude
  const getVelocityMagnitude = useCallback((velocity: THREE.Vector3): number => {
    const mag = velocity.length();
    velocityHistoryRef.current.push(mag);
    if (velocityHistoryRef.current.length > 5) { // Reduced from 10 for faster response
      velocityHistoryRef.current.shift();
    }
    return velocityHistoryRef.current.reduce((a, b) => a + b, 0) / velocityHistoryRef.current.length;
  }, []);

  // Detect two-hand gestures - HIGHEST PRIORITY
  const detectTwoHandGesture = useCallback((dual: DualHandLandmarks): GestureType | null => {
    if (!dual.leftHand || !dual.rightHand) return null;

    const { interHandDistance, isApproaching, isSeparating, leftHand, rightHand } = dual;

    // Check both palms facing each other (palms toward center)
    const palmsFacing = leftHand.palmNormal.dot(rightHand.palmNormal) < -0.2;
    
    // Check both are fists
    const leftFist = isFingerCurled(leftHand.allLandmarks, INDEX_TIP, leftHand.palmCenter, 0.35) &&
                     isFingerCurled(leftHand.allLandmarks, MIDDLE_TIP, leftHand.palmCenter, 0.35);
    const rightFist = isFingerCurled(rightHand.allLandmarks, INDEX_TIP, rightHand.palmCenter, 0.35) &&
                      isFingerCurled(rightHand.allLandmarks, MIDDLE_TIP, rightHand.palmCenter, 0.35);

    // Check both palms open
    const leftOpen = isFingerExtended(leftHand.allLandmarks, INDEX_TIP, INDEX_PIP, leftHand.palmCenter) &&
                     isFingerExtended(leftHand.allLandmarks, MIDDLE_TIP, MIDDLE_PIP, leftHand.palmCenter);
    const rightOpen = isFingerExtended(rightHand.allLandmarks, INDEX_TIP, INDEX_PIP, rightHand.palmCenter) &&
                      isFingerExtended(rightHand.allLandmarks, MIDDLE_TIP, MIDDLE_PIP, rightHand.palmCenter);

    // Palm forward check
    const bothPalmsForward = leftHand.palmNormal.z > 0.3 && rightHand.palmNormal.z > 0.3;

    // === TWO-HAND GESTURE DETECTION (in priority order) ===

    // CLAP - Hands approaching quickly
    if (isApproaching && interHandDistance < 1.0 && leftOpen && rightOpen) {
      return 'clap';
    }
    
    // MERGE - Both fists close together
    if (leftFist && rightFist && interHandDistance < 0.6) {
      return 'merge';
    }
    
    // TEAR - Hands separating quickly
    if (isSeparating && interHandDistance > 1.0) {
      return 'tear';
    }
    
    // STRETCH - Hands apart with palms facing each other
    if (palmsFacing && interHandDistance > 1.2 && leftOpen && rightOpen) {
      return 'stretch';
    }
    
    // COMPRESS - Hands close together with palms facing
    if (palmsFacing && interHandDistance < 0.8 && leftOpen && rightOpen) {
      return 'compress';
    }
    
    // TWIST - Hands rotating in opposite directions (different rotation angles)
    const rotationDiff = Math.abs(leftHand.handRotation - rightHand.handRotation);
    if (rotationDiff > 1.2 && interHandDistance < 1.8) {
      return 'twist';
    }
    
    // SPHERE - Hands cupped (palms facing each other, moderate distance)
    if (palmsFacing && interHandDistance > 0.5 && interHandDistance < 1.4) {
      return 'sphere';
    }
    
    // PUSH - Both palms facing forward
    if (bothPalmsForward && leftOpen && rightOpen) {
      return 'push';
    }
    
    // ORBITING - One hand relatively still, other moving
    const leftVelMag = leftHand.velocity.length();
    const rightVelMag = rightHand.velocity.length();
    if ((leftVelMag < 0.03 && rightVelMag > 0.06) || (rightVelMag < 0.03 && leftVelMag > 0.06)) {
      return 'orbiting';
    }
    
    // PULL - Both palms facing camera (toward viewer)
    if (leftHand.palmNormal.z < -0.3 && rightHand.palmNormal.z < -0.3 && leftOpen && rightOpen) {
      return 'pull';
    }

    return null;
  }, []);

  const detectGesture = useCallback((landmarks: HandLandmarks, dual: DualHandLandmarks | null): GestureType => {
    // PRIORITY 1: Two-hand gestures
    if (dual && dual.leftHand && dual.rightHand) {
      const twoHandGesture = detectTwoHandGesture(dual);
      if (twoHandGesture) {
        // Reduced stabilization for faster response
        if (twoHandGesture === lastGestureRef.current) {
          gestureStabilityRef.current++;
        } else {
          gestureStabilityRef.current = 0;
        }
        
        if (gestureStabilityRef.current >= 1) { // Reduced from 2
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
    const thumbExtended = distance(thumbTip, palmCenter) > 0.18;
    
    const allFingersCurled = 
      isFingerCurled(lm, INDEX_TIP, palmCenter, 0.32) &&
      isFingerCurled(lm, MIDDLE_TIP, palmCenter, 0.32) &&
      isFingerCurled(lm, RING_TIP, palmCenter, 0.32) &&
      isFingerCurled(lm, PINKY_TIP, palmCenter, 0.28);

    const allFingersExtended = indexExtended && middleExtended && ringExtended && pinkyExtended;

    const pinchDistance = distance(thumbTip, indexFingerTip);
    
    // Palm orientation - adjusted thresholds
    const palmFacingUp = palmNormal.y > 0.4;
    const palmFacingDown = palmNormal.y < -0.4;
    const palmFacingForward = palmNormal.z > 0.6; // More strict - must really face camera
    const palmFacingBack = palmNormal.z < -0.4;
    const palmSideways = Math.abs(palmNormal.x) > 0.5;

    // Velocity-based detection - adjusted thresholds
    const velMag = getVelocityMagnitude(velocity);
    const isMovingFast = velMag > 0.12;
    const isMovingVeryFast = velMag > 0.18;

    let detectedGesture: GestureType = 'idle';

    // === PRIORITY 2: SPECIFIC FINGER POSES (most unique) ===
    
    // PINCH - Thumb and index finger close (very specific)
    if (pinchDistance < 0.1 && middleExtended) {
      detectedGesture = 'pinch';
    }
    // FIST - All fingers curled (very specific)
    else if (allFingersCurled && !thumbExtended) {
      detectedGesture = 'fist';
    }
    // ROCK - Index and pinky extended only (very specific)
    else if (indexExtended && pinkyExtended && !middleExtended && !ringExtended) {
      detectedGesture = 'rock';
    }
    // PEACE - Index and middle extended only (very specific)
    else if (indexExtended && middleExtended && !ringExtended && !pinkyExtended && fingerSpread > 0.2) {
      detectedGesture = 'peace';
    }
    // GUN - Thumb up, only index extended (very specific)
    else if (thumbExtended && indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
      detectedGesture = 'gun';
    }
    // POINT - Only index extended (very specific)
    else if (indexExtended && !middleExtended && !ringExtended && !pinkyExtended && !thumbExtended) {
      detectedGesture = 'point';
    }
    // THUMB UP - Thumb raised, all fingers curled
    else if (thumbExtended && thumbTip.y > palmCenter.y + 0.12 && allFingersCurled) {
      detectedGesture = 'thumbUp';
    }
    
    // === PRIORITY 3: VELOCITY-BASED GESTURES ===
    
    // BURST - Very fast outward movement with spread fingers
    else if (isMovingVeryFast && fingerSpread > 0.6 && allFingersExtended) {
      detectedGesture = 'burst';
    }
    // SCATTER - Very fast chaotic movement
    else if (isMovingVeryFast && !allFingersCurled) {
      detectedGesture = 'scatter';
    }
    // REPEL - Fast palm push forward
    else if (isMovingFast && palmFacingForward && allFingersExtended) {
      detectedGesture = 'repel';
    }
    // ATTRACT - Fast movement with grab-like pose
    else if (isMovingFast && pinchDistance > 0.12 && pinchDistance < 0.28) {
      detectedGesture = 'attract';
    }
    
    // === PRIORITY 4: ORIENTATION-BASED GESTURES ===
    
    // GALAXY - Palm facing BACKWARD (away from camera) with fingers spread
    else if (palmFacingBack && fingerSpread > 0.4 && allFingersExtended) {
      detectedGesture = 'galaxy';
    }
    // VORTEX - Palm facing up with fingers together
    else if (palmFacingUp && fingerSpread < 0.35 && indexExtended && middleExtended) {
      detectedGesture = 'vortex';
    }
    // TORNADO - Palm sideways with horizontal orientation
    else if (palmSideways && allFingersExtended) {
      detectedGesture = 'tornado';
    }
    // PALM DOWN - Open palm facing down
    else if (palmFacingDown && allFingersExtended) {
      detectedGesture = 'palmDown';
    }
    // SWIRL - Palm up, gentle movement
    else if (palmFacingUp && !isMovingFast && fingerSpread < 0.45) {
      detectedGesture = 'swirl';
    }
    
    // === PRIORITY 5: GENERIC GESTURES (fallback) ===
    
    // SPREAD - All fingers spread wide
    else if (fingerSpread > 0.65 && allFingersExtended) {
      detectedGesture = 'spread';
    }
    // GRAB - Semi-curled fingers
    else if (pinchDistance > 0.1 && pinchDistance < 0.25 && !indexExtended && !middleExtended) {
      detectedGesture = 'grab';
    }
    // WAVE - Palm forward with some fingers extended
    else if (palmFacingForward && indexExtended && middleExtended && !pinkyExtended) {
      detectedGesture = 'wave';
    }
    // PALM - Open palm facing forward (LEAST PRIORITY - most generic)
    else if (palmFacingForward && allFingersExtended) {
      detectedGesture = 'palm';
    }
    
    // === EXTENDED GESTURES ===
    
    // PULSE - Fist with thumb out (like pressing a button)
    else if (allFingersCurled && thumbExtended && thumbTip.y < palmCenter.y) {
      detectedGesture = 'pulse';
    }
    // ORBIT - Circular hand motion
    else if (!allFingersCurled && !allFingersExtended && velMag > 0.04 && velMag < 0.1) {
      detectedGesture = 'orbit';
    }
    // HEARTBEAT - Rhythmic fist variant
    else if (allFingersCurled && thumbExtended) {
      detectedGesture = 'heartbeat';
    }

    // Gesture stabilization - reduced from 3 to 1 for faster response
    if (detectedGesture === lastGestureRef.current) {
      gestureStabilityRef.current++;
    } else {
      gestureStabilityRef.current = 0;
    }

    // Accept immediately if same as last, or after 1 frame of new gesture
    if (gestureStabilityRef.current >= 1 || detectedGesture === lastGestureRef.current) {
      lastGestureRef.current = detectedGesture;
      return detectedGesture;
    }

    return lastGestureRef.current;
  }, [detectTwoHandGesture, getVelocityMagnitude]);

  return { detectGesture };
};
