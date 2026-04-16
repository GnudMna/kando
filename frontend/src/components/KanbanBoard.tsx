// かんばんボードのメインコンポーネント
// 行・カラム・タスクのレンダリング、ドラッグ＆ドロップ、各種操作ダイアログを管理する
import { useState, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { Plus, Trash2, LayoutTemplate, List } from 'lucide-react';
import { TaskCard } from './TaskCard';
import { TaskEditModal } from './TaskEditModal';
import { ConfirmDialog } from './ConfirmDialog';
import { ListView } from './ListView';
import { useBoard } from '../hooks/useBoard';
import type { Row, Task } from '../types';

// 現在編集中のタスクとそのカラム ID を保持する型
interface EditingTask {
  task: Task;
  colId: number;
}

// インライン編集中の行・カラムの ID とタイトルを保持する型
interface InlineEditState {
  id: number;
  title: string;
}

// 確認ダイアログの表示内容とコールバックを保持する型
interface ConfirmState {
  message: string;
  onConfirm: () => void;
}

/**
 * かんばんボードのメインコンポーネント。
 * 行・カラム・タスクのレンダリング、ドラッグ&ドロップ操作、カンバンビュー・リストビューの切り替え、
 * タスク編集モーダルおよび削除確認ダイアログの表示を管理する。
 */
export function KanbanBoard() {
  const {
    rows,
    addRow,
    renameRow,
    removeRow,
    addColumn,
    renameColumn,
    removeColumn,
    addTask,
    removeTask,
    updateTask,
    moveTask,
  } = useBoard();

  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [editingTask, setEditingTask] = useState<EditingTask | null>(null);
  // インライン編集中の行・カラムを管理する
  const [editingRow, setEditingRow] = useState<InlineEditState | null>(null);
  const [editingCol, setEditingCol] = useState<InlineEditState | null>(null);
  // 確認ダイアログの表示状態を管理する
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  /**
   * 確認ダイアログを表示するヘルパー。
   * @param message - 確認メッセージ
   * @param onConfirm - 確定時のコールバック
   */
  const confirmAction = useCallback((message: string, onConfirm: () => void) => {
    setConfirmState({ message, onConfirm });
  }, []);

  /**
   * 確認ダイアログの「削除する」ボタン押下時のハンドラー。
   * コールバックを実行してダイアログを閉じる。
   */
  const handleConfirm = useCallback(() => {
    confirmState?.onConfirm();
    setConfirmState(null);
  }, [confirmState]);

  /**
   * @hello-pangea/dnd のドラッグ終了イベントハンドラー。
   * ドロップ先が有効な場合のみタスク移動を実行する。
   * @param result - DnDライブラリから渡される DropResult
   */
  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      const { destination, source, draggableId } = result;
      if (!destination) return;
      if (
        destination.droppableId === source.droppableId &&
        destination.index === source.index
      ) return;

      const taskId = parseInt(draggableId.replace('task-', ''), 10);
      await moveTask(
        source.droppableId,
        destination.droppableId,
        source.index,
        destination.index,
        taskId
      );
    },
    [moveTask]
  );

  /**
   * 行追加ダイアログを表示して新しい行を作成する。
   */
  const handleAddRow = useCallback(async () => {
    const title = prompt('行のタイトルを入力してください');
    if (!title) return;
    await addRow(title);
  }, [addRow]);

  /**
   * カラム名入力ダイアログを表示して新しいカラムを追加する。
   * @param rowId - カラムを追加する行 ID
   */
  const handleAddColumn = useCallback(
    async (rowId: number) => {
      const title = prompt('ステータス名を入力してください');
      if (!title) return;
      await addColumn(rowId, title);
    },
    [addColumn]
  );

  /**
   * 行名インライン編集を確定する。内容が空の場合は保存しない。
   */
  const handleSaveRowTitle = useCallback(async () => {
    if (!editingRow) return;
    const title = editingRow.title.trim();
    if (title) await renameRow(editingRow.id, title);
    setEditingRow(null);
  }, [editingRow, renameRow]);

  /**
   * カラム名インライン編集を確定する。内容が空の場合は保存しない。
   */
  const handleSaveColTitle = useCallback(async () => {
    if (!editingCol) return;
    const title = editingCol.title.trim();
    if (title) await renameColumn(editingCol.id, title);
    setEditingCol(null);
  }, [editingCol, renameColumn]);

  /**
   * タスクを追加して編集モーダルを自動開く。
   * @param colId - タスクを追加するカラム ID
   * @param rowId - カラムが所属する行 ID
   */
  const handleAddTask = useCallback(
    async (colId: number, rowId: number) => {
      const newTask = await addTask(colId, rowId);
      if (newTask) setEditingTask({ task: newTask, colId });
    },
    [addTask]
  );

  /**
   * タスク削除ハンドラー。
   * @param colId - タスクが属するカラム ID
   * @param taskId - 削除するタスク ID
   */
  const handleDeleteTask = useCallback(
    async (colId: number, taskId: number) => {
      await removeTask(colId, taskId);
    },
    [removeTask]
  );

  const renderRowHeader = (row: Row) => (
    <div className="board-row-header">
      {editingRow?.id === row.id ? (
        <input
          autoFocus
          className="board-row-title-input"
          value={editingRow.title}
          onChange={(e) => setEditingRow({ ...editingRow, title: e.target.value })}
          onBlur={() => void handleSaveRowTitle()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSaveRowTitle();
            if (e.key === 'Escape') setEditingRow(null);
          }}
        />
      ) : (
        <span
          className="board-row-title"
          style={{ cursor: 'pointer' }}
          title="クリックして編集"
          onClick={() => setEditingRow({ id: row.id, title: row.title })}
        >
          {row.title}
        </span>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button
          className="btn"
          style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
          onClick={() => void handleAddColumn(row.id)}
        >
          <Plus size={14} /> ステータスを追加
        </button>
        <button className="action-btn" onClick={() =>
          confirmAction(`「${row.title}」行を削除しますか？配下のすべてのタスクも削除されます。`, () => void removeRow(row.id))
        }>
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="kanban-wrapper" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <button className="btn btn-primary" onClick={() => void handleAddRow()}>
          <Plus size={16} /> 行を追加
        </button>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={`btn ${viewMode === 'kanban' ? 'btn-primary' : ''}`}
            onClick={() => setViewMode('kanban')}
          >
            <LayoutTemplate size={16} /> かんばん
          </button>
          <button
            className={`btn ${viewMode === 'list' ? 'btn-primary' : ''}`}
            onClick={() => setViewMode('list')}
          >
            <List size={16} /> リスト
          </button>
        </div>
      </div>

      {viewMode === 'kanban' ? (
        <DragDropContext onDragEnd={(r) => void handleDragEnd(r)}>
          <div className="kanban-rows">
            {rows.map((row) => (
              <div key={row.id} className="board-row">
                {renderRowHeader(row)}
                <div className="board-row-columns">
                  {row.columns.map((column) => (
                    <div key={column.id} className="column-container">
                      <div className="column-header">
                        {editingCol?.id === column.id ? (
                          <input
                            autoFocus
                            className="column-title-input"
                            value={editingCol.title}
                            onChange={(e) =>
                              setEditingCol({ ...editingCol, title: e.target.value })
                            }
                            onBlur={() => void handleSaveColTitle()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void handleSaveColTitle();
                              if (e.key === 'Escape') setEditingCol(null);
                            }}
                          />
                        ) : (
                          <div
                            className="column-title"
                            style={{ cursor: 'pointer' }}
                            title="クリックして編集"
                            onClick={() =>
                              setEditingCol({ id: column.id, title: column.title })
                            }
                          >
                            {column.title}
                          </div>
                        )}
                        <button
                          className="action-btn"
                          onClick={() =>
                            confirmAction(
                              `「${column.title}」列を削除しますか？配下のすべてのタスクも削除されます。`,
                              () => void removeColumn(column.id)
                            )
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <Droppable droppableId={column.id.toString()} type="task">
                        {(provided) => (
                          <div
                            className="column-body"
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                          >
                            {column.tasks.map((task, index) => (
                              <Draggable
                                draggableId={`task-${task.id}`}
                                index={index}
                                key={`task-${task.id}`}
                              >
                                {(provided) => (
                                  <div
                                    className="task-card"
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                  >
                                    <TaskCard
                                      task={task}
                                      columnId={column.id}
                                      onDeleteTask={handleDeleteTask}
                                      onTaskUpdated={updateTask}
                                      onEditTask={(t) => setEditingTask({ task: t, colId: column.id })}
                                    />
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                      <div className="column-add-task">
                        <button
                          className="btn"
                          onClick={() => void handleAddTask(column.id, row.id)}
                          style={{ width: '100%', justifyContent: 'center' }}
                        >
                          <Plus size={16} /> タスクを追加
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DragDropContext>
      ) : (
        <ListView
          rows={rows}
          onRowHeaderRender={renderRowHeader}
          onTaskClick={(task, colId) => setEditingTask({ task, colId })}
          onDeleteTask={handleDeleteTask}
          onAddTask={handleAddTask}
        />
      )}

      {editingTask && (
        <TaskEditModal
          task={editingTask.task}
          onClose={() => setEditingTask(null)}
          onTaskUpdated={(updatedTask) => {
            updateTask(updatedTask);
            setEditingTask(null);
          }}
        />
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
