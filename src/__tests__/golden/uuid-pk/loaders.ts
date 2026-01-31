import type { InferSelectModel } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { inArray } from "drizzle-orm";
import DataLoader from "dataloader";
import * as __schema from "./schema";
import { DrizzleLoaderNotFound } from "drizzleloader/runtime";

type DrizzleDb = PgDatabase<PgQueryResultHKT, typeof __schema>;

function createItemsLoaders(db: DrizzleDb) {
  const byId = new DataLoader<string, InferSelectModel<typeof __schema.items>>(
    async (ids) => {
      const rows = await db.select().from(__schema.items).where(inArray(__schema.items.id, [...ids]));
      const map = new Map(rows.map((row) => [row.id, row]));
      return ids.map((key) => map.get(key) ?? new DrizzleLoaderNotFound({ table: "items", columns: [{ id: key }] }));
    }
  );
  return { byId };
}

export function createDrizzleLoaders(db: DrizzleDb) {
  return {
    items: createItemsLoaders(db),
  };
}