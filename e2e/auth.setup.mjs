/**
 * Playwright セットアッププロジェクト用の認証フロー。
 *
 * テスト実行前に一度だけ走り、新規ユーザーを登録してログイン状態を
 * `e2e/.auth/user.json` に保存する。以降のテストはこのストレージ状態を再利用する。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test as setup } from "@playwright/test";

/** 認証済みセッション（Cookie 等）の保存先パス */
const authFile = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  ".auth/user.json",
);

/**
 * 新規ユーザーを登録し、認証済み状態をストレージファイルへ永続化する。
 *
 * @param {import('@playwright/test').Page} page - 操作対象の Playwright ページ
 * @returns {Promise<void>} ボード表示確認とストレージ保存が完了した時点で解決される Promise
 */
setup("認証状態を保存する", async ({ page }) => {
  mkdirSync(path.dirname(authFile), { recursive: true });

  // 登録は初回ユーザーだけ。2回目以降は同じ資格情報でログインする
  const username = "e2e_user";
  const password = "e2e_password_12";

  await page.goto("/");

  const registerSubmit = page.getByRole("button", { name: "アカウントを作成" });
  if (await registerSubmit.isVisible().catch(() => false)) {
    await page.getByPlaceholder("ユーザー名を入力").fill(username);
    await page.getByPlaceholder("パスワードを入力").fill(password);
    await registerSubmit.click();
  } else {
    await page.getByPlaceholder("ユーザー名を入力").fill(username);
    await page.getByPlaceholder("パスワードを入力").fill(password);
    await page.getByRole("button", { name: "ログイン" }).click();
  }

  // ログイン完了後、ボードが表示されるまで待ってからセッションを保存する
  await page.getByLabel("ボード統計").waitFor({ state: "visible", timeout: 30_000 });
  await page.context().storageState({ path: authFile });
  writeFileSync(
    path.join(path.dirname(authFile), "credentials.json"),
    JSON.stringify({ username, password }),
  );
});
