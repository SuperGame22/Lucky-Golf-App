import { motion } from "framer-motion";

interface MachineGearProps {
  size: number;
  duration: number;
  direction?: 1 | -1;
  className?: string;
  teeth?: number;
}

export const MachineGear = ({ 
  size, 
  duration, 
  direction = 1, 
  className = "",
  teeth = 8 
}: MachineGearProps) => {
  const innerRadius = size * 0.3;
  const outerRadius = size * 0.45;
  const toothHeight = size * 0.12;
  
  // Generate gear teeth path
  const generateGearPath = () => {
    const points: string[] = [];
    const angleStep = (2 * Math.PI) / teeth;
    
    for (let i = 0; i < teeth; i++) {
      const angle1 = i * angleStep;
      const angle2 = angle1 + angleStep * 0.3;
      const angle3 = angle1 + angleStep * 0.5;
      const angle4 = angle1 + angleStep * 0.7;
      
      // Inner point
      const x1 = size/2 + Math.cos(angle1) * outerRadius;
      const y1 = size/2 + Math.sin(angle1) * outerRadius;
      
      // Tooth outer start
      const x2 = size/2 + Math.cos(angle2) * (outerRadius + toothHeight);
      const y2 = size/2 + Math.sin(angle2) * (outerRadius + toothHeight);
      
      // Tooth outer end
      const x3 = size/2 + Math.cos(angle3) * (outerRadius + toothHeight);
      const y3 = size/2 + Math.sin(angle3) * (outerRadius + toothHeight);
      
      // Back to inner
      const x4 = size/2 + Math.cos(angle4) * outerRadius;
      const y4 = size/2 + Math.sin(angle4) * outerRadius;
      
      if (i === 0) {
        points.push(`M ${x1} ${y1}`);
      }
      points.push(`L ${x2} ${y2}`);
      points.push(`L ${x3} ${y3}`);
      points.push(`L ${x4} ${y4}`);
    }
    points.push('Z');
    return points.join(' ');
  };

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      animate={{ rotate: 360 * direction }}
      transition={{ duration, repeat: Infinity, ease: "linear" }}
      className={className}
    >
      {/* Gear body */}
      <path
        d={generateGearPath()}
        fill="url(#gearGradient)"
        stroke="hsl(var(--lucky-gold))"
        strokeWidth="1"
      />
      
      {/* Inner circle */}
      <circle
        cx={size/2}
        cy={size/2}
        r={innerRadius}
        fill="hsl(var(--card))"
        stroke="hsl(var(--lucky-gold) / 0.5)"
        strokeWidth="2"
      />
      
      {/* Center hole */}
      <circle
        cx={size/2}
        cy={size/2}
        r={size * 0.08}
        fill="hsl(var(--background))"
      />
      
      {/* Gradient definition - GOLD */}
      <defs>
        <linearGradient id="gearGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(48 96% 60%)" />
          <stop offset="50%" stopColor="hsl(43 90% 50%)" />
          <stop offset="100%" stopColor="hsl(38 85% 45%)" />
        </linearGradient>
      </defs>
    </motion.svg>
  );
};
