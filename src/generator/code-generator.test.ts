import { describe, expect, it } from "vitest";
import { analyzeTable } from "../analyzer/table-analyzer.js";
import { generateLoaderCode } from "./code-generator.js";

import * as basicPkSchema from "../__tests__/golden/basic-pk/schema.js";
import * as uuidPkSchema from "../__tests__/golden/uuid-pk/schema.js";
import * as uniqueIndexSchema from "../__tests__/golden/unique-index/schema.js";
import * as nonUniqueIndexSchema from "../__tests__/golden/non-unique-index/schema.js";
import * as multipleIndexesSchema from "../__tests__/golden/multiple-indexes/schema.js";
import * as multipleTablesSchema from "../__tests__/golden/multiple-tables/schema.js";

describe("generateLoaderCode", () => {
  it("generates loader for basic primary key", async () => {
    const tables = [analyzeTable(basicPkSchema.users)];
    const code = generateLoaderCode(tables, { schemaImport: "./schema.js" });
    await expect(code).toMatchFileSnapshot("../__tests__/golden/basic-pk/loaders.ts");
  });

  it("generates loader for uuid primary key", async () => {
    const tables = [analyzeTable(uuidPkSchema.items)];
    const code = generateLoaderCode(tables, { schemaImport: "./schema.js" });
    await expect(code).toMatchFileSnapshot("../__tests__/golden/uuid-pk/loaders.ts");
  });

  it("generates loader for unique index", async () => {
    const tables = [analyzeTable(uniqueIndexSchema.users)];
    const code = generateLoaderCode(tables, { schemaImport: "./schema.js" });
    await expect(code).toMatchFileSnapshot("../__tests__/golden/unique-index/loaders.ts");
  });

  it("generates loader for non-unique index", async () => {
    const tables = [analyzeTable(nonUniqueIndexSchema.posts)];
    const code = generateLoaderCode(tables, { schemaImport: "./schema.js" });
    await expect(code).toMatchFileSnapshot(
      "../__tests__/golden/non-unique-index/loaders.ts"
    );
  });

  it("generates loaders for multiple indexes", async () => {
    const tables = [analyzeTable(multipleIndexesSchema.posts)];
    const code = generateLoaderCode(tables, { schemaImport: "./schema.js" });
    await expect(code).toMatchFileSnapshot(
      "../__tests__/golden/multiple-indexes/loaders.ts"
    );
  });

  it("generates loaders for multiple tables", async () => {
    const tables = [
      analyzeTable(multipleTablesSchema.users),
      analyzeTable(multipleTablesSchema.posts),
    ];
    const code = generateLoaderCode(tables, { schemaImport: "./schema.js" });
    await expect(code).toMatchFileSnapshot(
      "../__tests__/golden/multiple-tables/loaders.ts"
    );
  });
});
