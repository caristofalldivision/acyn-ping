import { Mic } from "lucide-react";

interface FloatingOrbProps {
  onClick: () => void;
  isExpanded: boolean;
}

export const FloatingOrb = ({ onClick, isExpanded }: FloatingOrbProps) => {
  if (isExpanded) return null;

  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center 
                 transition-all duration-300 hover:scale-110 hover:opacity-100 
                 floating-orb cursor-pointer group touch-manipulation"
      style={{
        opacity: 0.5,
        background: `radial-gradient(circle at 30% 30%, 
          hsl(var(--orb-glow) / 0.9), 
          hsl(var(--orb-core) / 0.7) 50%, 
          hsl(var(--orb-outer) / 0.5) 100%)`,
        boxShadow: `
          0 0 30px hsl(var(--orb-glow) / 0.4),
          0 0 60px hsl(var(--orb-core) / 0.2),
          0 4px 20px hsl(var(--background) / 0.5),
          inset 0 0 20px hsl(var(--orb-glow) / 0.2)
        `,
      }}
      aria-label="Open quick chat"
    >
      {/* Inner highlight for 3D effect */}
      <div
        className="absolute inset-2 rounded-full opacity-60 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 35% 35%, 
            hsl(var(--foreground) / 0.2), 
            transparent 50%)`,
        }}
      />
      
      {/* Outer ring glow */}
      <div
        className="absolute -inset-1 rounded-full opacity-30 pointer-events-none animate-orb-ring"
        style={{
          background: `radial-gradient(circle, 
            transparent 60%, 
            hsl(var(--orb-glow) / 0.3) 100%)`,
        }}
      />

      {/* Icon */}
      <Mic className="w-6 h-6 text-foreground/90 group-hover:text-foreground transition-colors z-10" />
    </button>
  );
};
