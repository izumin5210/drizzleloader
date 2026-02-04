import type { Column, Table } from "drizzle-orm";

export interface AnalyzedColumn {
  name: string;
  tsType: string;
  column: Column;
}

export interface AnalyzedPrimaryKey {
  columns: AnalyzedColumn[];
}

export interface AnalyzedIndex {
  name: string;
  columns: AnalyzedColumn[];
  unique: boolean;
}

export interface AnalyzedTable {
  name: string;
  table: Table;
  primaryKey: AnalyzedPrimaryKey | null;
  indexes: AnalyzedIndex[];
}
