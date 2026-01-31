import type { InferSelectModel } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { inArray } from "drizzle-orm";
import DataLoader from "dataloader";
import * as __schema from "./schema";
import { DrizzleLoaderNotFound } from "drizzleloader/runtime";

type DrizzleDb = PgDatabase<PgQueryResultHKT, typeof __schema>;

function createUsersLoaders(db: DrizzleDb) {
  const byId = new DataLoader<number, InferSelectModel<typeof __schema.users>>(
    async (ids) => {
      const rows = await db.select().from(__schema.users).where(inArray(__schema.users.id, [...ids]));
      const map = new Map(rows.map((row) => [row.id, row]));
      return ids.map((key) => map.get(key) ?? new DrizzleLoaderNotFound({ table: "users", columns: [{ id: key }] }));
    }
  );
  const byEmail = new DataLoader<string, InferSelectModel<typeof __schema.users>>(
    async (emails) => {
      const rows = await db.select().from(__schema.users).where(inArray(__schema.users.email, [...emails]));
      const map = new Map(rows.map((row) => [row.email, row]));
      return emails.map((key) => map.get(key) ?? new DrizzleLoaderNotFound({ table: "users", columns: [{ email: key }] }));
    }
  );
  return { byId, byEmail };
}

export function createDrizzleLoaders(db: DrizzleDb) {
  return {
    users: createUsersLoaders(db),
  };
}