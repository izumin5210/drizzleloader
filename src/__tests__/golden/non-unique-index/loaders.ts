import type { InferSelectModel } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { inArray } from "drizzle-orm";
import DataLoader from "dataloader";
import * as __schema from "./schema.js";

type DrizzleDb = PgDatabase<PgQueryResultHKT, typeof __schema>;

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
