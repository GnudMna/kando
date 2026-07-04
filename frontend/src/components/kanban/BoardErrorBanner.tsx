import { AlertCircle, X } from "lucide-react";

interface BoardErrorBannerProps {
  message: string;
  onDismiss: () => void;
}

/**
 * ボード操作エラーのアラートバナーを描画する。
 */
export function BoardErrorBanner({ message, onDismiss }: BoardErrorBannerProps) {
  return (
    <div role="alert" className="board-error">
      <AlertCircle size={16} />
      <span className="board-error-message">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="board-error-close"
        aria-label="エラーを閉じる"
      >
        <X size={16} />
      </button>
    </div>
  );
}
