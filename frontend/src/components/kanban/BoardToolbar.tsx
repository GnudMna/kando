import { useId } from "react";
import {
  Plus,
  LayoutTemplate,
  List,
  Search,
  X,
} from "lucide-react";
import { InlineNameForm } from "./InlineNameForm";
import { MAX_DUE_SOON_DAYS, normalizeDueSoonDays } from "./constants";

interface BoardToolbarProps {
  isAddingRow: boolean;
  newRowTitle: string;
  onNewRowTitleChange: (value: string) => void;
  onSubmitAddRow: () => void;
  onCancelAddRow: () => void;
  onStartAddRow: () => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  isSearchActive: boolean;
  dueSoonDays: number;
  onDueSoonDaysChange: (value: number) => void;
  boardStats: { rows: number; columns: number; tasks: number };
  matchedTaskCount: number;
  isDeferredSearchActive: boolean;
  activeViewMode: "kanban" | "list";
  onViewModeChange: (mode: "kanban" | "list") => void;
}

/**
 * ボード上部のツールバー（行追加・検索・統計・表示切替）を描画する。
 */
export function BoardToolbar({
  isAddingRow,
  newRowTitle,
  onNewRowTitleChange,
  onSubmitAddRow,
  onCancelAddRow,
  onStartAddRow,
  searchQuery,
  onSearchQueryChange,
  isSearchActive,
  dueSoonDays,
  onDueSoonDaysChange,
  boardStats,
  matchedTaskCount,
  isDeferredSearchActive,
  activeViewMode,
  onViewModeChange,
}: BoardToolbarProps) {
  const taskSearchInputId = useId();
  const dueSoonDaysInputId = useId();

  return (
    <div className="board-toolbar">
      {isAddingRow ? (
        <InlineNameForm
          label="行のタイトル"
          placeholder="行のタイトルを入力"
          value={newRowTitle}
          onChange={onNewRowTitleChange}
          onSubmit={onSubmitAddRow}
          onCancel={onCancelAddRow}
          className="inline-name-form-toolbar"
        />
      ) : (
        <button type="button" className="btn btn-primary" onClick={onStartAddRow}>
          <Plus size={16} /> 行を追加
        </button>
      )}

      <div className="board-toolbar-right">
        <div className="task-search" role="search">
          <label htmlFor={taskSearchInputId} className="task-search-label">
            タスク検索
          </label>
          <div className="task-search-input-wrap">
            <Search size={14} className="task-search-icon" />
            <input
              id={taskSearchInputId}
              type="search"
              className="task-search-input"
              placeholder="タスク名・サブタスク・コメントで検索"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.currentTarget.value)}
            />
            {isSearchActive && (
              <button
                type="button"
                className="task-search-clear"
                onClick={() => onSearchQueryChange("")}
                aria-label="検索キーワードをクリア"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="due-soon-setting">
          <label htmlFor={dueSoonDaysInputId} className="due-soon-label">
            期限間近の強調
          </label>
          <div className="due-soon-input-wrap">
            <input
              id={dueSoonDaysInputId}
              type="number"
              min={0}
              max={MAX_DUE_SOON_DAYS}
              step={1}
              className="due-soon-input"
              value={dueSoonDays}
              onChange={(e) => {
                const next = e.currentTarget.valueAsNumber;
                if (Number.isNaN(next)) return;
                onDueSoonDaysChange(normalizeDueSoonDays(next));
              }}
            />
            <span className="due-soon-unit">日以内</span>
          </div>
        </div>

        <div className="board-stats" aria-label="ボード統計">
          <span className="stat-pill">
            <strong>{boardStats.rows}</strong> 行
          </span>
          <span className="stat-pill">
            <strong>{boardStats.columns}</strong> 列
          </span>
          <span className="stat-pill">
            <strong>{boardStats.tasks}</strong> タスク
          </span>
          {isDeferredSearchActive && (
            <span className="stat-pill">
              <strong>{matchedTaskCount}</strong> 件ヒット
            </span>
          )}
        </div>

        <div className="view-switch" role="tablist" aria-label="表示モード">
          <button
            type="button"
            className={`btn btn-toggle ${activeViewMode === "kanban" ? "btn-primary" : ""}`}
            onClick={() => onViewModeChange("kanban")}
            aria-pressed={activeViewMode === "kanban"}
            disabled={isSearchActive}
            title={
              isSearchActive
                ? "検索中はリスト表示のみ利用できます"
                : undefined
            }
          >
            <LayoutTemplate size={16} /> かんばん
          </button>
          <button
            type="button"
            className={`btn btn-toggle ${activeViewMode === "list" ? "btn-primary" : ""}`}
            onClick={() => onViewModeChange("list")}
            aria-pressed={activeViewMode === "list"}
          >
            <List size={16} /> リスト
          </button>
        </div>

        {isSearchActive && (
          <p className="task-search-hint">
            検索中は並び順の整合性のためリスト表示に切り替わります。
          </p>
        )}
      </div>
    </div>
  );
}
