import express from "express";
import request from "supertest";
import { describe, it } from "vitest";
import { AUTH_FAILURE_LIMIT, applyRateLimits } from "../rateLimits.js";

/**
 * レートリミットテスト用の Express アプリを生成する。
 * login は `ok` ボディが true のときだけ成功(200)、それ以外は 401 を返す。
 * @param options - applyRateLimits に渡すオプション
 * @returns リミッターと簡易ルートを登録した Express アプリ
 */
function createApp(options?: { disableAuthLimit?: boolean }) {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  applyRateLimits(app, options);
  app.get("/api/auth/status", (_req, res) => {
    res.json({ hasUsers: true });
  });
  app.post("/api/auth/login", (req, res) => {
    res.status(req.body?.ok ? 200 : 401).json({});
  });
  return app;
}

describe("applyRateLimits", () => {
  it("login の失敗が上限を超えると 429 を返す", async () => {
    const app = createApp();
    for (let i = 0; i < AUTH_FAILURE_LIMIT; i++) {
      await request(app).post("/api/auth/login").send({}).expect(401);
    }
    await request(app).post("/api/auth/login").send({}).expect(429);
  });

  it("成功した login は上限に数えない", async () => {
    const app = createApp();
    for (let i = 0; i < AUTH_FAILURE_LIMIT * 2; i++) {
      await request(app).post("/api/auth/login").send({ ok: true }).expect(200);
    }
  });

  it("status は認証専用リミッターの対象外", async () => {
    const app = createApp();
    for (let i = 0; i < AUTH_FAILURE_LIMIT * 2; i++) {
      await request(app).get("/api/auth/status").expect(200);
    }
  });

  it("IP ごとに別カウントになる", async () => {
    const app = createApp();
    for (let i = 0; i < AUTH_FAILURE_LIMIT; i++) {
      await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", "203.0.113.1")
        .send({})
        .expect(401);
    }
    await request(app)
      .post("/api/auth/login")
      .set("X-Forwarded-For", "203.0.113.1")
      .send({})
      .expect(429);
    await request(app)
      .post("/api/auth/login")
      .set("X-Forwarded-For", "203.0.113.2")
      .send({})
      .expect(401);
  });

  it("disableAuthLimit では認証専用リミッターを適用しない", async () => {
    const app = createApp({ disableAuthLimit: true });
    for (let i = 0; i < AUTH_FAILURE_LIMIT * 2; i++) {
      await request(app).post("/api/auth/login").send({}).expect(401);
    }
  });
});
