/**
 * Market Data Service — stub
 * Original Binance implementation was removed. These are placeholder
 * types and functions so dependent components compile.
 */

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

export async function fetchAllTickers(): Promise<MarketTicker[]> {
  return [];
}

export async function fetchSparkline(_symbol: string): Promise<MarketSparkline> {
  return { symbol: _symbol, prices: [] };
}

export function calculateIndicators(_prices: number[]): MarketIndicators {
  return { symbol: '', rsi14: null, momentum: 'neutral', volatility: 0 };
}

export function formatVolume(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(2);
}

export function formatPrice(value: number): string {
  if (value >= 1) return value.toFixed(2);
  return value.toFixed(6);
}

export function parseSymbol(symbol: string): { base: string; quote: string } {
  const quote = symbol.endsWith('USDT') ? 'USDT' : 'BTC';
  const base = symbol.replace(quote, '');
  return { base, quote };
}
