// 削除確認ダイアログコンポーネント
// React Portal を使って document.body 直下にレンダリングし、
// オーバーレイクリックでキャンセルできる
import { useId } from "react";
import { createPortal } from "react-dom";

interface Props {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 削除確認ダイアログコンポーネント。
 * React Portal を使って document.body 直下にレンダリングする。
 * オーバーレイクリックでキャンセルできる。
 * @param message - 確認メッセージ
 * @param onConfirm - 削除確定時のコールバック
 * @param onCancel - キャンセル時のコールバック
 */
export function ConfirmDialog({ message, onConfirm, onCancel }: Props) {
  const titleId = useId();
  const descriptionId = useId();

  return createPortal(
    <div
      className="modal-overlay"
      onClick={onCancel}
      data-testid="confirm-dialog-overlay"
    >
      <div
        className="modal-content confirm-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <div className="modal-body confirm-dialog-body">
          <h2 id={titleId} className="confirm-dialog-title">
            削除の確認
          </h2>
          <p id={descriptionId} className="confirm-dialog-message">
            {message}
          </p>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn" onClick={onCancel}>
            キャンセル
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm}>
            削除する
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
