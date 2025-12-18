import { useSoundSettings, sounds } from '../../hooks/useSoundFeedback';
import { useI18n } from '../../i18n';
import { Icon } from '../Icon';
import styles from './SoundToggle.module.css';

export function SoundToggle() {
  const { t } = useI18n();
  const { enabled, setEnabled } = useSoundSettings();

  const handleToggle = () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    if (newEnabled) {
      // 播放一个测试音
      sounds.click();
    }
  };

  return (
    <button 
      className={`${styles.toggle} ${enabled ? styles.active : ''}`}
      onClick={handleToggle}
      title={enabled ? (t.sound?.disable || 'Disable sound') : (t.sound?.enable || 'Enable sound')}
      aria-label={t.sound?.toggle || 'Toggle sound'}
    >
      <Icon name={enabled ? 'bell' : 'bell'} size="md" />
    </button>
  );
}

