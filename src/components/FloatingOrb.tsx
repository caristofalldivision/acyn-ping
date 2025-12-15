import { Mic } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";

interface FloatingOrbProps {
  onClick: () => void;
  isExpanded: boolean;
}

const STORAGE_KEY = "topher-orb-position";
const ORB_SIZE = 56; // 14 * 4 = 56px (w-14)
const EDGE_MARGIN = 24; // 6 * 4 = 24px margin from edges

interface Position {
  x: number;
  y: number;
}

const getDefaultPosition = (): Position => ({
  x: window.innerWidth - ORB_SIZE - EDGE_MARGIN,
  y: window.innerHeight - ORB_SIZE - EDGE_MARGIN,
});

const loadPosition = (): Position => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const pos = JSON.parse(saved);
      // Validate position is still on screen
      const maxX = window.innerWidth - ORB_SIZE;
      const maxY = window.innerHeight - ORB_SIZE;
      return {
        x: Math.min(Math.max(0, pos.x), maxX),
        y: Math.min(Math.max(0, pos.y), maxY),
      };
    }
  } catch (e) {
    console.error("Failed to load orb position:", e);
  }
  return getDefaultPosition();
};

const savePosition = (pos: Position) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  } catch (e) {
    console.error("Failed to save orb position:", e);
  }
};

// Snap to nearest edge
const snapToEdge = (pos: Position): Position => {
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  const centerX = pos.x + ORB_SIZE / 2;
  const centerY = pos.y + ORB_SIZE / 2;

  // Calculate distances to each edge
  const distLeft = centerX;
  const distRight = screenWidth - centerX;
  const distTop = centerY;
  const distBottom = screenHeight - centerY;

  const minDist = Math.min(distLeft, distRight, distTop, distBottom);

  // Snap to the nearest edge
  if (minDist === distLeft) {
    return { x: EDGE_MARGIN, y: Math.min(Math.max(EDGE_MARGIN, pos.y), screenHeight - ORB_SIZE - EDGE_MARGIN) };
  } else if (minDist === distRight) {
    return { x: screenWidth - ORB_SIZE - EDGE_MARGIN, y: Math.min(Math.max(EDGE_MARGIN, pos.y), screenHeight - ORB_SIZE - EDGE_MARGIN) };
  } else if (minDist === distTop) {
    return { x: Math.min(Math.max(EDGE_MARGIN, pos.x), screenWidth - ORB_SIZE - EDGE_MARGIN), y: EDGE_MARGIN };
  } else {
    return { x: Math.min(Math.max(EDGE_MARGIN, pos.x), screenWidth - ORB_SIZE - EDGE_MARGIN), y: screenHeight - ORB_SIZE - EDGE_MARGIN };
  }
};

export const FloatingOrb = ({ onClick, isExpanded }: FloatingOrbProps) => {
  const [position, setPosition] = useState<Position>(loadPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const dragStartPos = useRef<Position | null>(null);
  const hasMoved = useRef(false);
  const orbRef = useRef<HTMLButtonElement>(null);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        const maxX = window.innerWidth - ORB_SIZE;
        const maxY = window.innerHeight - ORB_SIZE;
        return {
          x: Math.min(Math.max(0, prev.x), maxX),
          y: Math.min(Math.max(0, prev.y), maxY),
        };
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    if (orbRef.current) {
      const rect = orbRef.current.getBoundingClientRect();
      setDragOffset({
        x: clientX - rect.left,
        y: clientY - rect.top,
      });
      dragStartPos.current = { x: clientX, y: clientY };
      hasMoved.current = false;
      setIsDragging(true);
    }
  }, []);

  const handleDragMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDragging) return;

      // Check if moved enough to count as a drag
      if (dragStartPos.current) {
        const dx = Math.abs(clientX - dragStartPos.current.x);
        const dy = Math.abs(clientY - dragStartPos.current.y);
        if (dx > 5 || dy > 5) {
          hasMoved.current = true;
        }
      }

      const newX = clientX - dragOffset.x;
      const newY = clientY - dragOffset.y;

      // Constrain to screen bounds
      const maxX = window.innerWidth - ORB_SIZE;
      const maxY = window.innerHeight - ORB_SIZE;

      setPosition({
        x: Math.min(Math.max(0, newX), maxX),
        y: Math.min(Math.max(0, newY), maxY),
      });
    },
    [isDragging, dragOffset]
  );

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    // Snap to nearest edge
    setPosition((prev) => {
      const snapped = snapToEdge(prev);
      savePosition(snapped);
      return snapped;
    });
  }, [isDragging]);

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => handleDragMove(e.clientX, e.clientY);
    const handleMouseUp = () => handleDragEnd();

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleDragStart(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging) {
      e.preventDefault(); // Prevent scrolling while dragging
      const touch = e.touches[0];
      handleDragMove(touch.clientX, touch.clientY);
    }
  };

  const handleTouchEnd = () => {
    handleDragEnd();
  };

  const handleClick = () => {
    // Only trigger click if we haven't dragged
    if (!hasMoved.current) {
      onClick();
    }
  };

  if (isExpanded) return null;

  return (
    <button
      ref={orbRef}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`fixed z-50 w-14 h-14 rounded-full flex items-center justify-center 
                 transition-opacity duration-300 hover:opacity-100 
                 cursor-grab group touch-manipulation select-none
                 ${isDragging ? "cursor-grabbing scale-110 opacity-100" : "floating-orb"}`}
      style={{
        left: position.x,
        top: position.y,
        opacity: isDragging ? 1 : 0.5,
        transition: isDragging ? "none" : "opacity 0.3s, transform 0.3s, left 0.3s ease-out, top 0.3s ease-out",
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
      aria-label="Open quick chat - drag to move"
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
        className={`absolute -inset-1 rounded-full pointer-events-none ${isDragging ? "opacity-50" : "opacity-30 animate-orb-ring"}`}
        style={{
          background: `radial-gradient(circle, 
            transparent 60%, 
            hsl(var(--orb-glow) / 0.3) 100%)`,
        }}
      />

      {/* Icon */}
      <Mic className="w-6 h-6 text-foreground/90 group-hover:text-foreground transition-colors z-10 pointer-events-none" />
    </button>
  );
};
