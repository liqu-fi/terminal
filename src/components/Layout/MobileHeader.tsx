import { Link } from 'react-router-dom';
import { Icon } from '../Icon';
import { ThemeToggle } from '../ThemeToggle';
import { AccountMenu } from './AccountMenu';
import styles from './MobileHeader.module.css';

interface MobileHeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  showActions?: boolean;
  rightAction?: React.ReactNode;
}

export function MobileHeader({
  title,
  showBack = false,
  onBack,
  showActions = true,
  rightAction,
}: MobileHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        {showBack ? (
          <button className={styles.backBtn} onClick={onBack}>
            <Icon name="chevron-left" size="lg" />
          </button>
        ) : (
          <Link to="/" className={styles.logo}>
            <Icon name="activity" size="lg" strokeWidth={2.5} />
          </Link>
        )}
      </div>

      {title && <h1 className={styles.title}>{title}</h1>}

      <div className={styles.right}>
        {rightAction}
        {showActions && (
          <>
            <ThemeToggle />
            <AccountMenu />
          </>
        )}
      </div>
    </header>
  );
}

