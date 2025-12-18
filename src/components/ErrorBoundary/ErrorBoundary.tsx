import { Component, ReactNode } from 'react';
import { Icon } from '../Icon';
import styles from './ErrorBoundary.module.css';

interface Props {
  children: ReactNode;
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
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.container}>
          <div className={styles.content}>
            <Icon name="alert-triangle" size="lg" className={styles.icon} />
            <h1 className={styles.title}>应用错误</h1>
            <p className={styles.message}>
              {this.state.error?.message || '发生了未知错误'}
            </p>
            <button
              className={styles.button}
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
            >
              重新加载页面
            </button>
            {this.state.error && (
              <details className={styles.details}>
                <summary>错误详情</summary>
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





