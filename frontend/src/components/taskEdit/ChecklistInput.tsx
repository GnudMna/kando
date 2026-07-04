interface ChecklistInputProps {
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  onCancel: () => void;
}

/**
 * チェックリスト項目の入力フォームコンポーネント。
 * Enter キーで追加、Escape キーでキャンセルできる。
 */
export function ChecklistInput({
  value,
  onChange,
  onAdd,
  onCancel,
}: ChecklistInputProps) {
  return (
    <div className="add-sub-form" style={{ marginTop: "0.5rem" }}>
      <input
        autoFocus
        placeholder="チェック項目..."
        className="task-content-input"
        style={{ fontSize: "0.85rem", padding: "0.35rem" }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onAdd();
          if (e.key === "Escape") onCancel();
        }}
      />
      <div className="form-actions">
        <button
          type="button"
          className="btn btn-primary"
          style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
          onClick={onAdd}
        >
          追加
        </button>
        <button
          type="button"
          className="btn"
          style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
          onClick={onCancel}
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
