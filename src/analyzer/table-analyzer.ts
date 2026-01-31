import type { Column, Table } from "drizzle-orm";
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import { mapColumnToTsType } from "../utils/type-mapping.js";
import type { AnalyzedColumn, AnalyzedIndex, AnalyzedTable } from "./types.js";

function toAnalyzedColumn(column: Column): AnalyzedColumn {
  return {
    name: column.name,
    tsType: mapColumnToTsType(column),
    column,
  };
}

interface IndexedColumn {
  name: string;
}

function isIndexedColumn(val: unknown): val is IndexedColumn {
  return val !== null && typeof val === "object" && "name" in val;
}

export function analyzeTable(table: Table): AnalyzedTable {
  const config = getTableConfig(table as PgTable);

  const columnByName = new Map(config.columns.map((col) => [col.name, col]));

  const primaryKeyColumn = config.columns.find((col) => col.primary);
  const primaryKey = primaryKeyColumn
    ? { column: toAnalyzedColumn(primaryKeyColumn) }
    : null;

  const indexes: AnalyzedIndex[] = [];
  for (const idx of config.indexes) {
    const idxConfig = idx.config;

    if (idxConfig.columns.length !== 1) {
      continue;
    }

    if (idxConfig.where !== undefined) {
      continue;
    }

    const indexedCol = idxConfig.columns[0];
    if (!indexedCol || !isIndexedColumn(indexedCol)) {
      continue;
    }

    const col = columnByName.get(indexedCol.name);
    if (!col) {
      continue;
    }

    indexes.push({
      name: idxConfig.name ?? "",
      column: toAnalyzedColumn(col),
      unique: idxConfig.unique ?? false,
    });
  }

  return {
    name: config.name,
    table,
    primaryKey,
    indexes,
  };
}
