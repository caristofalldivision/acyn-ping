import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { TrailRendererProps } from './types';

export const TrailRenderer = ({ points }: TrailRendererProps) => {
  // Filter valid points and convert to tuple format
  const validPoints = useMemo(() => {
    if (points.length < 2) return [];
    
    const now = Date.now();
    const trailLifetime = 3000;
    
    return points
      .filter(p => now - p.timestamp < trailLifetime)
      .map(p => [p.position.x, p.position.y, p.position.z] as [number, number, number]);
  }, [points]);

  if (validPoints.length < 2) return null;

  return (
    <Line
      points={validPoints}
      color="#00d4ff"
      lineWidth={2}
      transparent
      opacity={0.8}
    />
  );
};
