import { DrizzleLoaderNotFound } from "./errors.js";

export function buildLookupMap<K, V>(
  rows: V[],
  keyFn: (row: V) => K,
): Map<K, V> {
  return new Map(rows.map((row) => [keyFn(row), row]));
}

export function lookupOrError<K, V>(
  map: Map<K, V>,
  key: K,
  table: string,
  column: string,
): V | DrizzleLoaderNotFound {
  return (
    map.get(key) ??
    new DrizzleLoaderNotFound({ table, columns: [{ [column]: key }] })
  );
}
