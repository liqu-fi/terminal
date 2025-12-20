import { useRef, useState, useCallback } from 'react';
import { Icon } from '../Icon';
import { useI18n } from '../../i18n';
import styles from './AvatarUpload.module.css';

interface AvatarUploadProps {
  currentAvatar: string | null;
  onAvatarChange: (dataUrl: string | null) => void;
  size?: 'sm' | 'md' | 'lg';
  editable?: boolean;
}

export const AvatarUpload: React.FC<AvatarUploadProps> = ({
  currentAvatar,
  onAvatarChange,
  size = 'md',
  editable = true,
}) => {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return;
    }

    setIsProcessing(true);

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const resizedDataUrl = await resizeImage(dataUrl, 256);
      onAvatarChange(resizedDataUrl);
    } catch (error) {
      console.error('Failed to process avatar:', error);
    } finally {
      setIsProcessing(false);
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [onAvatarChange]);

  const handleClick = useCallback(() => {
    if (editable && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [editable]);

  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onAvatarChange(null);
  }, [onAvatarChange]);

  const sizeClass = styles[size];

  return (
    <div 
      className={`${styles.container} ${sizeClass} ${editable ? styles.editable : ''}`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className={styles.fileInput}
        disabled={!editable || isProcessing}
      />
      
      <div className={styles.avatarWrapper}>
        {currentAvatar ? (
          <img src={currentAvatar} alt="Avatar" className={styles.avatar} />
        ) : (
          <div className={styles.placeholder}>
            <Icon name="user" size={size === 'lg' ? 'xl' : size === 'md' ? 'lg' : 'md'} />
          </div>
        )}
        
        {editable && isHovering && !isProcessing && (
          <div className={styles.overlay}>
            <Icon name="camera" size="md" />
            <span className={styles.overlayText}>
              {t.settings?.profile?.changeAvatar || 'Change'}
            </span>
          </div>
        )}
        
        {isProcessing && (
          <div className={styles.overlay}>
            <Icon name="loader" size="md" className={styles.spinner} />
          </div>
        )}
      </div>
      
      {editable && currentAvatar && isHovering && !isProcessing && (
        <button 
          className={styles.removeBtn}
          onClick={handleRemove}
          title={t.common?.delete || 'Remove'}
        >
          <Icon name="x" size="xs" />
        </button>
      )}
    </div>
  );
};

// Helper functions
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function resizeImage(dataUrl: string, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Calculate dimensions to maintain aspect ratio and crop to square
      const size = Math.min(img.width, img.height);
      const x = (img.width - size) / 2;
      const y = (img.height - size) / 2;

      canvas.width = maxSize;
      canvas.height = maxSize;

      // Draw circular clip
      ctx.beginPath();
      ctx.arc(maxSize / 2, maxSize / 2, maxSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      // Draw image
      ctx.drawImage(img, x, y, size, size, 0, 0, maxSize, maxSize);

      resolve(canvas.toDataURL('image/png', 0.9));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}


