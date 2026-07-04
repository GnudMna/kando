import { Plus, X } from "lucide-react";
import { InlineNameForm } from "./InlineNameForm";

interface BoardEmptyStatesProps {
  variant: "no-rows" | "no-search-results";
  isAddingRow: boolean;
  newRowTitle: string;
  onNewRowTitleChange: (value: string) => void;
  onSubmitAddRow: () => void;
  onCancelAddRow: () => void;
  onStartAddRow: () => void;
  onClearSearch: () => void;
}

/**
 * ボードの空状態（行なし / 検索結果なし）を描画する。
 */
export function BoardEmptyState({
  variant,
  isAddingRow,
  newRowTitle,
  onNewRowTitleChange,
  onSubmitAddRow,
  onCancelAddRow,
  onStartAddRow,
  onClearSearch,
}: BoardEmptyStatesProps) {
  if (variant === "no-rows") {
    return (
      <div className="board-empty-state">
        <p className="board-empty-title">まだ行がありません</p>
        <p className="board-empty-description">
          「行を追加」から最初のワークフローを作成しましょう。
        </p>
        {isAddingRow ? (
          <InlineNameForm
            label="行のタイトル"
            placeholder="行のタイトルを入力"
            value={newRowTitle}
            onChange={onNewRowTitleChange}
            onSubmit={onSubmitAddRow}
            onCancel={onCancelAddRow}
            className="inline-name-form-empty"
          />
        ) : (
          <button type="button" className="btn btn-primary" onClick={onStartAddRow}>
            <Plus size={16} /> 最初の行を追加
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="board-empty-state">
      <p className="board-empty-title">該当するタスクがありません</p>
      <p className="board-empty-description">
        キーワードを変えるか、検索をクリアしてください。
      </p>
      <button type="button" className="btn" onClick={onClearSearch}>
        <X size={16} /> 検索をクリア
      </button>
    </div>
  );
}
