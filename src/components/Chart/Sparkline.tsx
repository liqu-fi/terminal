import { useMemo } from 'react';
import styles from './Sparkline.module.css';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

export function Sparkline({ 
  data, 
  width = 60, 
  height = 24, 
  color = 'var(--accent)',
  className = '' 
}: SparklineProps) {
  const path = useMemo(() => {
    if (data.length === 0) return '';

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data.map((value, index) => {
      const x = (index / (data.length - 1 || 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
  }, [data, width, height]);

  if (data.length === 0) {
    return (
      <svg width={width} height={height} className={className}>
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="var(--text-tertiary)" strokeWidth="1" />
      </svg>
    );
  }

  const isPositive = (data[data.length - 1] ?? 0) > (data[0] ?? 0);
  const sparklineColor = isPositive ? 'var(--buy)' : 'var(--sell)';

  return (
    <svg width={width} height={height} className={`${styles.sparkline} ${className}`}>
      <path
        d={path}
        fill="none"
        stroke={color || sparklineColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}





