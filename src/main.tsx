import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AppProviders } from './providers/AppProviders';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/global.css';

const initialTheme = localStorage.getItem('theme') ?? 'dark';
document.documentElement.setAttribute('data-theme', initialTheme);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <AppProviders>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AppProviders>
    </ErrorBoundary>
  </StrictMode>
);
