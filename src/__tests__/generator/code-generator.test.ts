import { describe, expect, it } from "vitest";
import { analyzeTable } from "../../analyzer/table-analyzer.js";
import { generateLoaderCode } from "../../generator/code-generator.js";

import * as basicPkSchema from "../golden/basic-pk/schema.js";
import * as uuidPkSchema from "../golden/uuid-pk/schema.js";
import * as uniqueIndexSchema from "../golden/unique-index/schema.js";
import * as nonUniqueIndexSchema from "../golden/non-unique-index/schema.js";
import * as multipleIndexesSchema from "../golden/multiple-indexes/schema.js";
import * as multipleTablesSchema from "../golden/multiple-tables/schema.js";

describe("generateLoaderCode", () => {
  it("generates loader for basic primary key", async () => {
    const tables = [analyzeTable(basicPkSchema.users)];
    const code = generateLoaderCode(tables, { schemaImport: "./schema.js" });
    await expect(code).toMatchFileSnapshot("../golden/basic-pk/loaders.ts");
  });

  it("generates loader for uuid primary key", async () => {
    const tables = [analyzeTable(uuidPkSchema.items)];
    const code = generateLoaderCode(tables, { schemaImport: "./schema.js" });
    await expect(code).toMatchFileSnapshot("../golden/uuid-pk/loaders.ts");
  });

  it("generates loader for unique index", async () => {
    const tables = [analyzeTable(uniqueIndexSchema.users)];
    const code = generateLoaderCode(tables, { schemaImport: "./schema.js" });
    await expect(code).toMatchFileSnapshot("../golden/unique-index/loaders.ts");
  });

  it("generates loader for non-unique index", async () => {
    const tables = [analyzeTable(nonUniqueIndexSchema.posts)];
    const code = generateLoaderCode(tables, { schemaImport: "./schema.js" });
    await expect(code).toMatchFileSnapshot(
      "../golden/non-unique-index/loaders.ts"
    );
  });

  it("generates loaders for multiple indexes", async () => {
    const tables = [analyzeTable(multipleIndexesSchema.posts)];
    const code = generateLoaderCode(tables, { schemaImport: "./schema.js" });
    await expect(code).toMatchFileSnapshot(
      "../golden/multiple-indexes/loaders.ts"
    );
  });

  it("generates loaders for multiple tables", async () => {
    const tables = [
      analyzeTable(multipleTablesSchema.users),
      analyzeTable(multipleTablesSchema.posts),
    ];
    const code = generateLoaderCode(tables, { schemaImport: "./schema.js" });
    await expect(code).toMatchFileSnapshot(
      "../golden/multiple-tables/loaders.ts"
    );
  });
});
