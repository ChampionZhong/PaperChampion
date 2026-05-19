/**
 * 全局错误边界 - 防止子组件崩溃导致白屏
 * @author Bamzc
 */
import { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-error-light">
            <AlertTriangle className="h-6 w-6 text-error" strokeWidth={1.5} />
          </div>
          <div className="text-center">
            <p className="text-[14px] font-medium text-ink">页面遇到了错误</p>
            <p className="mt-1 max-w-md text-[12px] text-ink-tertiary">
              {this.state.error?.message || "未知错误"}
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-white shadow-xs transition-colors duration-fast hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
