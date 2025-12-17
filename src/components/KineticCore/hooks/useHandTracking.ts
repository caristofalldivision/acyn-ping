import { useState, useEffect, useRef, useCallback } from 'react';
import { FilesetResolver, HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import * as THREE from 'three';
import { HandLandmarks } from '../types';

interface UseHandTrackingOptions {
  enabled: boolean;
  onLandmarksUpdate: (landmarks: HandLandmarks | null) => void;
}

export const useHandTracking = ({ enabled, onLandmarksUpdate }: UseHandTrackingOptions) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animationFrameRef = useRef<number>();

  // Convert 2D normalized MediaPipe coords to 3D world space
  const mapToWorldCoords = useCallback((x: number, y: number, z: number): THREE.Vector3 => {
    return new THREE.Vector3(
      (x - 0.5) * 4,    // Map [0,1] to [-2, 2]
      -(y - 0.5) * 4,   // Invert Y axis
      z * -4            // Depth mapping
    );
  }, []);

  const processLandmarks = useCallback((results: HandLandmarkerResult) => {
    if (results.landmarks && results.landmarks.length > 0) {
      const landmarks = results.landmarks[0];
      
      const allLandmarks = landmarks.map(lm => 
        mapToWorldCoords(lm.x, lm.y, lm.z)
      );

      const handData: HandLandmarks = {
        indexFingerTip: mapToWorldCoords(landmarks[8].x, landmarks[8].y, landmarks[8].z),
        thumbTip: mapToWorldCoords(landmarks[4].x, landmarks[4].y, landmarks[4].z),
        palmCenter: mapToWorldCoords(landmarks[9].x, landmarks[9].y, landmarks[9].z),
        allLandmarks
      };

      onLandmarksUpdate(handData);
    } else {
      onLandmarksUpdate(null);
    }
  }, [mapToWorldCoords, onLandmarksUpdate]);

  const detectHands = useCallback(() => {
    if (!handLandmarkerRef.current || !videoRef.current || !enabled) {
      animationFrameRef.current = requestAnimationFrame(detectHands);
      return;
    }

    const video = videoRef.current;
    if (video.readyState >= 2) {
      const startTimeMs = performance.now();
      try {
        const results = handLandmarkerRef.current.detectForVideo(video, startTimeMs);
        processLandmarks(results);
      } catch (error) {
        console.error('Hand detection error:', error);
      }
    }

    animationFrameRef.current = requestAnimationFrame(detectHands);
  }, [enabled, processLandmarks]);

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
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      handLandmarkerRef.current = handLandmarker;
      setIsInitialized(true);
    } catch (error) {
      console.error('Failed to initialize HandLandmarker:', error);
    }
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: 640, 
          height: 480,
          facingMode: 'user'
        }
      });

      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      
      await video.play();
      videoRef.current = video;
      setHasPermission(true);

      // Start detection loop
      detectHands();
    } catch (error) {
      console.error('Camera access denied:', error);
      setHasPermission(false);
    }
  }, [detectHands]);

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
    hasPermission
  };
};
