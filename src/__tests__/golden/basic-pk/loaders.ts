import type { InferSelectModel } from "drizzle-orm";
import { inArray } from "drizzle-orm";
import DataLoader from "dataloader";
import { users } from "./schema";
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

export function createDrizzleLoaders(db: DrizzleDb) {
  return {
    users: createUsersLoaders(db),
  };
}