import { useEffect, useState, useCallback } from 'react';
import { useNotificationStore, notification, type ToastItem } from '../../store/notificationStore';
import { Icon } from '../Icon';
import { useI18n } from '../../i18n';
import styles from './Toast.module.css';

// Legacy toast API for backward compatibility (will be migrated gradually)
export const toast = {
  success: (message: string, duration?: number) => {
    notification.success(`warning:legacy-success-${Date.now()}` as const, message, 'normal', duration);
  },
  error: (message: string, duration?: number) => {
    notification.error(`error:legacy-error-${Date.now()}` as const, message, 'high', duration);
  },
  warning: (message: string, duration?: number) => {
    notification.warning(`warning:legacy-warning-${Date.now()}` as const, message, 'normal', duration);
  },
  info: (message: string, duration?: number) => {
    notification.info(`warning:legacy-info-${Date.now()}` as const, message, 'low', duration);
  },
};

function ToastItem({ toast, onRemove }: { toast: ToastItem; onRemove: () => void }) {
  const { t } = useI18n();
  const [isExiting, setIsExiting] = useState(false);
  const duration = toast.duration ?? 4000;

  const handleRemove = useCallback(() => {
    setIsExiting(true);
    setTimeout(onRemove, 300);
  }, [onRemove]);

  useEffect(() => {
    const timer = setTimeout(handleRemove, duration);
    return () => clearTimeout(timer);
  }, [duration, handleRemove]);

  const iconMap = {
    success: 'check' as const,
    error: 'x' as const,
    warning: 'alert-triangle' as const,
    info: 'info' as const,
  };

  return (
    <div 
      className={`${styles.toast} ${styles[toast.type]} ${isExiting ? styles.exit : ''}`}
      role="alert"
    >
      <span className={styles.icon}>
        <Icon name={iconMap[toast.type]} size="sm" />
      </span>
      <span className={styles.message}>{toast.message}</span>
      <button 
        className={styles.close}
        onClick={handleRemove}
        aria-label={t.common.close}
      >
        <Icon name="x" size="sm" />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { t } = useI18n();
  const { toasts, remove, suppressedCount } = useNotificationStore();

  if (toasts.length === 0 && suppressedCount === 0) return null;

  return (
    <div className={styles.container} aria-live="polite">
      {toasts.map((t) => (
        <ToastItem 
          key={t.id} 
          toast={t} 
          onRemove={() => remove(t.id)} 
        />
      ))}
      {suppressedCount > 0 && (
        <div className={`${styles.toast} ${styles.info}`}>
          <Icon name="info" size="sm" className={styles.icon} />
          <span className={styles.message}>
            {suppressedCount} {t.toast?.eventsSuppressed || 'events suppressed'}
          </span>
        </div>
      )}
    </div>
  );
}

