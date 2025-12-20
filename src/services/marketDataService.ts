/**
 * Market Data Service
 * Professional Terminal Edition
 */

import { handleApiError, logError } from '../utils/errorHandler';

export interface MarketTicker {
  symbol: string;
  price: number;
  priceChange: number;
  priceChangePercent: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  quoteVolume24h: number;
  openPrice: number;
  trades24h: number;
  lastUpdated: number;
}

export interface MarketSparkline {
  symbol: string;
  prices: number[];
}

export interface MarketIndicators {
  symbol: string;
  rsi14: number | null;
  momentum: 'bullish' | 'bearish' | 'neutral';
  volatility: number;
}

export const POPULAR_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'DOTUSDT', 'LINKUSDT',
  'TRXUSDT', 'LTCUSDT', 'SHIBUSDT', 'MATICUSDT', 'UNIUSDT',
  'ARBUSDT', 'OPUSDT', 'NEARUSDT', 'FILUSDT', 'ATOMUSDT',
  'APTUSDT', 'SUIUSDT', 'TIAUSDT', 'IMXUSDT', 'INJUSDT',
  'ORDIUSDT', 'PEPEUSDT', 'RENDERUSDT', 'WIFUSDT', 'FETUSDT',
];

const CATEGORY_MAP: Record<string, string[]> = {
  'Main': ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'],
  'Layer2': ['ARBUSDT', 'OPUSDT', 'MATICUSDT', 'STRKUSDT', 'METISUSDT'],
  'DeFi': ['UNIUSDT', 'AAVEUSDT', 'MKRUSDT', 'LDOUSDT', 'CAKEUSDT'],
  'AI': ['FETUSDT', 'RENDERUSDT', 'WLDUSDT', 'AGIXUSDT', 'OCEANUSDT'],
  'Meme': ['DOGEUSDT', 'SHIBUSDT', 'PEPEUSDT', 'WIFUSDT', 'FLOKIUSDT'],
};

export const GET_SYMBOLS_BY_CATEGORY = (cat: string) => CATEGORY_MAP[cat] || POPULAR_SYMBOLS;

let tickerCache: Map<string, MarketTicker> = new Map();
let lastFetchTime = 0;
const CACHE_TTL = 3000;

// Use proxy path for API calls (works in both dev and production)
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/binance-api') + '/api/v3';

export async function fetchAllTickers(): Promise<MarketTicker[]> {
  const now = Date.now();
  if (now - lastFetchTime < CACHE_TTL && tickerCache.size > 0) return Array.from(tickerCache.values());

  try {
    const response = await fetch(`${API_BASE}/ticker/24hr`);
    if (!response.ok) throw response;
    const data = await response.json();
    
    const symbolSet = new Set(POPULAR_SYMBOLS);
    const tickers: MarketTicker[] = data
      .filter((t: any) => symbolSet.has(t.symbol))
      .map((t: any) => {
        const ticker = {
          symbol: t.symbol,
          price: parseFloat(t.lastPrice),
          priceChange: parseFloat(t.priceChange),
          priceChangePercent: parseFloat(t.priceChangePercent),
          high24h: parseFloat(t.highPrice),
          low24h: parseFloat(t.lowPrice),
          volume24h: parseFloat(t.volume),
          quoteVolume24h: parseFloat(t.quoteVolume),
          openPrice: parseFloat(t.openPrice),
          trades24h: parseInt(t.count),
          lastUpdated: now,
        };
        tickerCache.set(t.symbol, ticker);
        return ticker;
      });

    lastFetchTime = now;
    return tickers.sort((a, b) => b.quoteVolume24h - a.quoteVolume24h);
  } catch (error) {
    logError(handleApiError(error));
    return Array.from(tickerCache.values());
  }
}

export async function fetchSparkline(symbol: string): Promise<MarketSparkline | null> {
  try {
    const response = await fetch(`${API_BASE}/klines?symbol=${symbol}&interval=1h&limit=24`);
    if (!response.ok) return null;
    const data = await response.json();
    return { symbol, prices: data.map((k: any) => parseFloat(k[4])) };
  } catch { return null; }
}

export async function calculateIndicators(symbol: string): Promise<MarketIndicators | null> {
  try {
    const response = await fetch(`${API_BASE}/klines?symbol=${symbol}&interval=1h&limit=30`);
    if (!response.ok) return null;
    const data = await response.json();
    const closes = data.map((k: any) => parseFloat(k[4]));
    
    const rsi = calculateRSI(closes, 14);
    let momentum: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (rsi) {
      if (rsi > 60) momentum = 'bullish';
      else if (rsi < 40) momentum = 'bearish';
    }

    return {
      symbol,
      rsi14: rsi,
      momentum,
      volatility: calculateVolatility(closes),
    };
  } catch { return null; }
}

function calculateRSI(closes: number[], period: number): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const current = closes[i];
    const prev = closes[i - 1];
    if (current !== undefined && prev !== undefined) {
      const diff = current - prev;
      if (diff > 0) gains += diff; else losses -= diff;
    }
  }
  let avgGain = gains / period, avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const current = closes[i];
    const prev = closes[i - 1];
    if (current !== undefined && prev !== undefined) {
      const diff = current - prev;
      avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
      avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
    }
  }
  return avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
}

function calculateVolatility(closes: number[]): number {
  const returns = [];
  for (let i = 1; i < closes.length; i++) {
    const current = closes[i];
    const prev = closes[i - 1];
    if (current !== undefined && prev !== undefined && prev !== 0) {
      returns.push((current - prev) / prev);
    }
  }
  if (returns.length === 0) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
  return Math.sqrt(variance) * 100;
}

export function formatVolume(v: number): string {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(2) + 'K';
  return v.toFixed(2);
}

export function formatPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(4);
  return p.toFixed(6);
}

export function parseSymbol(s: string) {
  if (s.endsWith('USDT')) return { base: s.replace('USDT', ''), quote: 'USDT' };
  return { base: s, quote: '' };
}
