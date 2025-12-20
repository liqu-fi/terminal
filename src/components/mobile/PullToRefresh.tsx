import { forwardRef } from 'react';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import styles from './PullToRefresh.module.css';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
}

export const PullToRefresh = forwardRef<HTMLDivElement, PullToRefreshProps>(
  function PullToRefresh({ onRefresh, children, className }, _ref) {
    const { containerRef, pullDistance, isRefreshing, isPulling } = usePullToRefresh({
      onRefresh,
      threshold: 80,
      maxPull: 120,
    });

    const showIndicator = pullDistance > 0 || isRefreshing;
    const rotationDeg = Math.min(pullDistance * 3, 360);
    const isReady = pullDistance >= 80;

    return (
      <div
        ref={containerRef}
        className={`${styles.container} ${className || ''}`}
      >
        {/* Pull Indicator */}
        <div
          className={`${styles.indicator} ${showIndicator ? styles.visible : ''}`}
          style={{
            transform: `translateY(${Math.min(pullDistance, 80)}px)`,
            opacity: Math.min(pullDistance / 40, 1),
          }}
        >
          <div
            className={`${styles.spinner} ${isRefreshing ? styles.spinning : ''}`}
            style={{
              transform: isRefreshing ? undefined : `rotate(${rotationDeg}deg)`,
            }}
          >
            <svg viewBox="0 0 24 24" className={styles.spinnerSvg}>
              <circle
                className={`${styles.spinnerCircle} ${isReady || isRefreshing ? styles.ready : ''}`}
                cx="12"
                cy="12"
                r="10"
                fill="none"
                strokeWidth="2"
              />
            </svg>
          </div>
          <span className={styles.text}>
            {isRefreshing ? 'Refreshing...' : isReady ? 'Release to refresh' : 'Pull to refresh'}
          </span>
        </div>

        {/* Content */}
        <div
          className={styles.content}
          style={{
            transform: isPulling || isRefreshing ? `translateY(${pullDistance}px)` : undefined,
            transition: isPulling ? 'none' : 'transform 0.3s ease',
          }}
        >
          {children}
        </div>
      </div>
    );
  }
);

