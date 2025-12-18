import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, IChartApi, ColorType, UTCTimestamp, LineSeries, CandlestickSeries } from 'lightweight-charts';
import { useWatchlistStore, selectSelectedSymbol } from '../../store/watchlistStore';
import { useI18n } from '../../i18n';
import { Icon } from '../Icon';
import styles from './PriceChart.module.css';

export type ChartType = 'line' | 'candlestick';
export type TimeRange = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

// 使用实际颜色值，因为 lightweight-charts 不支持 CSS 变量
const CHART_COLORS = {
  accent: '#58A6FF',
  buy: '#3FB950',
  sell: '#F85149',
  text: '#9AA5B1',
  border: '#30363D',
  bg: '#161B22',
};

interface KlineData {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Binance K线间隔映射
const INTERVAL_MAP: Record<TimeRange, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '1h': '1h',
  '4h': '4h',
  '1d': '1d',
};

export function PriceChart() {
  const { t } = useI18n();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<any>(null);
  const selectedSymbol = useWatchlistStore(selectSelectedSymbol);
  
  const [chartType, setChartType] = useState<ChartType>('candlestick');
  const [timeRange, setTimeRange] = useState<TimeRange>('15m');
  const [klines, setKlines] = useState<KlineData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 获取历史K线数据
  const fetchKlines = useCallback(async (symbol: string, interval: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=200`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      // Binance K线格式: [openTime, open, high, low, close, volume, closeTime, ...]
      const formattedData: KlineData[] = data.map((k: (string | number)[]) => ({
        time: (Math.floor(Number(k[0]) / 1000)) as UTCTimestamp,
        open: parseFloat(k[1] as string),
        high: parseFloat(k[2] as string),
        low: parseFloat(k[3] as string),
        close: parseFloat(k[4] as string),
        volume: parseFloat(k[5] as string),
      }));
      
      setKlines(formattedData);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch klines:', err);
      setError('无法加载数据');
      setLoading(false);
    }
  }, []);

  // 当 symbol 或 timeRange 变化时重新获取数据
  useEffect(() => {
    if (selectedSymbol) {
      fetchKlines(selectedSymbol, INTERVAL_MAP[timeRange]);
    }
  }, [selectedSymbol, timeRange, fetchKlines]);

  // 定时刷新数据（每 10 秒）
  useEffect(() => {
    if (!selectedSymbol) return;
    
    const interval = setInterval(() => {
      fetchKlines(selectedSymbol, INTERVAL_MAP[timeRange]);
    }, 10000);
    
    return () => clearInterval(interval);
  }, [selectedSymbol, timeRange, fetchKlines]);

  // 初始化图表
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: CHART_COLORS.text,
        attributionLogo: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: 380,
      grid: {
        vertLines: { color: CHART_COLORS.border, style: 1 },
        horzLines: { color: CHART_COLORS.border, style: 1 },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: CHART_COLORS.border,
      },
      rightPriceScale: {
        borderColor: CHART_COLORS.border,
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: CHART_COLORS.text,
          width: 1,
          style: 2,
          labelBackgroundColor: CHART_COLORS.bg,
        },
        horzLine: {
          color: CHART_COLORS.text,
          width: 1,
          style: 2,
          labelBackgroundColor: CHART_COLORS.bg,
        },
      },
    });

    chartRef.current = chart;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      seriesRef.current = null;
      chartRef.current = null;
      chart.remove();
    };
  }, []);

  // 创建/更新 series
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    // 移除旧 series
    if (seriesRef.current) {
      try {
        chart.removeSeries(seriesRef.current);
      } catch {
        // ignore
      }
      seriesRef.current = null;
    }

    // 创建新 series
    try {
      if (chartType === 'line') {
        const lineSeries = chart.addSeries(LineSeries, {
          color: CHART_COLORS.accent,
          lineWidth: 2,
          priceLineVisible: true,
          lastValueVisible: true,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 4,
        });
        seriesRef.current = lineSeries;
      } else {
        const candlestickSeries = chart.addSeries(CandlestickSeries, {
          upColor: CHART_COLORS.buy,
          downColor: CHART_COLORS.sell,
          borderVisible: false,
          wickUpColor: CHART_COLORS.buy,
          wickDownColor: CHART_COLORS.sell,
          priceLineVisible: true,
          lastValueVisible: true,
        });
        seriesRef.current = candlestickSeries;
      }
    } catch {
      // Chart may have been destroyed
    }
  }, [chartType]);

  // 更新图表数据
  useEffect(() => {
    if (!seriesRef.current || klines.length === 0) return;

    try {
      if (chartType === 'line') {
        const lineData = klines.map(k => ({
          time: k.time,
          value: k.close,
        }));
        seriesRef.current.setData(lineData);
      } else {
        seriesRef.current.setData(klines);
      }
      
      // 自动缩放到可见范围
      chartRef.current?.timeScale().fitContent();
    } catch (err) {
      console.error('Failed to update chart data:', err);
    }
  }, [klines, chartType]);

  // 计算价格变化
  const priceInfo = klines.length > 0 ? {
    current: klines[klines.length - 1].close,
    change: klines[klines.length - 1].close - klines[0].open,
    changePercent: ((klines[klines.length - 1].close - klines[0].open) / klines[0].open) * 100,
  } : null;

  return (
    <div className={`card ${styles.container}`}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <span className={styles.symbol}>{selectedSymbol}</span>
          {priceInfo && (
            <div className={styles.priceInfo}>
              <span className={styles.currentPrice}>
                {priceInfo.current.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
              </span>
              <span className={`${styles.priceChange} ${priceInfo.change >= 0 ? styles.up : styles.down}`}>
                {priceInfo.change >= 0 ? '+' : ''}{priceInfo.changePercent.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
        <div className={styles.controls}>
          <div className={styles.typeToggle}>
            <button
              className={`${styles.typeBtn} ${chartType === 'line' ? styles.active : ''}`}
              onClick={() => setChartType('line')}
              title={t.chart?.lineChart || 'Line Chart'}
            >
              <Icon name="activity" size="sm" />
            </button>
            <button
              className={`${styles.typeBtn} ${chartType === 'candlestick' ? styles.active : ''}`}
              onClick={() => setChartType('candlestick')}
              title={t.chart?.candlestickChart || 'Candlestick Chart'}
            >
              <Icon name="bar-chart-2" size="sm" />
            </button>
          </div>
          <div className={styles.rangeToggle}>
            {(['1m', '5m', '15m', '1h', '4h', '1d'] as TimeRange[]).map((range) => (
              <button
                key={range}
                className={`${styles.rangeBtn} ${timeRange === range ? styles.active : ''}`}
                onClick={() => setTimeRange(range)}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <div className={styles.chartWrapper} ref={chartContainerRef}>
        {loading && (
          <div className={styles.loadingOverlay}>
            <div className={styles.spinner} />
            <span>加载中...</span>
          </div>
        )}
        {error && !loading && (
          <div className={styles.errorOverlay}>
            <Icon name="alert-circle" size="lg" />
            <span>{error}</span>
            <button 
              className={styles.retryBtn}
              onClick={() => fetchKlines(selectedSymbol, INTERVAL_MAP[timeRange])}
            >
              重试
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
