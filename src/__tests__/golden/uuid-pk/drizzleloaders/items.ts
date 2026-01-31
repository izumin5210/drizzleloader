import DataLoader from "dataloader";
import { inArray } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import * as __schema from "../schema.js";
import {
  type DrizzleDb,
  DrizzleLoaderNotFound,
  buildLookupMap,
  lookupOrError,
} from "./_internal.js";

export function createItemsLoaders(db: DrizzleDb) {
  const byId = new DataLoader<string, InferSelectModel<typeof __schema.items>>(
    async (ids) => {
      const rows = await db.select().from(__schema.items).where(inArray(__schema.items.id, [...ids]));
      const map = buildLookupMap(rows, (row) => row.id);
      return ids.map((key) => lookupOrError(map, key, "items", "id"));
    }
  );
  return { byId };
}
