// useBoard カスタムフックのユニットテスト
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useBoard } from '../hooks/useBoard';
import * as api from '../api/boardApi';
import type { Row, Task } from '../types';

vi.mock('../api/boardApi');

const taskA: Task = {
  id: 1,
  column_id: 10,
  content: 'タスクA',
  position: 1000,
  subtasks: [],
  checklists: [],
};

const sampleRows: Row[] = [
  {
    id: 1,
    title: '行1',
    position: 1000,
    columns: [
      { id: 10, row_id: 1, title: 'カラム1', position: 1000, tasks: [taskA] },
      { id: 11, row_id: 1, title: 'カラム2', position: 2000, tasks: [] },
    ],
  },
  {
    id: 2,
    title: '行2',
    position: 2000,
    columns: [
      { id: 20, row_id: 2, title: 'カラム3', position: 1000, tasks: [] },
    ],
  },
];

describe('useBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchBoard).mockResolvedValue(structuredClone(sampleRows));
  });

  it('マウント時にボードデータを読み込むこと', async () => {
    const { result } = renderHook(() => useBoard());
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.rows).toHaveLength(2);
    expect(api.fetchBoard).toHaveBeenCalledTimes(1);
  });

  it('fetchBoard が失敗した場合 operationError がセットされること', async () => {
    vi.mocked(api.fetchBoard).mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useBoard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.operationError).toBe('ボードの読み込みに失敗しました');
  });

  it('clearError で operationError がクリアされること', async () => {
    vi.mocked(api.fetchBoard).mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useBoard());
    await waitFor(() => expect(result.current.operationError).not.toBeNull());
    act(() => result.current.clearError());
    expect(result.current.operationError).toBeNull();
  });

  it('addRow が行と 3 つのデフォルトカラムを追加すること', async () => {
    const newRow: Row = {
      id: 99,
      title: '新しい行',
      position: 3000,
      columns: [
        { id: 31, row_id: 99, title: '未着手', position: 1000, tasks: [] },
        { id: 32, row_id: 99, title: '進行中', position: 2000, tasks: [] },
        { id: 33, row_id: 99, title: '完了', position: 3000, tasks: [] },
      ],
    };
    vi.mocked(api.createRowWithDefaultColumns).mockResolvedValue(newRow);

    const { result } = renderHook(() => useBoard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.addRow('新しい行');
    });

    const addedRow = result.current.rows.find((r) => r.id === 99);
    expect(addedRow).toBeDefined();
    expect(addedRow?.columns).toHaveLength(3);
    expect(addedRow?.columns[0].title).toBe('未着手');
    expect(api.createRowWithDefaultColumns).toHaveBeenCalledWith('新しい行', 3000);
    expect(api.createColumn).not.toHaveBeenCalled();
  });

  it('addRow が失敗した場合 operationError がセットされること', async () => {
    vi.mocked(api.createRowWithDefaultColumns).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useBoard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.addRow('エラー行'); });
    expect(result.current.operationError).toBe('行の追加に失敗しました');
  });

  it('renameRow が rows 内のタイトルを更新すること', async () => {
    vi.mocked(api.updateRow).mockResolvedValue({ id: 1, title: '行1-改', position: 1000, columns: [] });
    const { result } = renderHook(() => useBoard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.renameRow(1, '行1-改'); });
    expect(result.current.rows[0].title).toBe('行1-改');
  });

  it('removeRow が rows から行を削除すること', async () => {
    vi.mocked(api.deleteRow).mockResolvedValue();
    const { result } = renderHook(() => useBoard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.removeRow(1); });
    expect(result.current.rows.find((r) => r.id === 1)).toBeUndefined();
    expect(result.current.rows).toHaveLength(1);
  });

  it('addColumn が指定行にカラムを追加すること', async () => {
    const newCol = { id: 99, row_id: 1, title: '新カラム', position: 3000, tasks: [] };
    vi.mocked(api.createColumn).mockResolvedValue(newCol);
    const { result } = renderHook(() => useBoard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.addColumn(1, '新カラム'); });
    const row = result.current.rows.find((r) => r.id === 1);
    expect(row?.columns).toHaveLength(3);
    expect(row?.columns[2].title).toBe('新カラム');
  });

  it('renameColumn がカラムタイトルを更新すること', async () => {
    vi.mocked(api.updateColumn).mockResolvedValue({ id: 10, row_id: 1, title: 'カラム1-改', position: 1000, tasks: [] });
    const { result } = renderHook(() => useBoard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.renameColumn(10, 'カラム1-改'); });
    const col = result.current.rows[0].columns.find((c) => c.id === 10);
    expect(col?.title).toBe('カラム1-改');
  });

  it('removeColumn がカラムを削除すること', async () => {
    vi.mocked(api.deleteColumn).mockResolvedValue();
    const { result } = renderHook(() => useBoard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.removeColumn(10); });
    const row = result.current.rows.find((r) => r.id === 1);
    expect(row?.columns.find((c) => c.id === 10)).toBeUndefined();
    expect(row?.columns).toHaveLength(1);
  });

  it('removeTask がタスクを削除すること', async () => {
    vi.mocked(api.deleteTask).mockResolvedValue();
    const { result } = renderHook(() => useBoard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.removeTask(10, 1); });
    const col = result.current.rows[0].columns.find((c) => c.id === 10);
    expect(col?.tasks).toHaveLength(0);
  });

  it('updateTask が tasks 内の該当タスクを置き換えること', async () => {
    const { result } = renderHook(() => useBoard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const updated = { ...taskA, content: '更新後のタスク' };
    act(() => result.current.updateTask(updated));
    const col = result.current.rows[0].columns.find((c) => c.id === 10);
    expect(col?.tasks[0].content).toBe('更新後のタスク');
  });

  it('moveTask が同一カラム内でタスクを並び替えること', async () => {
    const taskB: Task = { id: 2, column_id: 10, content: 'タスクB', position: 2000, subtasks: [], checklists: [] };
    vi.mocked(api.fetchBoard).mockResolvedValue([
      {
        id: 1, title: '行1', position: 1000,
        columns: [
          { id: 10, row_id: 1, title: 'カラム1', position: 1000, tasks: [taskA, taskB] },
        ],
      },
    ]);
    vi.mocked(api.moveTask).mockResolvedValue({ ...taskA, position: 3000 });
    const { result } = renderHook(() => useBoard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.moveTask('10', '10', 0, 1, 1);
    });

    const tasks = result.current.rows[0].columns[0].tasks;
    // タスクBが先頭、タスクAが後ろ
    expect(tasks[0].id).toBe(2);
    expect(tasks[1].id).toBe(1);
    // taskA の新 position は taskB(2000) + POSITION_GAP(1000) = 3000
    expect(tasks[1].position).toBe(3000);
    expect(api.moveTask).toHaveBeenCalledWith(1, 10, 3000);
  });

  it('moveTask が異なるカラム間でタスクを移動すること', async () => {
    vi.mocked(api.moveTask).mockResolvedValue({ ...taskA, column_id: 11, position: 1000 });
    const { result } = renderHook(() => useBoard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.moveTask('10', '11', 0, 0, 1);
    });

    const srcCol = result.current.rows[0].columns.find((c) => c.id === 10);
    const dstCol = result.current.rows[0].columns.find((c) => c.id === 11);
    expect(srcCol?.tasks).toHaveLength(0);
    expect(dstCol?.tasks).toHaveLength(1);
    expect(dstCol?.tasks[0].id).toBe(1);
    expect(dstCol?.tasks[0].column_id).toBe(11);
    // 移動先が空なので position = POSITION_GAP = 1000
    expect(dstCol?.tasks[0].position).toBe(1000);
    expect(api.moveTask).toHaveBeenCalledWith(1, 11, 1000);
  });
});
