import { useMemo } from 'react';
import styles from './Sparkline.module.css';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
  lineWidth?: number;
  id?: string;
}

export function Sparkline({ 
  data, 
  width = 100, 
  height = 36, 
  color,
  className = '',
  lineWidth = 1.5,
  id
}: SparklineProps) {
  // 核心修复：手动定义颜色值，避免 SVG stop-color 无法解析 var() 的问题
  const colors = {
    up: '#22c55e',
    down: '#ef4444',
    neutral: '#94a3b8'
  };

  const { path, areaPath, isPositive } = useMemo(() => {
    if (data.length < 2) return { path: '', areaPath: '', isPositive: true };

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = (max - min) || 1;
    const padding = 2;

    const points = data.map((value, index) => ({
      x: (index / (data.length - 1)) * width,
      y: padding + (height - padding * 2) - ((value - min) / range) * (height - padding * 2)
    }));

    const firstPoint = points[0];
    if (!firstPoint) return { path: '', areaPath: '', isPositive: true };

    const linePath = `M ${firstPoint.x},${firstPoint.y} ` + points.slice(1).map(p => `L ${p.x},${p.y}`).join(' ');
    const area = `${linePath} L ${width},${height} L 0,${height} Z`;

    const lastValue = data[data.length - 1];
    const firstValue = data[0];
    const positive = (lastValue !== undefined && firstValue !== undefined) ? lastValue >= firstValue : true;

    return { path: linePath, areaPath: area, isPositive: positive };
  }, [data, width, height]);

  const finalColor = color || (isPositive ? colors.up : colors.down);
  const gradientId = useMemo(() => `spark-grad-${id || Math.random().toString(36).substr(2, 9)}`, [id]);

  if (data.length < 2) {
    return <div className={`${styles.placeholder} ${className}`} style={{ width, height }} />;
  }

  return (
    <div className={`${styles.container} ${className}`} style={{ width, height }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={finalColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={finalColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
        <path
          d={path}
          fill="none"
          stroke={finalColor}
          strokeWidth={lineWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
