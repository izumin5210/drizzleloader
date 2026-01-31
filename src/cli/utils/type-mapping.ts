import type { Column } from "drizzle-orm";

export function mapColumnToTsType(column: Column): string {
  const dataType = column.dataType;

  switch (dataType) {
    case "number":
      return "number";
    case "bigint":
      return "bigint";
    case "string":
      return "string";
    case "boolean":
      return "boolean";
    case "date":
      return "Date";
    case "json":
      return "unknown";
    default:
      return "unknown";
  }
}
