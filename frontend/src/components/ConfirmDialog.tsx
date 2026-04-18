// 削除確認ダイアログコンポーネント
// React Portal を使って document.body 直下にレンダリングし、
// オーバーレイクリックでキャンセルできる
import { useId } from 'react';
import { createPortal } from 'react-dom';

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
    <div className="modal-overlay" onClick={onCancel} data-testid="confirm-dialog-overlay">
      <div
        className="modal-content"
        style={{ maxWidth: '360px' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <div className="modal-body" style={{ padding: '1.5rem' }}>
          <h2 id={titleId} style={{ margin: '0 0 0.75rem 0', fontSize: '1rem' }}>削除の確認</h2>
          <p id={descriptionId} style={{ margin: 0, lineHeight: 1.6 }}>{message}</p>
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
    document.body
  );
}
