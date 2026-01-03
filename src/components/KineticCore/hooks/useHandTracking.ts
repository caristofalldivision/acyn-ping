import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { FilesetResolver, HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import * as THREE from 'three';
import { HandLandmarks, DualHandLandmarks } from '../types';

interface UseHandTrackingOptions {
  enabled: boolean;
  onLandmarksUpdate: (landmarks: HandLandmarks | null) => void;
  onDualHandUpdate: (dual: DualHandLandmarks | null) => void;
}

// Detect mobile device
const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.matchMedia('(max-width: 768px)').matches;
};

export const useHandTracking = ({ enabled, onLandmarksUpdate, onDualHandUpdate }: UseHandTrackingOptions) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animationFrameRef = useRef<number>();
  const lastPositionsRef = useRef<Map<string, THREE.Vector3>>(new Map());
  const lastFrameTimeRef = useRef(0);
  const isMobile = useMemo(() => isMobileDevice(), []);
  
  // Frame rate control for mobile
  const targetFps = isMobile ? 24 : 60;
  const frameInterval = 1000 / targetFps;

  // Convert 2D normalized MediaPipe coords to 3D world space
  const mapToWorldCoords = useCallback((x: number, y: number, z: number): THREE.Vector3 => {
    return new THREE.Vector3(
      (x - 0.5) * 4,
      -(y - 0.5) * 4,
      z * -4
    );
  }, []);

  // Calculate palm normal from wrist and finger base landmarks
  const calculatePalmNormal = useCallback((landmarks: THREE.Vector3[]): THREE.Vector3 => {
    const wrist = landmarks[0];
    const indexMCP = landmarks[5];
    const pinkyMCP = landmarks[17];
    
    if (!wrist || !indexMCP || !pinkyMCP) {
      return new THREE.Vector3(0, 0, 1);
    }

    const v1 = new THREE.Vector3().subVectors(indexMCP, wrist);
    const v2 = new THREE.Vector3().subVectors(pinkyMCP, wrist);
    const normal = new THREE.Vector3().crossVectors(v1, v2).normalize();
    
    return normal;
  }, []);

  // Calculate hand rotation (roll angle)
  const calculateHandRotation = useCallback((landmarks: THREE.Vector3[]): number => {
    const wrist = landmarks[0];
    const middleMCP = landmarks[9];
    
    if (!wrist || !middleMCP) return 0;
    
    const dx = middleMCP.x - wrist.x;
    const dy = middleMCP.y - wrist.y;
    
    return Math.atan2(dx, dy);
  }, []);

  // Calculate finger spread (0-1 value)
  const calculateFingerSpread = useCallback((landmarks: THREE.Vector3[]): number => {
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];
    const palmCenter = landmarks[9];
    
    if (!indexTip || !middleTip || !ringTip || !pinkyTip || !palmCenter) {
      return 0;
    }

    const indexMiddleDist = indexTip.distanceTo(middleTip);
    const middleRingDist = middleTip.distanceTo(ringTip);
    const ringPinkyDist = ringTip.distanceTo(pinkyTip);
    
    const avgSpread = (indexMiddleDist + middleRingDist + ringPinkyDist) / 3;
    const normalized = Math.min(1, Math.max(0, (avgSpread - 0.1) / 0.4));
    
    return normalized;
  }, []);

  // Calculate velocity from previous position
  const calculateVelocity = useCallback((handId: string, currentPos: THREE.Vector3): THREE.Vector3 => {
    const lastPos = lastPositionsRef.current.get(handId);
    if (!lastPos) {
      lastPositionsRef.current.set(handId, currentPos.clone());
      return new THREE.Vector3(0, 0, 0);
    }
    
    const velocity = new THREE.Vector3().subVectors(currentPos, lastPos);
    lastPositionsRef.current.set(handId, currentPos.clone());
    return velocity;
  }, []);

  const processLandmarks = useCallback((results: HandLandmarkerResult) => {
    if (!results.landmarks || results.landmarks.length === 0) {
      onLandmarksUpdate(null);
      onDualHandUpdate(null);
      return;
    }

    const processedHands: HandLandmarks[] = [];

    for (let i = 0; i < results.landmarks.length; i++) {
      const landmarks = results.landmarks[i];
      const handedness = results.handednesses[i]?.[0]?.categoryName as 'Left' | 'Right' || 'Right';
      
      const allLandmarks = landmarks.map(lm => 
        mapToWorldCoords(lm.x, lm.y, lm.z)
      );

      const palmCenter = mapToWorldCoords(landmarks[9].x, landmarks[9].y, landmarks[9].z);
      const handId = `hand_${i}`;

      const handData: HandLandmarks = {
        indexFingerTip: mapToWorldCoords(landmarks[8].x, landmarks[8].y, landmarks[8].z),
        thumbTip: mapToWorldCoords(landmarks[4].x, landmarks[4].y, landmarks[4].z),
        palmCenter,
        palmNormal: calculatePalmNormal(allLandmarks),
        handRotation: calculateHandRotation(allLandmarks),
        fingerSpread: calculateFingerSpread(allLandmarks),
        allLandmarks,
        handedness,
        velocity: calculateVelocity(handId, palmCenter)
      };

      processedHands.push(handData);
    }

    // Update primary hand (first detected)
    onLandmarksUpdate(processedHands[0] || null);

    // Process two-hand data if available
    if (processedHands.length >= 2) {
      const leftHand = processedHands.find(h => h.handedness === 'Left') || processedHands[0];
      const rightHand = processedHands.find(h => h.handedness === 'Right') || processedHands[1];
      
      const interHandDistance = leftHand.palmCenter.distanceTo(rightHand.palmCenter);
      const centerPoint = new THREE.Vector3().lerpVectors(
        leftHand.palmCenter, 
        rightHand.palmCenter, 
        0.5
      );

      // Detect approaching/separating
      const combinedVelocity = new THREE.Vector3().addVectors(
        leftHand.velocity, 
        rightHand.velocity
      );
      const dotProduct = leftHand.velocity.dot(
        new THREE.Vector3().subVectors(rightHand.palmCenter, leftHand.palmCenter).normalize()
      );

      const dualData: DualHandLandmarks = {
        leftHand,
        rightHand,
        interHandDistance,
        centerPoint,
        isApproaching: dotProduct > 0.02,
        isSeparating: dotProduct < -0.02
      };

      onDualHandUpdate(dualData);
    } else {
      onDualHandUpdate(null);
    }
  }, [mapToWorldCoords, calculatePalmNormal, calculateHandRotation, calculateFingerSpread, calculateVelocity, onLandmarksUpdate, onDualHandUpdate]);

  const detectHands = useCallback(() => {
    if (!handLandmarkerRef.current || !videoRef.current || !enabled) {
      animationFrameRef.current = requestAnimationFrame(detectHands);
      return;
    }

    const now = performance.now();
    
    // Frame rate limiting for mobile
    if (now - lastFrameTimeRef.current < frameInterval) {
      animationFrameRef.current = requestAnimationFrame(detectHands);
      return;
    }
    lastFrameTimeRef.current = now;

    const video = videoRef.current;
    if (video.readyState >= 2) {
      try {
        const results = handLandmarkerRef.current.detectForVideo(video, now);
        processLandmarks(results);
      } catch (error) {
        console.error('Hand detection error:', error);
      }
    }

    animationFrameRef.current = requestAnimationFrame(detectHands);
  }, [enabled, processLandmarks, frameInterval]);

  const initializeHandLandmarker = useCallback(async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      const handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numHands: 2, // Enable two-hand tracking
        minHandDetectionConfidence: isMobile ? 0.6 : 0.5,
        minHandPresenceConfidence: isMobile ? 0.6 : 0.5,
        minTrackingConfidence: isMobile ? 0.6 : 0.5
      });

      handLandmarkerRef.current = handLandmarker;
      setIsInitialized(true);
    } catch (error) {
      console.error('Failed to initialize HandLandmarker:', error);
    }
  }, [isMobile]);

  const startCamera = useCallback(async () => {
    try {
      // Lower resolution for mobile
      const videoConstraints = isMobile 
        ? { width: 480, height: 360, facingMode: 'user' }
        : { width: 640, height: 480, facingMode: 'user' };

      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints
      });

      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      
      await video.play();
      videoRef.current = video;
      setHasPermission(true);

      detectHands();
    } catch (error) {
      console.error('Camera access denied:', error);
      setHasPermission(false);
    }
  }, [detectHands, isMobile]);

  useEffect(() => {
    if (enabled && !isInitialized) {
      initializeHandLandmarker();
    }
  }, [enabled, isInitialized, initializeHandLandmarker]);

  useEffect(() => {
    if (enabled && isInitialized && !hasPermission) {
      startCamera();
    }
  }, [enabled, isInitialized, hasPermission, startCamera]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  return {
    isInitialized,
    hasPermission,
    isMobile
  };
};
