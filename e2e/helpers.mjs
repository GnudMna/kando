/**
 * E2E テストで共通利用する Playwright ヘルパー関数群。
 * `auth.setup.mjs` で保存した認証済みセッションを前提に、ボード操作を簡略化する。
 */

/**
 * ルート URL へ遷移し、認証済みかんばんボード画面が表示されるまで待機する。
 *
 * セットアッププロジェクトで保存されたストレージ状態を使うテスト向け。
 * 「ボード統計」ラベルの要素が表示されることをもって、ボード読み込み完了とみなす。
 *
 * @param {import('@playwright/test').Page} page - 操作対象の Playwright ページ
 * @returns {Promise<void>} ボード表示の待機が完了した時点で解決される Promise
 */
export async function ensureBoardVisible(page) {
  await page.goto("/");
  await page.getByLabel("ボード統計").waitFor({ state: "visible", timeout: 30_000 });
}

/**
 * インライン入力フォーム経由で行を追加し、追加された行が DOM に表示されるまで待機する。
 *
 * 「行を追加」ボタン → タイトル入力 → 「追加」ボタンの順で操作する。
 *
 * @param {import('@playwright/test').Page} page - 操作対象の Playwright ページ
 * @param {string} title - 新規行に設定するタイトル（完全一致で表示確認に使用する）
 * @returns {Promise<void>} 行タイトルのボタンが画面に表示された時点で解決される Promise
 */
export async function addRow(page, title) {
  await page.getByRole("button", { name: "行を追加", exact: true }).click();
  await page.getByLabel("行のタイトル").fill(title);
  await page.getByRole("button", { name: "追加", exact: true }).click();
  await page
    .getByRole("button", { name: title, exact: true })
    .waitFor({ state: "visible" });
}
