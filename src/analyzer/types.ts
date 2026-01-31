import type { Column, Table } from "drizzle-orm";

export interface AnalyzedColumn {
  name: string;
  tsType: string;
  column: Column;
}

export interface AnalyzedPrimaryKey {
  column: AnalyzedColumn;
}

export interface AnalyzedIndex {
  name: string;
  column: AnalyzedColumn;
  unique: boolean;
}

export interface AnalyzedTable {
  name: string;
  table: Table;
  primaryKey: AnalyzedPrimaryKey | null;
  indexes: AnalyzedIndex[];
}
