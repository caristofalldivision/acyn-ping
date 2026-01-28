import { useMemo } from 'react';

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  delay: number;
  duration: number;
}

export const Starfield = () => {
  const stars = useMemo(() => {
    const result: Star[] = [];
    for (let i = 0; i < 200; i++) {
      result.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.6 + 0.2,
        delay: Math.random() * 5,
        duration: 3 + Math.random() * 4
      });
    }
    return result;
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {stars.map((star, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white animate-twinkle"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: star.opacity,
            animationDuration: `${star.duration}s`,
            animationDelay: `${star.delay}s`
          }}
        />
      ))}
    </div>
  );
};

export default Starfield;
