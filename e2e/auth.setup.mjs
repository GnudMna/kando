import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test as setup } from "@playwright/test";

const authFile = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  ".auth/user.json",
);

setup("認証状態を保存する", async ({ page }) => {
  mkdirSync(path.dirname(authFile), { recursive: true });

  const username = `e2e_user_${Date.now().toString(36)}`;
  const password = "e2e_password_12";

  await page.goto("/");

  const registerSubmit = page.getByRole("button", { name: "アカウントを作成" });
  if (!(await registerSubmit.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "新規登録" }).click();
  }

  await page.getByPlaceholder("ユーザー名を入力").fill(username);
  await page.getByPlaceholder("パスワードを入力").fill(password);
  await registerSubmit.click();

  await page.getByLabel("ボード統計").waitFor({ state: "visible", timeout: 30_000 });
  await page.context().storageState({ path: authFile });
});
