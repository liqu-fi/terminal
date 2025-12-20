/**
 * Error Handler Utility
 */

export interface AppError {
  message: string;
  code?: string | number;
  details?: any;
  timestamp: number;
  isRateLimit?: boolean;
}

export function handleApiError(error: any): AppError {
  const timestamp = Date.now();
  
  if (error instanceof Response) {
    const isRateLimit = error.status === 418 || error.status === 429;
    let message = `API Error: ${error.status} ${error.statusText}`;
    
    if (isRateLimit) {
      message = error.status === 418 
        ? 'IP temporarily blocked by Binance (418). Please wait 5-10 minutes.' 
        : 'Rate limit exceeded (429). Please slow down.';
    }
    
    return {
      message,
      code: error.status,
      timestamp,
      isRateLimit
    };
  }
  
  return {
    message: error.message || 'An unknown error occurred',
    code: error.code || 'UNKNOWN',
    timestamp,
    isRateLimit: false
  };
}

export function logError(error: AppError) {
  // In production, console logs are stripped by Vite configuration
  // but we can still use console.error which we might want to keep or redirect
  console.error(`[Error ${error.code}] ${error.message}`, error.details || '');
}

