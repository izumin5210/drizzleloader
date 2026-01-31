import { describe, expect, it } from "vitest";
import { DrizzleLoaderNotFound } from "./errors.js";

describe("DrizzleLoaderNotFound", () => {
  it("should create an error with table and columns", () => {
    const error = new DrizzleLoaderNotFound({
      table: "users",
      columns: [{ id: 1 }],
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("DrizzleLoaderNotFound");
    expect(error.table).toBe("users");
    expect(error.columns).toEqual([{ id: 1 }]);
  });

  it("should format message for single column lookup", () => {
    const error = new DrizzleLoaderNotFound({
      table: "users",
      columns: [{ id: 1 }],
    });

    expect(error.message).toBe("Record not found in users for id=1");
  });

  it("should format message for multiple columns lookup", () => {
    const error = new DrizzleLoaderNotFound({
      table: "posts",
      columns: [{ id: 1 }, { id: 2 }],
    });

    expect(error.message).toBe("Record not found in posts for id=1; id=2");
  });

  it("should format message with string values", () => {
    const error = new DrizzleLoaderNotFound({
      table: "users",
      columns: [{ email: "test@example.com" }],
    });

    expect(error.message).toBe(
      'Record not found in users for email="test@example.com"',
    );
  });

  it("should format message with multiple keys in column", () => {
    const error = new DrizzleLoaderNotFound({
      table: "user_roles",
      columns: [{ userId: 1, roleId: 2 }],
    });

    expect(error.message).toBe(
      "Record not found in user_roles for userId=1, roleId=2",
    );
  });
});
