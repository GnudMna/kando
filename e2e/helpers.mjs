/**
 * E2E テストで共通利用する Playwright ヘルパー関数群。
 * `auth.setup.mjs` で保存した認証済みセッションを前提に、ボード操作を簡略化する。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "@playwright/test";

const e2eDir = path.dirname(fileURLToPath(import.meta.url));

/** デフォルト列タイトル（行作成時に自動生成される） */
export const DEFAULT_COLUMNS = ["未着手", "進行中", "完了"];

/**
 * テストごとに一意なラベルを生成する。
 * @param {string} prefix - ラベルの接頭辞
 * @returns {string} 一意なラベル文字列
 */
export function uniqueLabel(prefix) {
  return `${prefix}_${Date.now().toString(36)}`;
}

/**
 * セットアップで保存したログイン資格情報を読み込む。
 * @returns {{ username: string, password: string }} ユーザー名とパスワード
 */
export function loadAuthCredentials() {
  const credentialsPath = path.join(e2eDir, ".auth/credentials.json");
  return JSON.parse(readFileSync(credentialsPath, "utf8"));
}

/**
 * ルート URL へ遷移し、認証済みかんばんボード画面が表示されるまで待機する。
 *
 * @param {import('@playwright/test').Page} page - 操作対象の Playwright ページ
 * @returns {Promise<void>}
 */
export async function ensureBoardVisible(page) {
  await page.goto("/");
  await page
    .getByLabel("ボード統計")
    .waitFor({ state: "visible", timeout: 30_000 });
}

/**
 * インライン入力フォーム経由で行を追加し、デフォルト列が表示されるまで待機する。
 *
 * @param {import('@playwright/test').Page} page - 操作対象の Playwright ページ
 * @param {string} title - 新規行に設定するタイトル
 * @returns {Promise<void>}
 */
export async function addRow(page, title) {
  const toolbar = page.locator(".board-toolbar");
  await toolbar
    .getByRole("button", { name: "行を追加", exact: true })
    .click();
  await toolbar.getByLabel("行のタイトル").fill(title);
  await toolbar.getByRole("button", { name: "追加", exact: true }).click();
  await page
    .getByRole("button", { name: title, exact: true })
    .waitFor({ state: "visible" });

  const row = rowByTitle(page, title);
  for (const columnTitle of DEFAULT_COLUMNS) {
    await expect(
      row.getByRole("button", { name: columnTitle, exact: true }),
    ).toBeVisible();
  }
}

/**
 * 行タイトルから `.board-row` 要素を取得する。
 *
 * @param {import('@playwright/test').Page} page - 操作対象の Playwright ページ
 * @param {string} title - 行タイトル
 * @returns {import('@playwright/test').Locator}
 */
export function rowByTitle(page, title) {
  return page.locator(".board-row").filter({
    has: page.getByRole("button", { name: title, exact: true }),
  });
}

/**
 * 行内の指定列コンテナを取得する。
 * デフォルト列（未着手 / 進行中 / 完了）は表示順のインデックスで特定する。
 *
 * @param {import('@playwright/test').Locator} row - 行ロケーター
 * @param {string} columnTitle - 列タイトル
 * @returns {import('@playwright/test').Locator}
 */
export function columnInRow(row, columnTitle) {
  const defaultIndex = DEFAULT_COLUMNS.indexOf(columnTitle);
  if (defaultIndex >= 0) {
    return row.locator(".column-container").nth(defaultIndex);
  }

  return row.locator(".column-container").filter({
    has: row.getByRole("button", { name: columnTitle, exact: true }),
  });
}

/**
 * 行の先頭列（未着手）にタスクを追加し、カードが表示されるまで待機する。
 *
 * @param {import('@playwright/test').Page} page - 操作対象の Playwright ページ
 * @param {string} rowTitle - 対象行のタイトル
 * @param {string} [expectedContent="新しいタスク"] - 追加後に期待するタスク本文
 * @returns {Promise<void>}
 */
export async function addTaskInRow(
  page,
  rowTitle,
  expectedContent = "新しいタスク",
) {
  const row = rowByTitle(page, rowTitle);
  const firstColumn = columnInRow(row, DEFAULT_COLUMNS[0]);
  await firstColumn
    .getByRole("button", { name: "タスクを追加", exact: true })
    .click();
  await expect(
    row.getByRole("button", {
      name: `タスク「${expectedContent}」を編集`,
      exact: true,
    }),
  ).toBeVisible({ timeout: 15_000 });
}

/**
 * タスク編集モーダルを開く。
 *
 * @param {import('@playwright/test').Page} page - 操作対象の Playwright ページ
 * @param {string} taskContent - 編集対象タスクの本文
 * @param {string} [rowTitle] - 対象行のタイトル（複数行がある場合に指定）
 * @returns {Promise<void>}
 */
export async function openTaskEditModal(page, taskContent, rowTitle) {
  const scope = rowTitle ? rowByTitle(page, rowTitle) : page;
  await scope
    .getByRole("button", { name: `タスク「${taskContent}」を編集`, exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "タスクを編集" }),
  ).toBeVisible();
}

/**
 * タスク編集モーダルの内容を保存して閉じる。
 *
 * @param {import('@playwright/test').Page} page - 操作対象の Playwright ページ
 * @returns {Promise<void>}
 */
export async function saveTaskModal(page) {
  await page.getByRole("button", { name: "保存して閉じる", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "タスクを編集" })).toBeHidden({
    timeout: 15_000,
  });
}

/**
 * メモ編集の自動保存（PUT）が完了するまで待機する。
 *
 * @param {import('@playwright/test').Page} page - 操作対象の Playwright ページ
 * @returns {Promise<void>}
 */
export async function waitForMemoAutosave(page) {
  await page.waitForResponse(
    (response) =>
      /\/api\/memos\/\d+/.test(response.url()) &&
      response.request().method() === "PUT" &&
      response.ok(),
    { timeout: 10_000 },
  );
}

/**
 * メモ帳ダイアログのロケーターを返す。
 *
 * @param {import('@playwright/test').Page} page - 操作対象の Playwright ページ
 * @returns {import('@playwright/test').Locator}
 */
export function memoDialog(page) {
  return page.getByRole("dialog", { name: "メモ帳" });
}

/**
 * 新規メモを作成し、タイトル入力欄の初期化を待つ。
 *
 * @param {import('@playwright/test').Page} page - 操作対象の Playwright ページ
 * @returns {Promise<import('@playwright/test').Locator>} メモタイトル入力欄
 */
export async function createNewMemo(page) {
  const dialog = memoDialog(page);
  await dialog
    .getByRole("button", { name: "新しいメモを作成", exact: true })
    .click();
  const titleInput = dialog.getByLabel("メモタイトル");
  await expect(titleInput).toHaveValue("新しいメモ");
  return titleInput;
}

/**
 * メモのタイトルと本文を編集し、自動保存の完了を待つ。
 *
 * @param {import('@playwright/test').Page} page - 操作対象の Playwright ページ
 * @param {{ title: string, content: string }} draft - 編集内容
 * @returns {Promise<void>}
 */
export async function editMemoDraft(page, { title, content }) {
  const dialog = memoDialog(page);
  const titleInput = dialog.getByLabel("メモタイトル");
  const contentInput = dialog.getByLabel("メモ内容");

  await titleInput.clear();
  await titleInput.fill(title);
  await contentInput.clear();

  const autosave = waitForMemoAutosave(page);
  await contentInput.fill(content);
  await autosave;

  await expect(
    dialog.getByRole("list", { name: "メモ一覧" }).getByText(title, { exact: true }),
  ).toBeVisible({ timeout: 10_000 });
}

/**
 * メモ一覧から指定タイトルのメモを選択する。
 *
 * @param {import('@playwright/test').Page} page - 操作対象の Playwright ページ
 * @param {string} memoTitle - 選択するメモのタイトル
 * @returns {Promise<void>}
 */
export async function selectMemoFromList(page, memoTitle) {
  const dialog = memoDialog(page);
  await expect(dialog.getByText("読み込み中…")).toBeHidden({ timeout: 10_000 });
  const memoItem = dialog
    .getByRole("list", { name: "メモ一覧" })
    .getByRole("listitem")
    .filter({ hasText: memoTitle });
  await expect(memoItem).toBeVisible({ timeout: 10_000 });
  await memoItem.scrollIntoViewIfNeeded();
  await memoItem.click();
  await expect(dialog.getByLabel("メモタイトル")).toHaveValue(memoTitle, {
    timeout: 10_000,
  });
}

/**
 * メモ帳パネルを開く。
 *
 * @param {import('@playwright/test').Page} page - 操作対象の Playwright ページ
 * @returns {Promise<void>}
 */
export async function openMemoPanel(page) {
  await page.getByRole("button", { name: "メモ帳を開く", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "メモ帳" })).toBeVisible();
}

/**
 * メモ帳パネルを閉じる。
 *
 * @param {import('@playwright/test').Page} page - 操作対象の Playwright ページ
 * @returns {Promise<void>}
 */
export async function closeMemoPanel(page) {
  await page
    .getByRole("dialog", { name: "メモ帳" })
    .getByRole("button", { name: "メモ帳を閉じる", exact: true })
    .click();
  await expect(page.getByRole("dialog", { name: "メモ帳" })).toBeHidden();
}

/**
 * Playwright のマウス操作で要素をドラッグ&ドロップする。
 * `@hello-pangea/dnd` 向けに段階的な移動を行う。
 *
 * @param {import('@playwright/test').Page} page - 操作対象の Playwright ページ
 * @param {import('@playwright/test').Locator} source - ドラッグ元
 * @param {import('@playwright/test').Locator} target - ドロップ先
 * @returns {Promise<void>}
 */
export async function dragElement(page, source, target) {
  await source.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();

  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) {
    throw new Error("ドラッグ元またはドロップ先の要素が見つかりません");
  }

  // ボタン類と競合しないよう、カード右端付近からドラッグを開始する
  const startX = sourceBox.x + sourceBox.width - 12;
  const startY = sourceBox.y + sourceBox.height / 2;
  const endX = targetBox.x + targetBox.width / 2;
  const endY = targetBox.y + 24;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.waitForTimeout(200);

  for (let step = 1; step <= 8; step += 1) {
    await page.mouse.move(startX - step * 5, startY, { steps: 1 });
    await page.waitForTimeout(25);
  }

  await page.mouse.move(endX, startY, { steps: 16 });
  await page.mouse.move(endX, endY, { steps: 12 });
  await page.waitForTimeout(200);
  await page.mouse.up();
}

/**
 * タスクを別の列へドラッグして移動する。
 *
 * @param {import('@playwright/test').Page} page - 操作対象の Playwright ページ
 * @param {string} rowTitle - 対象行のタイトル
 * @param {string} taskContent - 移動するタスクの本文
 * @param {string} targetColumnTitle - 移動先の列タイトル
 * @returns {Promise<void>}
 */
export async function dragTaskToColumn(
  page,
  rowTitle,
  taskContent,
  targetColumnTitle,
) {
  const row = rowByTitle(page, rowTitle);
  const taskCard = row.locator(".task-card").filter({
    has: page.getByRole("button", {
      name: `タスク「${taskContent}」を編集`,
      exact: true,
    }),
  });
  const targetColumn = columnInRow(row, targetColumnTitle);
  const targetBody = targetColumn.locator(".column-body");

  const moveResponse = page.waitForResponse(
    (response) =>
      /\/api\/tasks\/\d+\/move$/.test(response.url()) &&
      response.request().method() === "PUT" &&
      response.ok(),
    { timeout: 15_000 },
  );

  await dragElement(page, taskCard, targetBody);
  await moveResponse;

  await expect(
    targetColumn.getByRole("button", {
      name: `タスク「${taskContent}」を編集`,
      exact: true,
    }),
  ).toBeVisible({ timeout: 15_000 });
}

/**
 * ログイン画面で資格情報を入力してログインする。
 *
 * @param {import('@playwright/test').Page} page - 操作対象の Playwright ページ
 * @param {string} username - ユーザー名
 * @param {string} password - パスワード
 * @returns {Promise<void>}
 */
export async function loginWithCredentials(page, username, password) {
  await page.getByPlaceholder("ユーザー名を入力").fill(username);
  await page.getByPlaceholder("パスワードを入力").fill(password);
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
  await page
    .getByLabel("ボード統計")
    .waitFor({ state: "visible", timeout: 30_000 });
}
