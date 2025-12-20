import { useRef, useEffect, useState, useCallback } from 'react';
import { Icon } from '../Icon';
import styles from './MobileDrawer.module.css';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Height of the drawer: 'auto', 'half', 'full' */
  height?: 'auto' | 'half' | 'full';
  /** Show drag handle for gesture interaction */
  showHandle?: boolean;
  /** Allow dragging to resize/close */
  draggable?: boolean;
}

export function MobileDrawer({
  isOpen,
  onClose,
  title,
  children,
  height = 'half',
  showHandle = true,
  draggable = true,
}: MobileDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const currentY = useRef(0);

  // Handle touch start
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!draggable || !e.touches[0]) return;
    setIsDragging(true);
    startY.current = e.touches[0].clientY;
    currentY.current = e.touches[0].clientY;
  }, [draggable]);

  // Handle touch move
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || !draggable || !e.touches[0]) return;
    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;
    // Only allow dragging down
    if (diff > 0) {
      setDragOffset(diff);
    }
  }, [isDragging, draggable]);

  // Handle touch end
  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    
    // If dragged more than 100px, close the drawer
    if (dragOffset > 100) {
      onClose();
    }
    setDragOffset(0);
  }, [isDragging, dragOffset, onClose]);

  // Reset drag offset when drawer closes
  useEffect(() => {
    if (!isOpen) {
      setDragOffset(0);
    }
  }, [isOpen]);

  // Prevent body scroll when drawer is open
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

  const heightClass = {
    auto: styles.heightAuto,
    half: styles.heightHalf,
    full: styles.heightFull,
  }[height];

  return (
    <>
      <div 
        className={`${styles.overlay} ${isOpen ? styles.visible : ''}`} 
        onClick={onClose}
      />
      <div
        ref={drawerRef}
        className={`${styles.drawer} ${heightClass} ${isOpen ? styles.open : ''}`}
        style={{
          transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
          transition: isDragging ? 'none' : undefined,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {showHandle && (
          <div className={styles.handleArea}>
            <div className={styles.handle} />
          </div>
        )}
        
        {title && (
          <div className={styles.header}>
            <h3 className={styles.title}>{title}</h3>
            <button className={styles.closeBtn} onClick={onClose}>
              <Icon name="x" size="md" />
            </button>
          </div>
        )}
        
        <div className={styles.content}>
          {children}
        </div>
      </div>
    </>
  );
}

