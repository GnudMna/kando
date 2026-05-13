// React レンダリングエラーをキャッチして UI が完全にクラッシュするのを防ぐ
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * 子コンポーネントのレンダリングエラーをキャッチし、フォールバック UI を表示する。
 * エラーが発生してもアプリ全体がクラッシュするのを防ぐ。
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("ErrorBoundary caught an error:", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="error-boundary" role="alert">
          <h2>予期しないエラーが発生しました</h2>
          <p>ページを再読み込みしてください。</p>
          <button
            type="button"
            className="btn"
            onClick={() => window.location.reload()}
          >
            再読み込み
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
