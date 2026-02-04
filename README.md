# drizzleloader

Generate [DataLoader](https://github.com/graphql/dataloader) instances from [Drizzle ORM](https://orm.drizzle.team/) schema definitions.

Eliminates boilerplate code for implementing data-loading patterns in GraphQL applications.

## Features

- Automatically generates DataLoaders from Drizzle table definitions
- Supports primary keys and indexes (unique and non-unique)
- Supports composite primary keys and composite indexes
- Full TypeScript support with type inference
- Batches queries using `inArray` for efficient database access

## Installation

```bash
npm install -D drizzleloader && npm install dataloader drizzle-orm
# or
pnpm add -D drizzleloader && pnpm add dataloader drizzle-orm
# or
yarn add -D drizzleloader && yarn add dataloader drizzle-orm
```

> **Note**: drizzleloader is a code generator and can be installed as a devDependency. The generated code has no runtime dependency on drizzleloader.

## Quick Start

### 1. Define your Drizzle schema

```typescript
// src/db/schema.ts
import { pgTable, serial, text, integer, varchar, index, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: text("email"),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)]
);

export const posts = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id"),
    authorId: integer("author_id"),
    slug: varchar("slug", { length: 255 }),
    title: text("title"),
  },
  (t) => [
    index("posts_author_id_idx").on(t.authorId),
    uniqueIndex("posts_tenant_slug_idx").on(t.tenantId, t.slug),
  ]
);
```

### 2. Generate loaders

```bash
# npm
npm exec drizzleloader -- generate --schema src/db/schema.ts --output-dir src/db/__generated__

# pnpm
pnpm drizzleloader generate --schema src/db/schema.ts --output-dir src/db/__generated__

# yarn
yarn drizzleloader generate --schema src/db/schema.ts --output-dir src/db/__generated__
```

This generates:

```
src/db/__generated__/
├── drizzleloaders.ts           # Entry point with createDrizzleLoaders()
└── drizzleloaders/
    ├── _internal.ts            # Internal type definitions
    ├── _runtime.ts             # Runtime helpers (DrizzleLoaderNotFound, etc.)
    ├── users.ts                # User loaders
    └── posts.ts                # Post loaders
```

### 3. Use in your application

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { createDrizzleLoaders } from "./__generated__/drizzleloaders";

const db = drizzle(pool, { schema });
const loaders = createDrizzleLoaders(db);

// Load a user by primary key
const user = await loaders.users.byId.load(1);

// Load a user by unique index
const userByEmail = await loaders.users.byEmail.load("user@example.com");

// Load all posts by author (non-unique index returns array)
const posts = await loaders.posts.byAuthorId.load(userId);

// Load a post by composite unique index
const post = await loaders.posts.byTenantIdAndSlug.load({ tenantId: 1, slug: "hello-world" });
```

## CLI Options

```
drizzleloader generate [options]

Options:
  -s, --schema <path>           Path to the Drizzle schema file (required)
  -o, --output-dir <dir>        Output directory (required)
  -e, --import-extension <ext>  Extension for schema import: ".js" or "none" (default: ".js")
```

### Import Extension

The `--import-extension` option controls how the generated file imports your schema:

- `.js` (default): Uses `.js` extension (recommended for ES modules)
- `none`: No extension (for bundlers that handle resolution)

## Generated Code

### Unique Loaders (Primary Key, Unique Index)

For primary keys and unique indexes, loaders return a single value or throw `DrizzleLoaderNotFound`:

```typescript
const byId = new DataLoader<number, User>(async (ids) => {
  const rows = await db.select().from(users).where(inArray(users.id, [...ids]));
  const map = buildLookupMap(rows, (row) => row.id);
  return ids.map((key) => lookupOrError(map, key, "users", "id"));
});
```

### Non-Unique Loaders (Regular Index)

For regular indexes, loaders return arrays:

```typescript
const byAuthorId = new DataLoader<number, Post[]>(async (authorIds) => {
  const rows = await db.select().from(posts).where(inArray(posts.authorId, [...authorIds]));
  const map = new Map<number, Post[]>();
  for (const row of rows) {
    const existing = map.get(row.authorId) ?? [];
    existing.push(row);
    map.set(row.authorId, existing);
  }
  return authorIds.map((key) => map.get(key) ?? []);
});
```

### Composite Index Loaders

For composite indexes, loaders accept an object key with all indexed columns:

```typescript
// Composite unique index - returns single value
const byTenantIdAndSlug = new DataLoader<
  { tenantId: number; slug: string },
  Post,
  string
>(
  async (keys) => {
    const rows = await queryCompositeKey(db, posts, [posts.tenantId, posts.slug], ["tenantId", "slug"], keys);
    const map = buildCompositeLookupMap(rows, ["tenantId", "slug"]);
    return keys.map((key) => {
      const found = map.get(serializeCompositeKey(key, ["tenantId", "slug"]))?.[0];
      return found ?? new DrizzleLoaderNotFound({ table: "posts", columns: [{ tenant_id: key.tenantId, slug: key.slug }] });
    });
  },
  { cacheKeyFn: (key) => serializeCompositeKey(key, ["tenantId", "slug"]) }
);

// Composite non-unique index - returns array
const byAuthorIdAndCategory = new DataLoader<
  { authorId: number; category: string },
  Post[],
  string
>(
  async (keys) => {
    const rows = await queryCompositeKey(db, posts, [posts.authorId, posts.category], ["authorId", "category"], keys);
    const map = buildCompositeLookupMap(rows, ["authorId", "category"]);
    return keys.map((key) => map.get(serializeCompositeKey(key, ["authorId", "category"])) ?? []);
  },
  { cacheKeyFn: (key) => serializeCompositeKey(key, ["authorId", "category"]) }
);
```

## Error Handling

When a record is not found for a unique loader, DataLoader returns a `DrizzleLoaderNotFound` error:

```typescript
import { DrizzleLoaderNotFound } from "./__generated__/drizzleloaders";

try {
  const user = await loaders.users.byId.load(999);
} catch (error) {
  if (error instanceof DrizzleLoaderNotFound) {
    console.log(error.table);   // "users"
    console.log(error.columns); // [{ id: 999 }]
  }
}
```

## Limitations

- **PostgreSQL only**: Currently supports `drizzle-orm/pg-core` tables
- **Conditional indexes are skipped**: Indexes with `WHERE` clauses are not supported

## License

MIT
