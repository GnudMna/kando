/**
 * Vitest グローバルセットアップ。
 * Testing Library のカスタムマッチャーと `window.matchMedia` モックを有効化する。
 */
// Testing Library 向けのカスタムマッチャー（toBeInTheDocument など）を有効化する
import "@testing-library/jest-dom";
import { vi } from "vitest";

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
