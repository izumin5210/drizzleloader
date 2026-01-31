import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const TEST_DIR = join(process.cwd(), "src/__tests__/integration/.tmp");

describe("CLI integration", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("generates loaders from schema file", () => {
    const schemaPath = join(TEST_DIR, "schema.ts");
    const outputPath = join(TEST_DIR, "loaders.ts");

    writeFileSync(
      schemaPath,
      `
import { pgTable, serial, text, varchar, integer, index, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name"),
}, (t) => [uniqueIndex("users_name_idx").on(t.name)]);

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  authorId: integer("author_id"),
}, (t) => [index("posts_author_id_idx").on(t.authorId)]);
`
    );

    execFileSync("npx", ["tsx", "src/cli.ts", "generate", "--schema", schemaPath, "--output", outputPath], {
      cwd: process.cwd(),
      encoding: "utf-8",
    });

    const output = readFileSync(outputPath, "utf-8");

    expect(output).toContain('import { inArray } from "drizzle-orm"');
    expect(output).toContain('import DataLoader from "dataloader"');
    expect(output).toContain('from "./schema.js"');
    expect(output).toContain("users");
    expect(output).toContain("posts");
    expect(output).toContain("function createUsersLoaders");
    expect(output).toContain("function createPostsLoaders");
    expect(output).toContain("function createDrizzleLoaders");
    expect(output).toContain("byId");
    expect(output).toContain("byName");
    expect(output).toContain("byAuthorId");
  });

  it("generates relative import path correctly", () => {
    const schemaDir = join(TEST_DIR, "db");
    const outputDir = join(TEST_DIR, "loaders");
    mkdirSync(schemaDir, { recursive: true });
    mkdirSync(outputDir, { recursive: true });

    const schemaPath = join(schemaDir, "schema.ts");
    const outputPath = join(outputDir, "loaders.ts");

    writeFileSync(
      schemaPath,
      `
import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name"),
});
`
    );

    execFileSync("npx", ["tsx", "src/cli.ts", "generate", "--schema", schemaPath, "--output", outputPath], {
      cwd: process.cwd(),
      encoding: "utf-8",
    });

    const output = readFileSync(outputPath, "utf-8");

    expect(output).toContain('import { users } from "../db/schema.js"');
  });
});
