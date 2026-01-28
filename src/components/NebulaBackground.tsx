export const NebulaBackground = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
    {/* Layer 1: Purple nebula */}
    <div 
      className="absolute inset-0 opacity-30 animate-nebula-drift"
      style={{
        background: 'radial-gradient(ellipse at 20% 30%, hsl(280 70% 40% / 0.4) 0%, transparent 50%)',
      }}
    />
    {/* Layer 2: Cyan nebula */}
    <div 
      className="absolute inset-0 opacity-25 animate-nebula-drift-reverse"
      style={{
        background: 'radial-gradient(ellipse at 80% 70%, hsl(180 80% 50% / 0.3) 0%, transparent 50%)',
      }}
    />
    {/* Layer 3: Pink/magenta nebula */}
    <div 
      className="absolute inset-0 opacity-15 animate-nebula-pulse"
      style={{
        background: 'radial-gradient(ellipse at 50% 50%, hsl(320 70% 50% / 0.25) 0%, transparent 60%)',
      }}
    />
    {/* Layer 4: Teal accent */}
    <div 
      className="absolute inset-0 opacity-20 animate-nebula-drift"
      style={{
        background: 'radial-gradient(ellipse at 70% 20%, hsl(173 80% 40% / 0.3) 0%, transparent 40%)',
        animationDelay: '-5s'
      }}
    />
  </div>
);

export default NebulaBackground;
