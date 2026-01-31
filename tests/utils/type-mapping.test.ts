import { describe, expect, it } from "vitest";
import {
  pgTable,
  serial,
  integer,
  smallint,
  bigint,
  text,
  varchar,
  boolean,
  timestamp,
  uuid,
  real,
  doublePrecision,
  date,
  json,
  jsonb,
  getTableConfig,
} from "drizzle-orm/pg-core";
import { mapColumnToTsType } from "../../src/utils/type-mapping.js";

function createTableWithColumn<T>(
  columnName: string,
  columnDef: T
): T extends object ? T : never {
  const table = pgTable("test_table", { [columnName]: columnDef });
  const config = getTableConfig(table);
  const column = config.columns.find((c) => c.name === columnName);
  if (!column) throw new Error(`Column ${columnName} not found`);
  return column as T extends object ? T : never;
}

describe("mapColumnToTsType", () => {
  describe("numeric types", () => {
    it("maps serial to number", () => {
      const column = createTableWithColumn("id", serial("id"));
      expect(mapColumnToTsType(column)).toBe("number");
    });

    it("maps integer to number", () => {
      const column = createTableWithColumn("count", integer("count"));
      expect(mapColumnToTsType(column)).toBe("number");
    });

    it("maps smallint to number", () => {
      const column = createTableWithColumn(
        "small_count",
        smallint("small_count")
      );
      expect(mapColumnToTsType(column)).toBe("number");
    });

    it("maps real to number", () => {
      const column = createTableWithColumn("float_val", real("float_val"));
      expect(mapColumnToTsType(column)).toBe("number");
    });

    it("maps doublePrecision to number", () => {
      const column = createTableWithColumn(
        "double_val",
        doublePrecision("double_val")
      );
      expect(mapColumnToTsType(column)).toBe("number");
    });

    it("maps bigint with number mode to number", () => {
      const column = createTableWithColumn(
        "big_count",
        bigint("big_count", { mode: "number" })
      );
      expect(mapColumnToTsType(column)).toBe("number");
    });

    it("maps bigint with bigint mode to bigint", () => {
      const column = createTableWithColumn(
        "big_count",
        bigint("big_count", { mode: "bigint" })
      );
      expect(mapColumnToTsType(column)).toBe("bigint");
    });
  });

  describe("string types", () => {
    it("maps text to string", () => {
      const column = createTableWithColumn("content", text("content"));
      expect(mapColumnToTsType(column)).toBe("string");
    });

    it("maps varchar to string", () => {
      const column = createTableWithColumn(
        "email",
        varchar("email", { length: 255 })
      );
      expect(mapColumnToTsType(column)).toBe("string");
    });

    it("maps uuid to string", () => {
      const column = createTableWithColumn("external_id", uuid("external_id"));
      expect(mapColumnToTsType(column)).toBe("string");
    });
  });

  describe("boolean type", () => {
    it("maps boolean to boolean", () => {
      const column = createTableWithColumn("is_active", boolean("is_active"));
      expect(mapColumnToTsType(column)).toBe("boolean");
    });
  });

  describe("date/time types", () => {
    it("maps timestamp to Date by default", () => {
      const column = createTableWithColumn(
        "created_at",
        timestamp("created_at")
      );
      expect(mapColumnToTsType(column)).toBe("Date");
    });

    it("maps timestamp with string mode to string", () => {
      const column = createTableWithColumn(
        "created_at",
        timestamp("created_at", { mode: "string" })
      );
      expect(mapColumnToTsType(column)).toBe("string");
    });

    it("maps date to Date by default", () => {
      const column = createTableWithColumn("birth_date", date("birth_date"));
      expect(mapColumnToTsType(column)).toBe("Date");
    });

    it("maps date with string mode to string", () => {
      const column = createTableWithColumn(
        "birth_date",
        date("birth_date", { mode: "string" })
      );
      expect(mapColumnToTsType(column)).toBe("string");
    });
  });

  describe("JSON types", () => {
    it("maps json to unknown", () => {
      const column = createTableWithColumn("data", json("data"));
      expect(mapColumnToTsType(column)).toBe("unknown");
    });

    it("maps jsonb to unknown", () => {
      const column = createTableWithColumn("data", jsonb("data"));
      expect(mapColumnToTsType(column)).toBe("unknown");
    });
  });
});
