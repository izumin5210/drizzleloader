import type { Column } from "drizzle-orm";

export function mapColumnToTsType(_column: Column): string {
  throw new Error("Not implemented");
}
