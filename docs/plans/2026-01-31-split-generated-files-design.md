# Split Generated Files Design

## Overview

現在1ファイルに生成されているコードを、以下の3種類に分割する：

1. `drizzleloaders.ts` - エントリポイント（`createDrizzleLoaders` を export）
2. `drizzleloaders/<tableName>.ts` - テーブルごとの loader 実装
3. `drizzleloaders/_internal.ts` - 共通の型・クラス・ヘルパー関数

## File Structure

`-o ./generated` を指定した場合の出力:

```
generated/
  drizzleloaders.ts              # エントリポイント
  drizzleloaders/
    _internal.ts                 # 共通の型・クラス・ヘルパー
    users.ts                     # createUsersLoaders 関数
    posts.ts                     # createPostsLoaders 関数
    ...
```

## File Contents

### `_internal.ts`

```typescript
import type { InferSelectModel } from "drizzle-orm";
import type * as __schema from "../path/to/schema";

// 型定義
export type DrizzleDb = PgDatabase<PgQueryResultHKT, typeof __schema>;

// エラークラス
export class DrizzleLoaderNotFound extends Error {
  // 現在と同じ実装
}

// ヘルパー関数
export function buildLookupMap<K, V>(
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
  return map.get(key) ?? new DrizzleLoaderNotFound({ table, columns: [{ [column]: key }] });
}
```

### `<tableName>.ts`

```typescript
import DataLoader from "dataloader";
import { inArray } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import * as __schema from "../../path/to/schema";
import {
  type DrizzleDb,
  DrizzleLoaderNotFound,
  buildLookupMap,
  lookupOrError,
} from "./_internal";

type UsersRow = InferSelectModel<typeof __schema.users>;

export function createUsersLoaders(db: DrizzleDb) {
  const byId = new DataLoader<number, UsersRow>(async (ids) => {
    const rows = await db
      .select()
      .from(__schema.users)
      .where(inArray(__schema.users.id, [...ids]));
    const map = buildLookupMap(rows, (row) => row.id);
    return ids.map((key) => lookupOrError(map, key, "users", "id"));
  });

  return { byId };
}
```

### `drizzleloaders.ts`

```typescript
import * as __schema from "./path/to/schema";
import { type DrizzleDb } from "./drizzleloaders/_internal";
import { createUsersLoaders } from "./drizzleloaders/users";
import { createPostsLoaders } from "./drizzleloaders/posts";

export { DrizzleLoaderNotFound } from "./drizzleloaders/_internal";

export function createDrizzleLoaders(db: DrizzleDb) {
  return {
    users: createUsersLoaders(db),
    posts: createPostsLoaders(db),
  };
}
```

## CLI Changes

### Before

```bash
drizzleloader -s ./schema.ts -o ./generated/loaders.ts
```

### After

```bash
drizzleloader -s ./schema.ts -o ./generated
```

### Option Changes

| Option | Before | After |
|--------|--------|-------|
| `-o` | `--output <path>` (file path) | `--output-dir <dir>` (parent directory) |

### Behavior

- 指定ディレクトリが存在しなければ作成
- `drizzleloaders.ts` と `drizzleloaders/` を生成
- `--import-extension` は全ての import に適用（スキーマ import + 内部 import）

## Implementation Changes

### Generator

- `code-generator.ts` を複数ファイル生成に対応
- 戻り値を `string` から `Map<string, string>` (ファイルパス → コード) に変更
- ヘルパー関数生成を追加

### CLI

- `-o, --output <path>` → `-o, --output-dir <dir>`
- `writeFileSync` 単一呼び出し → ディレクトリ作成 + 複数ファイル書き込み

### Tests

- golden テストを複数ファイル構成に更新
- 各 golden テストディレクトリ内に `drizzleloaders.ts` + `drizzleloaders/` を配置

## Breaking Changes

- CLI オプション名の変更 (`--output` → `--output-dir`)
- 出力が単一ファイルから複数ファイルに変更
