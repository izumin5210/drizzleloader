import type { InferSelectModel } from "drizzle-orm";
import { inArray } from "drizzle-orm";
import DataLoader from "dataloader";
import { users, posts } from "./schema";
import { DrizzleLoaderNotFound } from "drizzleloader/runtime";

function createUsersLoaders(db: DrizzleDb) {
  const byId = new DataLoader<number, InferSelectModel<typeof users>>(
    async (ids) => {
      const rows = await db.select().from(users).where(inArray(users.id, [...ids]));
      const map = new Map(rows.map((row) => [row.id, row]));
      return ids.map((key) => map.get(key) ?? new DrizzleLoaderNotFound({ table: "users", columns: [{ id: key }] }));
    }
  );
  return { byId };
}

function createPostsLoaders(db: DrizzleDb) {
  const byId = new DataLoader<number, InferSelectModel<typeof posts>>(
    async (ids) => {
      const rows = await db.select().from(posts).where(inArray(posts.id, [...ids]));
      const map = new Map(rows.map((row) => [row.id, row]));
      return ids.map((key) => map.get(key) ?? new DrizzleLoaderNotFound({ table: "posts", columns: [{ id: key }] }));
    }
  );
  const byAuthorId = new DataLoader<number, InferSelectModel<typeof posts>[]>(
    async (authorIds) => {
      const rows = await db.select().from(posts).where(inArray(posts.authorId, [...authorIds]));
      const map = new Map<number, InferSelectModel<typeof posts>[]>();
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
    users: createUsersLoaders(db),
    posts: createPostsLoaders(db),
  };
}