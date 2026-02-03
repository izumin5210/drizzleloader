# jiti によるスキーマファイル読み込みの設計

## 背景

現在の CLI 実装では、スキーマファイルを Node.js の `import()` で直接読み込んでいる。

```typescript
const module = await import(fileUrl);
```

この実装には以下の問題がある：

1. **トランスパイル後の CLI が TypeScript ファイルを読み込めない**
   - `dist/cli/index.js` として配布した場合、Node.js は TypeScript を直接実行できない
2. **副作用の分離ができていない**
   - インポートしたコードがグローバル状態を変更する可能性がある

## 解決策

[jiti](https://github.com/unjs/jiti) を使用して TypeScript ファイルをオンザフライでトランスパイルする。

### jiti を選択した理由

- ゼロ依存で軽量
- ESM/CommonJS 両方に対応
- drizzle-kit と同じエコシステムで広く使われているアプローチ

### 代替案

1. **esbuild-register** - drizzle-kit が使用。jiti より設定が複雑
2. **esbuild でインメモリビルド** - 副作用の分離は良いが、バンドル設定が必要
3. **子プロセスで実行** - 完全分離だが、オーバーヘッドが大きい

## 変更内容

### 1. package.json

`jiti` を dependencies に追加：

```json
{
  "dependencies": {
    "jiti": "^2.x.x"
  }
}
```

### 2. src/cli/index.ts

`loadSchema` 関数を修正：

```typescript
import { createJiti } from "jiti";

async function loadSchema(schemaPath: string): Promise<Table[]> {
  const jiti = createJiti(import.meta.url, {
    moduleCache: false,  // 常に最新のスキーマを読み込む
  });

  const absolutePath = resolve(process.cwd(), schemaPath);
  const module = await jiti.import(absolutePath);

  const tables: Table[] = [];
  for (const [, value] of Object.entries(module)) {
    if (is(value, PgTable)) {
      tables.push(value as Table);
    }
  }

  return tables;
}
```

削除する import：
- `import { pathToFileURL } from "node:url";`

### 3. src/__tests__/integration/cli-generate.test.ts（新規）

ビルド後の CLI が TypeScript スキーマを読み込めることを確認する統合テスト：

```typescript
import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

describe("CLI generate command (built)", () => {
  const outputDir = "/tmp/claude/drizzleloader-test-output";
  const cliPath = resolve(import.meta.dirname, "../../../dist/cli/index.js");
  const schemaPath = resolve(
    import.meta.dirname,
    "../../cli/__tests__/golden/basic-pk/schema.ts"
  );

  afterEach(() => {
    if (existsSync(outputDir)) {
      rmSync(outputDir, { recursive: true });
    }
  });

  it("should generate loaders from TypeScript schema", () => {
    execFileSync("node", [cliPath, "generate", "-s", schemaPath, "-o", outputDir]);

    expect(existsSync(`${outputDir}/drizzleloaders.ts`)).toBe(true);
  });
});
```

## テスト戦略

- 単体テストの追加は不要（jiti の内部動作をテストする必要はない）
- 統合テストで「ビルド後の CLI で TS スキーマを読み込める」ことを確認
- CI では `pnpm build && pnpm test:integration` の順で実行

## 実装手順

1. `jiti` を dependencies に追加
2. `src/cli/index.ts` の `loadSchema` 関数を修正
3. 統合テスト `src/__tests__/integration/cli-generate.test.ts` を作成
4. `pnpm build && pnpm test:integration` で動作確認
