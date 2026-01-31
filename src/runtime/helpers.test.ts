import { describe, expect, it } from "vitest";
import { DrizzleLoaderNotFound } from "./errors.js";
import { buildLookupMap, lookupOrError } from "./helpers.js";

describe("buildLookupMap", () => {
  it("should build a map from rows", () => {
    const rows = [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ];

    const map = buildLookupMap(rows, (row) => row.id);

    expect(map.get(1)).toEqual({ id: 1, name: "Alice" });
    expect(map.get(2)).toEqual({ id: 2, name: "Bob" });
  });

  it("should return empty map for empty rows", () => {
    const rows: { id: number }[] = [];

    const map = buildLookupMap(rows, (row) => row.id);

    expect(map.size).toBe(0);
  });

  it("should handle string keys", () => {
    const rows = [
      { email: "alice@example.com", name: "Alice" },
      { email: "bob@example.com", name: "Bob" },
    ];

    const map = buildLookupMap(rows, (row) => row.email);

    expect(map.get("alice@example.com")).toEqual({
      email: "alice@example.com",
      name: "Alice",
    });
  });
});

describe("lookupOrError", () => {
  it("should return value when key exists", () => {
    const map = new Map([[1, { id: 1, name: "Alice" }]]);

    const result = lookupOrError(map, 1, "users", "id");

    expect(result).toEqual({ id: 1, name: "Alice" });
  });

  it("should return DrizzleLoaderNotFound when key does not exist", () => {
    const map = new Map<number, { id: number; name: string }>();

    const result = lookupOrError(map, 999, "users", "id");

    expect(result).toBeInstanceOf(DrizzleLoaderNotFound);
    if (result instanceof DrizzleLoaderNotFound) {
      expect(result.table).toBe("users");
      expect(result.columns).toEqual([{ id: 999 }]);
    }
  });
});
