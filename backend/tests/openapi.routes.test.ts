import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, beforeAll } from "vitest";
import request from "supertest";
import express from "express";
import openapiRouter from "../routes/openapi.js";

const backendRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("OpenAPI routes", () => {
  beforeAll(() => {
    execSync("npm run openapi:generate", {
      cwd: backendRoot,
      stdio: "pipe",
    });
  });

  const app = express();
  app.use("/api", openapiRouter);

  it("GET /api/openapi.json returns OpenAPI document", async () => {
    const res = await request(app).get("/api/openapi.json");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/json/);
    expect(res.body.openapi).toBe("3.1.0");
    expect(res.body.paths["/api/health"]).toBeDefined();
  });

  it("GET /api/docs returns Swagger UI HTML", async () => {
    const res = await request(app).get("/api/docs");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/html/);
    expect(res.text).toContain("swagger-ui");
    expect(res.text).toContain("/api/openapi.json");
  });
});
