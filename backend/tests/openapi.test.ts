import { describe, expect, it } from "vitest";
import { generateOpenApiDocument } from "@kando/types/openapi";

describe("OpenAPI document", () => {
  it("generates OpenAPI 3.1 document with expected metadata", () => {
    const doc = generateOpenApiDocument();

    expect(doc.openapi).toBe("3.1.0");
    expect(doc.info.title).toBe("Kando API");
    expect(doc.info.version).toBe("0.3.1");
    expect(doc.servers?.length).toBeGreaterThan(0);
  });

  it("includes all major API path groups", () => {
    const doc = generateOpenApiDocument();
    const paths = Object.keys(doc.paths ?? {});

    const requiredPaths = [
      "/api/health",
      "/api/liveness",
      "/api/auth/status",
      "/api/auth/register",
      "/api/auth/login",
      "/api/board",
      "/api/rows",
      "/api/columns",
      "/api/tasks",
      "/api/tasks/{id}/snapshot",
      "/api/subtasks",
      "/api/task-comments",
      "/api/checklist-items",
      "/api/memos",
    ];

    for (const path of requiredPaths) {
      expect(paths, `missing path: ${path}`).toContain(path);
    }
  });

  it("registers authentication security schemes", () => {
    const doc = generateOpenApiDocument();
    const schemes = doc.components?.securitySchemes ?? {};

    expect(schemes).toHaveProperty("cookieAuth");
    expect(schemes).toHaveProperty("bearerAuth");
  });

  it("references shared request body schemas from validation", () => {
    const doc = generateOpenApiDocument();
    const schemas = doc.components?.schemas ?? {};

    expect(schemas).toHaveProperty("RegisterBody");
    expect(schemas).toHaveProperty("TaskSnapshotBody");
    expect(schemas).toHaveProperty("Row");
    expect(schemas).toHaveProperty("Task");
  });
});
