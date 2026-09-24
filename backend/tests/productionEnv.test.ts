import { describe, expect, it } from "vitest";
import {
  DEV_AUTH_SECRET,
  isCookieSecure,
  productionEnvError,
} from "../productionEnv.js";

describe("productionEnvError", () => {
  it("本番以外では検査しない", () => {
    expect(productionEnvError({ NODE_ENV: "development" })).toBeNull();
  });

  it("本番で CORS_ORIGIN が無いと失敗する", () => {
    expect(
      productionEnvError({
        NODE_ENV: "production",
        AUTH_SECRET: "a-real-secret-value",
      }),
    ).toMatch(/CORS_ORIGIN/);
  });

  it("本番で AUTH_SECRET が無いと失敗する", () => {
    expect(
      productionEnvError({
        NODE_ENV: "production",
        CORS_ORIGIN: "http://localhost:8080",
      }),
    ).toMatch(/AUTH_SECRET/);
  });

  it("本番で開発用シークレットは拒否する", () => {
    expect(
      productionEnvError({
        NODE_ENV: "production",
        CORS_ORIGIN: "http://localhost:8080",
        AUTH_SECRET: DEV_AUTH_SECRET,
      }),
    ).toMatch(/development placeholder/);
  });

  it("本番で必須値が揃っていれば成功する", () => {
    expect(
      productionEnvError({
        NODE_ENV: "production",
        CORS_ORIGIN: "http://localhost:8080",
        AUTH_SECRET: "a-real-secret-value",
      }),
    ).toBeNull();
  });
});

describe("isCookieSecure", () => {
  it("COOKIE_SECURE の明示を優先する", () => {
    expect(
      isCookieSecure({ NODE_ENV: "production", COOKIE_SECURE: "false" }),
    ).toBe(false);
    expect(
      isCookieSecure({ NODE_ENV: "development", COOKIE_SECURE: "true" }),
    ).toBe(true);
  });

  it("未指定時は本番だけ Secure にする", () => {
    expect(isCookieSecure({ NODE_ENV: "production" })).toBe(true);
    expect(isCookieSecure({ NODE_ENV: "development" })).toBe(false);
  });
});
