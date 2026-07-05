import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/errorHandler.js";
import { authenticate } from "../middleware/authenticate.js";
import { pool } from "../db.js";

vi.hoisted(() => {
  process.env.AUTH_SECRET = "test-auth-secret-for-integration-tests";
});

const { default: authRouter } = await import("../routes/auth.js");

vi.mock("../db.js", () => ({
  pool: {
    query: vi.fn(),
    connect: vi.fn(),
  },
}));

type MockFn = ReturnType<typeof vi.fn>;
type MockedClient = {
  query: MockFn;
  release: MockFn;
};
type MockedPool = {
  query: MockFn;
  connect: MockFn;
};

const mockedPool = pool as unknown as MockedPool;

/**
 * 認証ルーターテスト用の Express アプリを生成する。
 * @returns auth API をマウントした Express アプリ
 */
function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", authRouter);
  app.use(errorHandler);
  return app;
}

/**
 * テスト用 JWT Cookie 文字列を生成する。
 * @param userId - JWT subject となるユーザー ID
 * @returns `token=...` 形式の Cookie ヘッダー値
 */
async function createAuthCookie(userId: number): Promise<string> {
  const secretKey = new TextEncoder().encode(
    "test-auth-secret-for-integration-tests",
  );
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secretKey);
  return `token=${token}`;
}

describe("auth router", () => {
  const originalAuthSecret = process.env.AUTH_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_SECRET = "test-auth-secret-for-integration-tests";
  });

  afterEach(() => {
    process.env.AUTH_SECRET = originalAuthSecret;
  });

  it("GET /api/auth/status は登録ユーザー有無を返す", async () => {
    mockedPool.query.mockResolvedValueOnce({ rows: [{ count: "2" }] });

    const res = await request(createApp()).get("/api/auth/status");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ hasUsers: true });
    expect(mockedPool.query).toHaveBeenCalledWith("SELECT COUNT(*) FROM users");
  });

  it("GET /api/auth/status はユーザー未登録時に hasUsers=false を返す", async () => {
    mockedPool.query.mockResolvedValueOnce({ rows: [{ count: "0" }] });

    const res = await request(createApp()).get("/api/auth/status");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ hasUsers: false });
  });

  it("POST /api/auth/register はユーザーを作成して Cookie をセットする", async () => {
    const client: MockedClient = {
      query: vi.fn(),
      release: vi.fn(),
    };
    mockedPool.connect.mockResolvedValue(client);
    client.query.mockImplementation(async (sql: unknown) => {
      const statement = String(sql);
      if (statement === "BEGIN" || statement === "COMMIT") {
        return { rows: [] };
      }
      if (statement.includes("INSERT INTO users")) {
        return { rows: [{ id: 7 }] };
      }
      if (statement.includes("UPDATE rows SET user_id")) {
        return { rowCount: 0, rows: [] };
      }
      throw new Error(`Unexpected SQL: ${statement}`);
    });

    const res = await request(createApp())
      .post("/api/auth/register")
      .send({ username: "newuser", password: "validpassword12" });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });
    expect(res.headers["set-cookie"]?.[0]).toMatch(/^token=/);
    expect(client.release).toHaveBeenCalled();
  });

  it("POST /api/auth/register は短いパスワードを 400 で拒否する", async () => {
    const res = await request(createApp())
      .post("/api/auth/register")
      .send({ username: "newuser", password: "short" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("パスワードは12文字以上で入力してください");
    expect(mockedPool.connect).not.toHaveBeenCalled();
  });

  it("POST /api/auth/register は重複ユーザー名を 409 で拒否する", async () => {
    const client: MockedClient = {
      query: vi.fn(),
      release: vi.fn(),
    };
    mockedPool.connect.mockResolvedValue(client);
    client.query.mockImplementation(async (sql: unknown) => {
      const statement = String(sql);
      if (statement === "BEGIN") return { rows: [] };
      if (statement.includes("INSERT INTO users")) {
        const err = Object.assign(new Error("duplicate"), { code: "23505" });
        throw err;
      }
      if (statement === "ROLLBACK") return { rows: [] };
      throw new Error(`Unexpected SQL: ${statement}`);
    });

    const res = await request(createApp())
      .post("/api/auth/register")
      .send({ username: "existing", password: "validpassword12" });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("このユーザー名は既に使用されています");
    expect(client.release).toHaveBeenCalled();
  });

  it("POST /api/auth/login は正しい認証情報で Cookie を返す", async () => {
    const passwordHash = await bcrypt.hash("validpassword12", 12);
    mockedPool.query.mockResolvedValueOnce({
      rows: [{ id: 3, password_hash: passwordHash }],
    });

    const res = await request(createApp())
      .post("/api/auth/login")
      .send({ username: "alice", password: "validpassword12" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(res.headers["set-cookie"]?.[0]).toMatch(/^token=/);
  });

  it("POST /api/auth/login は誤ったパスワードを 401 で拒否する", async () => {
    const passwordHash = await bcrypt.hash("validpassword12", 12);
    mockedPool.query.mockResolvedValueOnce({
      rows: [{ id: 3, password_hash: passwordHash }],
    });

    const res = await request(createApp())
      .post("/api/auth/login")
      .send({ username: "alice", password: "wrongpassword1" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("ユーザー名またはパスワードが正しくありません");
  });

  it("POST /api/auth/login は存在しないユーザーを 401 で拒否する", async () => {
    mockedPool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(createApp())
      .post("/api/auth/login")
      .send({ username: "ghost", password: "validpassword12" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("ユーザー名またはパスワードが正しくありません");
  });

  it("POST /api/auth/logout は Cookie をクリアする", async () => {
    const res = await request(createApp()).post("/api/auth/logout");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(res.headers["set-cookie"]?.[0]).toMatch(/token=;/);
  });

  it("GET /api/auth/verify は有効な Cookie で 200 を返す", async () => {
    const verifyApp = express();
    verifyApp.use(cookieParser());
    verifyApp.get("/api/auth/verify", authenticate, (_req, res) => {
      res.json({ ok: true });
    });
    verifyApp.use(errorHandler);

    const cookie = await createAuthCookie(5);
    const res = await request(verifyApp)
      .get("/api/auth/verify")
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
