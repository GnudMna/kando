import { lazy, Suspense, useRef } from "react";
import { useBoard } from "../hooks/useBoard";
import { useKanbanBoardState } from "../hooks/useKanbanBoardState";
import { BoardToolbar } from "./kanban/BoardToolbar";
import { BoardEmptyState } from "./kanban/BoardEmptyState";
import { KanbanRowsView } from "./kanban/KanbanRowsView";
import { BoardLoadMore } from "./kanban/BoardLoadMore";
import { ConfirmDialog } from "./ConfirmDialog";

const TaskEditModal = lazy(() =>
  import("./TaskEditModal").then((m) => ({ default: m.TaskEditModal })),
);
const ListView = lazy(() =>
  import("./ListView").then((m) => ({ default: m.ListView })),
);

/**
 * かんばんボードのメインコンポーネント。
 * 行・カラム・タスクのレンダリング、ドラッグ&ドロップ操作、カンバンビュー・リストビューの切り替え、
 * タスク編集モーダルおよび削除確認ダイアログの表示を管理する。
 * @returns かんばんボード UI の JSX 要素
 */
export function KanbanBoard() {
  const board = useBoard();
  const { isLoading, hasMore, isLoadingMore, loadMoreRows, rows } = board;
  const boardWrapperRef = useRef<HTMLDivElement>(null);
  const {
    isAddingRow,
    newRowTitle,
    setNewRowTitle,
    submitAddRow,
    cancelAddRow,
    startAddRow,
    searchQuery,
    setSearchQuery,
    isSearchActive,
    dueSoonDays,
    setDueSoonDays,
    boardStats,
    matchedTaskCount,
    isDeferredSearchActive,
    isSearchLoading,
    activeViewMode,
    setViewMode,
    activeRows,
    editingRow,
    setEditingRow,
    handleSaveRowTitle,
    addingColumnRowId,
    newColumnTitle,
    setNewColumnTitle,
    submitAddColumn,
    cancelAddColumn,
    startAddColumn,
    removeRow,
    confirmAction,
    renameColumn,
    removeColumn,
    handleAddTask,
    handleDeleteTask,
    handleCopyTask,
    handleEditTask,
    updateTask,
    patchTask,
    handleDragEnd,
    taskDueHighlights,
    editingTask,
    handleCloseTaskModal,
    handleCreateTask,
    confirmState,
    setConfirmState,
    handleConfirm,
    renderRowHeader,
  } = useKanbanBoardState(board);

  if (isLoading) {
    return <div className="kanban-wrapper kanban-loading">読み込み中…</div>;
  }

  return (
    <div className="kanban-wrapper" ref={boardWrapperRef}>
      <BoardToolbar
        isAddingRow={isAddingRow}
        newRowTitle={newRowTitle}
        onNewRowTitleChange={setNewRowTitle}
        onSubmitAddRow={() => void submitAddRow()}
        onCancelAddRow={cancelAddRow}
        onStartAddRow={startAddRow}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        isSearchActive={isSearchActive}
        dueSoonDays={dueSoonDays}
        onDueSoonDaysChange={setDueSoonDays}
        boardStats={boardStats}
        matchedTaskCount={matchedTaskCount}
        isDeferredSearchActive={isDeferredSearchActive}
        activeViewMode={activeViewMode}
        onViewModeChange={setViewMode}
      />

      {rows.length === 0 ? (
        <BoardEmptyState
          variant="no-rows"
          isAddingRow={isAddingRow}
          newRowTitle={newRowTitle}
          onNewRowTitleChange={setNewRowTitle}
          onSubmitAddRow={() => void submitAddRow()}
          onCancelAddRow={cancelAddRow}
          onStartAddRow={startAddRow}
          onClearSearch={() => setSearchQuery("")}
        />
      ) : activeRows.length === 0 && isSearchLoading ? (
        <div className="kanban-wrapper kanban-loading">検索中…</div>
      ) : activeRows.length === 0 ? (
        <BoardEmptyState
          variant="no-search-results"
          isAddingRow={isAddingRow}
          newRowTitle={newRowTitle}
          onNewRowTitleChange={setNewRowTitle}
          onSubmitAddRow={() => void submitAddRow()}
          onCancelAddRow={cancelAddRow}
          onStartAddRow={startAddRow}
          onClearSearch={() => setSearchQuery("")}
        />
      ) : activeViewMode === "kanban" ? (
        <KanbanRowsView
          rows={activeRows}
          dragSurfaceRef={boardWrapperRef}
          onDragEnd={handleDragEnd}
          editingRow={editingRow}
          onEditingRowChange={setEditingRow}
          onSaveRowTitle={handleSaveRowTitle}
          addingColumnRowId={addingColumnRowId}
          newColumnTitle={newColumnTitle}
          onNewColumnTitleChange={setNewColumnTitle}
          onSubmitAddColumn={() => void submitAddColumn()}
          onCancelAddColumn={cancelAddColumn}
          onStartAddColumn={startAddColumn}
          onRemoveRow={removeRow}
          confirmAction={confirmAction}
          onRenameColumn={renameColumn}
          onRemoveColumn={removeColumn}
          onAddTask={handleAddTask}
          onDeleteTask={handleDeleteTask}
          onCopyTask={handleCopyTask}
          onTaskUpdated={updateTask}
          onTaskPatched={patchTask}
          onEditTask={handleEditTask}
          taskDueHighlights={taskDueHighlights}
          dueSoonDays={dueSoonDays}
        />
      ) : (
        <Suspense fallback={null}>
          <ListView
            rows={activeRows}
            taskDueHighlights={taskDueHighlights}
            onRowHeaderRender={renderRowHeader}
            onTaskClick={handleEditTask}
            onDeleteTask={handleDeleteTask}
            onAddTask={handleAddTask}
          />
        </Suspense>
      )}

      {hasMore && rows.length > 0 && !isSearchActive && (
        <BoardLoadMore
          isLoadingMore={isLoadingMore}
          onLoadMore={() => void loadMoreRows()}
        />
      )}

      {editingTask && (
        <Suspense fallback={null}>
          <TaskEditModal
            task={editingTask.task}
            onClose={handleCloseTaskModal}
            onTaskUpdated={updateTask}
            onCreate={editingTask.isNew ? handleCreateTask : undefined}
          />
        </Suspense>
      )}

      {confirmState && (
        <ConfirmDialog
          message={confirmState.message}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </div>
  );
}
