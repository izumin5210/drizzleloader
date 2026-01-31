# Composite Index Support Design

## Overview

drizzleloader を composite index に対応させる。現在は単一カラムの index/primary key のみサポートしているが、複数カラムの composite index/primary key もサポートする。

## Requirements

- composite index (unique/non-unique) のローダー生成
- composite primary key のローダー生成
- キーはオブジェクト型（例: `{ authorId: number; category: string }`）
- unique の場合は単一値または `DrizzleLoaderNotFound`、non-unique の場合は配列を返す

## Query Optimization

クエリ構築時に以下の最適化を行う:

1. **先頭から同一値が続くカラム** → `WHERE` で指定
2. **残りが1カラム** → `WHERE ... IN (...)` で絞る
3. **残りが複数カラム** → `VALUES (...) AS _keys(...) INNER JOIN` で結合

### Examples

`(tenantId, authorId, category)` の composite index で:

```typescript
keys = [
  { tenantId: 1, authorId: 10, category: "tech" },
  { tenantId: 1, authorId: 10, category: "news" },
  { tenantId: 1, authorId: 20, category: "sports" }
]
```

`tenantId` は全て `1`、`authorId` は異なる（10, 20）なので:

```sql
SELECT posts.* FROM posts
INNER JOIN (VALUES (10, 'tech'), (10, 'news'), (20, 'sports'))
  AS _keys(author_id, category)
ON posts.author_id = _keys.author_id AND posts.category = _keys.category
WHERE posts.tenant_id = 1
```

## Type Changes

### `src/analyzer/types.ts`

```typescript
// Before
export interface AnalyzedPrimaryKey {
  column: AnalyzedColumn;
}

export interface AnalyzedIndex {
  name: string;
  column: AnalyzedColumn;
  unique: boolean;
}

// After
export interface AnalyzedPrimaryKey {
  columns: AnalyzedColumn[];
}

export interface AnalyzedIndex {
  name: string;
  columns: AnalyzedColumn[];
  unique: boolean;
}
```

## Analyzer Changes

### `src/analyzer/table-analyzer.ts`

現在の composite index スキップロジック（36-38行目）を削除し、複数カラムを処理するように変更:

```typescript
// Before (skip)
if (idxConfig.columns.length !== 1) {
  continue;
}

// After (handle multiple columns)
const columns: AnalyzedColumn[] = [];
for (const col of idxConfig.columns) {
  const columnName = col.name;
  const schemaColumn = tableConfig.columns.find((c) => c.name === columnName);
  if (schemaColumn === undefined) {
    continue;
  }
  columns.push({
    name: columnName,
    tsType: mapColumnToTsType(schemaColumn),
  });
}
if (columns.length === 0) continue;

indexes.push({
  name: idxConfig.name,
  columns,
  unique: !!idxConfig.isUnique,
});
```

## Generator Changes

### Loader Type

```typescript
// Single column (unchanged)
const byAuthorId = new DataLoader<number, Post[]>(...)

// Composite
const byAuthorIdAndCategory = new DataLoader<
  { authorId: number; category: string },
  Post[]
>(...)
```

Loader naming: columns joined by `And` (e.g., `byAuthorIdAndCategory`).

### cacheKeyFn

DataLoader uses reference equality by default. For object keys, `cacheKeyFn` is required:

```typescript
const byAuthorIdAndCategory = new DataLoader<
  { authorId: number; category: string },
  Post[]
>(
  async (keys) => { /* ... */ },
  {
    cacheKeyFn: (key) => serializeCompositeKey(key, ["authorId", "category"]),
  }
);
```

## Helper Functions (`_internal.ts`)

### `buildCompositeQuery`

Builds optimized query based on key values:

```typescript
export function buildCompositeQuery<T extends Record<string, unknown>>(
  db: DrizzleClient,
  table: Table,
  columnDefs: { name: string; column: Column }[],
  keys: readonly T[]
): SelectQueryBuilder {
  // 1. Detect fixed columns (same value from start)
  const fixedColumns: { column: Column; value: unknown }[] = [];
  const variableColumns: { name: string; column: Column }[] = [];

  for (const colDef of columnDefs) {
    const firstValue = keys[0][colDef.name];
    const allSame = keys.every((k) => k[colDef.name] === firstValue);

    if (allSame && variableColumns.length === 0) {
      fixedColumns.push({ column: colDef.column, value: firstValue });
    } else {
      variableColumns.push(colDef);
    }
  }

  // 2. Build query
  let query = db.select().from(table);

  // Fixed columns → WHERE
  for (const { column, value } of fixedColumns) {
    query = query.where(eq(column, value));
  }

  // Variable columns
  if (variableColumns.length === 0) {
    // All fixed → single row
  } else if (variableColumns.length === 1) {
    // Single variable → IN
    const col = variableColumns[0];
    const values = keys.map((k) => k[col.name]);
    query = query.where(inArray(col.column, values));
  } else {
    // Multiple variable → VALUES + INNER JOIN
    query = query.innerJoin(
      buildValuesTable(variableColumns, keys),
      buildJoinCondition(variableColumns)
    );
  }

  return query;
}
```

### `buildValuesSubquery`

```typescript
function buildValuesSubquery<T extends Record<string, unknown>>(
  columnDefs: { name: string; column: Column }[],
  keys: readonly T[]
): SQL {
  const valueRows = keys.map((key) => {
    const values = columnDefs.map((col) => sql`${key[col.name]}`);
    return sql`(${sql.join(values, sql`, `)})`;
  });

  const columnNames = columnDefs.map((col) => sql.identifier(col.name));

  return sql`(VALUES ${sql.join(valueRows, sql`, `)}) AS _keys(${sql.join(columnNames, sql`, `)})`;
}
```

### `buildCompositeLookupMap` & `serializeCompositeKey`

```typescript
export function buildCompositeLookupMap<
  TKey extends Record<string, unknown>,
  TRow extends Record<string, unknown>
>(
  rows: TRow[],
  keyColumns: (keyof TKey)[]
): Map<string, TRow[]> {
  const map = new Map<string, TRow[]>();

  for (const row of rows) {
    const keyStr = keyColumns.map((col) => String(row[col as string])).join("\0");
    const existing = map.get(keyStr) ?? [];
    existing.push(row);
    map.set(keyStr, existing);
  }

  return map;
}

export function serializeCompositeKey<TKey extends Record<string, unknown>>(
  key: TKey,
  keyColumns: (keyof TKey)[]
): string {
  return keyColumns.map((col) => String(key[col])).join("\0");
}
```

## Error Handling

Unique composite index returns `DrizzleLoaderNotFound` when not found:

```typescript
new DrizzleLoaderNotFound({
  table: "posts",
  columns: [{ authorId: 1 }, { category: "tech" }]
})
```

## Test Strategy

### Analyzer Tests (`table-analyzer.test.ts`)
- composite index (2 columns) parsed correctly
- composite index (3+ columns) parsed correctly
- composite primary key parsed correctly
- conditional composite index skipped

### Generator Tests (`code-generator.test.ts`)
- composite unique index loader generated correctly
- composite non-unique index loader generated correctly
- composite primary key loader generated correctly

### Helper Function Tests
- `buildCompositeLookupMap`: correct grouping
- `serializeCompositeKey`: correct serialization
- Optimization: all same → WHERE only
- Optimization: first N same → WHERE + IN/JOIN
- Optimization: different from start → JOIN all

### Golden Tests
- `composite-unique-index`
- `composite-non-unique-index`
- `composite-primary-key`

## Implementation Order

| Order | File | Changes |
|-------|------|---------|
| 1 | `src/analyzer/types.ts` | Change to `columns: AnalyzedColumn[]` |
| 2 | `src/analyzer/table-analyzer.ts` | Parse composite index/PK |
| 3 | `src/analyzer/table-analyzer.test.ts` | Add composite tests |
| 4 | `src/generator/code-generator.ts` | Fix single column refs to `columns[0]` |
| 5 | `src/generator/_internal.ts` | Add helper functions |
| 6 | `src/generator/code-generator.ts` | Add composite loader generation |
| 7 | `src/generator/code-generator.test.ts` | Add golden test cases |
| 8 | `src/utils/naming.ts` | Add composite naming function |

## Design Decisions

- Single column index treated as `columns.length === 1` for backward compatibility
- Optimization logic centralized in `_internal.ts` to keep generated code simple
- Helper functions run at runtime, ensuring type safety
- `cacheKeyFn` required for DataLoader with object keys
