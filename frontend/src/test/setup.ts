/**
 * Vitest グローバルセットアップ。
 * Testing Library のカスタムマッチャーと `window.matchMedia` モックを有効化する。
 */
import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import {
  invalidateMemoCache,
  setCachedMemos,
} from "../components/taskEdit/memoCache";

// React Testing Library が act 環境であることを React に通知する
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

beforeEach(() => {
  // モジュール共有のメモキャッシュを毎テスト初期化し、
  // test.sh 全件実行時の fetchMemos 非同期更新。act 警告を防ぐ
  invalidateMemoCache();
  vi.spyOn(Date, "now").mockReturnValue(1_000_000);
  setCachedMemos([]);
});

afterEach(() => {
  cleanup();
  invalidateMemoCache();
  vi.restoreAllMocks();
});
