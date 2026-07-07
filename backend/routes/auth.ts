import { Router } from "express";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { pool } from "../db.js";
import { validateBody } from "../middleware/validate.js";
import { loginBodySchema, registerBodySchema } from "@kando/types/validation";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

/** JWT 署名に使用するシークレット */
const AUTH_SECRET = process.env.AUTH_SECRET;
/** JWT の有効期限 */
const TOKEN_EXPIRY = "7d";
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
): Promise<void> {
  const secretKey = new TextEncoder().encode(AUTH_SECRET!);
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(secretKey);

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_MS,
    path: "/",
  });
}

/**
 * GET /api/auth/status
 * ユーザーが1人以上登録されているかを返す(認証不要)。
 * フロントエンドが初期セットアップ画面かログイン画面かを判定するために使用する。
 */
router.get("/status", async (_req, res, next) => {
  try {
    const result = await pool.query<{ count: string }>(
      "SELECT COUNT(*) FROM users",
    );
    const hasUsers = parseInt(result.rows[0].count, 10) > 0;
    res.json({ hasUsers });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/register
 * 新規ユーザーを登録し JWT を返す。
 * 既存の未割り当てデータ(user_id IS NULL の行)は登録ユーザーへ移行される。
 */
router.post(
  "/register",
  validateBody(registerBodySchema),
  async (req, res, next) => {
    if (!AUTH_SECRET) {
      res.status(503).json({ error: "Authentication not configured" });
      return;
    }

    const { username, password } = req.body as {
      username: string;
      password: string;
    };

    try {
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

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

        // 既存の孤立データを最初の登録ユーザーへ移行する(後方互換性)
        await client.query(
          "UPDATE rows SET user_id = $1 WHERE user_id IS NULL",
          [userId],
        );

        await client.query("COMMIT");

        await signAndSetCookie(res, userId);
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
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/auth/login
 * ユーザー名とパスワードを検証し、有効な場合は JWT を返す。
 */
router.post("/login", validateBody(loginBodySchema), async (req, res, next) => {
  if (!AUTH_SECRET) {
    res.status(503).json({ error: "Authentication not configured" });
    return;
  }

  const { username, password } = req.body as {
    username: string;
    password: string;
  };

  try {
    const result = await pool.query<{
      id: number;
      password_hash: string;
    }>("SELECT id, password_hash FROM users WHERE username = $1", [username]);

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

    await signAndSetCookie(res, user.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/logout
 * HttpOnly Cookie を削除してログアウトする。
 */
router.post("/logout", (_req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  res.json({ ok: true });
});

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
