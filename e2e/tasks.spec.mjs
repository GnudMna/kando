/** タスク作成・編集モーダル・スナップショット保存の E2E テスト。 */
import { test, expect } from "@playwright/test";
import {
  addRow,
  addTaskInRow,
  ensureBoardVisible,
  openTaskEditModal,
  rowByTitle,
  saveTaskModal,
  uniqueLabel,
} from "./helpers.mjs";

test.describe("タスク編集", () => {
  test.beforeEach(async ({ page }) => {
    await ensureBoardVisible(page);
  });

  test("タスクを追加して編集モーダルで内容を変更し保存できる", async ({
    page,
  }) => {
    const rowTitle = uniqueLabel("E2Eタスク行");
    const updatedContent = uniqueLabel("E2E更新タスク");

    await addRow(page, rowTitle);
    await addTaskInRow(page, rowTitle);

    await openTaskEditModal(page, "新しいタスク", rowTitle);
    await page.getByLabel("タスク内容").fill(updatedContent);
    await saveTaskModal(page);

    await expect(
      page.getByRole("button", {
        name: `タスク「${updatedContent}」を編集`,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      rowByTitle(page, rowTitle).getByRole("button", {
        name: "タスク「新しいタスク」を編集",
        exact: true,
      }),
    ).toHaveCount(0);
  });

  test("チェックリスト項目を追加してスナップショット保存できる", async ({
    page,
  }) => {
    const rowTitle = uniqueLabel("E2Eチェックリスト行");
    const taskContent = uniqueLabel("E2Eチェックリストタスク");
    const checklistItem = uniqueLabel("E2Eチェック項目");

    await addRow(page, rowTitle);
    await addTaskInRow(page, rowTitle);

    await openTaskEditModal(page, "新しいタスク", rowTitle);
    await page.getByLabel("タスク内容").fill(taskContent);
    await page
      .getByRole("dialog", { name: "タスクを編集" })
      .getByRole("button", { name: "チェック項目を追加" })
      .click();
    await page.getByPlaceholder("チェック項目...").fill(checklistItem);
    await page
      .getByRole("dialog", { name: "タスクを編集" })
      .getByRole("button", { name: "追加", exact: true })
      .click();

    await expect(page.getByRole("dialog", { name: "タスクを編集" }).getByText(checklistItem)).toBeVisible();
    await saveTaskModal(page);

    await openTaskEditModal(page, taskContent, rowTitle);
    await expect(
      page.getByRole("dialog", { name: "タスクを編集" }).getByText(checklistItem),
    ).toBeVisible();
  });
});
