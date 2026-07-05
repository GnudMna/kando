import type { ReactNode, RefObject } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import type { Row, Task } from "../../types";
import type { DueHighlightResult } from "../../utils/dueDate";
import { isE2eTestMode } from "../../utils/e2e";
import { BoardColumn } from "./BoardColumn";
import { BoardRowHeader } from "./BoardRowHeader";
import type { InlineEditState } from "./types";

interface KanbanRowsViewProps {
  rows: Row[];
  dragSurfaceRef: RefObject<HTMLDivElement | null>;
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

type KanbanRowBlockProps = {
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
  onRenameColumn: (colId: number, title: string) => Promise<void>;
  onRemoveColumn: (colId: number) => Promise<void>;
  onAddTask: (colId: number, rowId: number) => Promise<void>;
  onDeleteTask: (colId: number, taskId: number) => Promise<void>;
  onCopyTask: (colId: number, taskId: number) => Promise<void>;
  onTaskUpdated: (task: Task) => void;
  onEditTask: (task: Task, colId: number) => void;
  taskDueHighlights: Map<number, DueHighlightResult>;
  dueSoonDays: number;
};

/**
 * 1行分のかんばんブロックを描画する。
 */
function KanbanRowBlock({
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
  onRenameColumn,
  onRemoveColumn,
  onAddTask,
  onDeleteTask,
  onCopyTask,
  onTaskUpdated,
  onEditTask,
  taskDueHighlights,
  dueSoonDays,
}: KanbanRowBlockProps) {
  return (
    <div className="board-row">
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
  );
}

/**
 * かんばん表示(行・カラム・タスクの DnD)を行単位仮想スクロールで描画する。
 * @param props - `KanbanRowsViewProps`(同ファイル interface を参照)
 * @returns かんばん行ビューの JSX 要素
 */
export function KanbanRowsView({
  rows,
  dragSurfaceRef,
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
  const rowBlockProps: Omit<KanbanRowBlockProps, "row"> = {
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
  };

  const dragContext = (content: ReactNode) => (
    <DragDropContext
      onBeforeDragStart={() => {
        dragSurfaceRef.current?.classList.add("is-dragging");
      }}
      onDragEnd={(result) => {
        dragSurfaceRef.current?.classList.remove("is-dragging");
        void onDragEnd(result);
      }}
    >
      {content}
    </DragDropContext>
  );

  if (isE2eTestMode) {
    return dragContext(
      <div className="kanban-rows">
        {rows.map((row) => (
          <KanbanRowBlock key={row.id} row={row} {...rowBlockProps} />
        ))}
      </div>,
    );
  }

  return (
    <VirtualizedKanbanRows
      rows={rows}
      rowBlockProps={rowBlockProps}
      dragSurfaceRef={dragSurfaceRef}
      onDragEnd={onDragEnd}
    />
  );
}

function VirtualizedKanbanRows({
  rows,
  rowBlockProps,
  dragSurfaceRef,
  onDragEnd,
}: {
  rows: Row[];
  rowBlockProps: Omit<KanbanRowBlockProps, "row">;
  dragSurfaceRef: RefObject<HTMLDivElement | null>;
  onDragEnd: (result: DropResult) => Promise<void>;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    if (listRef.current) {
      setScrollMargin(listRef.current.offsetTop);
    }
  }, [rows.length]);

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => 360,
    overscan: 2,
    scrollMargin,
    measureElement: (element) => element.getBoundingClientRect().height,
  });

  const prevRowCountRef = useRef(rows.length);
  useEffect(() => {
    if (rows.length > prevRowCountRef.current) {
      virtualizer.scrollToIndex(rows.length - 1, { align: "start" });
    }
    prevRowCountRef.current = rows.length;
  }, [rows.length, virtualizer]);

  return (
    <DragDropContext
      onBeforeDragStart={() => {
        dragSurfaceRef.current?.classList.add("is-dragging");
      }}
      onDragEnd={(result) => {
        dragSurfaceRef.current?.classList.remove("is-dragging");
        void onDragEnd(result);
      }}
    >
      <div
        ref={listRef}
        className="kanban-rows kanban-rows-virtual"
        style={{ height: virtualizer.getTotalSize(), position: "relative" }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index];
          return (
            <div
              key={row.id}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <KanbanRowBlock row={row} {...rowBlockProps} />
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}
