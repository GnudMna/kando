import type { RefObject } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import type { Row, Task } from "../../types";
import type { DueHighlightResult } from "../../utils/dueDate";
import { BoardColumn } from "./BoardColumn";
import { BoardRowHeader } from "./BoardRowHeader";
import type { InlineEditState } from "./types";

interface KanbanRowsViewProps {
  rows: Row[];
  boardWrapperRef: RefObject<HTMLDivElement | null>;
  onDragEnd: (result: DropResult) => Promise<void>;
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
  onRenameColumn: (colId: number, title: string) => Promise<void>;
  onRemoveColumn: (colId: number) => Promise<void>;
  onAddTask: (colId: number, rowId: number) => Promise<void>;
  onDeleteTask: (colId: number, taskId: number) => Promise<void>;
  onCopyTask: (colId: number, taskId: number) => Promise<void>;
  onTaskUpdated: (task: Task) => void;
  onEditTask: (task: Task, colId: number) => void;
  taskDueHighlights: Map<number, DueHighlightResult>;
  dueSoonDays: number;
}

/**
 * かんばん表示（行・カラム・タスクの DnD）を描画する。
 */
export function KanbanRowsView({
  rows,
  boardWrapperRef,
  onDragEnd,
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
  onRenameColumn,
  onRemoveColumn,
  onAddTask,
  onDeleteTask,
  onCopyTask,
  onTaskUpdated,
  onEditTask,
  taskDueHighlights,
  dueSoonDays,
}: KanbanRowsViewProps) {
  return (
    <DragDropContext
      onBeforeDragStart={() => {
        boardWrapperRef.current?.classList.add("is-dragging");
      }}
      onDragEnd={(result) => {
        boardWrapperRef.current?.classList.remove("is-dragging");
        void onDragEnd(result);
      }}
    >
      <div className="kanban-rows">
        {rows.map((row) => (
          <div key={row.id} className="board-row">
            <BoardRowHeader
              row={row}
              editingRow={editingRow}
              onEditingRowChange={onEditingRowChange}
              onSaveRowTitle={onSaveRowTitle}
              addingColumnRowId={addingColumnRowId}
              newColumnTitle={newColumnTitle}
              onNewColumnTitleChange={onNewColumnTitleChange}
              onSubmitAddColumn={onSubmitAddColumn}
              onCancelAddColumn={onCancelAddColumn}
              onStartAddColumn={onStartAddColumn}
              onRemoveRow={onRemoveRow}
              confirmAction={confirmAction}
            />
            <Droppable
              droppableId={`row-${row.id}`}
              type="column"
              direction="horizontal"
            >
              {(colsProvided) => (
                <div
                  className="board-row-columns"
                  ref={colsProvided.innerRef}
                  {...colsProvided.droppableProps}
                >
                  {row.columns.map((column, colIndex) => (
                    <Draggable
                      key={column.id}
                      draggableId={`col-${column.id}`}
                      index={colIndex}
                    >
                      {(colProvided) => (
                        <BoardColumn
                          column={column}
                          rowId={row.id}
                          colProvided={colProvided}
                          onRenameColumn={onRenameColumn}
                          onRemoveColumn={onRemoveColumn}
                          onAddTask={onAddTask}
                          onDeleteTask={onDeleteTask}
                          onCopyTask={onCopyTask}
                          onTaskUpdated={onTaskUpdated}
                          onEditTask={onEditTask}
                          taskDueHighlights={taskDueHighlights}
                          dueSoonDays={dueSoonDays}
                          confirmAction={confirmAction}
                        />
                      )}
                    </Draggable>
                  ))}
                  {colsProvided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
}
