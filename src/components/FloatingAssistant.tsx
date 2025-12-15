import { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { FloatingOrb } from "./FloatingOrb";
import { BubbleChat } from "./BubbleChat";
import { usePWA } from "@/hooks/usePWA";
import { useFloatingOverlay } from "@/hooks/useFloatingOverlay";

export const FloatingAssistant = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showOnMobile, setShowOnMobile] = useState(false);
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

  // Handle app lifecycle for native overlay
  useEffect(() => {
    if (!isNative) return;

    const setupAppLifecycle = async () => {
      try {
        const { App } = await import("@capacitor/app");
        
        // Listen for app state changes
        const listener = await App.addListener("appStateChange", async ({ isActive }) => {
          if (isActive) {
            // App came to foreground - hide native overlay
            await hideOverlay();
          } else {
            // App went to background - show native overlay if permitted
            if (hasPermission) {
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
  }, [isNative, hasPermission, showOverlay, hideOverlay]);

  // Request overlay permission on first load (native only)
  useEffect(() => {
    if (isNative && !hasPermission) {
      // Delay permission request slightly for better UX
      const timer = setTimeout(() => {
        requestPermission();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isNative, hasPermission, requestPermission]);

  // Show floating assistant on mobile or when running as PWA
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
