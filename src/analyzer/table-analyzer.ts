import type { Table } from "drizzle-orm";
import type { AnalyzedTable } from "./types.js";

export function analyzeTable(_table: Table): AnalyzedTable {
  throw new Error("Not implemented");
}
