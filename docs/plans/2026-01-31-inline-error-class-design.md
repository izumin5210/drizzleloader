# Inline Error Class in Generated Code

## Overview

Generate `DrizzleLoaderNotFound` error class directly in the generated loader code instead of importing from `drizzleloader/runtime`. This makes generated code fully standalone.

## Motivation

- Generated code should be self-contained without runtime dependencies on `drizzleloader`
- `drizzleloader` becomes a dev-only dependency (code generation tool)
- Simplifies deployment and reduces dependency chain

## Design

### Generated Code Structure

Before:
```typescript
import { DrizzleLoaderNotFound } from "drizzleloader/runtime";
// ... loaders
```

After:
```typescript
import type { InferSelectModel } from "drizzle-orm";
// ... other imports (no drizzleloader)

export class DrizzleLoaderNotFound extends Error {
  readonly table: string;
  readonly columns: Record<string, unknown>[];

  constructor(options: { table: string; columns: Record<string, unknown>[] }) {
    const columnStr = options.columns
      .map((col) =>
        Object.entries(col)
          .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
          .join(", ")
      )
      .join("; ");
    super(`Record not found in ${options.table} for ${columnStr}`);
    this.name = "DrizzleLoaderNotFound";
    this.table = options.table;
    this.columns = options.columns;
  }
}

// ... loaders
```

### Implementation Changes

1. **`src/generator/code-generator.ts`**
   - Remove `drizzleloader/runtime` import from `generateImports`
   - Add `generateErrorClass` function
   - Insert error class after imports in `generateLoaderCode`

2. **Delete runtime package:**
   - `src/runtime/errors.ts`
   - `src/runtime/index.ts`

3. **Update package.json:**
   - Remove `"./runtime"` from exports

4. **Update documentation:**
   - `README.md` - Update import examples
   - `CLAUDE.md` - Remove runtime references

5. **Update tests:**
   - All golden files in `src/__tests__/golden/`

## Breaking Changes

- `drizzleloader/runtime` export is removed
- Users importing `DrizzleLoaderNotFound` from runtime must regenerate their loaders
