// タスク編集モーダルコンポーネント
// タスク内容・チェックリスト・サブタスクの編集を行い、保存時に API へまとめて反映する
import { useId, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, Plus, CheckSquare, Square, CornerDownRight, GripVertical } from 'lucide-react';
import type { Task, LocalTask, LocalSubtask, LocalChecklistItem, TempId } from '../types';
import * as api from '../api/boardApi';

// 一時的な新規レコード用 ID のカウンター
let _tempId = 0;
/**
 * 一時的な新規レコード用 ID を生成する。
 * DB 保存前の項目に付与するために使用する。
 * @returns "__new__{n}" 形式の一意な文字列 ID
 */
function tempId(): TempId {
  return `__new__${++_tempId}` as TempId;
}
/**
 * 値が一時 ID（まだ DB 保存前）かどうかを判定する型ガード。
 * @param id - 検査する ID
 * @returns 一時 ID の場合 true（id は TempId に絞り込まれる）
 */
function isTemp(id: number | TempId): id is TempId {
  return typeof id === 'string';
}

interface Props {
  task: Task;
  onClose: (reason: 'saved' | 'dismiss') => void;
  onTaskUpdated: (task: Task) => void;
}

export function TaskEditModal({ task, onClose, onTaskUpdated }: Props) {
  // モーダル内のローカル編集状態（保存前は外部に影響しない）
  const [localTask, setLocalTask] = useState<LocalTask>(() =>
    structuredClone(task) as LocalTask
  );
  // 削除対象のサブタスク・チェックリストIDを保存しておき、保存時にまとめて削除する
  // 一時IDの項目はサーバーに存在しないため含まれない（常に number）
  const [deletedSubtaskIds, setDeletedSubtaskIds] = useState<number[]>([]);
  const [deletedChecklistIds, setDeletedChecklistIds] = useState<number[]>([]);
  // サブタスクのインライン編集状態
  const [editingSubtaskId, setEditingSubtaskId] = useState<number | TempId | null>(null);
  const [editingSubtaskContent, setEditingSubtaskContent] = useState('');
  // サブタスク追加フォームの表示状態と入力値
  const [newSubtaskContent, setNewSubtaskContent] = useState('');
  const [addingSubtask, setAddingSubtask] = useState(false);
  // チェックリスト追加フォームの表示状態（'task' | subtaskId | null）
  const [addingChecklist, setAddingChecklist] = useState<'task' | number | TempId | null>(null);
  // チェックリストドラッグ状態：親キー（'task' または subtaskId）とインデックス
  const dragState = useRef<{ parentKey: 'task' | number | TempId; index: number } | null>(null);
  const [dragOverKey, setDragOverKey] = useState<{ parentKey: 'task' | number | TempId; index: number } | null>(null);
  const [newChecklistContent, setNewChecklistContent] = useState('');
  // 保存中エラーとローディング状態
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const modalTitleId = useId();
  const taskContentInputId = useId();

  /**
   * ローカルの編集内容を API に保存してモーダルを閉じる。
   * 区別 API: タスク内容の変更、サブタスク・チェックリストの新規作成・更新・削除。
   * 失敗時はエラーメッセージを表示する。
   */
  const saveAndClose = async () => {
    setSaveError(null);
    setIsSaving(true);
    try {
      const final: LocalTask = structuredClone(localTask) as LocalTask;

      // タスク内容が変更されていれば更新する
      if (final.content !== task.content) {
        await api.updateTask(task.id, final.content);
      }

      // 削除対象のサブタスク・チェックリストを並行削除する
      await Promise.all([
        ...deletedSubtaskIds.map((id) => api.deleteSubtask(id)),
        ...deletedChecklistIds.map((id) => api.deleteChecklistItem(id)),
      ]);

      // サブタスクを保存する（一時IDのものは新規作成、既存は内容変更時のみ更新）
      for (let i = 0; i < final.subtasks.length; i++) {
        const sub = final.subtasks[i];
        if (isTemp(sub.id)) {
          const created = await api.createSubtask(task.id, sub.content);
          final.subtasks[i] = { ...sub, id: created.id, task_id: task.id };
        } else {
          const orig = task.subtasks.find((s) => s.id === sub.id);
          if (orig && orig.content !== sub.content) {
            await api.updateSubtask(sub.id, sub.content);
          }
        }
      }

      // タスク直下のチェックリストを保存する
      for (let i = 0; i < final.checklists.length; i++) {
        const c = final.checklists[i];
        const expectedPosition = (i + 1) * 1000;
        if (isTemp(c.id)) {
          const created = await api.createChecklistItem(c.content, task.id, null);
          // 作成後に position を確定値に更新する
          if (created.position !== expectedPosition) {
            await api.updateChecklistItem(created.id, { position: expectedPosition });
            created.position = expectedPosition;
          }
          final.checklists[i] = { ...c, id: created.id, position: created.position };
        } else {
          const orig = task.checklists.find((oc) => oc.id === c.id);
          const patch: { completed?: boolean; position?: number } = {};
          if (orig && orig.completed !== c.completed) patch.completed = c.completed;
          if (orig && orig.position !== expectedPosition) patch.position = expectedPosition;
          if (Object.keys(patch).length > 0) {
            await api.updateChecklistItem(c.id as number, patch);
          }
        }
      }

      // サブタスク配下のチェックリストを保存する
      // この時点で全サブタスクは DB に保存済みのため sub.id は number
      for (let i = 0; i < final.subtasks.length; i++) {
        const sub = final.subtasks[i];
        const subId = sub.id as number;
        const origSub = task.subtasks.find((s) => s.id === subId) ?? null;
        for (let j = 0; j < sub.checklists.length; j++) {
          const c = sub.checklists[j];
          const expectedPosition = (j + 1) * 1000;
          if (isTemp(c.id)) {
            const created = await api.createChecklistItem(c.content, null, subId);
            if (created.position !== expectedPosition) {
              await api.updateChecklistItem(created.id, { position: expectedPosition });
              created.position = expectedPosition;
            }
            final.subtasks[i].checklists[j] = { ...c, id: created.id, position: created.position };
          } else if (origSub) {
            const origC = origSub.checklists.find((oc) => oc.id === c.id);
            const patch: { completed?: boolean; position?: number } = {};
            if (origC && origC.completed !== c.completed) patch.completed = c.completed;
            if (origC && origC.position !== expectedPosition) patch.position = expectedPosition;
            if (Object.keys(patch).length > 0) {
              await api.updateChecklistItem(c.id as number, patch);
            }
          }
        }
      }

      // 保存完了後は全IDが number に確定しているため Task として扱う
      onTaskUpdated(final as unknown as Task);
      onClose('saved');
    } catch (err) {
      console.error(err);
      setSaveError('保存中にエラーが発生しました。再試行してください。');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * 新しいサブタスクをローカル state に追加する。
   * 保存は saveAndClose 呼び出し時にまとめて行う。
   */
  const addSubtask = () => {
    if (!newSubtaskContent.trim()) return;
    const newSub: LocalSubtask = {
      id: tempId(),
      task_id: task.id,
      content: newSubtaskContent,
      checklists: [],
    };
    setLocalTask((prev) => ({ ...prev, subtasks: [...prev.subtasks, newSub] }));
    setNewSubtaskContent('');
    setAddingSubtask(false);
  };

  /**
   * サブタスクのインライン編集を確定してローカル state を更新する。
   * 内容が空の場合は編集をキャンセルする。
   * @param subtaskId - 編集対象のサブタスク ID
   */
  const saveSubtaskEdit = (subtaskId: number | TempId) => {
    if (!editingSubtaskContent.trim()) {
      setEditingSubtaskId(null);
      return;
    }
    setLocalTask((prev) => ({
      ...prev,
      subtasks: prev.subtasks.map((s) =>
        s.id === subtaskId ? { ...s, content: editingSubtaskContent } : s
      ),
    }));
    setEditingSubtaskId(null);
  };

  /**
   * サブタスクをローカル state から削除する。
   * DB 保存済みの場合は deletedSubtaskIds に追加し、saveAndClose 時にまとめて削除する。
   * @param subId - 削除対象のサブタスク ID
   */
  const removeSubtask = (subId: number | TempId) => {
    if (!isTemp(subId)) setDeletedSubtaskIds((prev) => [...prev, subId]);
    setLocalTask((prev) => ({
      ...prev,
      subtasks: prev.subtasks.filter((s) => s.id !== subId),
    }));
  };

  /**
   * 新しいチェックリスト項目をローカル state に追加する。
   * @param type - 'task' の場合はタスク直下、'subtask' の場合はサブタスク配下に追加
   * @param subtaskId - type が 'subtask' の場合の親サブタスク ID
   */
  const addChecklistItem = (
    type: 'task' | 'subtask',
    subtaskId: number | TempId | null = null
  ) => {
    if (!newChecklistContent.trim()) return;
    setLocalTask((prev) => {
      if (type === 'task') {
        const position = (prev.checklists.length + 1) * 1000;
        const newItem: LocalChecklistItem = {
          id: tempId(),
          content: newChecklistContent,
          completed: false,
          task_id: task.id,
          subtask_id: null,
          position,
        };
        return { ...prev, checklists: [...prev.checklists, newItem] };
      }
      return {
        ...prev,
        subtasks: prev.subtasks.map((s) =>
          s.id === subtaskId
            ? {
                ...s,
                checklists: [
                  ...s.checklists,
                  {
                    id: tempId(),
                    content: newChecklistContent,
                    completed: false,
                    task_id: null,
                    subtask_id: subtaskId,
                    position: (s.checklists.length + 1) * 1000,
                  },
                ],
              }
            : s
        ),
      };
    });
    setNewChecklistContent('');
    setAddingChecklist(null);
  };

  /**
   * ドラッグ&ドロップでチェックリスト項目を並び替える。
   * @param parentKey - 'task' またはサブタスク ID
   * @param fromIndex - ドラッグ元インデックス
   * @param toIndex - ドロップ先インデックス
   */
  const moveChecklistItem = (
    parentKey: 'task' | number | TempId,
    fromIndex: number,
    toIndex: number
  ) => {
    if (fromIndex === toIndex) return;
    setLocalTask((prev) => {
      if (parentKey === 'task') {
        const checklists = [...prev.checklists];
        const [item] = checklists.splice(fromIndex, 1);
        checklists.splice(toIndex, 0, item);
        return { ...prev, checklists };
      }
      return {
        ...prev,
        subtasks: prev.subtasks.map((s) => {
          if (s.id !== parentKey) return s;
          const checklists = [...s.checklists];
          const [item] = checklists.splice(fromIndex, 1);
          checklists.splice(toIndex, 0, item);
          return { ...s, checklists };
        }),
      };
    });
  };

  /**
   * チェックリスト項目の完了状態をローカル state 内でトグルする。
   * 実際の API 更新は saveAndClose 時に行う。
   * @param itemId - 対象項目 ID
   * @param type - 'task' または 'subtask'
   * @param subtaskId - type が 'subtask' の場合の親サブタスク ID
   */
  const toggleChecklist = (
    itemId: number | TempId,
    type: 'task' | 'subtask',
    subtaskId: number | TempId | null = null
  ) => {
    setLocalTask((prev) => {
      if (type === 'task') {
        return {
          ...prev,
          checklists: prev.checklists.map((c) =>
            c.id === itemId ? { ...c, completed: !c.completed } : c
          ),
        };
      }
      return {
        ...prev,
        subtasks: prev.subtasks.map((s) =>
          s.id === subtaskId
            ? {
                ...s,
                checklists: s.checklists.map((c) =>
                  c.id === itemId ? { ...c, completed: !c.completed } : c
                ),
              }
            : s
        ),
      };
    });
  };

  /**
   * チェックリスト項目をローカル state から削除する。
   * DB 保存済みの場合は deletedChecklistIds に追加し、saveAndClose 時にまとめて削除する。
   * @param itemId - 削除対象項目 ID
   * @param type - 'task' または 'subtask'
   * @param subtaskId - type が 'subtask' の場合の親サブタスク ID
   */
  const removeChecklist = (
    itemId: number | TempId,
    type: 'task' | 'subtask',
    subtaskId: number | TempId | null = null
  ) => {
    if (!isTemp(itemId)) setDeletedChecklistIds((prev) => [...prev, itemId]);
    setLocalTask((prev) => {
      if (type === 'task') {
        return { ...prev, checklists: prev.checklists.filter((c) => c.id !== itemId) };
      }
      return {
        ...prev,
        subtasks: prev.subtasks.map((s) =>
          s.id === subtaskId
            ? { ...s, checklists: s.checklists.filter((c) => c.id !== itemId) }
            : s
        ),
      };
    });
  };

  return createPortal(
    <div className="modal-overlay">
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={modalTitleId}
      >
        <div className="modal-header">
          <h3 id={modalTitleId} className="modal-title">タスクを編集</h3>
          <button
            type="button"
            className="action-btn"
            onClick={() => onClose('dismiss')}
            aria-label="編集モーダルを閉じる"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-section">
            <label htmlFor={taskContentInputId} className="modal-label">タスク内容</label>
            <textarea
              id={taskContentInputId}
              className="task-content-input"
              value={localTask.content}
              onChange={(e) =>
                setLocalTask((prev) => ({ ...prev, content: e.target.value }))
              }
              rows={3}
              autoFocus
              style={{ resize: 'vertical' }}
            />
          </div>

          <div className="modal-section">
            <label className="modal-label">チェックリスト</label>
            <div className="task-checklists">
              {localTask.checklists.map((c, i) => (
                <div
                  key={c.id}
                  className={[
                    'checklist-item',
                    dragOverKey?.parentKey === 'task' && dragOverKey.index === i ? 'checklist-drag-over' : '',
                  ].join(' ').trim()}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    dragState.current = { parentKey: 'task', index: i };
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverKey({ parentKey: 'task', index: i });
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragState.current?.parentKey === 'task') {
                      moveChecklistItem('task', dragState.current.index, i);
                    }
                    dragState.current = null;
                    setDragOverKey(null);
                  }}
                  onDragEnd={() => {
                    dragState.current = null;
                    setDragOverKey(null);
                  }}
                >
                  <span className="checklist-drag-handle" aria-hidden="true">
                    <GripVertical size={12} />
                  </span>
                  <button
                    type="button"
                    className="checklist-toggle"
                    onClick={() => toggleChecklist(c.id, 'task')}
                    aria-label={`チェックリスト「${c.content}」を${c.completed ? '未完了' : '完了'}にする`}
                  >
                    {c.completed ? (
                      <CheckSquare size={14} className="accent" />
                    ) : (
                      <Square size={14} className="text-muted" />
                    )}
                  </button>
                  <span
                    className={
                      c.completed ? 'checklist-text completed text-muted' : 'checklist-text'
                    }
                  >
                    {c.content}
                  </span>
                  <button
                    type="button"
                    className="checklist-del modal-del-btn"
                    onClick={() => removeChecklist(c.id, 'task')}
                    aria-label={`チェックリスト「${c.content}」を削除`}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
            {addingChecklist === 'task' ? (
              <ChecklistInput
                value={newChecklistContent}
                onChange={setNewChecklistContent}
                onAdd={() => addChecklistItem('task')}
                onCancel={() => {
                  setAddingChecklist(null);
                  setNewChecklistContent('');
                }}
              />
            ) : (
              <button
                type="button"
                className="text-btn text-muted"
                style={{ marginTop: '0.5rem' }}
                onClick={() => {
                  setAddingChecklist('task');
                  setNewChecklistContent('');
                }}
              >
                <Plus size={12} /> チェック項目を追加
              </button>
            )}
          </div>

          <div className="modal-section">
            <label className="modal-label">サブタスク</label>
            {localTask.subtasks.map((subtask) => (
              <div
                key={subtask.id}
                className="subtask-card"
                style={{ marginBottom: '0.5rem' }}
              >
                <div className="subtask-header">
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      flex: 1,
                    }}
                  >
                    <CornerDownRight size={14} className="text-muted" />
                    {editingSubtaskId === subtask.id ? (
                      <input
                        autoFocus
                        className="task-content-input"
                        style={{ fontSize: '0.85rem', padding: '0.2rem 0.4rem', flex: 1 }}
                        value={editingSubtaskContent}
                        onChange={(e) => setEditingSubtaskContent(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveSubtaskEdit(subtask.id);
                          if (e.key === 'Escape') setEditingSubtaskId(null);
                        }}
                        onBlur={() => saveSubtaskEdit(subtask.id)}
                      />
                    ) : (
                      <span
                        className="subtask-title"
                        style={{ cursor: 'pointer', flex: 1 }}
                        onClick={() => {
                          setEditingSubtaskId(subtask.id);
                          setEditingSubtaskContent(subtask.content);
                        }}
                        title="クリックして編集"
                      >
                        {subtask.content}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="action-btn"
                    onClick={() => removeSubtask(subtask.id)}
                    aria-label={`サブタスク「${subtask.content}」を削除`}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                <div
                  className="task-checklists"
                  style={{ marginLeft: '1.25rem', marginTop: '0.25rem' }}
                >
                  {subtask.checklists.map((c, j) => (
                    <div
                      key={c.id}
                      className={[
                        'checklist-item',
                        dragOverKey?.parentKey === subtask.id && dragOverKey.index === j ? 'checklist-drag-over' : '',
                      ].join(' ').trim()}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move';
                        dragState.current = { parentKey: subtask.id, index: j };
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverKey({ parentKey: subtask.id, index: j });
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragState.current?.parentKey === subtask.id) {
                          moveChecklistItem(subtask.id, dragState.current.index, j);
                        }
                        dragState.current = null;
                        setDragOverKey(null);
                      }}
                      onDragEnd={() => {
                        dragState.current = null;
                        setDragOverKey(null);
                      }}
                    >
                      <span className="checklist-drag-handle" aria-hidden="true">
                        <GripVertical size={12} />
                      </span>
                      <button
                        type="button"
                        className="checklist-toggle"
                        onClick={() => toggleChecklist(c.id, 'subtask', subtask.id)}
                        aria-label={`サブタスク「${subtask.content}」のチェックリスト「${c.content}」を${c.completed ? '未完了' : '完了'}にする`}
                      >
                        {c.completed ? (
                          <CheckSquare size={14} className="accent" />
                        ) : (
                          <Square size={14} className="text-muted" />
                        )}
                      </button>
                      <span
                        className={
                          c.completed
                            ? 'checklist-text completed text-muted'
                            : 'checklist-text'
                        }
                      >
                        {c.content}
                      </span>
                      <button
                        type="button"
                        className="checklist-del modal-del-btn"
                        onClick={() => removeChecklist(c.id, 'subtask', subtask.id)}
                        aria-label={`サブタスク「${subtask.content}」のチェックリスト「${c.content}」を削除`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>

                {addingChecklist === subtask.id ? (
                  <div style={{ marginLeft: '1.25rem', marginTop: '0.25rem' }}>
                    <ChecklistInput
                      value={newChecklistContent}
                      onChange={setNewChecklistContent}
                      onAdd={() => addChecklistItem('subtask', subtask.id)}
                      onCancel={() => {
                        setAddingChecklist(null);
                        setNewChecklistContent('');
                      }}
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    className="text-btn text-muted"
                    style={{ marginLeft: '1.25rem', marginTop: '0.25rem' }}
                    onClick={() => {
                      setAddingChecklist(subtask.id);
                      setNewChecklistContent('');
                    }}
                  >
                    <Plus size={12} /> チェック項目を追加
                  </button>
                )}
              </div>
            ))}

            {addingSubtask ? (
              <div className="add-sub-form" style={{ marginTop: '0.5rem' }}>
                <input
                  autoFocus
                  placeholder="サブタスク名..."
                  className="task-content-input"
                  style={{ fontSize: '0.85rem' }}
                  value={newSubtaskContent}
                  onChange={(e) => setNewSubtaskContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addSubtask();
                    if (e.key === 'Escape') {
                      setAddingSubtask(false);
                      setNewSubtaskContent('');
                    }
                  }}
                />
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                    onClick={addSubtask}
                  >
                    追加
                  </button>
                  <button
                    type="button"
                    className="btn"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                    onClick={() => {
                      setAddingSubtask(false);
                      setNewSubtaskContent('');
                    }}
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="text-btn text-muted"
                style={{ marginTop: '0.5rem' }}
                onClick={() => setAddingSubtask(true)}
              >
                <Plus size={12} /> サブタスクを追加
              </button>
            )}
          </div>
        </div>

        <div className="modal-footer">
          {saveError && (
            <span style={{ color: 'var(--danger, #e53e3e)', fontSize: '0.85rem', flex: 1 }}>
              {saveError}
            </span>
          )}
          <button type="button" className="btn btn-primary" onClick={() => void saveAndClose()} disabled={isSaving}>
            {isSaving ? '保存中...' : '保存して閉じる'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

interface ChecklistInputProps {
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  onCancel: () => void;
}

/**
 * チェックリスト項目の入力フォームコンポーネント。
 * Enter キーで追加、Escape キーでキャンセルできる。
 * @param value - 入力内容
 * @param onChange - 入力変更コールバック
 * @param onAdd - 追加確定コールバック
 * @param onCancel - キャンセルコールバック
 */
function ChecklistInput({ value, onChange, onAdd, onCancel }: ChecklistInputProps) {
  return (
    <div className="add-sub-form" style={{ marginTop: '0.5rem' }}>
      <input
        autoFocus
        placeholder="チェック項目..."
        className="task-content-input"
        style={{ fontSize: '0.85rem', padding: '0.35rem' }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onAdd();
          if (e.key === 'Escape') onCancel();
        }}
      />
      <div className="form-actions">
        <button
          type="button"
          className="btn btn-primary"
          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
          onClick={onAdd}
        >
          追加
        </button>
        <button
          type="button"
          className="btn"
          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
          onClick={onCancel}
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
