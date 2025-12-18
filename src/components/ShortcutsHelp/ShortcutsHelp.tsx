import { useState } from 'react';
import { useI18n } from '../../i18n';
import { Icon } from '../Icon';
import styles from './ShortcutsHelp.module.css';

export function ShortcutsHelp() {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  const shortcuts = [
    { key: 'B', desc: t.tips.shortcuts.buy },
    { key: 'S', desc: t.tips.shortcuts.sell },
    { key: 'M', desc: t.tips.shortcuts.market },
    { key: 'L', desc: t.tips.shortcuts.limit },
    { key: 'Esc', desc: t.tips.shortcuts.cancel },
    { key: 'Enter', desc: t.tips.shortcuts.submit },
    { key: 'T', desc: t.tips.shortcuts.theme },
    { key: '?', desc: t.tips.shortcuts.toggle },
  ];

  return (
    <>
      <button 
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        title={t.tips.shortcut}
      >
        <Icon name="zap" size="sm" />
      </button>

      {isOpen && (
        <div className={styles.overlay} onClick={() => setIsOpen(false)}>
          <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.header}>
              <h3 className={styles.title}>
                <Icon name="zap" size="sm" style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                {t.tips.shortcut}
              </h3>
              <button 
                className={styles.close}
                onClick={() => setIsOpen(false)}
                title={t.common.close}
              >
                <Icon name="x" size="sm" />
              </button>
            </div>
            <div className={styles.list}>
              {shortcuts.map((s) => (
                <div key={s.key} className={styles.item}>
                  <kbd className={styles.key}>{s.key}</kbd>
                  <span className={styles.desc}>{s.desc}</span>
                </div>
              ))}
            </div>
            <div className={styles.footer}>
              <span className={styles.hint}>{t.tips.shortcuts.hint}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

