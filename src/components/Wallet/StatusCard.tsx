import { useEffect, useState } from 'react';
import { Icon, IconName } from '../Icon';
import styles from './StatusCard.module.css';

interface StatusCardProps {
  status: 'pending' | 'processing' | 'success' | 'error';
  title: string;
  subtitle?: string;
  estimatedSeconds?: number;
  onConfirmDemo?: () => void;
  confirmDemoLabel?: string;
  confirmDemoHint?: string;
}

export function StatusCard({
  status,
  title,
  subtitle,
  estimatedSeconds,
  onConfirmDemo,
  confirmDemoLabel,
  confirmDemoHint,
}: StatusCardProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if ((status === 'pending' || status === 'processing') && estimatedSeconds) {
      let elapsed = 0;
      const interval = setInterval(() => {
        elapsed += 0.1;
        const progressValue = Math.min((elapsed / estimatedSeconds) * 100, 95);
        setProgress(progressValue);
      }, 100);

      return () => clearInterval(interval);
    } else if (status === 'success') {
      setProgress(100);
    }
  }, [status, estimatedSeconds]);

  const getIcon = (): IconName => {
    switch (status) {
      case 'pending':
      case 'processing':
        return 'loader';
      case 'success':
        return 'check-circle';
      case 'error':
        return 'alert-circle';
    }
  };

  const getStatusClass = () => {
    switch (status) {
      case 'pending':
      case 'processing':
        return styles.statusPending;
      case 'success':
        return styles.statusSuccess;
      case 'error':
        return styles.statusError;
    }
  };

  return (
    <div className={`${styles.container} ${getStatusClass()}`}>
      <div className={styles.iconWrapper}>
        <Icon 
          name={getIcon()} 
          size="lg" 
          className={status === 'pending' || status === 'processing' ? styles.spinning : ''}
        />
      </div>
      
      <div className={styles.content}>
        <div className={styles.title}>{title}</div>
        {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
      </div>

      {(status === 'pending' || status === 'processing') && estimatedSeconds && (
        <div className={styles.progressSection}>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill} 
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className={styles.progressText}>
            {Math.round(progress)}%
          </div>
        </div>
      )}

      {onConfirmDemo && (status === 'pending' || status === 'processing') && (
        <div className={styles.demoSection}>
          <button 
            className={styles.demoButton}
            onClick={onConfirmDemo}
          >
            {confirmDemoLabel || 'Confirm for Demo'}
          </button>
          {confirmDemoHint && (
            <div className={styles.demoHint}>{confirmDemoHint}</div>
          )}
        </div>
      )}
    </div>
  );
}

