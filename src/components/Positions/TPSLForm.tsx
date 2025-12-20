import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useI18n } from '../../i18n';
import { useAutomationStore } from '../../store/automationStore';
import { toast } from '../Toast';
import { Icon } from '../Icon';
import styles from './TPSLForm.module.css';

interface TPSLFormProps {
  symbol: string;
  currentPrice: number;
  avgEntryPrice: number;
  quantity: string;
  onClose: () => void;
}

export function TPSLForm({ symbol, onClose }: TPSLFormProps) {
  const { t } = useI18n();
  const addTrigger = useAutomationStore((state) => state.addTrigger);

  const [tpPrice, setTpPrice] = useState('');
  const [slPrice, setSlPrice] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!tpPrice && !slPrice) {
      toast.warning(t.common.error);
      return;
    }

    const tpId = uuidv4();
    const slId = uuidv4();

    // Take Profit
    if (tpPrice) {
      addTrigger({
        id: tpId,
        symbol,
        type: 'takeProfit',
        enabled: true,
        condition: {
          priceSource: 'last',
          operator: 'gte',
          threshold: tpPrice,
          direction: 'up',
          debounceMs: 1000,
          cooldownMs: 60000,
        },
        action: {
          type: 'order',
          side: 'sell',
          orderType: 'market',
          quantityMode: 'percent',
          quantityValue: '100',
        },
        allowDegraded: false,
        repeat: false,
        linkedTriggerId: slPrice ? slId : undefined,
      });
    }

    // Stop Loss
    if (slPrice) {
      addTrigger({
        id: slId,
        symbol,
        type: 'stopLoss',
        enabled: true,
        condition: {
          priceSource: 'last',
          operator: 'lte',
          threshold: slPrice,
          direction: 'down',
          debounceMs: 1000,
          cooldownMs: 60000,
        },
        action: {
          type: 'order',
          side: 'sell',
          orderType: 'market',
          quantityMode: 'percent',
          quantityValue: '100',
        },
        allowDegraded: false,
        repeat: false,
        linkedTriggerId: tpPrice ? tpId : undefined,
      });
    }

    toast.success(t.common.success);
    onClose();
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>TP/SL - {symbol}</span>
        <button className={styles.closeBtn} onClick={onClose}>
          <Icon name="x" size="sm" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label}>{t.automation.type.takeProfit}</label>
          <div className={styles.inputWrapper}>
            <input
              type="number"
              step="any"
              className="input"
              value={tpPrice}
              onChange={(e) => setTpPrice(e.target.value)}
              placeholder={t.automation.form.triggerPrice}
            />
            <span className={styles.suffix}>USDT</span>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>{t.automation.type.stopLoss}</label>
          <div className={styles.inputWrapper}>
            <input
              type="number"
              step="any"
              className="input"
              value={slPrice}
              onChange={(e) => setSlPrice(e.target.value)}
              placeholder={t.automation.form.triggerPrice}
            />
            <span className={styles.suffix}>USDT</span>
          </div>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            {t.common.cancel}
          </button>
          <button type="submit" className={styles.submitBtn}>
            {t.common.save}
          </button>
        </div>
      </form>
    </div>
  );
}

