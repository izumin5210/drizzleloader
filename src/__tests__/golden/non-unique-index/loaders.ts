import type { InferSelectModel } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { inArray } from "drizzle-orm";
import DataLoader from "dataloader";
import * as __schema from "./schema.js";
import { DrizzleLoaderNotFound } from "drizzleloader/runtime";

type DrizzleDb = PgDatabase<PgQueryResultHKT, typeof __schema>;

function createPostsLoaders(db: DrizzleDb) {
  const byId = new DataLoader<number, InferSelectModel<typeof __schema.posts>>(
    async (ids) => {
      const rows = await db.select().from(__schema.posts).where(inArray(__schema.posts.id, [...ids]));
      const map = new Map(rows.map((row) => [row.id, row]));
      return ids.map((key) => map.get(key) ?? new DrizzleLoaderNotFound({ table: "posts", columns: [{ id: key }] }));
    }
  );
  const byAuthorId = new DataLoader<number, InferSelectModel<typeof __schema.posts>[]>(
    async (authorIds) => {
      const rows = await db.select().from(__schema.posts).where(inArray(__schema.posts.authorId, [...authorIds]));
      const map = new Map<number, InferSelectModel<typeof __schema.posts>[]>();
      for (const row of rows) {
        const existing = map.get(row.authorId) ?? [];
        existing.push(row);
        map.set(row.authorId, existing);
      }
      return authorIds.map((key) => map.get(key) ?? []);
    }
  );
  return { byId, byAuthorId };
}

export function createDrizzleLoaders(db: DrizzleDb) {
  return {
    posts: createPostsLoaders(db),
  };
}