#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { program } from "commander";
import type { Table } from "drizzle-orm";
import { is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { analyzeTable } from "./analyzer/table-analyzer.js";
import { generateMultiFileOutput } from "./generator/code-generator.js";
import {
  computeSchemaImport,
  type ImportExtension,
} from "./utils/import-path.js";

async function loadSchema(schemaPath: string): Promise<Table[]> {
  const absolutePath = resolve(process.cwd(), schemaPath);
  const fileUrl = pathToFileURL(absolutePath).href;
  const module = await import(fileUrl);

  const tables: Table[] = [];
  for (const [, value] of Object.entries(module)) {
    if (is(value, PgTable)) {
      tables.push(value as Table);
    }
  }

  return tables;
}

interface GenerateOptions {
  schema: string;
  outputDir: string;
  importExtension: ImportExtension;
}

async function generate(options: GenerateOptions): Promise<void> {
  const tables = await loadSchema(options.schema);

  if (tables.length === 0) {
    console.error("No tables found in schema file");
    process.exit(1);
  }

  const analyzedTables = tables.map((table) => analyzeTable(table));

  // Compute schema import relative to the entry point (drizzleloaders.ts)
  const entryPointPath = join(options.outputDir, "drizzleloaders.ts");
  const schemaImport = computeSchemaImport(
    options.schema,
    entryPointPath,
    options.importExtension,
  );

  const importExtension =
    options.importExtension === "none" ? "" : options.importExtension;
  const files = generateMultiFileOutput(analyzedTables, {
    schemaImport,
    importExtension,
  });

  const outputDir = resolve(process.cwd(), options.outputDir);

  // Create directories and write files
  for (const [relativePath, content] of files) {
    const fullPath = join(outputDir, relativePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content);
  }

  console.log(
    `Generated loaders for ${tables.length} table(s) in ${options.outputDir}/`,
  );
}

program
  .name("drizzleloader")
  .description("Generate DataLoaders from Drizzle ORM schema")
  .version("0.0.0");

program
  .command("generate")
  .description("Generate DataLoader code from schema")
  .requiredOption("-s, --schema <path>", "Path to the Drizzle schema file")
  .requiredOption("-o, --output-dir <dir>", "Output directory")
  .option(
    "-e, --import-extension <ext>",
    "Extension for schema import (.js or none)",
    ".js",
  )
  .action(async (options: GenerateOptions) => {
    if (
      options.importExtension !== ".js" &&
      options.importExtension !== "none"
    ) {
      console.error(
        `Invalid import extension: ${options.importExtension}. Must be ".js" or "none".`,
      );
      process.exit(1);
    }
    await generate(options);
  });

program.parse();
