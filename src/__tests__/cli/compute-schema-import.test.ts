import { describe, expect, it } from "vitest";
import { computeSchemaImport } from "../../utils/import-path.js";

describe("computeSchemaImport", () => {
  it("returns relative path with .js extension by default", () => {
    const result = computeSchemaImport("src/schema.ts", "src/loaders.ts");
    expect(result).toBe("./schema.js");
  });

  it("returns relative path with .js extension when explicitly specified", () => {
    const result = computeSchemaImport(
      "src/schema.ts",
      "src/loaders.ts",
      ".js",
    );
    expect(result).toBe("./schema.js");
  });

  it("returns relative path without extension when none specified", () => {
    const result = computeSchemaImport(
      "src/schema.ts",
      "src/loaders.ts",
      "none",
    );
    expect(result).toBe("./schema");
  });

  it("handles different directories with .js extension", () => {
    const result = computeSchemaImport(
      "src/db/schema.ts",
      "src/loaders/loaders.ts",
      ".js",
    );
    expect(result).toBe("../db/schema.js");
  });

  it("handles different directories without extension", () => {
    const result = computeSchemaImport(
      "src/db/schema.ts",
      "src/loaders/loaders.ts",
      "none",
    );
    expect(result).toBe("../db/schema");
  });
});
