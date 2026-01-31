import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as __schema from "../schema.js";

export type DrizzleDb = PgDatabase<PgQueryResultHKT, typeof __schema>;

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

export function buildLookupMap<K, V>(
  rows: V[],
  keyFn: (row: V) => K
): Map<K, V> {
  return new Map(rows.map((row) => [keyFn(row), row]));
}

export function lookupOrError<K, V>(
  map: Map<K, V>,
  key: K,
  table: string,
  column: string
): V | DrizzleLoaderNotFound {
  return (
    map.get(key) ?? new DrizzleLoaderNotFound({ table, columns: [{ [column]: key }] })
  );
}

export function serializeCompositeKey<T extends Record<string, unknown>>(
  key: T,
  keyColumns: (keyof T)[]
): string {
  return keyColumns.map((col) => String(key[col])).join("\0");
}

export function buildCompositeLookupMap<
  TKey extends Record<string, unknown>,
  TRow extends Record<string, unknown>
>(
  rows: TRow[],
  keyColumns: (keyof TKey)[]
): Map<string, TRow[]> {
  const map = new Map<string, TRow[]>();
  for (const row of rows) {
    const keyStr = keyColumns.map((col) => String(row[col as string])).join("\0");
    const existing = map.get(keyStr) ?? [];
    existing.push(row);
    map.set(keyStr, existing);
  }
  return map;
}
