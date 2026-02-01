import * as path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { DrizzleDb } from "../../cli/__tests__/golden/composite-index/drizzleloaders/_internal.js";
import { createPostsLoaders } from "../../cli/__tests__/golden/composite-index/drizzleloaders/posts.js";
import * as schema from "../../cli/__tests__/golden/composite-index/schema.js";
import { QueryCapture } from "../utils/query-logger.js";
import {
  createTestDatabase,
  dropTestDatabase,
  pushSchemaToDatabase,
  type TestDbContext,
} from "../utils/test-db.js";

const SCHEMA_PATH = path.resolve(
  import.meta.dirname,
  "../../cli/__tests__/golden/composite-index/schema.ts",
);

describe("composite-index DataLoader integration", () => {
  let ctx: TestDbContext;
  let db: DrizzleDb;
  let client: ReturnType<typeof postgres>;
  let queryCapture: QueryCapture;

  beforeAll(async () => {
    ctx = await createTestDatabase();
    pushSchemaToDatabase(ctx, SCHEMA_PATH);

    client = postgres(ctx.connectionString);
    queryCapture = new QueryCapture();
    db = drizzle(client, { schema, logger: queryCapture });
  });

  afterAll(async () => {
    if (client) {
      await client.end();
    }
    if (ctx) {
      await dropTestDatabase(ctx);
    }
  });

  beforeEach(async () => {
    await client`DELETE FROM posts`;
    await client`ALTER SEQUENCE posts_id_seq RESTART WITH 1`;
    queryCapture.clear();
  });

  it("should load posts by id", async () => {
    await db.insert(schema.posts).values([
      { authorId: 1, category: "tech", title: "Post 1" },
      { authorId: 2, category: "tech", title: "Post 2" },
    ]);

    const loaders = createPostsLoaders(db);
    const post = await loaders.byId.load(1);

    expect(post).toMatchObject({
      id: 1,
      authorId: 1,
      category: "tech",
      title: "Post 1",
    });
  });

  it("should load posts by composite index (authorId + category)", async () => {
    await db.insert(schema.posts).values([
      { authorId: 1, category: "tech", title: "Tech Post 1" },
      { authorId: 1, category: "tech", title: "Tech Post 2" },
      { authorId: 1, category: "news", title: "News Post" },
      { authorId: 2, category: "tech", title: "User 2 Tech Post" },
    ]);

    const loaders = createPostsLoaders(db);

    // Non-unique index returns array
    const techPosts = await loaders.byAuthorIdAndCategory.load({
      authorId: 1,
      category: "tech",
    });

    expect(techPosts).toHaveLength(2);
    expect(techPosts.map((p) => p.title)).toEqual(
      expect.arrayContaining(["Tech Post 1", "Tech Post 2"]),
    );
  });

  it("should return empty array for non-existent composite key", async () => {
    await db
      .insert(schema.posts)
      .values([{ authorId: 1, category: "tech", title: "Existing Post" }]);

    const loaders = createPostsLoaders(db);
    const result = await loaders.byAuthorIdAndCategory.load({
      authorId: 999,
      category: "nonexistent",
    });

    expect(result).toEqual([]);
  });

  it("should batch multiple composite key requests", async () => {
    await db.insert(schema.posts).values([
      { authorId: 1, category: "tech", title: "Tech 1" },
      { authorId: 1, category: "news", title: "News 1" },
      { authorId: 2, category: "tech", title: "Tech 2" },
    ]);

    const loaders = createPostsLoaders(db);
    queryCapture.clear();

    // Load multiple keys in parallel - they should be batched
    const [techPosts1, newsPosts1, techPosts2] = await Promise.all([
      loaders.byAuthorIdAndCategory.load({ authorId: 1, category: "tech" }),
      loaders.byAuthorIdAndCategory.load({ authorId: 1, category: "news" }),
      loaders.byAuthorIdAndCategory.load({ authorId: 2, category: "tech" }),
    ]);

    expect(techPosts1).toHaveLength(1);
    expect(techPosts1[0]!.title).toBe("Tech 1");
    expect(newsPosts1).toHaveLength(1);
    expect(newsPosts1[0]!.title).toBe("News 1");
    expect(techPosts2).toHaveLength(1);
    expect(techPosts2[0]!.title).toBe("Tech 2");

    // Verify batching: only one query should be executed
    expect(queryCapture.queries).toHaveLength(1);
    expect(queryCapture.lastQuery).toMatchInlineSnapshot(`
      {
        "params": [
          1,
          "tech",
          1,
          "news",
          2,
          "tech",
        ],
        "sql": "select "id", "author_id", "category", "title" from "posts" where (("posts"."author_id" = $1 and "posts"."category" = $2) or ("posts"."author_id" = $3 and "posts"."category" = $4) or ("posts"."author_id" = $5 and "posts"."category" = $6))",
      }
    `);
  });

  it("should generate optimized query when first column is fixed", async () => {
    await db.insert(schema.posts).values([
      { authorId: 1, category: "tech", title: "Tech 1" },
      { authorId: 1, category: "news", title: "News 1" },
      { authorId: 1, category: "sports", title: "Sports 1" },
    ]);

    const loaders = createPostsLoaders(db);
    queryCapture.clear();

    // Same authorId, different categories - should use IN clause
    await Promise.all([
      loaders.byAuthorIdAndCategory.load({ authorId: 1, category: "tech" }),
      loaders.byAuthorIdAndCategory.load({ authorId: 1, category: "news" }),
      loaders.byAuthorIdAndCategory.load({ authorId: 1, category: "sports" }),
    ]);

    expect(queryCapture.queries).toHaveLength(1);
    expect(queryCapture.lastQuery).toMatchInlineSnapshot(`
      {
        "params": [
          1,
          "tech",
          "news",
          "sports",
        ],
        "sql": "select "id", "author_id", "category", "title" from "posts" where ("posts"."author_id" = $1 and "posts"."category" in ($2, $3, $4))",
      }
    `);
  });

  it("should generate OR conditions when both columns vary", async () => {
    await db.insert(schema.posts).values([
      { authorId: 1, category: "tech", title: "Tech 1" },
      { authorId: 2, category: "news", title: "News 2" },
    ]);

    const loaders = createPostsLoaders(db);
    queryCapture.clear();

    // Different authorIds - should use OR conditions
    await Promise.all([
      loaders.byAuthorIdAndCategory.load({ authorId: 1, category: "tech" }),
      loaders.byAuthorIdAndCategory.load({ authorId: 2, category: "news" }),
    ]);

    expect(queryCapture.queries).toHaveLength(1);
    expect(queryCapture.lastQuery).toMatchInlineSnapshot(`
      {
        "params": [
          1,
          "tech",
          2,
          "news",
        ],
        "sql": "select "id", "author_id", "category", "title" from "posts" where (("posts"."author_id" = $1 and "posts"."category" = $2) or ("posts"."author_id" = $3 and "posts"."category" = $4))",
      }
    `);
  });
});
