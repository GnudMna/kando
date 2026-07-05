/** メモ帳の作成・編集・永続化の E2E テスト。 */
import { test, expect } from "@playwright/test";
import {
  closeMemoPanel,
  createNewMemo,
  editMemoDraft,
  ensureBoardVisible,
  memoDialog,
  openMemoPanel,
  selectMemoFromList,
  uniqueLabel,
} from "./helpers.mjs";

test.describe("メモ帳", () => {
  test.beforeEach(async ({ page }) => {
    await ensureBoardVisible(page);
  });

  test("メモを作成・編集して一覧に反映される", async ({ page }) => {
    const memoTitle = uniqueLabel("E2Eメモ");
    const memoContent = uniqueLabel("E2Eメモ本文");

    await openMemoPanel(page);
    await createNewMemo(page);
    await editMemoDraft(page, { title: memoTitle, content: memoContent });

    await expect(memoDialog(page).getByLabel("メモ内容")).toHaveValue(
      memoContent,
    );
  });

  test("メモ帳を閉じて再度開いても内容が保持される", async ({ page }) => {
    const memoTitle = uniqueLabel("E2E永続メモ");
    const memoContent = uniqueLabel("E2E永続本文");

    await openMemoPanel(page);
    await createNewMemo(page);
    await editMemoDraft(page, { title: memoTitle, content: memoContent });
    await closeMemoPanel(page);

    await openMemoPanel(page);
    await selectMemoFromList(page, memoTitle);

    await expect(memoDialog(page).getByLabel("メモ内容")).toHaveValue(
      memoContent,
    );
  });
});
