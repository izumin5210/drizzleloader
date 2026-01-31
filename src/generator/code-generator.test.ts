import { describe, expect, it } from "vitest";
import * as basicPkSchema from "../__tests__/golden/basic-pk/schema.js";
import * as compositeIndexSchema from "../__tests__/golden/composite-index/schema.js";
import * as multipleIndexesSchema from "../__tests__/golden/multiple-indexes/schema.js";
import * as multipleTablesSchema from "../__tests__/golden/multiple-tables/schema.js";
import * as nonUniqueIndexSchema from "../__tests__/golden/non-unique-index/schema.js";
import * as uniqueIndexSchema from "../__tests__/golden/unique-index/schema.js";
import * as uuidPkSchema from "../__tests__/golden/uuid-pk/schema.js";
import { analyzeTable } from "../analyzer/table-analyzer.js";
import {
  generateEntryPointFile,
  generateHelperFunctions,
  generateInternalFile,
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
    await expect(files.get("drizzleloaders/_internal.ts")).toMatchFileSnapshot(
      "../__tests__/golden/basic-pk/drizzleloaders/_internal.ts",
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
    await expect(files.get("drizzleloaders/_internal.ts")).toMatchFileSnapshot(
      "../__tests__/golden/uuid-pk/drizzleloaders/_internal.ts",
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
    await expect(files.get("drizzleloaders/_internal.ts")).toMatchFileSnapshot(
      "../__tests__/golden/unique-index/drizzleloaders/_internal.ts",
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
    await expect(files.get("drizzleloaders/_internal.ts")).toMatchFileSnapshot(
      "../__tests__/golden/non-unique-index/drizzleloaders/_internal.ts",
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
    await expect(files.get("drizzleloaders/_internal.ts")).toMatchFileSnapshot(
      "../__tests__/golden/multiple-indexes/drizzleloaders/_internal.ts",
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
    await expect(files.get("drizzleloaders/_internal.ts")).toMatchFileSnapshot(
      "../__tests__/golden/multiple-tables/drizzleloaders/_internal.ts",
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
    await expect(files.get("drizzleloaders/_internal.ts")).toMatchFileSnapshot(
      "../__tests__/golden/composite-index/drizzleloaders/_internal.ts",
    );
    await expect(files.get("drizzleloaders/posts.ts")).toMatchFileSnapshot(
      "../__tests__/golden/composite-index/drizzleloaders/posts.ts",
    );
  });
});

describe("generateHelperFunctions", () => {
  it("generates buildLookupMap function", () => {
    const code = generateHelperFunctions();
    expect(code).toContain("export function buildLookupMap<K, V>");
    expect(code).toContain("rows: V[]");
    expect(code).toContain("keyFn: (row: V) => K");
    expect(code).toContain("): Map<K, V>");
  });

  it("generates lookupOrError function", () => {
    const code = generateHelperFunctions();
    expect(code).toContain("export function lookupOrError<K, V>");
    expect(code).toContain("DrizzleLoaderNotFound");
  });
});

describe("generateInternalFile", () => {
  it("generates _internal.ts content with imports, types, error class, and helpers", () => {
    const code = generateInternalFile({
      schemaImport: "../schema.js",
      dialect: "pg",
    });
    expect(code).toContain('import type * as __schema from "../schema.js"');
    expect(code).toContain("export type DrizzleDb");
    expect(code).toContain("export class DrizzleLoaderNotFound");
    expect(code).toContain("export function buildLookupMap");
    expect(code).toContain("export function lookupOrError");
  });
});

describe("generateTableFile", () => {
  it("generates table loader file with imports from _internal", () => {
    const table = analyzeTable(basicPkSchema.users);
    const code = generateTableFile(table, {
      schemaImport: "../../schema.js",
      internalImport: "./_internal.js",
    });
    expect(code).toContain("type DrizzleDb,");
    expect(code).toContain("DrizzleLoaderNotFound,");
    expect(code).toContain("buildLookupMap,");
    expect(code).toContain("lookupOrError,");
    expect(code).toContain('} from "./_internal.js"');
    expect(code).toContain('import * as __schema from "../../schema.js"');
    expect(code).toContain("export function createUsersLoaders");
  });

  it("generates unique loader using buildLookupMap and lookupOrError", () => {
    const table = analyzeTable(basicPkSchema.users);
    const code = generateTableFile(table, {
      schemaImport: "../../schema.js",
      internalImport: "./_internal.js",
    });
    expect(code).toContain("buildLookupMap(rows, (row) => row.id)");
    expect(code).toContain('lookupOrError(map, key, "users", "id")');
  });
});

describe("generateEntryPointFile", () => {
  it("generates entry point that imports table loaders and re-exports error", () => {
    const tables = [analyzeTable(basicPkSchema.users)];
    const code = generateEntryPointFile(tables, {
      schemaImport: "./schema.js",
      internalImport: "./drizzleloaders/_internal.js",
      tableImportPrefix: "./drizzleloaders/",
      importExtension: ".js",
    });
    expect(code).toContain(
      'import { createUsersLoaders } from "./drizzleloaders/users.js"',
    );
    expect(code).toContain(
      'export { DrizzleLoaderNotFound } from "./drizzleloaders/_internal.js"',
    );
    expect(code).toContain("export function createDrizzleLoaders");
  });

  it("generates entry point for multiple tables", () => {
    const tables = [
      analyzeTable(multipleTablesSchema.users),
      analyzeTable(multipleTablesSchema.posts),
    ];
    const code = generateEntryPointFile(tables, {
      schemaImport: "./schema.js",
      internalImport: "./drizzleloaders/_internal.js",
      tableImportPrefix: "./drizzleloaders/",
      importExtension: ".js",
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
    // Test with a hypothetical snake_case table name
    // Using multipleIndexesSchema.posts as a proxy
    const tables = [analyzeTable(multipleIndexesSchema.posts)];
    const code = generateEntryPointFile(tables, {
      schemaImport: "./schema.js",
      internalImport: "./drizzleloaders/_internal.js",
      tableImportPrefix: "./drizzleloaders/",
      importExtension: ".js",
    });
    expect(code).toContain("createPostsLoaders");
  });
});

describe("generateMultiFileOutput", () => {
  it("returns Map with all generated files", () => {
    const tables = [analyzeTable(basicPkSchema.users)];
    const files = generateMultiFileOutput(tables, {
      schemaImport: "./schema.js",
      importExtension: ".js",
    });

    expect(files.get("drizzleloaders.ts")).toBeDefined();
    expect(files.get("drizzleloaders/_internal.ts")).toBeDefined();
    expect(files.get("drizzleloaders/users.ts")).toBeDefined();
  });

  it("adjusts schema import path for files inside drizzleloaders directory", () => {
    const tables = [analyzeTable(basicPkSchema.users)];
    const files = generateMultiFileOutput(tables, {
      schemaImport: "./schema.js",
      importExtension: ".js",
    });

    const internalFile = files.get("drizzleloaders/_internal.ts");
    expect(internalFile).toContain(
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
    expect(files.get("drizzleloaders/_internal.ts")).toBeDefined();
    expect(files.get("drizzleloaders/users.ts")).toBeDefined();
    expect(files.get("drizzleloaders/posts.ts")).toBeDefined();
  });

  it("handles parent directory schema imports", () => {
    const tables = [analyzeTable(basicPkSchema.users)];
    const files = generateMultiFileOutput(tables, {
      schemaImport: "../db/schema.js",
      importExtension: ".js",
    });

    const internalFile = files.get("drizzleloaders/_internal.ts");
    expect(internalFile).toContain(
      'import type * as __schema from "../../db/schema.js"',
    );
  });

  it("preserves package imports without modification", () => {
    const tables = [analyzeTable(basicPkSchema.users)];
    const files = generateMultiFileOutput(tables, {
      schemaImport: "@myapp/db/schema",
      importExtension: ".js",
    });

    const internalFile = files.get("drizzleloaders/_internal.ts");
    expect(internalFile).toContain(
      'import type * as __schema from "@myapp/db/schema"',
    );
  });
});
