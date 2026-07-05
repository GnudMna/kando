import { AlertCircle, X } from "lucide-react";

interface BoardErrorBannerProps {
  message: string;
  onDismiss: () => void;
}

/**
 * ボード操作エラーのアラートバナーを描画する。
 * @param message - 表示するエラーメッセージ
 * @param onDismiss - バナーを閉じるコールバック
 * @returns エラーバナーの JSX 要素
 */
export function BoardErrorBanner({
  message,
  onDismiss,
}: BoardErrorBannerProps) {
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
