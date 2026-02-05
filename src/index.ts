#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import type { Table } from "drizzle-orm";
import { is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { createJiti } from "jiti";
import { analyzeTable } from "./analyzer/table-analyzer.js";
import { generateMultiFileOutput } from "./generator/code-generator.js";
import {
  computeSchemaImport,
  type ImportExtension,
} from "./utils/import-path.js";

const VERSION = "0.0.0";

function printHelp(): void {
  console.log(`drizzleloader - Generate DataLoaders from Drizzle ORM schema

Usage:
  drizzleloader <command> [options]

Commands:
  generate    Generate DataLoader code from schema

Options:
  -h, --help      Show this help message
  -v, --version   Show version number

Run "drizzleloader generate --help" for generate command options.`);
}

function printGenerateHelp(): void {
  console.log(`drizzleloader generate - Generate DataLoader code from schema

Usage:
  drizzleloader generate [options]

Options:
  -s, --schema <path>           Path to the Drizzle schema file (required)
  -o, --output-dir <dir>        Output directory (required)
  -e, --import-extension <ext>  Extension for schema import (.js or none) [default: .js]
  -h, --help                    Show this help message`);
}

interface LoadedTable {
  varName: string;
  table: Table;
}

async function loadSchema(schemaPath: string): Promise<LoadedTable[]> {
  const jiti = createJiti(import.meta.url, {
    moduleCache: false,
  });

  const absolutePath = resolve(process.cwd(), schemaPath);
  const module = await jiti.import(absolutePath);

  const tables: LoadedTable[] = [];
  for (const [varName, value] of Object.entries(
    module as Record<string, unknown>,
  )) {
    if (is(value, PgTable)) {
      tables.push({ varName, table: value as Table });
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
  const loadedTables = await loadSchema(options.schema);

  if (loadedTables.length === 0) {
    console.error("No tables found in schema file");
    process.exit(1);
  }

  const analyzedTables = loadedTables.map(({ varName, table }) =>
    analyzeTable(table, varName),
  );

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
    `Generated loaders for ${loadedTables.length} table(s) in ${options.outputDir}/`,
  );
}

function main(): void {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
      schema: { type: "string", short: "s" },
      "output-dir": { type: "string", short: "o" },
      "import-extension": { type: "string", short: "e", default: ".js" },
    },
    allowPositionals: true,
  });

  const command = positionals[0];

  if (values.version) {
    console.log(VERSION);
    process.exit(0);
  }

  if (values.help && !command) {
    printHelp();
    process.exit(0);
  }

  if (!command) {
    printHelp();
    process.exit(1);
  }

  if (command === "generate") {
    if (values.help) {
      printGenerateHelp();
      process.exit(0);
    }

    if (!values.schema) {
      console.error("Error: --schema is required");
      process.exit(1);
    }

    if (!values["output-dir"]) {
      console.error("Error: --output-dir is required");
      process.exit(1);
    }

    const importExtension = values["import-extension"] as ImportExtension;
    if (importExtension !== ".js" && importExtension !== "none") {
      console.error(
        `Invalid import extension: ${importExtension}. Must be ".js" or "none".`,
      );
      process.exit(1);
    }

    generate({
      schema: values.schema,
      outputDir: values["output-dir"],
      importExtension,
    }).catch((error: unknown) => {
      console.error("Error:", error);
      process.exit(1);
    });
  } else {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
  }
}

main();
