import { Component, type ReactNode, type ErrorInfo } from 'react';

interface ErrorBoundaryProps {
  /** Content to render */
  children: ReactNode;
  /** Fallback UI when error occurs */
  fallback?: ReactNode;
  /** Error handler callback */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component for catching React errors
 * Note: This is the one exception where we use a class component,
 * as error boundaries require componentDidCatch lifecycle method
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ERROR] [ErrorBoundary] Caught error:', error);
    console.error('[ERROR] [ErrorBoundary] Error info:', errorInfo);

    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="ui-loading-overlay">
          <div className="ui-text-center ui-p-md">
            <h2 className="text-xl ui-font-medium text-danger ui-mb-sm">
              Something went wrong
            </h2>
            <p className="text-text-muted text-sm ui-mb-md">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={this.handleRetry}
              className="ui-btn ui-btn-primary"
              style={{ width: 'auto' }}
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
