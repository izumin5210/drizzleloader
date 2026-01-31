#!/usr/bin/env node
import { program } from "commander";
import { writeFileSync } from "node:fs";
import { resolve, relative, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import type { Table } from "drizzle-orm";
import { is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { analyzeTable } from "./analyzer/table-analyzer.js";
import { generateLoaderCode } from "./generator/code-generator.js";

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

function computeSchemaImport(schemaPath: string, outputPath: string): string {
  const schemaAbs = resolve(process.cwd(), schemaPath);
  const outputAbs = resolve(process.cwd(), outputPath);
  const outputDir = dirname(outputAbs);

  let relativePath = relative(outputDir, schemaAbs);
  if (!relativePath.startsWith(".")) {
    relativePath = "./" + relativePath;
  }

  relativePath = relativePath.replace(/\.ts$/, ".js");

  return relativePath;
}

interface GenerateOptions {
  schema: string;
  output: string;
}

async function generate(options: GenerateOptions): Promise<void> {
  const tables = await loadSchema(options.schema);

  if (tables.length === 0) {
    console.error("No tables found in schema file");
    process.exit(1);
  }

  const analyzedTables = tables.map((table) => analyzeTable(table));
  const schemaImport = computeSchemaImport(options.schema, options.output);
  const code = generateLoaderCode(analyzedTables, { schemaImport });

  const outputPath = resolve(process.cwd(), options.output);
  writeFileSync(outputPath, code);

  console.log(`Generated loaders for ${tables.length} table(s) at ${options.output}`);
}

program
  .name("drizzleloader")
  .description("Generate DataLoaders from Drizzle ORM schema")
  .version("0.0.0");

program
  .command("generate")
  .description("Generate DataLoader code from schema")
  .requiredOption("-s, --schema <path>", "Path to the Drizzle schema file")
  .requiredOption("-o, --output <path>", "Path to the output file")
  .action(async (options: GenerateOptions) => {
    await generate(options);
  });

program.parse();
