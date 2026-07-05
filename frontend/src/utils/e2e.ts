/** Playwright E2E 実行時は仮想スクロールを無効化して DOM を安定させる。 */
export const isE2eTestMode = import.meta.env.VITE_E2E_TEST === "true";
