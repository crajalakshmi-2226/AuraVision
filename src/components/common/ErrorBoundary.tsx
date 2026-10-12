import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full p-6 my-4 bg-slate-950 border border-rose-500/30 rounded-xl text-center space-y-4 font-sans">
          <div className="w-12 h-12 rounded-full bg-rose-950/80 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-base text-rose-300">
              {this.props.fallbackTitle || 'Component Render Recovery'}
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
              A temporary render discrepancy was safely intercepted. Click below to reload this section with verified defaults.
            </p>
            {this.state.error && (
              <p className="text-[11px] font-mono text-slate-500 mt-2 max-w-lg mx-auto truncate bg-slate-900 p-1.5 rounded">
                {this.state.error.message}
              </p>
            )}
          </div>
          <button
            onClick={this.handleReset}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs font-hud transition-colors shadow-lg"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Recover & Refresh View</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
