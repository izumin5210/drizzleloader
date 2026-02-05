import type { Column, Table } from "drizzle-orm";
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import { mapColumnToTsType } from "../utils/type-mapping.js";
import type {
  AnalyzedColumn,
  AnalyzedIndex,
  AnalyzedPrimaryKey,
  AnalyzedTable,
} from "./types.js";

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

export function analyzeTable(table: Table, varName: string): AnalyzedTable {
  const config = getTableConfig(table as PgTable);

  const columnByName = new Map(config.columns.map((col) => [col.name, col]));

  // Check for single-column primary key first
  const primaryKeyColumn = config.columns.find((col) => col.primary);
  let primaryKey: AnalyzedPrimaryKey | null = null;

  if (primaryKeyColumn) {
    primaryKey = { columns: [toAnalyzedColumn(primaryKeyColumn)] };
  } else if (config.primaryKeys.length > 0) {
    // Check for composite primary key
    const pk = config.primaryKeys[0];
    if (pk) {
      const columns: AnalyzedColumn[] = [];
      for (const pkCol of pk.columns) {
        const col = columnByName.get(pkCol.name);
        if (col) {
          columns.push(toAnalyzedColumn(col));
        }
      }
      if (columns.length > 0) {
        primaryKey = { columns };
      }
    }
  }

  const indexes: AnalyzedIndex[] = [];
  for (const idx of config.indexes) {
    const idxConfig = idx.config;

    if (idxConfig.where !== undefined) {
      continue;
    }

    const columns: AnalyzedColumn[] = [];
    for (const indexedCol of idxConfig.columns) {
      if (!isIndexedColumn(indexedCol)) {
        continue;
      }
      const col = columnByName.get(indexedCol.name);
      if (!col) {
        continue;
      }
      columns.push(toAnalyzedColumn(col));
    }

    if (columns.length === 0) {
      continue;
    }

    indexes.push({
      name: idxConfig.name ?? "",
      columns,
      unique: idxConfig.unique ?? false,
    });
  }

  return {
    name: config.name,
    varName,
    table,
    primaryKey,
    indexes,
  };
}
