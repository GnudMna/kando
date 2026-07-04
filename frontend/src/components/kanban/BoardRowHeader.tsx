import { Plus, Trash2 } from "lucide-react";
import type { Row } from "../../types";
import type { InlineEditState } from "./types";
import { InlineNameForm } from "./InlineNameForm";

interface BoardRowHeaderProps {
  row: Row;
  editingRow: InlineEditState | null;
  onEditingRowChange: (state: InlineEditState | null) => void;
  onSaveRowTitle: () => Promise<void>;
  addingColumnRowId: number | null;
  newColumnTitle: string;
  onNewColumnTitleChange: (value: string) => void;
  onSubmitAddColumn: () => void;
  onCancelAddColumn: () => void;
  onStartAddColumn: (rowId: number) => void;
  onRemoveRow: (rowId: number) => Promise<void>;
  confirmAction: (message: string, onConfirm: () => void) => void;
}

/**
 * 行ヘッダー（タイトル編集と操作ボタン）を描画する。
 */
export function BoardRowHeader({
  row,
  editingRow,
  onEditingRowChange,
  onSaveRowTitle,
  addingColumnRowId,
  newColumnTitle,
  onNewColumnTitleChange,
  onSubmitAddColumn,
  onCancelAddColumn,
  onStartAddColumn,
  onRemoveRow,
  confirmAction,
}: BoardRowHeaderProps) {
  return (
    <div className="board-row-header">
      {editingRow?.id === row.id ? (
        <input
          autoFocus
          className="board-row-title-input"
          value={editingRow.title}
          onChange={(e) =>
            onEditingRowChange({ ...editingRow, title: e.target.value })
          }
          onBlur={() => void onSaveRowTitle()}
          onKeyDown={(e) => {
            if (e.key === "Enter") void onSaveRowTitle();
            if (e.key === "Escape") onEditingRowChange(null);
          }}
        />
      ) : (
        <button
          type="button"
          className="board-row-title board-title-button"
          title="クリックして編集"
          onClick={() => onEditingRowChange({ id: row.id, title: row.title })}
        >
          {row.title}
        </button>
      )}
      <div className="board-row-header-actions">
        {addingColumnRowId === row.id ? (
          <InlineNameForm
            label="ステータス名"
            placeholder="ステータス名を入力"
            value={newColumnTitle}
            onChange={onNewColumnTitleChange}
            onSubmit={onSubmitAddColumn}
            onCancel={onCancelAddColumn}
            className="inline-name-form-row-header"
            inputClassName="board-row-title-input"
          />
        ) : (
          <button
            type="button"
            className="btn btn-compact"
            onClick={() => onStartAddColumn(row.id)}
          >
            <Plus size={14} /> ステータスを追加
          </button>
        )}
        <button
          type="button"
          className="action-btn"
          aria-label={`行「${row.title}」を削除`}
          onClick={() =>
            confirmAction(
              `「${row.title}」行を削除しますか？配下のすべてのタスクも削除されます。`,
              () => void onRemoveRow(row.id),
            )
          }
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
