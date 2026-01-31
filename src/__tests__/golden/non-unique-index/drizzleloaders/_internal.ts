import { eq, inArray, and, or } from "drizzle-orm";
import type { Column, InferSelectModel, Table } from "drizzle-orm";
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
  keyColumns: readonly (keyof T)[]
): string {
  return keyColumns.map((col) => String(key[col])).join("\0");
}

export function buildCompositeLookupMap<TRow extends Record<string, unknown>>(
  rows: TRow[],
  keyColumns: readonly string[]
): Map<string, TRow[]> {
  const map = new Map<string, TRow[]>();
  for (const row of rows) {
    const keyStr = keyColumns.map((col) => String(row[col])).join("\0");
    const existing = map.get(keyStr) ?? [];
    existing.push(row);
    map.set(keyStr, existing);
  }
  return map;
}

export async function queryCompositeKey<TTable extends Table>(
  db: DrizzleDb,
  table: TTable,
  columns: Column[],
  keys: readonly Record<string, unknown>[]
): Promise<InferSelectModel<TTable>[]> {
  if (keys.length === 0) return [];

  // Optimization: detect fixed columns (same value from start)
  const fixedCols: { col: Column; value: unknown }[] = [];
  const variableCols: Column[] = [];

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i]!;
    const colName = col.name;
    const firstValue = keys[0]![colName];
    const allSame = keys.every((k) => k[colName] === firstValue);

    if (allSame && variableCols.length === 0) {
      fixedCols.push({ col, value: firstValue });
    } else {
      variableCols.push(col);
    }
  }

  let query = db.select().from(table);

  // Fixed columns -> WHERE eq
  for (const { col, value } of fixedCols) {
    query = query.where(eq(col, value)) as typeof query;
  }

  // Variable columns
  if (variableCols.length === 0) {
    // All fixed - return as is
  } else if (variableCols.length === 1) {
    // Single variable -> IN
    const col = variableCols[0]!;
    const values = [...new Set(keys.map((k) => k[col.name]))];
    query = query.where(inArray(col, values as unknown[])) as typeof query;
  } else {
    // Multiple variable -> OR conditions
    const conditions = keys.map((key) => {
      const colConditions = variableCols.map((col) => eq(col, key[col.name]));
      return and(...colConditions);
    });
    query = query.where(or(...conditions)) as typeof query;
  }

  return query as unknown as Promise<InferSelectModel<TTable>[]>;
}
