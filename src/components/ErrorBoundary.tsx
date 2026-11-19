import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    let message = error.message || 'Unexpected application error';
    try {
      const parsed = JSON.parse(error.message) as { error?: string; operationType?: string; path?: string };
      if (parsed.error) {
        message = `${parsed.error}${parsed.path ? ` (${parsed.operationType || 'op'} ${parsed.path})` : ''}`;
      }
    } catch {
      // Plain error message
    }
    return { hasError: true, message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('NearMe ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0D1018] text-white p-6">
          <div className="max-w-md w-full rounded-2xl bg-[#171C28] border border-white/10 p-6 space-y-4">
            <h2 className="text-xl font-semibold text-[#F05265]">Application Error</h2>
            <p className="text-sm text-[#A7AFBF] break-words">{this.state.message}</p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.href = '/';
              }}
              className="px-4 py-2 rounded-xl bg-[#FF5277] text-white text-sm font-medium hover:bg-[#FF5277]/90 transition-colors"
            >
              Return Home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
