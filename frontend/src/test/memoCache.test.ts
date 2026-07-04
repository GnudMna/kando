import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getCachedMemos,
  setCachedMemos,
  invalidateMemoCache,
} from "../components/taskEdit/memoCache";
import type { Memo } from "../api/boardApi";

const sampleMemos: Memo[] = [
  {
    id: 1,
    user_id: 1,
    title: "メモ",
    content: "本文",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    tasks: [],
  },
];

describe("memoCache", () => {
  beforeEach(() => {
    invalidateMemoCache();
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    invalidateMemoCache();
  });

  it("キャッシュ未設定時は null を返す", () => {
    expect(getCachedMemos()).toBeNull();
  });

  it("setCachedMemos 後に TTL 内はキャッシュを返す", () => {
    setCachedMemos(sampleMemos);
    expect(getCachedMemos()).toEqual(sampleMemos);
  });

  it("TTL 切れ後は null を返す", () => {
    setCachedMemos(sampleMemos);
    vi.spyOn(Date, "now").mockReturnValue(1_000_000 + 31_000);
    expect(getCachedMemos()).toBeNull();
  });

  it("invalidateMemoCache でキャッシュが無効化される", () => {
    setCachedMemos(sampleMemos);
    invalidateMemoCache();
    expect(getCachedMemos()).toBeNull();
  });
});
