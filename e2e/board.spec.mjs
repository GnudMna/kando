/** かんばんボード操作（行追加・検索・リスト表示切替）の E2E テスト。 */
import { test, expect } from "@playwright/test";
import { addRow, ensureBoardVisible } from "./helpers.mjs";

test.describe("かんばんボード操作", () => {
  test.beforeEach(async ({ page }) => {
    await ensureBoardVisible(page);
  });

  test("行を追加してタイトルが表示される", async ({ page }) => {
    const rowTitle = `E2E行_${Date.now().toString(36)}`;
    await addRow(page, rowTitle);
    await expect(
      page.getByRole("button", { name: rowTitle, exact: true }),
    ).toBeVisible();
  });

  test("タスク検索でリスト表示に切り替わる", async ({ page }) => {
    await addRow(page, `E2E検索行_${Date.now().toString(36)}`);

    await page
      .getByPlaceholder("タスク名・サブタスク・コメントで検索")
      .fill("存在しないキーワード");

    await expect(
      page.getByText("該当するタスクがありません"),
    ).toBeVisible();
    await expect(page.getByLabel("ボード統計")).toContainText("件ヒット");
  });

  test("リストビューに切り替えできる", async ({ page }) => {
    await addRow(page, `E2Eリスト行_${Date.now().toString(36)}`);

    const listTab = page
      .getByRole("tablist", { name: "表示モード" })
      .getByRole("button", { name: "リスト", exact: true });
    await listTab.click();
    await expect(listTab).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".list-view-body").first()).toBeVisible();
  });
});
