import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { useLazyTaskDetails } from "../hooks/useLazyTaskDetails";
import { fetchTask } from "../api/tasks";
import { queryKeys } from "../api/queryKeys";
import { createQueryClient } from "../providers/queryClient";
import { createQueryWrapper, baseTask } from "./testUtils";
import type { Task } from "../types";

vi.mock("../api/tasks");

type ObserverCallback = IntersectionObserverCallback;

let latestObserver: {
  triggerIntersect: (isIntersecting: boolean) => void;
} | null = null;

function LazyTaskProbe({
  task,
  onLoaded,
}: {
  task: Task;
  onLoaded: (task: Task) => void;
}) {
  const { rootRef } = useLazyTaskDetails(task, onLoaded);
  return <div ref={rootRef} data-testid="lazy-task" />;
}

describe("useLazyTaskDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    latestObserver = null;
    vi.stubGlobal(
      "IntersectionObserver",
      class MockIntersectionObserver implements IntersectionObserver {
        readonly root: Element | Document | null = null;
        readonly rootMargin = "";
        readonly scrollMargin = "";
        readonly thresholds: ReadonlyArray<number> = [];

        private callback: ObserverCallback;

        constructor(callback: ObserverCallback) {
          this.callback = callback;
          latestObserver = {
            triggerIntersect: (isIntersecting: boolean) => {
              this.callback(
                [{ isIntersecting } as IntersectionObserverEntry],
                this,
              );
            },
          };
        }

        observe = vi.fn();
        disconnect = vi.fn();
        unobserve = vi.fn();
        takeRecords = vi.fn((): IntersectionObserverEntry[] => []);
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const summaryTask: Task = {
    ...baseTask,
    comment_count: 2,
    subtask_count: 0,
    checklist_count: 0,
    comments: [],
    subtasks: [],
    checklists: [],
  };

  const fullTask: Task = {
    ...baseTask,
    comments: [
      {
        id: 1,
        task_id: 1,
        content: "コメント",
        created_at: "2026-01-01T00:00:00.000Z",
        position: 1000,
      },
    ],
  };

  it("詳細が既に読み込まれているタスクでは fetch を行わない", () => {
    const onLoaded = vi.fn();
    render(<LazyTaskProbe task={fullTask} onLoaded={onLoaded} />, {
      wrapper: createQueryWrapper(),
    });

    expect(fetchTask).not.toHaveBeenCalled();
  });

  it("詳細が読み込み済みのタスクは、キャッシュに古い詳細が残っていても onLoaded で上書きしない", () => {
    const onLoaded = vi.fn();
    const queryClient = createQueryClient();
    const staleDetail: Task = { ...fullTask, content: "編集前" };
    const editedTask: Task = { ...fullTask, content: "編集後" };

    queryClient.setQueryData(queryKeys.tasks.detail(editedTask.id), staleDetail);

    render(<LazyTaskProbe task={editedTask} onLoaded={onLoaded} />, {
      wrapper: createQueryWrapper(queryClient),
    });

    expect(onLoaded).not.toHaveBeenCalled();
  });

  it("サマリータスクが可視になったら詳細を取得して onLoaded を呼ぶ", async () => {
    const onLoaded = vi.fn();
    vi.mocked(fetchTask).mockResolvedValue(fullTask);

    render(<LazyTaskProbe task={summaryTask} onLoaded={onLoaded} />, {
      wrapper: createQueryWrapper(),
    });

    latestObserver?.triggerIntersect(true);

    await waitFor(() => {
      expect(fetchTask).toHaveBeenCalledWith(summaryTask.id);
      expect(onLoaded).toHaveBeenCalledWith(fullTask);
    });
  });
});
