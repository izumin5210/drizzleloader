import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

describe("CLI generate command (built)", () => {
  const outputDir = "/tmp/claude/drizzleloader-test-output";
  const cliPath = resolve(import.meta.dirname, "../../../dist/index.js");
  const schemaPath = resolve(
    import.meta.dirname,
    "../../__tests__/golden/basic-pk/schema.ts",
  );

  afterEach(() => {
    if (existsSync(outputDir)) {
      rmSync(outputDir, { recursive: true });
    }
  });

  it("should generate loaders from TypeScript schema using built CLI", () => {
    execFileSync("node", [
      cliPath,
      "generate",
      "-s",
      schemaPath,
      "-o",
      outputDir,
    ]);

    expect(existsSync(`${outputDir}/drizzleloaders.ts`)).toBe(true);
    expect(existsSync(`${outputDir}/drizzleloaders/users.ts`)).toBe(true);
    expect(existsSync(`${outputDir}/drizzleloaders/_internal.ts`)).toBe(true);

    const entryContent = readFileSync(
      `${outputDir}/drizzleloaders.ts`,
      "utf-8",
    );
    expect(entryContent).toContain("createUsersLoaders");
  });
});
