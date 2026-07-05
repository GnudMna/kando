/** ドラッグ&ドロップによるタスク移動の E2E テスト。 */
import { test, expect } from "@playwright/test";
import {
  addRow,
  addTaskInRow,
  columnInRow,
  DEFAULT_COLUMNS,
  dragTaskToColumn,
  ensureBoardVisible,
  openTaskEditModal,
  rowByTitle,
  saveTaskModal,
  uniqueLabel,
} from "./helpers.mjs";

test.describe("ドラッグ&ドロップ", () => {
  test.beforeEach(async ({ page }) => {
    await ensureBoardVisible(page);
  });

  test("タスクを別の列へドラッグして移動できる", async ({ page }) => {
    const rowTitle = uniqueLabel("E2E DnD行");
    const taskContent = uniqueLabel("E2E DnDタスク");
    const sourceColumn = DEFAULT_COLUMNS[0];
    const targetColumn = DEFAULT_COLUMNS[1];

    await addRow(page, rowTitle);
    await addTaskInRow(page, rowTitle);

    await openTaskEditModal(page, "新しいタスク", rowTitle);
    await page.getByLabel("タスク内容").fill(taskContent);
    await saveTaskModal(page);

    const row = rowByTitle(page, rowTitle);
    const source = columnInRow(row, sourceColumn);
    await expect(
      source.getByRole("button", {
        name: `タスク「${taskContent}」を編集`,
        exact: true,
      }),
    ).toBeVisible();

    await dragTaskToColumn(page, rowTitle, taskContent, targetColumn);

    const destination = columnInRow(row, targetColumn);
    await expect(
      destination.getByRole("button", {
        name: `タスク「${taskContent}」を編集`,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      source.getByRole("button", {
        name: `タスク「${taskContent}」を編集`,
        exact: true,
      }),
    ).toHaveCount(0);
  });
});
