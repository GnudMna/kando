/** 認証フロー（セッション再利用・ログアウト）の E2E テスト。 */
import { test, expect } from "@playwright/test";
import { ensureBoardVisible } from "./helpers.mjs";

test.describe("認証フロー", () => {
  test("セットアップ済みセッションでかんばんボードが表示される", async ({
    page,
  }) => {
    await ensureBoardVisible(page);

    await expect(page.getByRole("heading", { name: "Kando" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "行を追加", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("ボード統計")).toBeVisible();
  });

  test("ログアウト後にログイン画面へ戻る", async ({ page }) => {
    await ensureBoardVisible(page);

    await page.getByRole("button", { name: "ログアウト" }).click();
    await expect(
      page.getByRole("button", { name: "ログイン" }),
    ).toBeVisible({ timeout: 15_000 });
  });
});
