import { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { FloatingOrb } from "./FloatingOrb";
import { BubbleChat } from "./BubbleChat";
import { usePWA } from "@/hooks/usePWA";
import { useFloatingOverlay } from "@/hooks/useFloatingOverlay";
import { getOverlayEnabled } from "./SettingsPanel";

export const FloatingAssistant = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showOnMobile, setShowOnMobile] = useState(false);
  const [overlayEnabled, setOverlayEnabled] = useState(getOverlayEnabled());
  const { isStandalone } = usePWA();
  const { isNative, hasPermission, requestPermission, showOverlay, hideOverlay } = useFloatingOverlay();

  useEffect(() => {
    const checkMobile = () => {
      const isMobile = window.innerWidth < 768;
      setShowOnMobile(isMobile);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Listen for overlay setting changes
  useEffect(() => {
    const handleSettingChange = (e: CustomEvent<boolean>) => {
      setOverlayEnabled(e.detail);
    };

    window.addEventListener("overlay-setting-changed", handleSettingChange as EventListener);
    return () => {
      window.removeEventListener("overlay-setting-changed", handleSettingChange as EventListener);
    };
  }, []);

  // Handle app lifecycle for native overlay
  useEffect(() => {
    if (!isNative || !overlayEnabled) return;

    const setupAppLifecycle = async () => {
      try {
        const { App } = await import("@capacitor/app");
        
        // Listen for app state changes
        const listener = await App.addListener("appStateChange", async ({ isActive }) => {
          if (isActive) {
            // App came to foreground - hide native overlay
            await hideOverlay();
          } else {
            // App went to background - show native overlay if permitted and enabled
            if (hasPermission && overlayEnabled) {
              await showOverlay();
            }
          }
        });

        return () => {
          listener.remove();
        };
      } catch (error) {
        console.log("App lifecycle not available:", error);
      }
    };

    setupAppLifecycle();
  }, [isNative, hasPermission, showOverlay, hideOverlay, overlayEnabled]);

  // Request overlay permission on first load (native only)
  useEffect(() => {
    if (isNative && !hasPermission && overlayEnabled) {
      // Delay permission request slightly for better UX
      const timer = setTimeout(() => {
        requestPermission();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isNative, hasPermission, requestPermission, overlayEnabled]);

  // Don't show if overlay is disabled or not on mobile/PWA
  if (!overlayEnabled) return null;
  if (!showOnMobile && !isStandalone) return null;

  return (
    <>
      <FloatingOrb
        onClick={() => setIsExpanded(true)}
        isExpanded={isExpanded}
      />
      {isExpanded && (
        <BubbleChat onClose={() => setIsExpanded(false)} />
      )}
    </>
  );
};