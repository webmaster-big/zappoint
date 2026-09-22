import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportClientError } from '../utils/errorLogger';

interface Props {
  children: ReactNode;
}

interface State {
  crashed: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false };

  static getDerivedStateFromError(): State {
    return { crashed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportClientError({
      kind: 'render',
      message: error.message || 'Render error',
      stack: `${error.stack ?? ''}\n${info.componentStack ?? ''}`,
    });
  }

  render(): ReactNode {
    if (!this.state.crashed) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-gray-50">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl p-8 text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">This page stopped working</h1>
          <p className="text-sm text-gray-600 mb-6">
            The problem has been reported to the team. Reloading usually gets you moving again.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800"
          >
            Reload the page
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
