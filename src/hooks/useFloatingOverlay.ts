import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { FloatingOverlay } from '@/plugins/floating-overlay';

interface UseFloatingOverlayReturn {
  isNative: boolean;
  hasPermission: boolean;
  isOverlayVisible: boolean;
  checkPermission: () => Promise<boolean>;
  requestPermission: () => Promise<boolean>;
  showOverlay: () => Promise<void>;
  hideOverlay: () => Promise<void>;
}

export const useFloatingOverlay = (): UseFloatingOverlayReturn => {
  const [hasPermission, setHasPermission] = useState(false);
  const [isOverlayVisible, setIsOverlayVisible] = useState(false);
  
  const isNative = Capacitor.isNativePlatform();
  
  const checkPermission = useCallback(async (): Promise<boolean> => {
    if (!isNative) return true;
    
    try {
      const { granted } = await FloatingOverlay.checkPermission();
      setHasPermission(granted);
      return granted;
    } catch (error) {
      console.error('Error checking overlay permission:', error);
      return false;
    }
  }, [isNative]);
  
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isNative) return true;
    
    try {
      const { granted } = await FloatingOverlay.requestPermission();
      setHasPermission(granted);
      return granted;
    } catch (error) {
      console.error('Error requesting overlay permission:', error);
      return false;
    }
  }, [isNative]);
  
  const showOverlay = useCallback(async (): Promise<void> => {
    if (!isNative) return;
    
    try {
      await FloatingOverlay.showOverlay();
      setIsOverlayVisible(true);
    } catch (error) {
      console.error('Error showing overlay:', error);
    }
  }, [isNative]);
  
  const hideOverlay = useCallback(async (): Promise<void> => {
    if (!isNative) return;
    
    try {
      await FloatingOverlay.hideOverlay();
      setIsOverlayVisible(false);
    } catch (error) {
      console.error('Error hiding overlay:', error);
    }
  }, [isNative]);
  
  useEffect(() => {
    if (isNative) {
      checkPermission();
    }
  }, [isNative, checkPermission]);
  
  return {
    isNative,
    hasPermission,
    isOverlayVisible,
    checkPermission,
    requestPermission,
    showOverlay,
    hideOverlay,
  };
};
