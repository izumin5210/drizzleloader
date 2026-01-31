# Split Generated Files Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split generated code into multiple files: entry point, per-table loaders, and shared internals.

**Architecture:** Refactor `generateLoaderCode()` to return `Map<string, string>` (relative path → code). Add helper functions to `_internal.ts`. Update CLI to write multiple files.

**Tech Stack:** TypeScript, Vitest with `toMatchFileSnapshot()`, Commander.js

---

## Task 1: Add helper function generators to code-generator

**Files:**
- Modify: `src/generator/code-generator.ts`
- Test: `src/generator/code-generator.test.ts`

**Step 1: Write the failing test for buildLookupMap helper**

Add to `code-generator.test.ts`:

```typescript
describe("generateHelperFunctions", () => {
  it("generates buildLookupMap function", () => {
    const code = generateHelperFunctions();
    expect(code).toContain("export function buildLookupMap<K, V>");
    expect(code).toContain("(rows: V[], keyFn: (row: V) => K): Map<K, V>");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/generator/code-generator.test.ts`
Expected: FAIL with "generateHelperFunctions is not defined"

**Step 3: Write minimal implementation**

Add to `code-generator.ts`:

```typescript
export function generateHelperFunctions(): string {
  return `export function buildLookupMap<K, V>(
  rows: V[],
  keyFn: (row: V) => K
): Map<K, V> {
  return new Map(rows.map((row) => [keyFn(row), row]));
}`;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/generator/code-generator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/generator/code-generator.ts src/generator/code-generator.test.ts
git commit -m "feat(generator): add generateHelperFunctions for buildLookupMap"
```

---

## Task 2: Add lookupOrError helper to generateHelperFunctions

**Files:**
- Modify: `src/generator/code-generator.ts`
- Test: `src/generator/code-generator.test.ts`

**Step 1: Write the failing test**

Add to the `generateHelperFunctions` describe block:

```typescript
it("generates lookupOrError function", () => {
  const code = generateHelperFunctions();
  expect(code).toContain("export function lookupOrError<K, V>");
  expect(code).toContain("DrizzleLoaderNotFound");
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/generator/code-generator.test.ts`
Expected: FAIL

**Step 3: Update implementation**

Update `generateHelperFunctions()` to include lookupOrError:

```typescript
export function generateHelperFunctions(): string {
  return `export function buildLookupMap<K, V>(
  rows: V[],
  keyFn: (row: V) => K
): Map<K, V> {
  return new Map(rows.map((row) => [keyFn(row), row]));
}

export function lookupOrError<K, V>(
  map: Map<K, V>,
  key: K,
  table: string,
  column: string
): V | DrizzleLoaderNotFound {
  return (
    map.get(key) ?? new DrizzleLoaderNotFound({ table, columns: [{ [column]: key }] })
  );
}`;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/generator/code-generator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/generator/code-generator.ts src/generator/code-generator.test.ts
git commit -m "feat(generator): add lookupOrError to helper functions"
```

---

## Task 3: Create generateInternalFile function

**Files:**
- Modify: `src/generator/code-generator.ts`
- Test: `src/generator/code-generator.test.ts`

**Step 1: Write the failing test**

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/generator/code-generator.test.ts`
Expected: FAIL

**Step 3: Write implementation**

```typescript
export function generateInternalFile(options: {
  schemaImport: string;
  dialect: "pg" | "mysql" | "sqlite";
}): string {
  const imports = generateImports(options.schemaImport, options.dialect);
  const dbType = generateDbType(options.dialect);
  const errorClass = generateErrorClass();
  const helpers = generateHelperFunctions();

  return `${imports}

${dbType}

${errorClass}

${helpers}
`;
}
```

Note: `generateDbType()` will need to be extracted from current code.

**Step 4: Run test to verify it passes**

Run: `pnpm test src/generator/code-generator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/generator/code-generator.ts src/generator/code-generator.test.ts
git commit -m "feat(generator): add generateInternalFile function"
```

---

## Task 4: Create generateTableFile function

**Files:**
- Modify: `src/generator/code-generator.ts`
- Test: `src/generator/code-generator.test.ts`

**Step 1: Write the failing test**

```typescript
describe("generateTableFile", () => {
  it("generates table loader file with imports from _internal", () => {
    const table = analyzeTable(basicPkSchema.users);
    const code = generateTableFile(table, {
      schemaImport: "../../schema.js",
      internalImport: "./_internal.js",
    });
    expect(code).toContain('import { type DrizzleDb, DrizzleLoaderNotFound, buildLookupMap, lookupOrError } from "./_internal.js"');
    expect(code).toContain('import * as __schema from "../../schema.js"');
    expect(code).toContain("export function createUsersLoaders");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/generator/code-generator.test.ts`
Expected: FAIL

**Step 3: Write implementation**

```typescript
export function generateTableFile(
  table: AnalyzedTable,
  options: {
    schemaImport: string;
    internalImport: string;
  }
): string {
  const tableName = toPascalCase(table.name);
  const rowType = `${tableName}Row`;

  const imports = `import DataLoader from "dataloader";
import { inArray } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import * as __schema from "${options.schemaImport}";
import {
  type DrizzleDb,
  DrizzleLoaderNotFound,
  buildLookupMap,
  lookupOrError,
} from "${options.internalImport}";`;

  const typeAlias = `type ${rowType} = InferSelectModel<typeof __schema.${table.name}>;`;
  const loaderFn = generateTableLoaderFunction(table, rowType);

  return `${imports}

${typeAlias}

${loaderFn}
`;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/generator/code-generator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/generator/code-generator.ts src/generator/code-generator.test.ts
git commit -m "feat(generator): add generateTableFile function"
```

---

## Task 5: Create generateEntryPointFile function

**Files:**
- Modify: `src/generator/code-generator.ts`
- Test: `src/generator/code-generator.test.ts`

**Step 1: Write the failing test**

```typescript
describe("generateEntryPointFile", () => {
  it("generates entry point that imports table loaders and re-exports error", () => {
    const tables = [analyzeTable(basicPkSchema.users)];
    const code = generateEntryPointFile(tables, {
      schemaImport: "./schema.js",
      internalImport: "./drizzleloaders/_internal.js",
      tableImportPrefix: "./drizzleloaders/",
      importExtension: ".js",
    });
    expect(code).toContain('import { createUsersLoaders } from "./drizzleloaders/users.js"');
    expect(code).toContain('export { DrizzleLoaderNotFound } from "./drizzleloaders/_internal.js"');
    expect(code).toContain("export function createDrizzleLoaders");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/generator/code-generator.test.ts`
Expected: FAIL

**Step 3: Write implementation**

```typescript
export function generateEntryPointFile(
  tables: AnalyzedTable[],
  options: {
    schemaImport: string;
    internalImport: string;
    tableImportPrefix: string;
    importExtension: string;
  }
): string {
  const ext = options.importExtension;
  const tableImports = tables
    .map((t) => {
      const fnName = `create${toPascalCase(t.name)}Loaders`;
      const fileName = toCamelCase(t.name);
      return `import { ${fnName} } from "${options.tableImportPrefix}${fileName}${ext}";`;
    })
    .join("\n");

  const reExport = `export { DrizzleLoaderNotFound } from "${options.internalImport}";`;

  const factoryFn = generateFactoryFunction(tables);

  return `${tableImports}
import { type DrizzleDb } from "${options.internalImport}";

${reExport}

${factoryFn}
`;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/generator/code-generator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/generator/code-generator.ts src/generator/code-generator.test.ts
git commit -m "feat(generator): add generateEntryPointFile function"
```

---

## Task 6: Create generateMultiFileOutput function

**Files:**
- Modify: `src/generator/code-generator.ts`
- Test: `src/generator/code-generator.test.ts`

**Step 1: Write the failing test**

```typescript
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
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/generator/code-generator.test.ts`
Expected: FAIL

**Step 3: Write implementation**

```typescript
export function generateMultiFileOutput(
  tables: AnalyzedTable[],
  options: {
    schemaImport: string;
    importExtension: string;
    dialect?: "pg" | "mysql" | "sqlite";
  }
): Map<string, string> {
  const ext = options.importExtension;
  const dialect = options.dialect ?? "pg";
  const files = new Map<string, string>();

  // _internal.ts - schema is one level up from drizzleloaders/
  const internalSchemaImport = computeRelativeImport(
    "drizzleloaders/_internal.ts",
    options.schemaImport,
    ext
  );
  files.set(
    "drizzleloaders/_internal.ts",
    generateInternalFile({ schemaImport: internalSchemaImport, dialect })
  );

  // Per-table files
  for (const table of tables) {
    const fileName = `drizzleloaders/${toCamelCase(table.name)}.ts`;
    const tableSchemaImport = computeRelativeImport(fileName, options.schemaImport, ext);
    files.set(
      fileName,
      generateTableFile(table, {
        schemaImport: tableSchemaImport,
        internalImport: `./_internal${ext}`,
      })
    );
  }

  // Entry point
  files.set(
    "drizzleloaders.ts",
    generateEntryPointFile(tables, {
      schemaImport: options.schemaImport,
      internalImport: `./drizzleloaders/_internal${ext}`,
      tableImportPrefix: "./drizzleloaders/",
      importExtension: ext,
    })
  );

  return files;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/generator/code-generator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/generator/code-generator.ts src/generator/code-generator.test.ts
git commit -m "feat(generator): add generateMultiFileOutput function"
```

---

## Task 7: Update loaders to use helper functions

**Files:**
- Modify: `src/generator/code-generator.ts`
- Test: `src/generator/code-generator.test.ts`

**Step 1: Write the failing test**

```typescript
it("generates unique loader using buildLookupMap and lookupOrError", () => {
  const table = analyzeTable(basicPkSchema.users);
  const code = generateTableFile(table, {
    schemaImport: "../../schema.js",
    internalImport: "./_internal.js",
  });
  expect(code).toContain("buildLookupMap(rows, (row) => row.id)");
  expect(code).toContain('lookupOrError(map, key, "users", "id")');
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/generator/code-generator.test.ts`
Expected: FAIL (current code generates inline Map construction)

**Step 3: Update loader generation to use helpers**

Modify `generateUniqueLoader()` to use helper functions instead of inline code.

**Step 4: Run test to verify it passes**

Run: `pnpm test src/generator/code-generator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/generator/code-generator.ts src/generator/code-generator.test.ts
git commit -m "refactor(generator): use helper functions in unique loaders"
```

---

## Task 8: Update CLI to use output-dir option

**Files:**
- Modify: `src/cli.ts`
- Test: Manual verification (CLI tests are integration tests)

**Step 1: Update CLI option definition**

Change from:
```typescript
.option("-o, --output <path>", "Output file path", "drizzleloaders.ts")
```

To:
```typescript
.option("-o, --output-dir <dir>", "Output directory", ".")
```

**Step 2: Update file writing logic**

Replace single `writeFileSync` with:
```typescript
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const outputDir = resolve(process.cwd(), options.outputDir);
const files = generateMultiFileOutput(tables, { schemaImport, importExtension });

// Create directories and write files
for (const [relativePath, content] of files) {
  const fullPath = join(outputDir, relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content);
}
```

**Step 3: Verify manually**

Run: `pnpm build && node dist/cli.js -s ./src/__tests__/golden/basic-pk/schema.ts -o ./tmp`
Expected: Creates `tmp/drizzleloaders.ts` and `tmp/drizzleloaders/` directory

**Step 4: Commit**

```bash
git add src/cli.ts
git commit -m "feat(cli): change --output to --output-dir for multi-file generation"
```

---

## Task 9: Update golden tests for multi-file output

**Files:**
- Modify: `src/generator/code-generator.test.ts`
- Create: `src/__tests__/golden/basic-pk/drizzleloaders.ts`
- Create: `src/__tests__/golden/basic-pk/drizzleloaders/_internal.ts`
- Create: `src/__tests__/golden/basic-pk/drizzleloaders/users.ts`
- Delete: `src/__tests__/golden/basic-pk/loaders.ts`

**Step 1: Update test to compare multiple files**

```typescript
it("generates loader files for basic primary key", async () => {
  const tables = [analyzeTable(basicPkSchema.users)];
  const files = generateMultiFileOutput(tables, {
    schemaImport: "./schema.js",
    importExtension: ".js",
  });

  await expect(files.get("drizzleloaders.ts")).toMatchFileSnapshot(
    "../__tests__/golden/basic-pk/drizzleloaders.ts"
  );
  await expect(files.get("drizzleloaders/_internal.ts")).toMatchFileSnapshot(
    "../__tests__/golden/basic-pk/drizzleloaders/_internal.ts"
  );
  await expect(files.get("drizzleloaders/users.ts")).toMatchFileSnapshot(
    "../__tests__/golden/basic-pk/drizzleloaders/users.ts"
  );
});
```

**Step 2: Run test to create golden files**

Run: `pnpm test src/generator/code-generator.test.ts -u`
This will create the new golden files.

**Step 3: Review generated golden files**

Manually verify the generated files look correct.

**Step 4: Delete old loaders.ts**

```bash
rm src/__tests__/golden/basic-pk/loaders.ts
```

**Step 5: Commit**

```bash
git add src/generator/code-generator.test.ts src/__tests__/golden/basic-pk/
git commit -m "test: update basic-pk golden test for multi-file output"
```

---

## Task 10-14: Update remaining golden tests

Repeat Task 9 for each remaining golden test case:
- `uuid-pk`
- `unique-index`
- `non-unique-index`
- `multiple-indexes`
- `multiple-tables`

Each task follows the same pattern:
1. Update test to use `generateMultiFileOutput`
2. Run with `-u` to update snapshots
3. Review generated files
4. Delete old `loaders.ts`
5. Commit

---

## Task 15: Update schemaImport computation for CLI

**Files:**
- Modify: `src/utils/import-path.ts`
- Test: `src/utils/import-path.test.ts`

**Step 1: Write test for new path computation**

The schema import path needs to be computed relative to the entry point file, not the output directory.

```typescript
it("computes schema import from entry point file", () => {
  const result = computeSchemaImport({
    schemaPath: "/project/src/db/schema.ts",
    outputDir: "/project/generated",
    importExtension: ".js",
  });
  expect(result).toBe("../src/db/schema.js");
});
```

**Step 2-5: Implement and commit**

---

## Task 16: Final integration test

**Step 1: Run full test suite**

Run: `pnpm test`
Expected: All tests pass

**Step 2: Run biome check**

Run: `pnpm biome check`
Expected: No errors

**Step 3: Manual end-to-end verification**

```bash
pnpm build
node dist/cli.js -s ./src/__tests__/golden/multiple-tables/schema.ts -o ./tmp -e .js
ls -la tmp/
ls -la tmp/drizzleloaders/
```

**Step 4: Final commit (if any fixes needed)**

---

## Summary

Total tasks: 16
- Tasks 1-6: Build new generator functions (TDD)
- Task 7: Refactor loader generation to use helpers
- Task 8: Update CLI
- Tasks 9-14: Update golden tests (6 test cases)
- Task 15: Fix import path computation
- Task 16: Final verification
