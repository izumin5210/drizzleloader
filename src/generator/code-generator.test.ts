import { describe, expect, it } from "vitest";
import * as basicPkSchema from "../__tests__/golden/basic-pk/schema.js";
import * as compositeIndexSchema from "../__tests__/golden/composite-index/schema.js";
import * as compositePkSchema from "../__tests__/golden/composite-pk/schema.js";
import * as compositeUniqueIndexSchema from "../__tests__/golden/composite-unique-index/schema.js";
import * as multipleIndexesSchema from "../__tests__/golden/multiple-indexes/schema.js";
import * as multipleTablesSchema from "../__tests__/golden/multiple-tables/schema.js";
import * as nonUniqueIndexSchema from "../__tests__/golden/non-unique-index/schema.js";
import * as uniqueIndexSchema from "../__tests__/golden/unique-index/schema.js";
import * as uuidPkSchema from "../__tests__/golden/uuid-pk/schema.js";
import { analyzeTable } from "../analyzer/table-analyzer.js";
import {
  generateEntryPointFile,
  generateMultiFileOutput,
  generateTableFile,
} from "./code-generator.js";

describe("generateMultiFileOutput golden tests", () => {
  it("generates loader files for basic primary key", async () => {
    const tables = [analyzeTable(basicPkSchema.users)];
    const files = generateMultiFileOutput(tables, {
      schemaImport: "./schema.js",
      importExtension: ".js",
    });

    await expect(files.get("drizzleloaders.ts")).toMatchFileSnapshot(
      "../__tests__/golden/basic-pk/drizzleloaders.ts",
    );
    await expect(files.get("drizzleloaders/_runtime.ts")).toMatchFileSnapshot(
      "../__tests__/golden/basic-pk/drizzleloaders/_runtime.ts",
    );
    await expect(files.get("drizzleloaders/users.ts")).toMatchFileSnapshot(
      "../__tests__/golden/basic-pk/drizzleloaders/users.ts",
    );
  });

  it("generates loader files for uuid primary key", async () => {
    const tables = [analyzeTable(uuidPkSchema.items)];
    const files = generateMultiFileOutput(tables, {
      schemaImport: "./schema.js",
      importExtension: ".js",
    });

    await expect(files.get("drizzleloaders.ts")).toMatchFileSnapshot(
      "../__tests__/golden/uuid-pk/drizzleloaders.ts",
    );
    await expect(files.get("drizzleloaders/_runtime.ts")).toMatchFileSnapshot(
      "../__tests__/golden/uuid-pk/drizzleloaders/_runtime.ts",
    );
    await expect(files.get("drizzleloaders/items.ts")).toMatchFileSnapshot(
      "../__tests__/golden/uuid-pk/drizzleloaders/items.ts",
    );
  });

  it("generates loader files for unique index", async () => {
    const tables = [analyzeTable(uniqueIndexSchema.users)];
    const files = generateMultiFileOutput(tables, {
      schemaImport: "./schema.js",
      importExtension: ".js",
    });

    await expect(files.get("drizzleloaders.ts")).toMatchFileSnapshot(
      "../__tests__/golden/unique-index/drizzleloaders.ts",
    );
    await expect(files.get("drizzleloaders/_runtime.ts")).toMatchFileSnapshot(
      "../__tests__/golden/unique-index/drizzleloaders/_runtime.ts",
    );
    await expect(files.get("drizzleloaders/users.ts")).toMatchFileSnapshot(
      "../__tests__/golden/unique-index/drizzleloaders/users.ts",
    );
  });

  it("generates loader files for non-unique index", async () => {
    const tables = [analyzeTable(nonUniqueIndexSchema.posts)];
    const files = generateMultiFileOutput(tables, {
      schemaImport: "./schema.js",
      importExtension: ".js",
    });

    await expect(files.get("drizzleloaders.ts")).toMatchFileSnapshot(
      "../__tests__/golden/non-unique-index/drizzleloaders.ts",
    );
    await expect(files.get("drizzleloaders/_runtime.ts")).toMatchFileSnapshot(
      "../__tests__/golden/non-unique-index/drizzleloaders/_runtime.ts",
    );
    await expect(files.get("drizzleloaders/posts.ts")).toMatchFileSnapshot(
      "../__tests__/golden/non-unique-index/drizzleloaders/posts.ts",
    );
  });

  it("generates loader files for multiple indexes", async () => {
    const tables = [analyzeTable(multipleIndexesSchema.posts)];
    const files = generateMultiFileOutput(tables, {
      schemaImport: "./schema.js",
      importExtension: ".js",
    });

    await expect(files.get("drizzleloaders.ts")).toMatchFileSnapshot(
      "../__tests__/golden/multiple-indexes/drizzleloaders.ts",
    );
    await expect(files.get("drizzleloaders/_runtime.ts")).toMatchFileSnapshot(
      "../__tests__/golden/multiple-indexes/drizzleloaders/_runtime.ts",
    );
    await expect(files.get("drizzleloaders/posts.ts")).toMatchFileSnapshot(
      "../__tests__/golden/multiple-indexes/drizzleloaders/posts.ts",
    );
  });

  it("generates loader files for multiple tables", async () => {
    const tables = [
      analyzeTable(multipleTablesSchema.users),
      analyzeTable(multipleTablesSchema.posts),
    ];
    const files = generateMultiFileOutput(tables, {
      schemaImport: "./schema.js",
      importExtension: ".js",
    });

    await expect(files.get("drizzleloaders.ts")).toMatchFileSnapshot(
      "../__tests__/golden/multiple-tables/drizzleloaders.ts",
    );
    await expect(files.get("drizzleloaders/_runtime.ts")).toMatchFileSnapshot(
      "../__tests__/golden/multiple-tables/drizzleloaders/_runtime.ts",
    );
    await expect(files.get("drizzleloaders/users.ts")).toMatchFileSnapshot(
      "../__tests__/golden/multiple-tables/drizzleloaders/users.ts",
    );
    await expect(files.get("drizzleloaders/posts.ts")).toMatchFileSnapshot(
      "../__tests__/golden/multiple-tables/drizzleloaders/posts.ts",
    );
  });

  it("generates loader files for composite index", async () => {
    const tables = [analyzeTable(compositeIndexSchema.posts)];
    const files = generateMultiFileOutput(tables, {
      schemaImport: "./schema.js",
      importExtension: ".js",
    });

    await expect(files.get("drizzleloaders.ts")).toMatchFileSnapshot(
      "../__tests__/golden/composite-index/drizzleloaders.ts",
    );
    await expect(files.get("drizzleloaders/_runtime.ts")).toMatchFileSnapshot(
      "../__tests__/golden/composite-index/drizzleloaders/_runtime.ts",
    );
    await expect(files.get("drizzleloaders/posts.ts")).toMatchFileSnapshot(
      "../__tests__/golden/composite-index/drizzleloaders/posts.ts",
    );
  });

  it("generates loader files for composite unique index", async () => {
    const tables = [analyzeTable(compositeUniqueIndexSchema.posts)];
    const files = generateMultiFileOutput(tables, {
      schemaImport: "./schema.js",
      importExtension: ".js",
    });

    await expect(files.get("drizzleloaders.ts")).toMatchFileSnapshot(
      "../__tests__/golden/composite-unique-index/drizzleloaders.ts",
    );
    await expect(files.get("drizzleloaders/_runtime.ts")).toMatchFileSnapshot(
      "../__tests__/golden/composite-unique-index/drizzleloaders/_runtime.ts",
    );
    await expect(files.get("drizzleloaders/posts.ts")).toMatchFileSnapshot(
      "../__tests__/golden/composite-unique-index/drizzleloaders/posts.ts",
    );
  });

  it("generates loader files for composite primary key", async () => {
    const tables = [analyzeTable(compositePkSchema.user_roles)];
    const files = generateMultiFileOutput(tables, {
      schemaImport: "./schema.js",
      importExtension: ".js",
    });

    await expect(files.get("drizzleloaders.ts")).toMatchFileSnapshot(
      "../__tests__/golden/composite-pk/drizzleloaders.ts",
    );
    await expect(files.get("drizzleloaders/_runtime.ts")).toMatchFileSnapshot(
      "../__tests__/golden/composite-pk/drizzleloaders/_runtime.ts",
    );
    await expect(files.get("drizzleloaders/userRoles.ts")).toMatchFileSnapshot(
      "../__tests__/golden/composite-pk/drizzleloaders/userRoles.ts",
    );
  });
});

describe("generateTableFile", () => {
  it("generates table loader file with imports from runtime", () => {
    const table = analyzeTable(basicPkSchema.users);
    const code = generateTableFile(table, {
      schemaImport: "../../schema.js",
      runtimeImport: "./_runtime.js",
    });
    expect(code).toContain("type DrizzleDb,");
    expect(code).toContain("DrizzleLoaderNotFound,");
    expect(code).toContain("buildLookupMap,");
    expect(code).toContain("lookupOrError,");
    expect(code).toContain('} from "./_runtime.js"');
    expect(code).toContain('import * as __schema from "../../schema.js"');
    expect(code).toContain("export function createUsersLoaders");
  });

  it("generates unique loader using buildLookupMap and lookupOrError", () => {
    const table = analyzeTable(basicPkSchema.users);
    const code = generateTableFile(table, {
      schemaImport: "../../schema.js",
      runtimeImport: "./_runtime.js",
    });
    expect(code).toContain("buildLookupMap(rows, (row) => row.id)");
    expect(code).toContain('lookupOrError(map, key, "users", "id")');
  });
});

describe("generateEntryPointFile", () => {
  it("generates entry point that imports table loaders and re-exports error from runtime", () => {
    const tables = [analyzeTable(basicPkSchema.users)];
    const code = generateEntryPointFile(tables, {
      tableImportPrefix: "./drizzleloaders/",
      importExtension: ".js",
      runtimeImport: "./drizzleloaders/_runtime.js",
    });
    expect(code).toContain(
      'import { createUsersLoaders } from "./drizzleloaders/users.js"',
    );
    expect(code).toContain(
      'export { DrizzleLoaderNotFound } from "./drizzleloaders/_runtime.js"',
    );
    expect(code).toContain("export function createDrizzleLoaders");
  });

  it("generates entry point for multiple tables", () => {
    const tables = [
      analyzeTable(multipleTablesSchema.users),
      analyzeTable(multipleTablesSchema.posts),
    ];
    const code = generateEntryPointFile(tables, {
      tableImportPrefix: "./drizzleloaders/",
      importExtension: ".js",
      runtimeImport: "./drizzleloaders/_runtime.js",
    });
    expect(code).toContain(
      'import { createUsersLoaders } from "./drizzleloaders/users.js"',
    );
    expect(code).toContain(
      'import { createPostsLoaders } from "./drizzleloaders/posts.js"',
    );
    expect(code).toContain("users: createUsersLoaders(db)");
    expect(code).toContain("posts: createPostsLoaders(db)");
  });

  it("converts snake_case table names to camelCase for file imports", () => {
    const tables = [analyzeTable(multipleIndexesSchema.posts)];
    const code = generateEntryPointFile(tables, {
      tableImportPrefix: "./drizzleloaders/",
      importExtension: ".js",
      runtimeImport: "./drizzleloaders/_runtime.js",
    });
    expect(code).toContain("createPostsLoaders");
  });
});

describe("generateMultiFileOutput", () => {
  it("returns Map with all generated files including runtime", () => {
    const tables = [analyzeTable(basicPkSchema.users)];
    const files = generateMultiFileOutput(tables, {
      schemaImport: "./schema.js",
      importExtension: ".js",
    });

    expect(files.get("drizzleloaders.ts")).toBeDefined();
    expect(files.get("drizzleloaders/_runtime.ts")).toBeDefined();
    expect(files.get("drizzleloaders/users.ts")).toBeDefined();
  });

  it("generates runtime file with necessary helpers", () => {
    const tables = [analyzeTable(basicPkSchema.users)];
    const files = generateMultiFileOutput(tables, {
      schemaImport: "./schema.js",
      importExtension: ".js",
    });

    const runtimeFile = files.get("drizzleloaders/_runtime.ts");
    expect(runtimeFile).toContain("class DrizzleLoaderNotFound");
    expect(runtimeFile).toContain("export function buildLookupMap");
    expect(runtimeFile).toContain("export function lookupOrError");
    expect(runtimeFile).toContain("export type DrizzleDb");
  });

  it("generates runtime file with composite helpers when needed", () => {
    const tables = [analyzeTable(compositeIndexSchema.posts)];
    const files = generateMultiFileOutput(tables, {
      schemaImport: "./schema.js",
      importExtension: ".js",
    });

    const runtimeFile = files.get("drizzleloaders/_runtime.ts");
    expect(runtimeFile).toContain("class DrizzleLoaderNotFound");
    expect(runtimeFile).toContain("export function serializeCompositeKey");
    expect(runtimeFile).toContain("export function buildCompositeLookupMap");
    expect(runtimeFile).toContain("export async function queryCompositeKey");
  });

  it("adjusts schema import path for files inside drizzleloaders directory", () => {
    const tables = [analyzeTable(basicPkSchema.users)];
    const files = generateMultiFileOutput(tables, {
      schemaImport: "./schema.js",
      importExtension: ".js",
    });

    const runtimeFile = files.get("drizzleloaders/_runtime.ts");
    expect(runtimeFile).toContain(
      'import type * as __schema from "../schema.js"',
    );

    const tableFile = files.get("drizzleloaders/users.ts");
    expect(tableFile).toContain('import * as __schema from "../schema.js"');
  });

  it("generates files for multiple tables", () => {
    const tables = [
      analyzeTable(multipleTablesSchema.users),
      analyzeTable(multipleTablesSchema.posts),
    ];
    const files = generateMultiFileOutput(tables, {
      schemaImport: "./schema.js",
      importExtension: ".js",
    });

    expect(files.get("drizzleloaders.ts")).toBeDefined();
    expect(files.get("drizzleloaders/_runtime.ts")).toBeDefined();
    expect(files.get("drizzleloaders/users.ts")).toBeDefined();
    expect(files.get("drizzleloaders/posts.ts")).toBeDefined();
  });

  it("handles parent directory schema imports", () => {
    const tables = [analyzeTable(basicPkSchema.users)];
    const files = generateMultiFileOutput(tables, {
      schemaImport: "../db/schema.js",
      importExtension: ".js",
    });

    const runtimeFile = files.get("drizzleloaders/_runtime.ts");
    expect(runtimeFile).toContain(
      'import type * as __schema from "../../db/schema.js"',
    );
  });

  it("preserves package imports without modification", () => {
    const tables = [analyzeTable(basicPkSchema.users)];
    const files = generateMultiFileOutput(tables, {
      schemaImport: "@myapp/db/schema",
      importExtension: ".js",
    });

    const runtimeFile = files.get("drizzleloaders/_runtime.ts");
    expect(runtimeFile).toContain(
      'import type * as __schema from "@myapp/db/schema"',
    );
  });
});
