import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { useMemosQuery, useMemoMutations } from "../hooks/useMemos";
import { createMemo, deleteMemo, fetchMemos, updateMemo } from "../api/memos";
import { queryKeys } from "../api/queryKeys";
import { createQueryWrapper } from "./testUtils";
import { createQueryClient } from "../providers/queryClient";
import type { Memo } from "@kando/types";

vi.mock("../api/memos");

const sampleMemos: Memo[] = [
  {
    id: 1,
    user_id: 1,
    title: "メモA",
    content: "内容A",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    tasks: [],
  },
];

describe("useMemosQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchMemos).mockResolvedValue(structuredClone(sampleMemos));
  });

  it("メモ一覧を取得する", async () => {
    const { result } = renderHook(() => useMemosQuery(), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(sampleMemos);
  });
});

describe("useMemoMutations", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createQueryClient();
    vi.mocked(fetchMemos).mockResolvedValue(structuredClone(sampleMemos));
  });

  it("作成成功時にキャッシュへメモを追加する", async () => {
    const created: Memo = {
      id: 2,
      user_id: 1,
      title: "新規",
      content: "本文",
      created_at: "2026-01-02T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
      tasks: [],
    };
    vi.mocked(createMemo).mockResolvedValue(created);

    const wrapper = createQueryWrapper(queryClient);
    renderHook(() => useMemosQuery(), { wrapper });
    const { result: mutations } = renderHook(() => useMemoMutations(), {
      wrapper,
    });

    await waitFor(() =>
      expect(
        queryClient.getQueryData<Memo[]>(queryKeys.memos.list()),
      ).toEqual(sampleMemos),
    );

    await act(async () => {
      await mutations.current.create.mutateAsync({
        title: "新規",
        content: "本文",
      });
    });

    expect(queryClient.getQueryData<Memo[]>(queryKeys.memos.list())).toEqual([
      ...sampleMemos,
      created,
    ]);
  });

  it("更新成功時にキャッシュ内のメモを置き換える", async () => {
    const updated: Memo = { ...sampleMemos[0], title: "更新後" };
    vi.mocked(updateMemo).mockResolvedValue(updated);

    const wrapper = createQueryWrapper(queryClient);
    renderHook(() => useMemosQuery(), { wrapper });
    const { result: mutations } = renderHook(() => useMemoMutations(), {
      wrapper,
    });

    await waitFor(() =>
      expect(
        queryClient.getQueryData<Memo[]>(queryKeys.memos.list()),
      ).toBeDefined(),
    );

    await act(async () => {
      await mutations.current.update.mutateAsync({
        id: 1,
        patch: { title: "更新後" },
      });
    });

    expect(queryClient.getQueryData<Memo[]>(queryKeys.memos.list())?.[0].title).toBe(
      "更新後",
    );
  });

  it("削除成功時にキャッシュからメモを除去する", async () => {
    vi.mocked(deleteMemo).mockResolvedValue(undefined);

    const wrapper = createQueryWrapper(queryClient);
    renderHook(() => useMemosQuery(), { wrapper });
    const { result: mutations } = renderHook(() => useMemoMutations(), {
      wrapper,
    });

    await waitFor(() =>
      expect(
        queryClient.getQueryData<Memo[]>(queryKeys.memos.list()),
      ).toHaveLength(1),
    );

    await act(async () => {
      await mutations.current.remove.mutateAsync(1);
    });

    expect(queryClient.getQueryData<Memo[]>(queryKeys.memos.list())).toEqual([]);
  });
});
