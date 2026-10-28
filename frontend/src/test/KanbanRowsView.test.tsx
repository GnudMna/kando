import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { KanbanRowsView } from "../components/kanban/KanbanRowsView";
import { createQueryWrapper, sampleBoardRows } from "./testUtils";

vi.stubEnv("VITE_E2E_TEST", "true");

describe("KanbanRowsView", () => {
  const dragSurfaceRef = createRef<HTMLDivElement>();
  const noopAsync = vi.fn().mockResolvedValue(undefined);
  const confirmAction = vi.fn((_message: string, onConfirm: () => void) =>
    onConfirm(),
  );

  const defaultProps = {
    rows: structuredClone(sampleBoardRows),
    dragSurfaceRef,
    onDragEnd: noopAsync,
    editingRow: null,
    onEditingRowChange: vi.fn(),
    onSaveRowTitle: noopAsync,
    addingColumnRowId: null,
    newColumnTitle: "",
    onNewColumnTitleChange: vi.fn(),
    onSubmitAddColumn: vi.fn(),
    onCancelAddColumn: vi.fn(),
    onStartAddColumn: vi.fn(),
    onRemoveRow: noopAsync,
    confirmAction,
    onRenameColumn: noopAsync,
    onRemoveColumn: noopAsync,
    onAddTask: noopAsync,
    onDeleteTask: noopAsync,
    onCopyTask: noopAsync,
    onTaskUpdated: vi.fn(),
    onTaskPatched: vi.fn(),
    onEditTask: vi.fn(),
    taskDueHighlights: new Map(),
    dueSoonDays: 3,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("行・カラム・タスクを描画する", () => {
    render(<KanbanRowsView {...defaultProps} />, {
      wrapper: createQueryWrapper(),
    });

    expect(screen.getByText("行1")).toBeInTheDocument();
    expect(screen.getByText("行2")).toBeInTheDocument();
    expect(screen.getByText("カラム1")).toBeInTheDocument();
    expect(screen.getByText("テストタスク")).toBeInTheDocument();
  });

  it("行が空の場合は何も描画しない", () => {
    render(<KanbanRowsView {...defaultProps} rows={[]} />, {
      wrapper: createQueryWrapper(),
    });

    expect(screen.queryByText("行1")).not.toBeInTheDocument();
  });
});
