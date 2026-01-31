import { describe, expect, it } from "vitest";
import {
  pgTable,
  serial,
  integer,
  text,
  varchar,
  uuid,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { analyzeTable } from "../../src/analyzer/table-analyzer.js";
import { generateLoaderCode } from "../../src/generator/code-generator.js";

describe("generateLoaderCode", () => {
  describe("primary key loader", () => {
    it("generates loader for primary key", () => {
      const users = pgTable("users", {
        id: serial("id").primaryKey(),
        name: text("name"),
      });

      const analyzed = analyzeTable(users);
      const code = generateLoaderCode([analyzed], { schemaImport: "./schema" });

      expect(code).toContain('import { inArray } from "drizzle-orm"');
      expect(code).toContain('import DataLoader from "dataloader"');
      expect(code).toContain('import { users } from "./schema"');
      expect(code).toContain(
        "import { DrizzleLoaderNotFound } from \"drizzleloader/runtime\""
      );
      expect(code).toContain("function createUsersLoaders");
      expect(code).toContain("new DataLoader<number,");
      expect(code).toContain("inArray(users.id, [...ids])");
      expect(code).toContain('new DrizzleLoaderNotFound({ table: "users"');
      expect(code).toContain("byId");
    });
  });

  describe("unique index loader", () => {
    it("generates loader for unique index", () => {
      const users = pgTable(
        "users",
        {
          id: serial("id").primaryKey(),
          email: varchar("email", { length: 255 }),
        },
        (t) => [uniqueIndex("users_email_idx").on(t.email)]
      );

      const analyzed = analyzeTable(users);
      const code = generateLoaderCode([analyzed], { schemaImport: "./schema" });

      expect(code).toContain("byEmail");
      expect(code).toContain("new DataLoader<string,");
      expect(code).toContain("inArray(users.email, [...emails])");
      expect(code).toContain(
        'new DrizzleLoaderNotFound({ table: "users", columns: [{ email'
      );
    });
  });

  describe("non-unique index loader", () => {
    it("generates loader returning array for non-unique index", () => {
      const posts = pgTable(
        "posts",
        {
          id: serial("id").primaryKey(),
          authorId: integer("author_id"),
        },
        (t) => [index("posts_author_id_idx").on(t.authorId)]
      );

      const analyzed = analyzeTable(posts);
      const code = generateLoaderCode([analyzed], { schemaImport: "./schema" });

      expect(code).toContain("byAuthorId");
      expect(code).toContain("new DataLoader<number, InferSelectModel<");
      expect(code).toContain("[]>");
      expect(code).not.toContain("DrizzleLoaderNotFound.*authorId");
    });
  });

  describe("multiple tables", () => {
    it("generates loaders for multiple tables", () => {
      const users = pgTable("users", {
        id: serial("id").primaryKey(),
        name: text("name"),
      });

      const posts = pgTable(
        "posts",
        {
          id: serial("id").primaryKey(),
          authorId: integer("author_id"),
        },
        (t) => [index("posts_author_id_idx").on(t.authorId)]
      );

      const analyzedUsers = analyzeTable(users);
      const analyzedPosts = analyzeTable(posts);
      const code = generateLoaderCode([analyzedUsers, analyzedPosts], {
        schemaImport: "./schema",
      });

      expect(code).toContain('import { users, posts } from "./schema"');
      expect(code).toContain("function createUsersLoaders");
      expect(code).toContain("function createPostsLoaders");
      expect(code).toContain("function createDrizzleLoaders");
      expect(code).toContain("users: createUsersLoaders(db)");
      expect(code).toContain("posts: createPostsLoaders(db)");
    });
  });

  describe("uuid primary key", () => {
    it("generates loader with string type for uuid", () => {
      const items = pgTable("items", {
        id: uuid("id").primaryKey(),
        name: text("name"),
      });

      const analyzed = analyzeTable(items);
      const code = generateLoaderCode([analyzed], { schemaImport: "./schema" });

      expect(code).toContain("byId");
      expect(code).toContain("new DataLoader<string,");
    });
  });
});
