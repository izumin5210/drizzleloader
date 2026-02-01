# Composite Index Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable drizzleloader to generate DataLoader instances for composite indexes and composite primary keys.

**Architecture:** Extend the type system to support multiple columns per index/primary key. The analyzer will collect all columns for composite indexes. The generator will produce loaders with object-based keys and query optimization logic.

**Tech Stack:** TypeScript, Drizzle ORM, DataLoader, Vitest

---

## Task 1: Update Type Definitions

**Files:**
- Modify: `src/analyzer/types.ts:9-17`

**Step 1: Update AnalyzedPrimaryKey and AnalyzedIndex types**

Change `column` to `columns` array:

```typescript
export interface AnalyzedPrimaryKey {
  columns: AnalyzedColumn[];
}

export interface AnalyzedIndex {
  name: string;
  columns: AnalyzedColumn[];
  unique: boolean;
}
```

**Step 2: Run existing tests to see failures**

Run: `pnpm test`
Expected: Multiple failures due to type mismatch (`column` vs `columns`)

**Step 3: Commit type changes**

```bash
git add src/analyzer/types.ts
git commit -m "refactor: change column to columns array in types

Breaking change preparation for composite index support."
```

---

## Task 2: Update Analyzer for Single-Column Backward Compatibility

**Files:**
- Modify: `src/analyzer/table-analyzer.ts:22-67`
- Modify: `src/analyzer/table-analyzer.test.ts`

**Step 1: Update analyzeTable to use columns array for single-column indexes**

```typescript
export function analyzeTable(table: Table): AnalyzedTable {
  const config = getTableConfig(table as PgTable);

  const columnByName = new Map(config.columns.map((col) => [col.name, col]));

  const primaryKeyColumn = config.columns.find((col) => col.primary);
  const primaryKey = primaryKeyColumn
    ? { columns: [toAnalyzedColumn(primaryKeyColumn)] }
    : null;

  const indexes: AnalyzedIndex[] = [];
  for (const idx of config.indexes) {
    const idxConfig = idx.config;

    if (idxConfig.columns.length !== 1) {
      continue; // Still skip composite for now
    }

    if (idxConfig.where !== undefined) {
      continue;
    }

    const indexedCol = idxConfig.columns[0];
    if (!indexedCol || !isIndexedColumn(indexedCol)) {
      continue;
    }

    const col = columnByName.get(indexedCol.name);
    if (!col) {
      continue;
    }

    indexes.push({
      name: idxConfig.name ?? "",
      columns: [toAnalyzedColumn(col)],
      unique: idxConfig.unique ?? false,
    });
  }

  return {
    name: config.name,
    table,
    primaryKey,
    indexes,
  };
}
```

**Step 2: Update tests to use columns[0]**

Update assertions in `src/analyzer/table-analyzer.test.ts`:

```typescript
// Before
expect(result.primaryKey?.column.name).toBe("id");
// After
expect(result.primaryKey?.columns[0]?.name).toBe("id");

// Before
expect(result.indexes[0]?.column.name).toBe("email");
// After
expect(result.indexes[0]?.columns[0]?.name).toBe("email");
```

**Step 3: Run tests to verify they pass**

Run: `pnpm test src/analyzer/table-analyzer.test.ts`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/analyzer/
git commit -m "refactor: update analyzer to use columns array

Single-column indexes now use columns[0] for backward compatibility."
```

---

## Task 3: Update Generator for Single-Column Backward Compatibility

**Files:**
- Modify: `src/generator/code-generator.ts`

**Step 1: Update all column references to use columns[0]**

Replace all `table.primaryKey.column` with `table.primaryKey.columns[0]` and `idx.column` with `idx.columns[0]`:

```typescript
// In generateTableLoaders and generateTableLoaderFunctionExported
if (table.primaryKey) {
  const col = table.primaryKey.columns[0];
  if (col) {
    loaders.push(
      generateUniqueLoader(table, col.name, col.tsType, { useHelpers: true }),
    );
  }
}

for (const idx of table.indexes) {
  const col = idx.columns[0];
  if (!col) continue;
  if (idx.unique) {
    loaders.push(generateUniqueLoader(table, col.name, col.tsType, { useHelpers: true }));
  } else {
    loaders.push(generateNonUniqueLoader(table, col.name, col.tsType));
  }
}

// In getLoaderNames
function getLoaderNames(table: AnalyzedTable): string[] {
  const names: string[] = [];

  if (table.primaryKey?.columns[0]) {
    names.push(`by${toPascalCase(table.primaryKey.columns[0].name)}`);
  }

  for (const idx of table.indexes) {
    if (idx.columns[0]) {
      names.push(`by${toPascalCase(idx.columns[0].name)}`);
    }
  }

  return names;
}
```

**Step 2: Run all tests**

Run: `pnpm test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/generator/code-generator.ts
git commit -m "refactor: update generator to use columns[0]

Maintain backward compatibility with single-column indexes."
```

---

## Task 4: Add Composite Index Analyzer Tests (RED)

**Files:**
- Modify: `src/analyzer/table-analyzer.test.ts`

**Step 1: Write failing test for composite index**

Add new test:

```typescript
it("detects composite index with multiple columns", () => {
  const posts = pgTable(
    "posts",
    {
      id: serial("id").primaryKey(),
      authorId: integer("author_id"),
      category: varchar("category", { length: 100 }),
    },
    (t) => [index("posts_author_category_idx").on(t.authorId, t.category)],
  );

  const result = analyzeTable(posts);

  expect(result.indexes).toHaveLength(1);
  expect(result.indexes[0]?.name).toBe("posts_author_category_idx");
  expect(result.indexes[0]?.columns).toHaveLength(2);
  expect(result.indexes[0]?.columns[0]?.name).toBe("author_id");
  expect(result.indexes[0]?.columns[0]?.tsType).toBe("number");
  expect(result.indexes[0]?.columns[1]?.name).toBe("category");
  expect(result.indexes[0]?.columns[1]?.tsType).toBe("string");
  expect(result.indexes[0]?.unique).toBe(false);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/analyzer/table-analyzer.test.ts -t "detects composite index"`
Expected: FAIL - `result.indexes` has length 0 (still being skipped)

**Step 3: Commit failing test**

```bash
git add src/analyzer/table-analyzer.test.ts
git commit -m "test: add failing test for composite index detection"
```

---

## Task 5: Implement Composite Index Detection (GREEN)

**Files:**
- Modify: `src/analyzer/table-analyzer.ts:33-58`

**Step 1: Remove single-column filter and handle multiple columns**

```typescript
const indexes: AnalyzedIndex[] = [];
for (const idx of config.indexes) {
  const idxConfig = idx.config;

  if (idxConfig.where !== undefined) {
    continue;
  }

  const columns: AnalyzedColumn[] = [];
  for (const indexedCol of idxConfig.columns) {
    if (!isIndexedColumn(indexedCol)) {
      continue;
    }
    const col = columnByName.get(indexedCol.name);
    if (!col) {
      continue;
    }
    columns.push(toAnalyzedColumn(col));
  }

  if (columns.length === 0) {
    continue;
  }

  indexes.push({
    name: idxConfig.name ?? "",
    columns,
    unique: idxConfig.unique ?? false,
  });
}
```

**Step 2: Run test to verify it passes**

Run: `pnpm test src/analyzer/table-analyzer.test.ts -t "detects composite index"`
Expected: PASS

**Step 3: Run all analyzer tests**

Run: `pnpm test src/analyzer/table-analyzer.test.ts`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/analyzer/table-analyzer.ts
git commit -m "feat: support composite index detection in analyzer"
```

---

## Task 6: Update Composite Index Skip Test

**Files:**
- Modify: `src/analyzer/table-analyzer.test.ts`

**Step 1: Update the "skips composite indexes" test**

The old test expected composite indexes to be skipped. Now they should be detected:

```typescript
it("detects composite indexes", () => {
  const posts = pgTable(
    "posts",
    {
      id: serial("id").primaryKey(),
      authorId: integer("author_id"),
      category: varchar("category", { length: 100 }),
    },
    (t) => [index("posts_composite_idx").on(t.authorId, t.category)],
  );

  const result = analyzeTable(posts);

  expect(result.indexes).toHaveLength(1);
  expect(result.indexes[0]?.columns).toHaveLength(2);
});
```

**Step 2: Run tests**

Run: `pnpm test src/analyzer/table-analyzer.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/analyzer/table-analyzer.test.ts
git commit -m "test: update composite index test to expect detection"
```

---

## Task 7: Add Composite Primary Key Tests (RED)

**Files:**
- Modify: `src/analyzer/table-analyzer.test.ts`

**Step 1: Write failing test for composite primary key**

```typescript
it("detects composite primary key", () => {
  const userRoles = pgTable(
    "user_roles",
    {
      userId: integer("user_id").notNull(),
      roleId: integer("role_id").notNull(),
    },
    (t) => [primaryKey({ columns: [t.userId, t.roleId] })],
  );

  const result = analyzeTable(userRoles);

  expect(result.primaryKey).not.toBeNull();
  expect(result.primaryKey?.columns).toHaveLength(2);
  expect(result.primaryKey?.columns[0]?.name).toBe("user_id");
  expect(result.primaryKey?.columns[1]?.name).toBe("role_id");
});
```

Add import at top:
```typescript
import { primaryKey } from "drizzle-orm/pg-core";
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/analyzer/table-analyzer.test.ts -t "detects composite primary key"`
Expected: FAIL - `primaryKey` is null

**Step 3: Commit failing test**

```bash
git add src/analyzer/table-analyzer.test.ts
git commit -m "test: add failing test for composite primary key detection"
```

---

## Task 8: Implement Composite Primary Key Detection (GREEN)

**Files:**
- Modify: `src/analyzer/table-analyzer.ts`

**Step 1: Update primary key detection logic**

```typescript
export function analyzeTable(table: Table): AnalyzedTable {
  const config = getTableConfig(table as PgTable);

  const columnByName = new Map(config.columns.map((col) => [col.name, col]));

  // Check for single-column primary key first
  const primaryKeyColumn = config.columns.find((col) => col.primary);
  let primaryKey: AnalyzedPrimaryKey | null = null;

  if (primaryKeyColumn) {
    primaryKey = { columns: [toAnalyzedColumn(primaryKeyColumn)] };
  } else if (config.primaryKeys.length > 0) {
    // Check for composite primary key
    const pk = config.primaryKeys[0];
    if (pk) {
      const columns: AnalyzedColumn[] = [];
      for (const pkCol of pk.columns) {
        const col = columnByName.get(pkCol.name);
        if (col) {
          columns.push(toAnalyzedColumn(col));
        }
      }
      if (columns.length > 0) {
        primaryKey = { columns };
      }
    }
  }

  // ... rest of the function
}
```

**Step 2: Run test to verify it passes**

Run: `pnpm test src/analyzer/table-analyzer.test.ts -t "detects composite primary key"`
Expected: PASS

**Step 3: Run all tests**

Run: `pnpm test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/analyzer/table-analyzer.ts
git commit -m "feat: support composite primary key detection"
```

---

## Task 9: Update Old Composite PK Test

**Files:**
- Modify: `src/analyzer/table-analyzer.test.ts`

**Step 1: Update "returns null for composite primary key" test**

```typescript
it("detects composite primary key defined inline", () => {
  const userRoles = pgTable(
    "user_roles",
    {
      userId: integer("user_id"),
      roleId: integer("role_id"),
    },
    (t) => [t.userId, t.roleId],
  );

  const result = analyzeTable(userRoles);

  // This inline syntax creates an index, not a primaryKey
  // So primaryKey should still be null
  expect(result.primaryKey).toBeNull();
});
```

**Step 2: Run tests**

Run: `pnpm test src/analyzer/table-analyzer.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/analyzer/table-analyzer.test.ts
git commit -m "test: clarify inline primary key behavior"
```

---

## Task 10: Add Naming Utility for Composite Keys

**Files:**
- Modify: `src/utils/naming.ts`

**Step 1: Add composite key naming function**

```typescript
export function toCompositeLoaderName(columnNames: string[]): string {
  return "by" + columnNames.map((name) => toPascalCase(name)).join("And");
}
```

**Step 2: Run lint**

Run: `pnpm biome check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/utils/naming.ts
git commit -m "feat: add toCompositeLoaderName utility"
```

---

## Task 11: Add Helper Functions for Composite Keys

**Files:**
- Modify: `src/generator/code-generator.ts`

**Step 1: Add generateCompositeHelperFunctions**

Add to the existing `generateHelperFunctions` or create new function:

```typescript
export function generateCompositeHelperFunctions(): string {
  return `export function serializeCompositeKey<T extends Record<string, unknown>>(
  key: T,
  keyColumns: (keyof T)[]
): string {
  return keyColumns.map((col) => String(key[col])).join("\\0");
}

export function buildCompositeLookupMap<
  TKey extends Record<string, unknown>,
  TRow extends Record<string, unknown>
>(
  rows: TRow[],
  keyColumns: (keyof TKey)[]
): Map<string, TRow[]> {
  const map = new Map<string, TRow[]>();
  for (const row of rows) {
    const keyStr = keyColumns.map((col) => String(row[col as string])).join("\\0");
    const existing = map.get(keyStr) ?? [];
    existing.push(row);
    map.set(keyStr, existing);
  }
  return map;
}`;
}
```

**Step 2: Update generateInternalFile to include composite helpers**

```typescript
export function generateInternalFile(options: InternalFileOptions): string {
  const lines: string[] = [];

  // ... existing code ...

  // Helper functions
  lines.push(generateHelperFunctions());
  lines.push("");

  // Composite helper functions
  lines.push(generateCompositeHelperFunctions());
  lines.push("");

  return lines.join("\n");
}
```

**Step 3: Run tests**

Run: `pnpm test`
Expected: Tests pass (golden tests will need update)

**Step 4: Update golden test snapshots**

Run: `pnpm test -u`

**Step 5: Commit**

```bash
git add src/generator/code-generator.ts src/__tests__/golden/
git commit -m "feat: add composite key helper functions to _internal.ts"
```

---

## Task 12: Create Golden Test for Composite Index

**Files:**
- Create: `src/__tests__/golden/composite-index/schema.ts`
- Create: `src/__tests__/golden/composite-index/drizzleloaders.ts`
- Create: `src/__tests__/golden/composite-index/drizzleloaders/_internal.ts`
- Create: `src/__tests__/golden/composite-index/drizzleloaders/posts.ts`

**Step 1: Create schema file**

```typescript
import {
  pgTable,
  serial,
  integer,
  varchar,
  index,
} from "drizzle-orm/pg-core";

export const posts = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    authorId: integer("author_id").notNull(),
    category: varchar("category", { length: 100 }).notNull(),
    title: varchar("title", { length: 255 }),
  },
  (t) => [index("posts_author_category_idx").on(t.authorId, t.category)]
);
```

**Step 2: Add test case to code-generator.test.ts**

```typescript
import * as compositeIndexSchema from "../__tests__/golden/composite-index/schema.js";

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
```

**Step 3: Run test to see failure**

Run: `pnpm test -t "composite index"`
Expected: FAIL - Snapshot does not exist or loader not generated correctly

**Step 4: Commit failing test**

```bash
git add src/__tests__/golden/composite-index/ src/generator/code-generator.test.ts
git commit -m "test: add failing golden test for composite index"
```

---

## Task 13: Implement Composite Loader Generation

**Files:**
- Modify: `src/generator/code-generator.ts`

**Step 1: Add composite index detection in generateTableLoaderFunctionExported**

```typescript
import { toCompositeLoaderName } from "../utils/naming.js";

function generateTableLoaderFunctionExported(table: AnalyzedTable): string {
  const tablePascal = toPascalCase(table.name);
  const lines: string[] = [];

  lines.push(`export function create${tablePascal}Loaders(db: DrizzleDb) {`);

  const loaders: string[] = [];

  // Single-column primary key
  if (table.primaryKey && table.primaryKey.columns.length === 1) {
    const col = table.primaryKey.columns[0];
    if (col) {
      loaders.push(
        generateUniqueLoader(table, col.name, col.tsType, { useHelpers: true }),
      );
    }
  }
  // Composite primary key
  else if (table.primaryKey && table.primaryKey.columns.length > 1) {
    loaders.push(generateCompositeUniqueLoader(table, table.primaryKey.columns));
  }

  for (const idx of table.indexes) {
    // Single-column index
    if (idx.columns.length === 1) {
      const col = idx.columns[0];
      if (!col) continue;
      if (idx.unique) {
        loaders.push(generateUniqueLoader(table, col.name, col.tsType, { useHelpers: true }));
      } else {
        loaders.push(generateNonUniqueLoader(table, col.name, col.tsType));
      }
    }
    // Composite index
    else if (idx.columns.length > 1) {
      if (idx.unique) {
        loaders.push(generateCompositeUniqueLoader(table, idx.columns));
      } else {
        loaders.push(generateCompositeNonUniqueLoader(table, idx.columns));
      }
    }
  }

  // ... rest of function
}
```

**Step 2: Implement generateCompositeNonUniqueLoader**

```typescript
function generateCompositeNonUniqueLoader(
  table: AnalyzedTable,
  columns: AnalyzedColumn[],
): string {
  const loaderName = toCompositeLoaderName(columns.map((c) => c.name));
  const tableName = table.name;

  // Build key type: { authorId: number; category: string }
  const keyTypeFields = columns
    .map((col) => `${toCamelCase(col.name)}: ${col.tsType}`)
    .join("; ");
  const keyType = `{ ${keyTypeFields} }`;

  // Build column names array for helpers
  const columnNames = columns.map((col) => `"${toCamelCase(col.name)}"`).join(", ");

  return `const ${loaderName} = new DataLoader<${keyType}, InferSelectModel<typeof __schema.${tableName}>[], string>(
  async (keys) => {
    const rows = await queryComposite(db, __schema.${tableName}, [${columns.map((c) => `{ name: "${toCamelCase(c.name)}", column: __schema.${tableName}.${toCamelCase(c.name)} }`).join(", ")}], keys);
    const map = buildCompositeLookupMap<${keyType}, InferSelectModel<typeof __schema.${tableName}>>(rows, [${columnNames}]);
    return keys.map((key) => map.get(serializeCompositeKey(key, [${columnNames}])) ?? []);
  },
  { cacheKeyFn: (key) => serializeCompositeKey(key, [${columnNames}]) }
);`;
}
```

**Step 3: Implement generateCompositeUniqueLoader**

```typescript
function generateCompositeUniqueLoader(
  table: AnalyzedTable,
  columns: AnalyzedColumn[],
): string {
  const loaderName = toCompositeLoaderName(columns.map((c) => c.name));
  const tableName = table.name;

  const keyTypeFields = columns
    .map((col) => `${toCamelCase(col.name)}: ${col.tsType}`)
    .join("; ");
  const keyType = `{ ${keyTypeFields} }`;

  const columnNames = columns.map((col) => `"${toCamelCase(col.name)}"`).join(", ");

  const errorColumns = columns
    .map((col) => `{ ${col.name}: key.${toCamelCase(col.name)} }`)
    .join(", ");

  return `const ${loaderName} = new DataLoader<${keyType}, InferSelectModel<typeof __schema.${tableName}>, string>(
  async (keys) => {
    const rows = await queryComposite(db, __schema.${tableName}, [${columns.map((c) => `{ name: "${toCamelCase(c.name)}", column: __schema.${tableName}.${toCamelCase(c.name)} }`).join(", ")}], keys);
    const map = buildCompositeLookupMap<${keyType}, InferSelectModel<typeof __schema.${tableName}>>(rows, [${columnNames}]);
    return keys.map((key) => {
      const found = map.get(serializeCompositeKey(key, [${columnNames}]))?.[0];
      return found ?? new DrizzleLoaderNotFound({ table: "${tableName}", columns: [${errorColumns}] });
    });
  },
  { cacheKeyFn: (key) => serializeCompositeKey(key, [${columnNames}]) }
);`;
}
```

**Step 4: Update getLoaderNames for composite**

```typescript
function getLoaderNames(table: AnalyzedTable): string[] {
  const names: string[] = [];

  if (table.primaryKey) {
    if (table.primaryKey.columns.length === 1 && table.primaryKey.columns[0]) {
      names.push(`by${toPascalCase(table.primaryKey.columns[0].name)}`);
    } else if (table.primaryKey.columns.length > 1) {
      names.push(toCompositeLoaderName(table.primaryKey.columns.map((c) => c.name)));
    }
  }

  for (const idx of table.indexes) {
    if (idx.columns.length === 1 && idx.columns[0]) {
      names.push(`by${toPascalCase(idx.columns[0].name)}`);
    } else if (idx.columns.length > 1) {
      names.push(toCompositeLoaderName(idx.columns.map((c) => c.name)));
    }
  }

  return names;
}
```

**Step 5: Run test**

Run: `pnpm test -t "composite index"`
Expected: Partial pass (may need query function)

---

## Task 14: Add queryComposite Helper Function

**Files:**
- Modify: `src/generator/code-generator.ts`

**Step 1: Add queryComposite to generateCompositeHelperFunctions**

```typescript
export function generateCompositeHelperFunctions(): string {
  return `export function serializeCompositeKey<T extends Record<string, unknown>>(
  key: T,
  keyColumns: (keyof T)[]
): string {
  return keyColumns.map((col) => String(key[col])).join("\\0");
}

export function buildCompositeLookupMap<
  TKey extends Record<string, unknown>,
  TRow extends Record<string, unknown>
>(
  rows: TRow[],
  keyColumns: (keyof TKey)[]
): Map<string, TRow[]> {
  const map = new Map<string, TRow[]>();
  for (const row of rows) {
    const keyStr = keyColumns.map((col) => String(row[col as string])).join("\\0");
    const existing = map.get(keyStr) ?? [];
    existing.push(row);
    map.set(keyStr, existing);
  }
  return map;
}

export async function queryComposite<
  TTable extends Table,
  TKey extends Record<string, unknown>
>(
  db: DrizzleDb,
  table: TTable,
  columnDefs: { name: string; column: Column }[],
  keys: readonly TKey[]
): Promise<InferSelectModel<TTable>[]> {
  if (keys.length === 0) return [];

  // Optimization: detect fixed columns (same value from start)
  const fixedColumns: { column: Column; value: unknown }[] = [];
  const variableColumns: { name: string; column: Column }[] = [];

  for (const colDef of columnDefs) {
    const firstValue = keys[0]![colDef.name];
    const allSame = keys.every((k) => k[colDef.name] === firstValue);

    if (allSame && variableColumns.length === 0) {
      fixedColumns.push({ column: colDef.column, value: firstValue });
    } else {
      variableColumns.push(colDef);
    }
  }

  let query = db.select().from(table);

  // Fixed columns -> WHERE eq
  for (const { column, value } of fixedColumns) {
    query = query.where(eq(column, value)) as typeof query;
  }

  // Variable columns
  if (variableColumns.length === 0) {
    // All fixed, just return
  } else if (variableColumns.length === 1) {
    // Single variable -> IN
    const col = variableColumns[0]!;
    const values = [...new Set(keys.map((k) => k[col.name]))];
    query = query.where(inArray(col.column, values as unknown[])) as typeof query;
  } else {
    // Multiple variable -> VALUES + JOIN
    const valueRows = keys.map((key) => {
      const values = variableColumns.map((col) => sql\`\${key[col.name]}\`);
      return sql\`(\${sql.join(values, sql\`, \`)})\`;
    });
    const columnNames = variableColumns.map((col) => sql.identifier(col.name));
    const valuesTable = sql\`(VALUES \${sql.join(valueRows, sql\`, \`)}) AS _keys(\${sql.join(columnNames, sql\`, \`)})\`;
    const joinConditions = variableColumns.map((col) =>
      sql\`\${col.column} = _keys.\${sql.identifier(col.name)}\`
    );
    query = query.innerJoin(valuesTable, sql.join(joinConditions, sql\` AND \`)) as typeof query;
  }

  return query as unknown as Promise<InferSelectModel<TTable>[]>;
}`;
}
```

**Step 2: Update generateInternalFile imports**

```typescript
export function generateInternalFile(options: InternalFileOptions): string {
  const lines: string[] = [];

  lines.push('import { eq, inArray, sql, type Column, type Table } from "drizzle-orm";');
  lines.push('import type { InferSelectModel } from "drizzle-orm";');
  lines.push(
    'import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";',
  );
  lines.push(`import type * as __schema from "${options.schemaImport}";`);
  // ... rest
}
```

**Step 3: Update generateTableFile imports**

Add `queryComposite`, `serializeCompositeKey`, `buildCompositeLookupMap` to imports when composite indexes exist.

**Step 4: Run tests and update snapshots**

Run: `pnpm test -u`

**Step 5: Commit**

```bash
git add src/generator/ src/__tests__/golden/
git commit -m "feat: implement composite index loader generation"
```

---

## Task 15: Add Golden Test for Composite Unique Index

**Files:**
- Create: `src/__tests__/golden/composite-unique-index/schema.ts`
- Modify: `src/generator/code-generator.test.ts`

**Step 1: Create schema with composite unique index**

```typescript
import {
  pgTable,
  serial,
  integer,
  varchar,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const posts = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    authorId: integer("author_id").notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
  },
  (t) => [uniqueIndex("posts_author_slug_idx").on(t.authorId, t.slug)]
);
```

**Step 2: Add test case**

**Step 3: Run and update snapshots**

**Step 4: Commit**

```bash
git add src/__tests__/golden/composite-unique-index/ src/generator/code-generator.test.ts
git commit -m "test: add golden test for composite unique index"
```

---

## Task 16: Add Golden Test for Composite Primary Key

**Files:**
- Create: `src/__tests__/golden/composite-pk/schema.ts`
- Modify: `src/generator/code-generator.test.ts`

**Step 1: Create schema with composite primary key**

```typescript
import { pgTable, integer, varchar, primaryKey } from "drizzle-orm/pg-core";

export const userRoles = pgTable(
  "user_roles",
  {
    userId: integer("user_id").notNull(),
    roleId: integer("role_id").notNull(),
    assignedAt: varchar("assigned_at", { length: 100 }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] })]
);
```

**Step 2: Add test case**

**Step 3: Run and update snapshots**

**Step 4: Commit**

```bash
git add src/__tests__/golden/composite-pk/ src/generator/code-generator.test.ts
git commit -m "test: add golden test for composite primary key"
```

---

## Task 17: Run Full Test Suite and Lint

**Step 1: Run all tests**

Run: `pnpm test`
Expected: All tests pass

**Step 2: Run lint and format**

Run: `pnpm biome check --write`
Expected: No errors

**Step 3: Final commit**

```bash
git add .
git commit -m "chore: final cleanup for composite index support"
```

---

## Task 18: Create Pull Request

**Step 1: Push branch**

```bash
git push -u origin feature/composite-index-support
```

**Step 2: Create PR**

```bash
gh pr create --title "feat: add composite index support" --body "## Summary
- Support composite indexes (unique and non-unique)
- Support composite primary keys
- Query optimization: WHERE for fixed columns, IN for single variable, VALUES+JOIN for multiple

## Test plan
- [x] Analyzer detects composite indexes
- [x] Analyzer detects composite primary keys
- [x] Generator produces correct loaders with object keys
- [x] cacheKeyFn is set for object-based DataLoaders
- [x] Query optimization works correctly
- [x] All existing tests pass

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Update type definitions (column → columns) |
| 2 | Update analyzer for single-column backward compat |
| 3 | Update generator for single-column backward compat |
| 4-6 | Add and implement composite index detection |
| 7-9 | Add and implement composite primary key detection |
| 10 | Add naming utility for composite keys |
| 11 | Add helper functions for composite keys |
| 12-14 | Implement composite loader generation |
| 15 | Add golden test for composite unique index |
| 16 | Add golden test for composite primary key |
| 17 | Final tests and lint |
| 18 | Create pull request |
