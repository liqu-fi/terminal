import { useState, useEffect } from 'react';
import { useI18n } from '../../i18n';
import { Icon } from '../Icon';
import styles from './WelcomeGuide.module.css';

const STORAGE_KEY = 'welcome-guide-dismissed';

export function WelcomeGuide() {
  const { t } = useI18n();
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      // 延迟显示，等待主界面加载
      setTimeout(() => setIsVisible(true), 500);
    }
  }, []);

  const steps = [
    {
      icon: 'bar-chart-3' as const,
      title: t.welcome.step1Title,
      description: t.welcome.step1Desc,
    },
    {
      icon: 'briefcase' as const,
      title: t.welcome.step2Title,
      description: t.welcome.step2Desc,
    },
    {
      icon: 'search' as const,
      title: t.welcome.step3Title,
      description: t.welcome.step3Desc,
    },
  ];

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
    setIsVisible(false);
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (!isVisible) return null;

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>{t.welcome.title}</h2>
          <p className={styles.subtitle}>{t.welcome.subtitle}</p>
        </div>

        {/* Steps */}
        <div className={styles.stepsContainer}>
          <div 
            className={styles.stepsTrack}
            style={{ transform: `translateX(-${currentStep * 100}%)` }}
          >
            {steps.map((step, index) => (
              <div key={index} className={styles.step}>
                <div className={styles.stepIcon}>
                  <Icon name={step.icon} size="xl" />
                </div>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepDesc}>{step.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Step indicators */}
        <div className={styles.indicators}>
          {steps.map((_, index) => (
            <button
              key={index}
              className={`${styles.indicator} ${index === currentStep ? styles.active : ''}`}
              onClick={() => setCurrentStep(index)}
              aria-label={t.welcome.stepLabel?.replace('{n}', String(index + 1)) || `Step ${index + 1}`}
            />
          ))}
        </div>

        {/* Disclaimer */}
        {t.welcome.disclaimer && (
          <div className={styles.disclaimer}>
            {t.welcome.disclaimer}
          </div>
        )}

        {/* Footer */}
        <div className={styles.footer}>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
            />
            <span>{t.welcome.dontShowAgain}</span>
          </label>

          <div className={styles.buttons}>
            {currentStep > 0 && (
              <button className={styles.btnSecondary} onClick={handlePrev}>
                <Icon name="chevron-left" size="sm" />
              </button>
            )}
            <button className={styles.btnPrimary} onClick={handleNext}>
              {currentStep === steps.length - 1 ? t.welcome.getStarted : <Icon name="chevron-right" size="sm" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

