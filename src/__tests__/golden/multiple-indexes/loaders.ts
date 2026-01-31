import type { InferSelectModel } from "drizzle-orm";
import { inArray } from "drizzle-orm";
import DataLoader from "dataloader";
import { posts } from "./schema";
import { DrizzleLoaderNotFound } from "drizzleloader/runtime";

function createPostsLoaders(db: DrizzleDb) {
  const byId = new DataLoader<number, InferSelectModel<typeof posts>>(
    async (ids) => {
      const rows = await db.select().from(posts).where(inArray(posts.id, [...ids]));
      const map = new Map(rows.map((row) => [row.id, row]));
      return ids.map((key) => map.get(key) ?? new DrizzleLoaderNotFound({ table: "posts", columns: [{ id: key }] }));
    }
  );
  const bySlug = new DataLoader<string, InferSelectModel<typeof posts>>(
    async (slugs) => {
      const rows = await db.select().from(posts).where(inArray(posts.slug, [...slugs]));
      const map = new Map(rows.map((row) => [row.slug, row]));
      return slugs.map((key) => map.get(key) ?? new DrizzleLoaderNotFound({ table: "posts", columns: [{ slug: key }] }));
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
  const byCategoryId = new DataLoader<number, InferSelectModel<typeof posts>[]>(
    async (categoryIds) => {
      const rows = await db.select().from(posts).where(inArray(posts.categoryId, [...categoryIds]));
      const map = new Map<number, InferSelectModel<typeof posts>[]>();
      for (const row of rows) {
        const existing = map.get(row.categoryId) ?? [];
        existing.push(row);
        map.set(row.categoryId, existing);
      }
      return categoryIds.map((key) => map.get(key) ?? []);
    }
  );
  return { byId, bySlug, byAuthorId, byCategoryId };
}

export function createDrizzleLoaders(db: DrizzleDb) {
  return {
    posts: createPostsLoaders(db),
  };
}