import { useMemo } from 'react';

interface Particle {
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  hue: number;
}

export const FloatingParticles = () => {
  const particles = useMemo(() => {
    const result: Particle[] = [];
    for (let i = 0; i < 40; i++) {
      result.push({
        x: Math.random() * 100,
        y: 100 + Math.random() * 20, // Start below viewport
        size: Math.random() * 3 + 1,
        delay: Math.random() * 10,
        duration: 15 + Math.random() * 15,
        hue: 173 + Math.random() * 40 - 20 // Teal-ish hues
      });
    }
    return result;
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full animate-float-up"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: `hsl(${p.hue} 70% 50% / 0.4)`,
            boxShadow: `0 0 ${p.size * 2}px hsl(${p.hue} 70% 50% / 0.3)`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`
          }}
        />
      ))}
    </div>
  );
};

export default FloatingParticles;
