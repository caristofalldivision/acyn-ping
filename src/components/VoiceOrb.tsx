import { useState } from "react";
import { Mic } from "lucide-react";
interface VoiceOrbProps {
  isListening?: boolean;
  onMicClick?: () => void;
  size?: "sm" | "md" | "lg";
}
export const VoiceOrb = ({
  isListening = false,
  onMicClick,
  size = "lg"
}: VoiceOrbProps) => {
  const sizeClasses = {
    sm: "w-16 h-16",
    md: "w-32 h-32",
    lg: "w-48 h-48 md:w-64 md:h-64"
  };
  const iconSizes = {
    sm: "w-6 h-6",
    md: "w-10 h-10",
    lg: "w-12 h-12 md:w-16 md:h-16"
  };
  return <div className="relative flex items-center justify-center">
      {/* Outer glow rings */}
      
      
      
      {/* Main orb glow */}
      
      
      {/* Core orb */}
      <button onClick={onMicClick} className={`relative ${sizeClasses[size]} rounded-full flex items-center justify-center transition-all duration-300 hover:scale-105 cursor-pointer group`} style={{
      background: `radial-gradient(circle at 30% 30%, hsl(var(--orb-glow) / 0.8), hsl(var(--orb-core) / 0.6) 50%, hsl(var(--orb-outer) / 0.4) 100%)`,
      boxShadow: `
            0 0 60px hsl(var(--orb-glow) / 0.3),
            0 0 100px hsl(var(--orb-core) / 0.2),
            inset 0 0 60px hsl(var(--orb-glow) / 0.1)
          `
    }}>
        {/* Inner highlight */}
        <div className="absolute inset-4 rounded-full opacity-60" style={{
        background: `radial-gradient(circle at 40% 40%, hsl(var(--foreground) / 0.15), transparent 60%)`
      }} />
        
        {/* Mic icon */}
        <Mic className={`${iconSizes[size]} text-foreground/80 group-hover:text-foreground transition-colors z-10 ${isListening ? 'animate-pulse' : ''}`} />
      </button>

      {/* Listening indicator text */}
      {size === "lg" && <p className="absolute -bottom-12 text-sm text-muted-foreground">
          {isListening ? "Listening..." : "Tap to speak"}
        </p>}
    </div>;
};