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
