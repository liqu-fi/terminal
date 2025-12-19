import { Component, ReactNode } from 'react';
import { Icon } from '../Icon';
import styles from './ErrorBoundary.module.css';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`ErrorBoundary [${this.props.name || 'Anonymous'}] caught an error:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className={styles.container}>
          <div className={styles.content}>
            <Icon name="alert-circle" size="xl" className={styles.icon} />
            <h1 className={styles.title}>System Error</h1>
            <p className={styles.message}>
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <div className={styles.actions}>
              <button
                className={styles.button}
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
              >
                Reload Page
              </button>
            </div>
            {this.state.error && (
              <details className={styles.details}>
                <summary>Error Details</summary>
                <pre className={styles.stack}>
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
