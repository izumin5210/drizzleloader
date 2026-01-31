# drizzleloader

Generate [DataLoader](https://github.com/graphql/dataloader) instances from [Drizzle ORM](https://orm.drizzle.team/) schema definitions.

Eliminates boilerplate code for implementing data-loading patterns in GraphQL applications.

## Features

- Automatically generates DataLoaders from Drizzle table definitions
- Supports primary keys and indexes (unique and non-unique)
- Full TypeScript support with type inference
- Batches queries using `inArray` for efficient database access

## Installation

```bash
npm install drizzleloader dataloader drizzle-orm
# or
pnpm add drizzleloader dataloader drizzle-orm
# or
yarn add drizzleloader dataloader drizzle-orm
```

## Quick Start

### 1. Define your Drizzle schema

```typescript
// src/db/schema.ts
import { pgTable, serial, text, integer, index, uniqueIndex } from "drizzle-orm/pg-core";

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
    authorId: integer("author_id"),
    title: text("title"),
  },
  (t) => [index("posts_author_id_idx").on(t.authorId)]
);
```

### 2. Generate loaders

```bash
# npm
npm exec drizzleloader -- generate --schema src/db/schema.ts --output src/db/loaders.ts

# pnpm
pnpm drizzleloader generate --schema src/db/schema.ts --output src/db/loaders.ts

# yarn
yarn drizzleloader generate --schema src/db/schema.ts --output src/db/loaders.ts
```

### 3. Use in your application

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { createDrizzleLoaders } from "./loaders";

const db = drizzle(pool, { schema });
const loaders = createDrizzleLoaders(db);

// Load a user by primary key
const user = await loaders.users.byId.load(1);

// Load a user by unique index
const userByEmail = await loaders.users.byEmail.load("user@example.com");

// Load all posts by author (non-unique index returns array)
const posts = await loaders.posts.byAuthorId.load(userId);
```

## CLI Options

```
drizzleloader generate [options]

Options:
  -s, --schema <path>           Path to the Drizzle schema file (required)
  -o, --output <path>           Path to the output file (required)
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
  const map = new Map(rows.map((row) => [row.id, row]));
  return ids.map((key) => map.get(key) ?? new DrizzleLoaderNotFound({ table: "users", columns: [{ id: key }] }));
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

## Error Handling

When a record is not found for a unique loader, DataLoader returns a `DrizzleLoaderNotFound` error. The error class is included in the generated code:

```typescript
import { DrizzleLoaderNotFound } from "./loaders";

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
- **Composite indexes are skipped**: Only single-column indexes are supported
- **Conditional indexes are skipped**: Indexes with `WHERE` clauses are not supported

## License

MIT
