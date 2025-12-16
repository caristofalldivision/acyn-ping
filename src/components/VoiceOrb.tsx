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
    sm: "w-20 h-20",
    md: "w-36 h-36",
    lg: "w-56 h-56 md:w-72 md:h-72"
  };

  const iconSizes = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16 md:w-20 md:h-20"
  };

  return (
    <div className="relative flex items-center justify-center">
      {/* Outer glow ring */}
      <div 
        className="absolute rounded-full animate-orb-glow"
        style={{
          width: size === "lg" ? "320px" : size === "md" ? "180px" : "100px",
          height: size === "lg" ? "320px" : size === "md" ? "180px" : "100px",
          background: `radial-gradient(circle, hsl(var(--orb-glow) / 0.15) 0%, transparent 70%)`,
        }}
      />
      
      {/* Core orb */}
      <button 
        onClick={onMicClick} 
        className={`relative ${sizeClasses[size]} rounded-full flex items-center justify-center transition-all duration-300 hover:scale-105 cursor-pointer group animate-orb-breathe`}
        style={{
          background: `
            radial-gradient(circle at 30% 25%, hsl(var(--orb-glow) / 0.9) 0%, transparent 40%),
            radial-gradient(circle at 70% 80%, hsl(var(--orb-outer) / 0.6) 0%, transparent 40%),
            radial-gradient(circle at 50% 50%, hsl(var(--orb-core) / 0.8) 0%, hsl(var(--orb-outer) / 0.4) 100%)
          `,
          boxShadow: `
            0 0 60px hsl(var(--orb-glow) / 0.4),
            0 0 120px hsl(var(--orb-core) / 0.2),
            inset 0 0 60px hsl(var(--orb-glow) / 0.2),
            inset 0 -20px 40px hsl(var(--orb-outer) / 0.3)
          `
        }}
      >
        {/* Glass highlight - top left */}
        <div 
          className="absolute rounded-full opacity-80 pointer-events-none"
          style={{
            width: "60%",
            height: "40%",
            top: "8%",
            left: "10%",
            background: `linear-gradient(135deg, hsl(var(--foreground) / 0.25) 0%, transparent 60%)`,
            filter: "blur(2px)",
          }}
        />

        {/* Secondary highlight - bottom right */}
        <div 
          className="absolute rounded-full opacity-40 pointer-events-none"
          style={{
            width: "30%",
            height: "20%",
            bottom: "15%",
            right: "15%",
            background: `radial-gradient(circle, hsl(var(--orb-glow) / 0.5) 0%, transparent 70%)`,
          }}
        />
        
        {/* Mic icon */}
        <Mic 
          className={`${iconSizes[size]} text-foreground/90 group-hover:text-foreground transition-colors z-10 drop-shadow-lg ${isListening ? 'animate-pulse' : ''}`} 
        />
      </button>

      {/* Listening indicator text */}
      {size === "lg" && (
        <p className="absolute -bottom-16 text-sm text-muted-foreground">
          {isListening ? "Listening..." : "Tap to speak"}
        </p>
      )}
    </div>
  );
};