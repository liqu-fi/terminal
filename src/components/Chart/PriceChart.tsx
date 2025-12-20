import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createChart, IChartApi, ColorType, UTCTimestamp, LineSeries, CandlestickSeries, HistogramSeries, CrosshairMode } from 'lightweight-charts';
import { useWatchlistStore, selectSelectedSymbol } from '../../store/watchlistStore';
import { useAutomationStore } from '../../store/automationStore';
import { useTradingStore } from '../../store/tradingStore';
import { useI18n } from '../../i18n';
import { Icon } from '../Icon';
import styles from './PriceChart.module.css';

export type ChartType = 'line' | 'candlestick';
export type TimeRange = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
export type Indicator = 'MA' | 'EMA' | 'BOLL' | 'VOL';

// 图表颜色配置
const CHART_COLORS = {
  accent: '#58A6FF',
  buy: '#3FB950',
  sell: '#F85149',
  text: '#9AA5B1',
  textSecondary: '#6E7681',
  border: '#30363D',
  bg: '#161B22',
  bgSecondary: '#0D1117',
  ma7: '#F0B90B',
  ma25: '#E377C2',
  ma99: '#9467BD',
  ema12: '#00D4AA',
  ema26: '#FF6B9D',
  bollUpper: '#FF6B6B',
  bollMiddle: '#4ECDC4',
  bollLower: '#45B7D1',
  volumeUp: 'rgba(63, 185, 80, 0.5)',
  volumeDown: 'rgba(248, 81, 73, 0.5)',
  grid: 'rgba(48, 54, 61, 0.5)',
};

interface KlineData {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface CrosshairData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
  changePercent: number;
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

// 计算移动平均线
function calculateMA(data: KlineData[], period: number) {
  const result = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    result.push({ time: data[i].time, value: sum / period });
  }
  return result;
}

// 计算 EMA
function calculateEMA(data: KlineData[], period: number) {
  const result = [];
  const multiplier = 2 / (period + 1);
  let ema = data[0]?.close || 0;
  
  for (let i = 0; i < data.length; i++) {
    ema = i === 0 ? data[i].close : (data[i].close - ema) * multiplier + ema;
    if (i >= period - 1) {
      result.push({ time: data[i].time, value: ema });
    }
  }
  return result;
}

// 计算布林带
function calculateBOLL(data: KlineData[], period: number = 20, stdDev: number = 2) {
  const upper = [], middle = [], lower = [];
  
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += data[i - j].close;
    const ma = sum / period;
    
    let squaredDiffSum = 0;
    for (let j = 0; j < period; j++) squaredDiffSum += Math.pow(data[i - j].close - ma, 2);
    const std = Math.sqrt(squaredDiffSum / period);
    
    middle.push({ time: data[i].time, value: ma });
    upper.push({ time: data[i].time, value: ma + stdDev * std });
    lower.push({ time: data[i].time, value: ma - stdDev * std });
  }
  
  return { upper, middle, lower };
}

export function PriceChart() {
  const { t } = useI18n();
  const mainChartRef = useRef<HTMLDivElement>(null);
  const volumeChartRef = useRef<HTMLDivElement>(null);
  const mainChartApiRef = useRef<IChartApi | null>(null);
  const volumeChartApiRef = useRef<IChartApi | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mainSeriesRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const volumeSeriesRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const indicatorSeriesRef = useRef<Map<string, any>>(new Map());
  
  const selectedSymbol = useWatchlistStore(selectSelectedSymbol);
  const triggers = useAutomationStore((state) => state.triggers);
  const openOrders = useTradingStore((state) => state.orders.filter(o => o.status === 'open'));
  
  const [chartType, setChartType] = useState<ChartType>('candlestick');
  const [timeRange, setTimeRange] = useState<TimeRange>('15m');
  const [klines, setKlines] = useState<KlineData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndicators, setActiveIndicators] = useState<Set<Indicator>>(new Set(['MA', 'VOL']));
  const [crosshairData, setCrosshairData] = useState<CrosshairData | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chartReady, setChartReady] = useState(false);

  // 切换指标
  const toggleIndicator = useCallback((indicator: Indicator) => {
    setActiveIndicators(prev => {
      const newSet = new Set(prev);
      if (newSet.has(indicator)) newSet.delete(indicator);
      else newSet.add(indicator);
      return newSet;
    });
  }, []);

  // K线数据缓存
  const klinesCacheRef = useRef<Map<string, { data: KlineData[]; timestamp: number }>>(new Map());
  const CACHE_TTL = 60000; // 60秒缓存

  // 获取历史K线数据（带缓存和重试）
  const fetchKlines = useCallback(async (symbol: string, interval: string, retryCount = 0) => {
    const cacheKey = `${symbol}-${interval}`;
    const cached = klinesCacheRef.current.get(cacheKey);
    const now = Date.now();
    
    // 有效缓存直接使用
    if (cached && now - cached.timestamp < CACHE_TTL) {
      setKlines(cached.data);
      setLoading(false);
      setError(null);
      return;
    }
    
    // 首次加载显示 loading
    if (klines.length === 0) {
      setLoading(true);
    }
    
    try {
      const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=500`;
      const response = await fetch(url);
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      const formattedData: KlineData[] = data.map((k: (string | number)[]) => ({
        time: (Math.floor(Number(k[0]) / 1000)) as UTCTimestamp,
        open: parseFloat(k[1] as string),
        high: parseFloat(k[2] as string),
        low: parseFloat(k[3] as string),
        close: parseFloat(k[4] as string),
        volume: parseFloat(k[5] as string),
      }));
      
      // 更新缓存
      klinesCacheRef.current.set(cacheKey, { data: formattedData, timestamp: now });
      
      setKlines(formattedData);
      setError(null);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch klines:', err);
      
      // 有缓存数据时使用过期缓存
      if (cached) {
        setKlines(cached.data);
        setError(null);
        setLoading(false);
        return;
      }
      
      // 重试最多3次
      if (retryCount < 3) {
        setTimeout(() => fetchKlines(symbol, interval, retryCount + 1), 2000 * (retryCount + 1));
        return;
      }
      
      setError('无法加载数据');
      setLoading(false);
    }
  }, [klines.length]);

  // 数据获取
  useEffect(() => {
    if (selectedSymbol) fetchKlines(selectedSymbol, INTERVAL_MAP[timeRange]);
  }, [selectedSymbol, timeRange, fetchKlines]);

  // 定时刷新（60秒间隔，避免速率限制）
  useEffect(() => {
    if (!selectedSymbol) return;
    const interval = setInterval(() => fetchKlines(selectedSymbol, INTERVAL_MAP[timeRange]), 60000);
    return () => clearInterval(interval);
  }, [selectedSymbol, timeRange, fetchKlines]);

  // 格式化时间
  const formatTime = useCallback((timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  // 初始化主图表
  useEffect(() => {
    if (!mainChartRef.current) return;

    // 等待布局稳定后初始化图表
    const initChart = () => {
      if (!mainChartRef.current) return null;
      
      const containerWidth = mainChartRef.current.clientWidth || mainChartRef.current.offsetWidth;
      const containerHeight = mainChartRef.current.clientHeight || mainChartRef.current.offsetHeight || 350;

      const chart = createChart(mainChartRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: CHART_COLORS.text,
          attributionLogo: false,
        },
        width: containerWidth,
        height: containerHeight,
        grid: {
          vertLines: { color: CHART_COLORS.grid, style: 1 },
          horzLines: { color: CHART_COLORS.grid, style: 1 },
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          borderColor: CHART_COLORS.border,
          rightOffset: 5,
          barSpacing: 8,
          minBarSpacing: 2,
        },
        rightPriceScale: {
          borderColor: CHART_COLORS.border,
          scaleMargins: { top: 0.05, bottom: 0.05 },
          autoScale: true,
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: {
            color: CHART_COLORS.accent,
            width: 1,
            style: 2,
            labelBackgroundColor: CHART_COLORS.bg,
          },
          horzLine: {
            color: CHART_COLORS.accent,
            width: 1,
            style: 2,
            labelBackgroundColor: CHART_COLORS.bg,
          },
        },
        handleScroll: { vertTouchDrag: false },
      });

      return chart;
    };

    // 使用 requestAnimationFrame 确保布局完成后初始化
    const rafId = requestAnimationFrame(() => {
      const chart = initChart();
      if (!chart) return;

      mainChartApiRef.current = chart;

      // 创建初始 series
      const candlestickSeries = chart.addSeries(CandlestickSeries, {
        upColor: CHART_COLORS.buy,
        downColor: CHART_COLORS.sell,
        borderVisible: false,
        wickUpColor: CHART_COLORS.buy,
        wickDownColor: CHART_COLORS.sell,
        priceLineVisible: true,
        lastValueVisible: true,
      });
      mainSeriesRef.current = candlestickSeries;

      // 十字光标订阅
      chart.subscribeCrosshairMove((param) => {
        if (!param.time || !param.seriesData || !mainSeriesRef.current) {
          setCrosshairData(null);
          return;
        }
        
        const data = param.seriesData.get(mainSeriesRef.current);
        if (data && 'open' in data) {
          const kline = data as { open: number; high: number; low: number; close: number };
          const matchingKline = klines.find(k => k.time === param.time);
          setCrosshairData({
            time: formatTime(param.time as number),
            open: kline.open,
            high: kline.high,
            low: kline.low,
            close: kline.close,
            volume: matchingKline?.volume || 0,
            change: kline.close - kline.open,
            changePercent: ((kline.close - kline.open) / kline.open) * 100,
          });
        }
      });

      setChartReady(true);
    });

    // 使用 ResizeObserver 监听容器大小变化
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (mainChartApiRef.current && entry.target === mainChartRef.current) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            mainChartApiRef.current.applyOptions({ 
              width: Math.floor(width),
              height: Math.floor(height),
            });
          }
        }
      }
    });

    if (mainChartRef.current) {
      resizeObserver.observe(mainChartRef.current);
    }

    const handleResize = () => {
      if (mainChartRef.current && mainChartApiRef.current) {
        mainChartApiRef.current.applyOptions({ 
          width: mainChartRef.current.clientWidth,
          height: mainChartRef.current.clientHeight || 350,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      mainSeriesRef.current = null;
      indicatorSeriesRef.current.clear();
      if (mainChartApiRef.current) {
        mainChartApiRef.current.remove();
        mainChartApiRef.current = null;
      }
      setChartReady(false);
    };
  }, [formatTime]);

  // 切换图表类型
  useEffect(() => {
    const chart = mainChartApiRef.current;
    if (!chart || !chartReady) return;

    // 移除旧 series
    if (mainSeriesRef.current) {
      try { chart.removeSeries(mainSeriesRef.current); } catch { /* ignore */ }
      mainSeriesRef.current = null;
    }

    // 创建新 series
    try {
      if (chartType === 'line') {
        mainSeriesRef.current = chart.addSeries(LineSeries, {
          color: CHART_COLORS.accent,
          lineWidth: 2,
          priceLineVisible: true,
          lastValueVisible: true,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 4,
        });
      } else {
        mainSeriesRef.current = chart.addSeries(CandlestickSeries, {
          upColor: CHART_COLORS.buy,
          downColor: CHART_COLORS.sell,
          borderVisible: false,
          wickUpColor: CHART_COLORS.buy,
          wickDownColor: CHART_COLORS.sell,
          priceLineVisible: true,
          lastValueVisible: true,
        });
      }

      // 立即设置数据
      if (klines.length > 0) {
        if (chartType === 'line') {
          mainSeriesRef.current.setData(klines.map(k => ({ time: k.time, value: k.close })));
        } else {
          mainSeriesRef.current.setData(klines);
        }
        chart.timeScale().fitContent();
      }
    } catch (err) {
      console.error('Failed to create series:', err);
    }
  }, [chartType, chartReady, klines]);

  // 更新主数据
  useEffect(() => {
    if (!mainSeriesRef.current || !chartReady || klines.length === 0) return;

    try {
      if (chartType === 'line') {
        mainSeriesRef.current.setData(klines.map(k => ({ time: k.time, value: k.close })));
      } else {
        mainSeriesRef.current.setData(klines);
      }
      mainChartApiRef.current?.timeScale().fitContent();
    } catch (err) {
      console.error('Failed to update chart data:', err);
    }
  }, [klines, chartReady, chartType]);

  // 初始化成交量图表
  useEffect(() => {
    if (!volumeChartRef.current || !activeIndicators.has('VOL')) {
      if (volumeChartApiRef.current) {
        volumeChartApiRef.current.remove();
        volumeChartApiRef.current = null;
        volumeSeriesRef.current = null;
      }
      return;
    }

    const containerWidth = volumeChartRef.current.clientWidth || volumeChartRef.current.offsetWidth || 400;

    const chart = createChart(volumeChartRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: CHART_COLORS.text,
        attributionLogo: false,
      },
      width: containerWidth,
      height: 80,
      grid: {
        vertLines: { color: CHART_COLORS.grid, style: 1 },
        horzLines: { visible: false },
      },
      timeScale: {
        visible: false,
        borderColor: CHART_COLORS.border,
      },
      rightPriceScale: {
        borderColor: CHART_COLORS.border,
        scaleMargins: { top: 0.1, bottom: 0 },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { visible: false },
        horzLine: { visible: false },
      },
    });

    volumeChartApiRef.current = chart;

    // 创建成交量 series
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'right',
    });
    volumeSeriesRef.current = volumeSeries;

    // 同步时间轴
    if (mainChartApiRef.current) {
      mainChartApiRef.current.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (range && volumeChartApiRef.current) {
          volumeChartApiRef.current.timeScale().setVisibleLogicalRange(range);
        }
      });
    }

    // 使用 ResizeObserver 监听容器大小变化
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (volumeChartApiRef.current && entry.target === volumeChartRef.current) {
          const { width } = entry.contentRect;
          if (width > 0) {
            volumeChartApiRef.current.applyOptions({ width: Math.floor(width) });
          }
        }
      }
    });

    resizeObserver.observe(volumeChartRef.current);

    const handleResize = () => {
      if (volumeChartRef.current && volumeChartApiRef.current) {
        volumeChartApiRef.current.applyOptions({ width: volumeChartRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      volumeSeriesRef.current = null;
      volumeChartApiRef.current = null;
      chart.remove();
    };
  }, [activeIndicators]);

  // 更新成交量数据
  useEffect(() => {
    if (!volumeSeriesRef.current || klines.length === 0 || !activeIndicators.has('VOL')) return;

    try {
      const volumeData = klines.map(k => ({
        time: k.time,
        value: k.volume,
        color: k.close >= k.open ? CHART_COLORS.volumeUp : CHART_COLORS.volumeDown,
      }));
      volumeSeriesRef.current.setData(volumeData);
    } catch { /* ignore */ }
  }, [klines, activeIndicators]);

  // 更新技术指标
  useEffect(() => {
    const chart = mainChartApiRef.current;
    if (!chart || !chartReady || klines.length === 0) return;

    // 清除所有旧指标
    indicatorSeriesRef.current.forEach((series) => {
      try { chart.removeSeries(series); } catch { /* ignore */ }
    });
    indicatorSeriesRef.current.clear();

    // MA
    if (activeIndicators.has('MA')) {
      try {
        const periods = [7, 25, 99];
        const colors = [CHART_COLORS.ma7, CHART_COLORS.ma25, CHART_COLORS.ma99];
        periods.forEach((period, i) => {
          const data = calculateMA(klines, period);
          const series = chart.addSeries(LineSeries, {
            color: colors[i],
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          series.setData(data);
          indicatorSeriesRef.current.set(`ma${period}`, series);
        });
      } catch { /* ignore */ }
    }

    // EMA
    if (activeIndicators.has('EMA')) {
      try {
        const periods = [12, 26];
        const colors = [CHART_COLORS.ema12, CHART_COLORS.ema26];
        periods.forEach((period, i) => {
          const data = calculateEMA(klines, period);
          const series = chart.addSeries(LineSeries, {
            color: colors[i],
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          series.setData(data);
          indicatorSeriesRef.current.set(`ema${period}`, series);
        });
      } catch { /* ignore */ }
    }

    // BOLL
    if (activeIndicators.has('BOLL')) {
      try {
        const boll = calculateBOLL(klines);
        const bollSeries = [
          { data: boll.upper, color: CHART_COLORS.bollUpper, key: 'bollUpper', style: 2 },
          { data: boll.middle, color: CHART_COLORS.bollMiddle, key: 'bollMiddle', style: 0 },
          { data: boll.lower, color: CHART_COLORS.bollLower, key: 'bollLower', style: 2 },
        ];
        bollSeries.forEach(({ data, color, key, style }) => {
          const series = chart.addSeries(LineSeries, {
            color,
            lineWidth: 1,
            lineStyle: style,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          series.setData(data);
          indicatorSeriesRef.current.set(key, series);
        });
      } catch { /* ignore */ }
    }
  }, [klines, activeIndicators, chartReady]);

  // 添加价格线（触发器和挂单）
  useEffect(() => {
    if (!mainSeriesRef.current || !chartReady) return;

    try {
      const series = mainSeriesRef.current;
      
      // 添加触发器价格线
      triggers.filter(t => t.enabled && t.symbol === selectedSymbol).forEach(trigger => {
        series.createPriceLine({
          price: parseFloat(trigger.triggerPrice),
          color: trigger.action === 'buy' ? CHART_COLORS.buy : CHART_COLORS.sell,
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: `T: ${trigger.action.toUpperCase()}`,
        });
      });

      // 添加挂单价格线
      openOrders.filter(o => o.symbol === selectedSymbol && o.price).forEach(order => {
        series.createPriceLine({
          price: parseFloat(order.price!),
          color: order.side === 'buy' ? CHART_COLORS.buy : CHART_COLORS.sell,
          lineWidth: 1,
          lineStyle: 1,
          axisLabelVisible: true,
          title: `${order.side.toUpperCase()} @ ${order.price}`,
        });
      });
    } catch { /* ignore */ }
  }, [triggers, openOrders, selectedSymbol, chartReady]);

  // 价格信息计算
  const priceInfo = useMemo(() => {
    if (klines.length === 0) return null;
    const current = klines[klines.length - 1].close;
    const first = klines[0].open;
    const high24h = Math.max(...klines.map(k => k.high));
    const low24h = Math.min(...klines.map(k => k.low));
    const totalVolume = klines.reduce((sum, k) => sum + k.volume, 0);
    
    return {
      current,
      high24h,
      low24h,
      change: current - first,
      changePercent: ((current - first) / first) * 100,
      volume: totalVolume,
      amplitude: ((high24h - low24h) / low24h) * 100,
    };
  }, [klines]);

  // 重置图表视图
  const handleReset = useCallback(() => {
    mainChartApiRef.current?.timeScale().fitContent();
    volumeChartApiRef.current?.timeScale().fitContent();
  }, []);

  // 切换全屏
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  const indicators: Indicator[] = ['MA', 'EMA', 'BOLL', 'VOL'];

  return (
    <div className={`card ${styles.container} ${isFullscreen ? styles.fullscreen : ''}`}>
      {/* 头部工具栏 */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          {/* 指标按钮 */}
          <div className={styles.indicatorGroup}>
            {indicators.map((indicator) => (
              <button
                key={indicator}
                className={`${styles.indicatorBtn} ${activeIndicators.has(indicator) ? styles.active : ''}`}
                onClick={() => toggleIndicator(indicator)}
              >
                {indicator}
              </button>
            ))}
          </div>
          
          {/* 图表类型 */}
          <div className={styles.chartTypeGroup}>
            <button
              className={`${styles.chartTypeBtn} ${chartType === 'line' ? styles.active : ''}`}
              onClick={() => setChartType('line')}
              title={t.chart?.lineChart || 'Line Chart'}
            >
              <Icon name="activity" size="sm" />
            </button>
            <button
              className={`${styles.chartTypeBtn} ${chartType === 'candlestick' ? styles.active : ''}`}
              onClick={() => setChartType('candlestick')}
              title={t.chart?.candlestickChart || 'Candlestick Chart'}
            >
              <Icon name="bar-chart-2" size="sm" />
            </button>
          </div>

          {/* 时间周期 */}
          <div className={styles.timeRangeGroup}>
            {(['1m', '5m', '15m', '1h', '4h', '1d'] as TimeRange[]).map((range) => (
              <button
                key={range}
                className={`${styles.timeRangeBtn} ${timeRange === range ? styles.active : ''}`}
                onClick={() => setTimeRange(range)}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.toolbarRight}>
          <button className={styles.toolBtn} onClick={handleReset} title="Reset">
            <Icon name="refresh-cw" size="sm" />
          </button>
          <button className={styles.toolBtn} onClick={toggleFullscreen} title="Fullscreen">
            <Icon name={isFullscreen ? 'minimize-2' : 'maximize-2'} size="sm" />
          </button>
        </div>
      </div>

      {/* OHLC 信息栏 */}
      <div className={styles.ohlcBar}>
        <div className={styles.symbolInfo}>
          <span className={styles.symbolName}>{selectedSymbol}</span>
          {priceInfo && (
            <>
              <span className={styles.currentPrice}>
                {priceInfo.current.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
              </span>
              <span className={`${styles.priceChange} ${priceInfo.change >= 0 ? styles.up : styles.down}`}>
                {priceInfo.change >= 0 ? '+' : ''}{priceInfo.changePercent.toFixed(2)}%
              </span>
            </>
          )}
        </div>
        
        {/* OHLCV 数据 */}
        <div className={styles.ohlcData}>
          {crosshairData ? (
            <>
              <span className={styles.ohlcItem}><label>T</label>{crosshairData.time}</span>
              <span className={styles.ohlcItem}><label>O</label>{crosshairData.open.toFixed(2)}</span>
              <span className={styles.ohlcItem}><label>H</label>{crosshairData.high.toFixed(2)}</span>
              <span className={styles.ohlcItem}><label>L</label>{crosshairData.low.toFixed(2)}</span>
              <span className={`${styles.ohlcItem} ${crosshairData.change >= 0 ? styles.up : styles.down}`}>
                <label>C</label>{crosshairData.close.toFixed(2)}
              </span>
              <span className={styles.ohlcItem}><label>V</label>{(crosshairData.volume / 1000).toFixed(2)}K</span>
              <span className={`${styles.ohlcItem} ${crosshairData.changePercent >= 0 ? styles.up : styles.down}`}>
                <label>Chg</label>{crosshairData.changePercent >= 0 ? '+' : ''}{crosshairData.changePercent.toFixed(2)}%
              </span>
            </>
          ) : priceInfo && (
            <>
              <span className={styles.ohlcItem}><label>24H High</label>{priceInfo.high24h.toFixed(2)}</span>
              <span className={styles.ohlcItem}><label>24H Low</label>{priceInfo.low24h.toFixed(2)}</span>
              <span className={styles.ohlcItem}><label>24H Vol</label>{(priceInfo.volume / 1000000).toFixed(2)}M</span>
              <span className={styles.ohlcItem}><label>Amp</label>{priceInfo.amplitude.toFixed(2)}%</span>
            </>
          )}
        </div>
      </div>

      {/* 指标图例 */}
      {(activeIndicators.has('MA') || activeIndicators.has('EMA') || activeIndicators.has('BOLL')) && (
        <div className={styles.legend}>
          {activeIndicators.has('MA') && (
            <>
              <span style={{ color: CHART_COLORS.ma7 }}>●MA(7)</span>
              <span style={{ color: CHART_COLORS.ma25 }}>●MA(25)</span>
              <span style={{ color: CHART_COLORS.ma99 }}>●MA(99)</span>
            </>
          )}
          {activeIndicators.has('EMA') && (
            <>
              <span style={{ color: CHART_COLORS.ema12 }}>●EMA(12)</span>
              <span style={{ color: CHART_COLORS.ema26 }}>●EMA(26)</span>
            </>
          )}
          {activeIndicators.has('BOLL') && (
            <span style={{ color: CHART_COLORS.bollMiddle }}>●BOLL(20,2)</span>
          )}
        </div>
      )}

      {/* 主图表 */}
      <div className={styles.mainChart} ref={mainChartRef}>
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
            <button className={styles.retryBtn} onClick={() => fetchKlines(selectedSymbol, INTERVAL_MAP[timeRange])}>
              重试
            </button>
          </div>
        )}
      </div>

      {/* 成交量图表 */}
      {activeIndicators.has('VOL') && (
        <div className={styles.volumeChart}>
          <div className={styles.volumeLabel}>VOL</div>
          <div className={styles.volumeChartInner} ref={volumeChartRef} />
        </div>
      )}
    </div>
  );
}
