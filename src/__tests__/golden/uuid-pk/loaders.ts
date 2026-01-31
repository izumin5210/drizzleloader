import type { InferSelectModel } from "drizzle-orm";
import { inArray } from "drizzle-orm";
import DataLoader from "dataloader";
import { items } from "./schema";
import { DrizzleLoaderNotFound } from "drizzleloader/runtime";

function createItemsLoaders(db: DrizzleDb) {
  const byId = new DataLoader<string, InferSelectModel<typeof items>>(
    async (ids) => {
      const rows = await db.select().from(items).where(inArray(items.id, [...ids]));
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