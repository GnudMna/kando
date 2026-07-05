import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authenticate } from "../middleware/authenticate.js";

vi.hoisted(() => {
  process.env.AUTH_SECRET = "test-auth-secret-for-middleware-tests";
});

/**
 * 認証ミドルウェア検証用の最小 Express アプリを生成する。
 * @returns `/protected` に authenticate を適用したアプリ
 */
function createApp() {
  const app = express();
  app.use(cookieParser());
  app.get("/protected", authenticate, (req, res) => {
    res.json({ userId: req.userId });
  });
  return app;
}

/**
 * テスト用 JWT を生成する。
 * @param userId - subject となるユーザー ID
 * @returns 署名済み JWT 文字列
 */
async function signToken(userId: number): Promise<string> {
  const secretKey = new TextEncoder().encode(
    "test-auth-secret-for-middleware-tests",
  );
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secretKey);
}

describe("authenticate middleware", () => {
  const originalAuthSecret = process.env.AUTH_SECRET;

  beforeEach(() => {
    process.env.AUTH_SECRET = "test-auth-secret-for-middleware-tests";
  });

  afterEach(() => {
    process.env.AUTH_SECRET = originalAuthSecret;
  });

  it("AUTH_SECRET 未設定時は 503 を返す", async () => {
    delete process.env.AUTH_SECRET;
    vi.resetModules();
    const { authenticate: freshAuthenticate } =
      await import("../middleware/authenticate.js");

    const app = express();
    app.get("/protected", freshAuthenticate, (_req, res) => {
      res.json({ ok: true });
    });

    const res = await request(app).get("/protected");
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: "Authentication not configured" });
  });

  it("トークン未指定時は 401 を返す", async () => {
    const res = await request(createApp()).get("/protected");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Unauthorized" });
  });

  it("無効な Bearer トークンは 401 を返す", async () => {
    const res = await request(createApp())
      .get("/protected")
      .set("Authorization", "Bearer invalid-token");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Unauthorized" });
  });

  it("有効な Bearer トークンで userId を設定する", async () => {
    const token = await signToken(42);
    const res = await request(createApp())
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId: 42 });
  });

  it("有効な Cookie トークンで userId を設定する", async () => {
    const token = await signToken(17);
    const res = await request(createApp())
      .get("/protected")
      .set("Cookie", `token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId: 17 });
  });

  it("Cookie を Bearer より優先する", async () => {
    const cookieToken = await signToken(11);
    const bearerToken = await signToken(22);
    const res = await request(createApp())
      .get("/protected")
      .set("Cookie", `token=${cookieToken}`)
      .set("Authorization", `Bearer ${bearerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId: 11 });
  });

  it("不正な subject のトークンは 401 を返す", async () => {
    const secretKey = new TextEncoder().encode(
      "test-auth-secret-for-middleware-tests",
    );
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("not-a-number")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(secretKey);

    const res = await request(createApp())
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Unauthorized" });
  });
});
