import { useCallback } from 'react';

type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';

/**
 * Simulates haptic feedback using the Vibration API where available,
 * or provides visual feedback as fallback
 */
export function useHapticFeedback() {
  const trigger = useCallback((type: HapticType = 'light') => {
    // Check if the Vibration API is available
    if ('vibrate' in navigator) {
      const patterns: Record<HapticType, number | number[]> = {
        light: 10,
        medium: 20,
        heavy: 30,
        success: [10, 50, 20],
        warning: [20, 30, 20],
        error: [30, 50, 30, 50, 30],
        selection: 5,
      };

      try {
        navigator.vibrate(patterns[type]);
      } catch {
        // Vibration not supported or blocked
      }
    }

    // Also apply visual feedback class
    applyVisualFeedback(type);
  }, []);

  return { trigger };
}

/**
 * Apply a brief visual feedback effect
 */
function applyVisualFeedback(type: HapticType) {
  const root = document.documentElement;
  const feedbackClass = `haptic-${type}`;
  
  root.classList.add(feedbackClass);
  
  setTimeout(() => {
    root.classList.remove(feedbackClass);
  }, 100);
}

/**
 * Higher-order function to wrap click handlers with haptic feedback
 */
export function withHaptic<T extends (...args: any[]) => void>(
  handler: T,
  type: HapticType = 'light'
): T {
  return ((...args: Parameters<T>) => {
    if ('vibrate' in navigator) {
      try {
        const patterns: Record<HapticType, number | number[]> = {
          light: 10,
          medium: 20,
          heavy: 30,
          success: [10, 50, 20],
          warning: [20, 30, 20],
          error: [30, 50, 30, 50, 30],
          selection: 5,
        };
        navigator.vibrate(patterns[type]);
      } catch {
        // Ignore
      }
    }
    return handler(...args);
  }) as T;
}

