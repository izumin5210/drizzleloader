import { integer, pgTable, varchar } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import { describe, expect, it } from "vitest";
import { DrizzleLoaderNotFound } from "./errors.js";
import {
  buildCompositeQuery,
  buildLookupMap,
  lookupOrError,
} from "./helpers.js";

describe("buildLookupMap", () => {
  it("should build a map from rows", () => {
    const rows = [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ];

    const map = buildLookupMap(rows, (row) => row.id);

    expect(map.get(1)).toEqual({ id: 1, name: "Alice" });
    expect(map.get(2)).toEqual({ id: 2, name: "Bob" });
  });

  it("should return empty map for empty rows", () => {
    const rows: { id: number }[] = [];

    const map = buildLookupMap(rows, (row) => row.id);

    expect(map.size).toBe(0);
  });

  it("should handle string keys", () => {
    const rows = [
      { email: "alice@example.com", name: "Alice" },
      { email: "bob@example.com", name: "Bob" },
    ];

    const map = buildLookupMap(rows, (row) => row.email);

    expect(map.get("alice@example.com")).toEqual({
      email: "alice@example.com",
      name: "Alice",
    });
  });
});

describe("lookupOrError", () => {
  it("should return value when key exists", () => {
    const map = new Map([[1, { id: 1, name: "Alice" }]]);

    const result = lookupOrError(map, 1, "users", "id");

    expect(result).toEqual({ id: 1, name: "Alice" });
  });

  it("should return DrizzleLoaderNotFound when key does not exist", () => {
    const map = new Map<number, { id: number; name: string }>();

    const result = lookupOrError(map, 999, "users", "id");

    expect(result).toBeInstanceOf(DrizzleLoaderNotFound);
    if (result instanceof DrizzleLoaderNotFound) {
      expect(result.table).toBe("users");
      expect(result.columns).toEqual([{ id: 999 }]);
    }
  });
});

// Test schema for composite key queries
const posts = pgTable("posts", {
  id: integer("id").primaryKey(),
  authorId: integer("author_id").notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  title: varchar("title", { length: 255 }),
});

// biome-ignore lint/suspicious/noExplicitAny: intentionally using dummy client for query building only
const db = drizzle({} as any);

describe("buildCompositeQuery", () => {
  it("should return null for empty keys", () => {
    const result = buildCompositeQuery(
      db,
      posts,
      [posts.authorId, posts.category],
      ["authorId", "category"],
      [],
    );

    expect(result).toBeNull();
  });

  it("should generate eq conditions for all-fixed columns", () => {
    const query = buildCompositeQuery(
      db,
      posts,
      [posts.authorId, posts.category],
      ["authorId", "category"],
      [
        { authorId: 1, category: "tech" },
        { authorId: 1, category: "tech" },
      ],
    );

    expect(query).not.toBeNull();
    const { sql, params } = query!.toSQL();
    expect(sql).toBe(
      'select "id", "author_id", "category", "title" from "posts" where ("posts"."author_id" = $1 and "posts"."category" = $2)',
    );
    expect(params).toEqual([1, "tech"]);
  });

  it("should generate IN clause for single variable column", () => {
    const query = buildCompositeQuery(
      db,
      posts,
      [posts.authorId, posts.category],
      ["authorId", "category"],
      [
        { authorId: 1, category: "tech" },
        { authorId: 1, category: "news" },
        { authorId: 1, category: "sports" },
      ],
    );

    expect(query).not.toBeNull();
    const { sql, params } = query!.toSQL();
    expect(sql).toBe(
      'select "id", "author_id", "category", "title" from "posts" where ("posts"."author_id" = $1 and "posts"."category" in ($2, $3, $4))',
    );
    expect(params).toEqual([1, "tech", "news", "sports"]);
  });

  it("should deduplicate values in IN clause", () => {
    const query = buildCompositeQuery(
      db,
      posts,
      [posts.authorId, posts.category],
      ["authorId", "category"],
      [
        { authorId: 1, category: "tech" },
        { authorId: 1, category: "tech" },
        { authorId: 1, category: "news" },
      ],
    );

    expect(query).not.toBeNull();
    const { sql, params } = query!.toSQL();
    expect(sql).toBe(
      'select "id", "author_id", "category", "title" from "posts" where ("posts"."author_id" = $1 and "posts"."category" in ($2, $3))',
    );
    expect(params).toEqual([1, "tech", "news"]);
  });

  it("should generate OR conditions for multiple variable columns", () => {
    const query = buildCompositeQuery(
      db,
      posts,
      [posts.authorId, posts.category],
      ["authorId", "category"],
      [
        { authorId: 1, category: "tech" },
        { authorId: 2, category: "news" },
      ],
    );

    expect(query).not.toBeNull();
    const { sql, params } = query!.toSQL();
    expect(sql).toBe(
      'select "id", "author_id", "category", "title" from "posts" where (("posts"."author_id" = $1 and "posts"."category" = $2) or ("posts"."author_id" = $3 and "posts"."category" = $4))',
    );
    expect(params).toEqual([1, "tech", 2, "news"]);
  });

  it("should generate OR conditions with three variable keys", () => {
    const query = buildCompositeQuery(
      db,
      posts,
      [posts.authorId, posts.category],
      ["authorId", "category"],
      [
        { authorId: 1, category: "tech" },
        { authorId: 2, category: "news" },
        { authorId: 3, category: "sports" },
      ],
    );

    expect(query).not.toBeNull();
    const { sql, params } = query!.toSQL();
    expect(sql).toBe(
      'select "id", "author_id", "category", "title" from "posts" where (("posts"."author_id" = $1 and "posts"."category" = $2) or ("posts"."author_id" = $3 and "posts"."category" = $4) or ("posts"."author_id" = $5 and "posts"."category" = $6))',
    );
    expect(params).toEqual([1, "tech", 2, "news", 3, "sports"]);
  });

  it("should handle single key", () => {
    const query = buildCompositeQuery(
      db,
      posts,
      [posts.authorId, posts.category],
      ["authorId", "category"],
      [{ authorId: 1, category: "tech" }],
    );

    expect(query).not.toBeNull();
    const { sql, params } = query!.toSQL();
    expect(sql).toBe(
      'select "id", "author_id", "category", "title" from "posts" where ("posts"."author_id" = $1 and "posts"."category" = $2)',
    );
    expect(params).toEqual([1, "tech"]);
  });
});
