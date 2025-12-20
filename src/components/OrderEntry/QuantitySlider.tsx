import styles from './QuantitySlider.module.css';

interface QuantitySliderProps {
  value: number; // 0-100
  onChange: (value: number) => void;
  estimatedQty: string;
}

export function QuantitySlider({ value, onChange, estimatedQty }: QuantitySliderProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseInt(e.target.value, 10));
  };

  return (
    <div className={styles.container}>
      <div className={styles.sliderWrapper}>
        <input
          type="range"
          min="0"
          max="100"
          value={value}
          onChange={handleChange}
          className={styles.slider}
        />
        <div className={styles.sliderTrack}>
          <div 
            className={styles.sliderFill} 
            style={{ width: `${value}%` }}
          />
        </div>
      </div>
      <div className={styles.info}>
        <span className={styles.percent}>{value}%</span>
        <span className={styles.qty}>{estimatedQty}</span>
      </div>
    </div>
  );
}





