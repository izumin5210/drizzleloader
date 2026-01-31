import DataLoader from "dataloader";
import { inArray } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import {
  DrizzleLoaderNotFound,
  buildLookupMap,
  lookupOrError,
} from "drizzleloader";
import * as __schema from "../schema.js";
import { type DrizzleDb } from "./_internal.js";

export function createUsersLoaders(db: DrizzleDb) {
  const byId = new DataLoader<number, InferSelectModel<typeof __schema.users>>(
    async (ids) => {
      const rows = await db.select().from(__schema.users).where(inArray(__schema.users.id, [...ids]));
      const map = buildLookupMap(rows, (row) => row.id);
      return ids.map((key) => lookupOrError(map, key, "users", "id"));
    }
  );
  return { byId };
}
