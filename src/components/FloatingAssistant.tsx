import { useState, useEffect } from "react";
import { FloatingOrb } from "./FloatingOrb";
import { BubbleChat } from "./BubbleChat";
import { usePWA } from "@/hooks/usePWA";

export const FloatingAssistant = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showOnMobile, setShowOnMobile] = useState(false);
  const { isStandalone } = usePWA();

  useEffect(() => {
    // Check if mobile device
    const checkMobile = () => {
      const isMobile = window.innerWidth < 768;
      setShowOnMobile(isMobile);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

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
