/** 行・カラム追加用インラインフォームの props。 */
export interface InlineNameFormProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  className?: string;
  inputClassName?: string;
}

/**
 * 行・カラム追加用のインライン入力フォーム。
 * @param props - フォーム props
 * @returns インライン入力フォームの JSX 要素
 */
export function InlineNameForm({
  label,
  placeholder,
  value,
  onChange,
  onSubmit,
  onCancel,
  className,
  inputClassName = "inline-name-input",
}: InlineNameFormProps) {
  const trimmed = value.trim();

  return (
    <form
      className={
        className ? `inline-name-form ${className}` : "inline-name-form"
      }
      onSubmit={(e) => {
        e.preventDefault();
        if (trimmed) onSubmit();
      }}
    >
      <input
        autoFocus
        type="text"
        className={inputClassName}
        placeholder={placeholder}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
      />
      <div className="inline-name-form-actions">
        <button
          type="submit"
          className="btn btn-primary btn-compact"
          disabled={!trimmed}
        >
          追加
        </button>
        <button type="button" className="btn btn-compact" onClick={onCancel}>
          キャンセル
        </button>
      </div>
    </form>
  );
}
