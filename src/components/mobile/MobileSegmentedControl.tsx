import { useRef, useEffect, useState } from 'react';
import styles from './MobileSegmentedControl.module.css';

interface Segment {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number;
  className?: string;
}

interface MobileSegmentedControlProps {
  segments: Segment[];
  activeId: string;
  onChange: (id: string) => void;
  /** Allow horizontal scroll for many segments */
  scrollable?: boolean;
  /** Visual style variant */
  variant?: 'pills' | 'underline';
}

export function MobileSegmentedControl({
  segments,
  activeId,
  onChange,
  scrollable = false,
  variant = 'pills',
}: MobileSegmentedControlProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const [hasScroll, setHasScroll] = useState(false);

  // Check if content is scrollable
  useEffect(() => {
    const checkScroll = () => {
      if (containerRef.current) {
        const { scrollWidth, clientWidth } = containerRef.current;
        setHasScroll(scrollWidth > clientWidth);
      }
    };

    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [segments]);

  // Update indicator position when active segment changes
  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const activeRect = activeRef.current.getBoundingClientRect();
      setIndicatorStyle({
        left: activeRect.left - containerRect.left + containerRef.current.scrollLeft,
        width: activeRect.width,
      });

      // Auto-scroll to keep active segment visible
      if (scrollable) {
        const scrollLeft = activeRef.current.offsetLeft - containerRect.width / 2 + activeRect.width / 2;
        containerRef.current.scrollTo({ left: scrollLeft, behavior: 'smooth' });
      }
    }
  }, [activeId, scrollable, segments]);

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${styles[variant]} ${scrollable ? styles.scrollable : ''} ${hasScroll ? styles.hasScroll : ''}`}
    >
      {variant === 'underline' && (
        <div
          className={styles.indicator}
          style={{
            left: indicatorStyle.left,
            width: indicatorStyle.width,
          }}
        />
      )}
      
      {segments.map((segment) => (
        <button
          key={segment.id}
          ref={segment.id === activeId ? activeRef : null}
          className={`${styles.segment} ${segment.id === activeId ? styles.active : ''} ${segment.className || ''}`}
          onClick={() => onChange(segment.id)}
        >
          {segment.icon && <span className={styles.icon}>{segment.icon}</span>}
          <span className={styles.label}>{segment.label}</span>
          {segment.badge !== undefined && segment.badge > 0 && (
            <span className={styles.badge}>{segment.badge > 99 ? '99+' : segment.badge}</span>
          )}
        </button>
      ))}
    </div>
  );
}

