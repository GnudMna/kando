/**
 * 認証済みのかんばんボード画面が表示されるまで待機する。
 * @param {import('@playwright/test').Page} page
 */
export async function ensureBoardVisible(page) {
  await page.goto("/");
  await page.getByLabel("ボード統計").waitFor({ state: "visible", timeout: 30_000 });
}

/**
 * インライン入力フォーム経由で行を追加する。
 * @param {import('@playwright/test').Page} page
 * @param {string} title
 */
export async function addRow(page, title) {
  await page.getByRole("button", { name: "行を追加", exact: true }).click();
  await page.getByLabel("行のタイトル").fill(title);
  await page.getByRole("button", { name: "追加", exact: true }).click();
  await page
    .getByRole("button", { name: title, exact: true })
    .waitFor({ state: "visible" });
}
