import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/errorHandler.js";
import { NotFoundError } from "../errors.js";

/**
 * errorHandler テスト用の Express アプリを生成する。
 * @param jsonLimit - express.json の上限サイズ
 * @returns エコーとエラー送出ルートを持つ Express アプリ
 */
function createApp(jsonLimit = "1kb") {
  const app = express();
  app.use(express.json({ limit: jsonLimit }));
  app.post("/echo", (req, res) => {
    res.json(req.body);
  });
  app.get("/http-error", () => {
    throw new NotFoundError("not found");
  });
  app.get("/boom", () => {
    throw new Error("boom");
  });
  app.use(errorHandler);
  return app;
}

describe("errorHandler", () => {
  it("HttpError はそのステータスで返す", async () => {
    const res = await request(createApp()).get("/http-error");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "not found" });
  });

  it("不正な JSON は 400 を返し、スタックを出力しない", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await request(createApp())
      .post("/echo")
      .set("Content-Type", "application/json")
      .send('{"title": ');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid JSON" });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("上限を超えるボディは 413 を返し、スタックを出力しない", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await request(createApp())
      .post("/echo")
      .send({ content: "a".repeat(2000) });

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: "Request body too large" });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("想定外のエラーは 500 を返す", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await request(createApp()).get("/boom");

    expect(res.status).toBe(500);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
