import { useEffect } from 'react';
import { Icon, IconName } from '../Icon';
import styles from './MobileActionSheet.module.css';

interface ActionSheetAction {
  id: string;
  label: string;
  icon?: IconName;
  destructive?: boolean;
  disabled?: boolean;
}

interface MobileActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  actions: ActionSheetAction[];
  onAction: (actionId: string) => void;
  showCancel?: boolean;
  cancelLabel?: string;
}

export function MobileActionSheet({
  isOpen,
  onClose,
  title,
  message,
  actions,
  onAction,
  showCancel = true,
  cancelLabel = 'Cancel',
}: MobileActionSheetProps) {
  // Prevent body scroll when action sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAction = (actionId: string) => {
    onAction(actionId);
    onClose();
  };

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={`${styles.sheet} ${isOpen ? styles.open : ''}`}>
        <div className={styles.content}>
          {(title || message) && (
            <div className={styles.header}>
              {title && <h3 className={styles.title}>{title}</h3>}
              {message && <p className={styles.message}>{message}</p>}
            </div>
          )}
          
          <div className={styles.actions}>
            {actions.map((action) => (
              <button
                key={action.id}
                className={`${styles.actionBtn} ${action.destructive ? styles.destructive : ''}`}
                onClick={() => handleAction(action.id)}
                disabled={action.disabled}
              >
                {action.icon && <Icon name={action.icon} size="md" />}
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        {showCancel && (
          <button className={styles.cancelBtn} onClick={onClose}>
            {cancelLabel}
          </button>
        )}
      </div>
    </>
  );
}

