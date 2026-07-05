import { describe, expect, it } from "vitest";
import { generateOpenApiDocument } from "./document.js";

describe("generateOpenApiDocument", () => {
  it("OpenAPI 3.1 メタデータを含む", () => {
    const doc = generateOpenApiDocument();

    expect(doc.openapi).toBe("3.1.0");
    expect(doc.info).toMatchObject({
      title: "Kando API",
      version: "0.3.1",
    });
    expect(doc.servers?.length).toBeGreaterThan(0);
  });

  it("主要 API パスを登録する", () => {
    const paths = Object.keys(generateOpenApiDocument().paths ?? {});

    expect(paths).toEqual(
      expect.arrayContaining([
        "/api/health",
        "/api/auth/login",
        "/api/board",
        "/api/tasks",
        "/api/tasks/{id}/snapshot",
        "/api/memos",
      ]),
    );
  });

  it("認証スキームを登録する", () => {
    const schemes = generateOpenApiDocument().components?.securitySchemes ?? {};

    expect(schemes).toHaveProperty("cookieAuth");
    expect(schemes).toHaveProperty("bearerAuth");
  });

  it("共有スキーマを components に含む", () => {
    const schemas = generateOpenApiDocument().components?.schemas ?? {};

    expect(schemas).toHaveProperty("RegisterBody");
    expect(schemas).toHaveProperty("TaskSnapshotBody");
    expect(schemas).toHaveProperty("Task");
  });

  it("スキーマ名一覧がスナップショットと一致する", () => {
    const schemaNames = Object.keys(
      generateOpenApiDocument().components?.schemas ?? {},
    ).sort();

    expect(schemaNames).toMatchSnapshot();
  });
});
