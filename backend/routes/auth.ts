import { Router } from "express";
import { jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { pool } from "../db.js";
import { validateBody } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { loginBodySchema, registerBodySchema } from "@kando/types/validation";
import { authenticate } from "../middleware/authenticate.js";
import {
  authCookieOptions,
  readTokenVersion,
  signAuthToken,
} from "../authToken.js";

const router = Router();

/** JWT 署名に使用するシークレット */
const AUTH_SECRET = process.env.AUTH_SECRET;
/** Cookie の有効期限(ms)*/
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** bcrypt コスト係数 */
const BCRYPT_ROUNDS = 12;
/**
 * ユーザーが存在しない場合のタイミング攻撃対策用ダミーハッシュ。
 * bcrypt.compare は常に実行されるため、ユーザー名の存否がタイミングで露出しない。
 */
const DUMMY_HASH =
  "$2b$12$RJj.qfAEo4xN8xoHk1BzVOXIEFeSPPJVrMrRJdaUh7B2pq2jJz6.";

/**
 * JWT を署名して HttpOnly Cookie としてレスポンスにセットする。
 * @param res - Cookie を設定する Express レスポンス
 * @param userId - JWT の subject となるユーザー ID
 * @returns Cookie 設定完了時に解決される Promise
 */
async function signAndSetCookie(
  res: import("express").Response,
  userId: number,
  tokenVersion: number,
): Promise<void> {
  const token = await signAuthToken(userId, tokenVersion);
  res.cookie("token", token, authCookieOptions(COOKIE_MAX_AGE_MS));
}

/**
 * 認証 Cookie を削除する。
 * @param res - Cookie を消す Express レスポンス
 */
function clearAuthCookie(res: import("express").Response): void {
  res.clearCookie("token", authCookieOptions());
}

/**
 * GET /api/auth/status
 * ユーザーが1人以上登録されているかを返す(認証不要)。
 * フロントエンドが初期セットアップ画面かログイン画面かを判定するために使用する。
 */
router.get(
  "/status",
  asyncHandler(async (_req, res) => {
    const result = await pool.query<{ count: string }>(
      "SELECT COUNT(*) FROM users",
    );
    const hasUsers = parseInt(result.rows[0].count, 10) > 0;
    res.json({ hasUsers });
  }),
);

/**
 * POST /api/auth/register
 * ユーザーが未登録のときだけアカウントを作り、JWT を返す。
 * セットアップ前から残っている所有者なしの行は、この初回登録だけに割り当てる。
 */
router.post(
  "/register",
  validateBody(registerBodySchema),
  asyncHandler(async (req, res) => {
    if (!AUTH_SECRET) {
      res.status(503).json({ error: "Authentication not configured" });
      return;
    }

    const { username, password } = req.body as {
      username: string;
      password: string;
    };

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // 同時の初回登録を直列化し、二人目が孤立行を受け取らないようにする
      await client.query("LOCK TABLE users IN EXCLUSIVE MODE");

      const countResult = await client.query<{ count: string }>(
        "SELECT COUNT(*) FROM users",
      );
      if (parseInt(countResult.rows[0].count, 10) > 0) {
        await client.query("ROLLBACK");
        res
          .status(403)
          .json({ error: "ユーザー登録は初回セットアップ時のみ可能です" });
        return;
      }

      let userId: number;
      try {
        const userResult = await client.query<{ id: number }>(
          "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id",
          [username, passwordHash],
        );
        userId = userResult.rows[0].id;
      } catch (err: unknown) {
        // ユニーク制約違反(重複ユーザー名)
        if (
          err != null &&
          typeof err === "object" &&
          "code" in err &&
          (err as { code: unknown }).code === "23505"
        ) {
          await client.query("ROLLBACK");
          res
            .status(409)
            .json({ error: "このユーザー名は既に使用されています" });
          return;
        }
        throw err;
      }

      // 初回ユーザーにだけ、セットアップ前の所有者なし行を渡す
      await client.query("UPDATE rows SET user_id = $1 WHERE user_id IS NULL", [
        userId,
      ]);

      await client.query("COMMIT");

      await signAndSetCookie(res, userId, 0);
      res.status(201).json({ ok: true });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackErr) {
        console.error("Rollback failed:", rollbackErr);
      }
      throw err;
    } finally {
      client.release();
    }
  }),
);

/**
 * POST /api/auth/login
 * ユーザー名とパスワードを検証し、有効な場合は JWT を返す。
 */
router.post(
  "/login",
  validateBody(loginBodySchema),
  asyncHandler(async (req, res) => {
    if (!AUTH_SECRET) {
      res.status(503).json({ error: "Authentication not configured" });
      return;
    }

    const { username, password } = req.body as {
      username: string;
      password: string;
    };

    const result = await pool.query<{
      id: number;
      password_hash: string;
      token_version: number;
    }>(
      "SELECT id, password_hash, token_version FROM users WHERE username = $1",
      [username],
    );

    const user = result.rows[0];
    // ユーザーが存在しない場合もダミーハッシュで比較し、タイミング攻撃を防ぐ
    const hashToCheck = user?.password_hash ?? DUMMY_HASH;
    const valid = await bcrypt.compare(password, hashToCheck);

    if (!user || !valid) {
      res
        .status(401)
        .json({ error: "ユーザー名またはパスワードが正しくありません" });
      return;
    }

    const tokenVersion =
      Number.isInteger(user.token_version) && user.token_version >= 0
        ? user.token_version
        : 0;
    await signAndSetCookie(res, user.id, tokenVersion);
    res.json({ ok: true });
  }),
);

/**
 * POST /api/auth/logout
 * 提示された JWT の世代を進め、Cookie を削除する。
 * 世代を進めたトークンは、期限前でも以降の API で拒否される。
 */
router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const cookieToken = req.cookies?.token as string | undefined;
    const authHeader = req.headers.authorization;
    const token =
      cookieToken ??
      (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined);

    if (token && AUTH_SECRET) {
      let payload: Awaited<ReturnType<typeof jwtVerify>>["payload"] | undefined;
      try {
        ({ payload } = await jwtVerify(
          token,
          new TextEncoder().encode(AUTH_SECRET),
        ));
      } catch {
        payload = undefined;
      }
      const userId = Number(payload?.sub);
      if (payload && Number.isFinite(userId) && userId > 0) {
        await pool.query(
          `UPDATE users SET token_version = token_version + 1
           WHERE id = $1 AND token_version = $2`,
          [userId, readTokenVersion(payload)],
        );
      }
    }

    clearAuthCookie(res);
    res.json({ ok: true });
  }),
);

/**
 * GET /api/auth/verify
 * Cookie の JWT を検証し、認証済みなら 200 を返す。
 * フロントエンドの初期表示時に認証状態を確認するために使用する。
 */
router.get("/verify", authenticate, (_req, res) => {
  res.json({ ok: true });
});

/** 認証 API(登録・ログイン・ステータス確認)の Express ルーター。 */
export default router;
