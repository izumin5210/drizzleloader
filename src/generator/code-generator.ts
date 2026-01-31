import type { AnalyzedTable } from "../analyzer/types.js";
import { toCamelCase, toPascalCase } from "../utils/naming.js";

export interface GeneratorOptions {
  schemaImport: string;
}

export interface InternalFileOptions {
  schemaImport: string;
  dialect: "pg";
}

export function generateLoaderCode(
  tables: AnalyzedTable[],
  options: GeneratorOptions,
): string {
  const lines: string[] = [];

  lines.push(generateImports(tables, options));
  lines.push("");
  lines.push(generateErrorClass());
  lines.push("");

  for (const table of tables) {
    lines.push(generateTableLoaders(table));
    lines.push("");
  }

  lines.push(generateFactory(tables));
  lines.push("");

  return lines.join("\n");
}

function generateImports(
  _tables: AnalyzedTable[],
  options: GeneratorOptions,
): string {
  return `import type { InferSelectModel } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { inArray } from "drizzle-orm";
import DataLoader from "dataloader";
import * as __schema from "${options.schemaImport}";

type DrizzleDb = PgDatabase<PgQueryResultHKT, typeof __schema>;`;
}

function generateErrorClass(): string {
  return `export class DrizzleLoaderNotFound extends Error {
  readonly table: string;
  readonly columns: Record<string, unknown>[];

  constructor(options: { table: string; columns: Record<string, unknown>[] }) {
    const columnStr = options.columns
      .map((col) =>
        Object.entries(col)
          .map(([k, v]) => \`\${k}=\${JSON.stringify(v)}\`)
          .join(", ")
      )
      .join("; ");
    super(\`Record not found in \${options.table} for \${columnStr}\`);
    this.name = "DrizzleLoaderNotFound";
    this.table = options.table;
    this.columns = options.columns;
  }
}`;
}

function generateTableLoaders(table: AnalyzedTable): string {
  const tablePascal = toPascalCase(table.name);
  const lines: string[] = [];

  lines.push(`function create${tablePascal}Loaders(db: DrizzleDb) {`);

  const loaders: string[] = [];

  if (table.primaryKey) {
    loaders.push(
      generateUniqueLoader(
        table,
        table.primaryKey.column.name,
        table.primaryKey.column.tsType,
      ),
    );
  }

  for (const idx of table.indexes) {
    if (idx.unique) {
      loaders.push(
        generateUniqueLoader(table, idx.column.name, idx.column.tsType),
      );
    } else {
      loaders.push(
        generateNonUniqueLoader(table, idx.column.name, idx.column.tsType),
      );
    }
  }

  for (const loader of loaders) {
    lines.push(indentLines(loader, 2));
  }

  const loaderNames = getLoaderNames(table);
  lines.push(`  return { ${loaderNames.join(", ")} };`);
  lines.push("}");

  return lines.join("\n");
}

interface UniqueLoaderOptions {
  useHelpers: boolean;
}

function generateUniqueLoader(
  table: AnalyzedTable,
  columnName: string,
  tsType: string,
  options: UniqueLoaderOptions = { useHelpers: false },
): string {
  const loaderName = `by${toPascalCase(columnName)}`;
  const keysVar = `${toCamelCase(columnName)}s`;
  const tableName = table.name;
  const columnCamel = toCamelCase(columnName);

  if (options.useHelpers) {
    return `const ${loaderName} = new DataLoader<${tsType}, InferSelectModel<typeof __schema.${tableName}>>(
  async (${keysVar}) => {
    const rows = await db.select().from(__schema.${tableName}).where(inArray(__schema.${tableName}.${columnCamel}, [...${keysVar}]));
    const map = buildLookupMap(rows, (row) => row.${columnCamel});
    return ${keysVar}.map((key) => lookupOrError(map, key, "${tableName}", "${columnName}"));
  }
);`;
  }

  return `const ${loaderName} = new DataLoader<${tsType}, InferSelectModel<typeof __schema.${tableName}>>(
  async (${keysVar}) => {
    const rows = await db.select().from(__schema.${tableName}).where(inArray(__schema.${tableName}.${columnCamel}, [...${keysVar}]));
    const map = new Map(rows.map((row) => [row.${columnCamel}, row]));
    return ${keysVar}.map((key) => map.get(key) ?? new DrizzleLoaderNotFound({ table: "${tableName}", columns: [{ ${columnName}: key }] }));
  }
);`;
}

function generateNonUniqueLoader(
  table: AnalyzedTable,
  columnName: string,
  tsType: string,
): string {
  const loaderName = `by${toPascalCase(columnName)}`;
  const keysVar = `${toCamelCase(columnName)}s`;
  const tableName = table.name;
  const columnCamel = toCamelCase(columnName);

  return `const ${loaderName} = new DataLoader<${tsType}, InferSelectModel<typeof __schema.${tableName}>[]>(
  async (${keysVar}) => {
    const rows = await db.select().from(__schema.${tableName}).where(inArray(__schema.${tableName}.${columnCamel}, [...${keysVar}]));
    const map = new Map<${tsType}, InferSelectModel<typeof __schema.${tableName}>[]>();
    for (const row of rows) {
      const existing = map.get(row.${columnCamel}) ?? [];
      existing.push(row);
      map.set(row.${columnCamel}, existing);
    }
    return ${keysVar}.map((key) => map.get(key) ?? []);
  }
);`;
}

function getLoaderNames(table: AnalyzedTable): string[] {
  const names: string[] = [];

  if (table.primaryKey) {
    names.push(`by${toPascalCase(table.primaryKey.column.name)}`);
  }

  for (const idx of table.indexes) {
    names.push(`by${toPascalCase(idx.column.name)}`);
  }

  return names;
}

function generateFactory(tables: AnalyzedTable[]): string {
  const lines: string[] = [];

  lines.push("export function createDrizzleLoaders(db: DrizzleDb) {");
  lines.push("  return {");

  for (const table of tables) {
    const tablePascal = toPascalCase(table.name);
    lines.push(`    ${table.name}: create${tablePascal}Loaders(db),`);
  }

  lines.push("  };");
  lines.push("}");

  return lines.join("\n");
}

function indentLines(text: string, spaces: number): string {
  const indent = " ".repeat(spaces);
  return text
    .split("\n")
    .map((line) => indent + line)
    .join("\n");
}

export function generateHelperFunctions(): string {
  return `export function buildLookupMap<K, V>(
  rows: V[],
  keyFn: (row: V) => K
): Map<K, V> {
  return new Map(rows.map((row) => [keyFn(row), row]));
}

export function lookupOrError<K, V>(
  map: Map<K, V>,
  key: K,
  table: string,
  column: string
): V | DrizzleLoaderNotFound {
  return (
    map.get(key) ?? new DrizzleLoaderNotFound({ table, columns: [{ [column]: key }] })
  );
}`;
}

export function generateInternalFile(options: InternalFileOptions): string {
  const lines: string[] = [];

  // Type imports from drizzle-orm
  lines.push(
    'import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";',
  );
  lines.push(`import type * as __schema from "${options.schemaImport}";`);
  lines.push("");

  // DrizzleDb type alias
  lines.push(
    "export type DrizzleDb = PgDatabase<PgQueryResultHKT, typeof __schema>;",
  );
  lines.push("");

  // Error class
  lines.push(generateErrorClass());
  lines.push("");

  // Helper functions
  lines.push(generateHelperFunctions());
  lines.push("");

  return lines.join("\n");
}

export interface TableFileOptions {
  schemaImport: string;
  internalImport: string;
}

export function generateTableFile(
  table: AnalyzedTable,
  options: TableFileOptions,
): string {
  const tableName = toPascalCase(table.name);
  const rowType = `${tableName}Row`;

  const imports = `import DataLoader from "dataloader";
import { inArray } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import * as __schema from "${options.schemaImport}";
import {
  type DrizzleDb,
  DrizzleLoaderNotFound,
  buildLookupMap,
  lookupOrError,
} from "${options.internalImport}";`;

  const typeAlias = `type ${rowType} = InferSelectModel<typeof __schema.${table.name}>;`;

  const loaderFn = generateTableLoaderFunctionExported(table);

  return `${imports}

${typeAlias}

${loaderFn}
`;
}

function generateTableLoaderFunctionExported(table: AnalyzedTable): string {
  const tablePascal = toPascalCase(table.name);
  const lines: string[] = [];

  lines.push(`export function create${tablePascal}Loaders(db: DrizzleDb) {`);

  const loaders: string[] = [];

  if (table.primaryKey) {
    loaders.push(
      generateUniqueLoader(
        table,
        table.primaryKey.column.name,
        table.primaryKey.column.tsType,
        { useHelpers: true },
      ),
    );
  }

  for (const idx of table.indexes) {
    if (idx.unique) {
      loaders.push(
        generateUniqueLoader(table, idx.column.name, idx.column.tsType, {
          useHelpers: true,
        }),
      );
    } else {
      loaders.push(
        generateNonUniqueLoader(table, idx.column.name, idx.column.tsType),
      );
    }
  }

  for (const loader of loaders) {
    lines.push(indentLines(loader, 2));
  }

  const loaderNames = getLoaderNames(table);
  lines.push(`  return { ${loaderNames.join(", ")} };`);
  lines.push("}");

  return lines.join("\n");
}

export interface EntryPointFileOptions {
  schemaImport: string;
  internalImport: string;
  tableImportPrefix: string;
  importExtension: string;
}

export function generateEntryPointFile(
  tables: AnalyzedTable[],
  options: EntryPointFileOptions,
): string {
  const ext = options.importExtension;

  // Generate imports for each table's loader function
  const tableImports = tables
    .map((t) => {
      const fnName = `create${toPascalCase(t.name)}Loaders`;
      const fileName = toCamelCase(t.name);
      return `import { ${fnName} } from "${options.tableImportPrefix}${fileName}${ext}";`;
    })
    .join("\n");

  // Import DrizzleDb type from _internal
  const typeImport = `import { type DrizzleDb } from "${options.internalImport}";`;

  // Re-export DrizzleLoaderNotFound from _internal
  const reExport = `export { DrizzleLoaderNotFound } from "${options.internalImport}";`;

  // Generate factory function that combines all table loaders
  const factoryFn = generateEntryPointFactory(tables);

  return `${tableImports}
${typeImport}

${reExport}

${factoryFn}
`;
}

function generateEntryPointFactory(tables: AnalyzedTable[]): string {
  const lines: string[] = [];

  lines.push("export function createDrizzleLoaders(db: DrizzleDb) {");
  lines.push("  return {");

  for (const table of tables) {
    const tablePascal = toPascalCase(table.name);
    lines.push(`    ${table.name}: create${tablePascal}Loaders(db),`);
  }

  lines.push("  };");
  lines.push("}");

  return lines.join("\n");
}

export interface MultiFileOutputOptions {
  schemaImport: string;
  importExtension: string;
  dialect?: "pg";
}

export function generateMultiFileOutput(
  tables: AnalyzedTable[],
  options: MultiFileOutputOptions,
): Map<string, string> {
  const ext = options.importExtension;
  const dialect = options.dialect ?? "pg";
  const files = new Map<string, string>();

  // _internal.ts - schema import needs adjustment for being inside drizzleloaders/
  // If schemaImport is "./schema.js", from drizzleloaders/_internal.ts it becomes "../schema.js"
  const internalSchemaImport = adjustSchemaImportPath(options.schemaImport);
  files.set(
    "drizzleloaders/_internal.ts",
    generateInternalFile({ schemaImport: internalSchemaImport, dialect }),
  );

  // Per-table files
  for (const table of tables) {
    const fileName = `drizzleloaders/${toCamelCase(table.name)}.ts`;
    // Schema import from drizzleloaders/users.ts to schema also needs "../" prefix
    const tableSchemaImport = adjustSchemaImportPath(options.schemaImport);
    files.set(
      fileName,
      generateTableFile(table, {
        schemaImport: tableSchemaImport,
        internalImport: `./_internal${ext}`,
      }),
    );
  }

  // Entry point
  files.set(
    "drizzleloaders.ts",
    generateEntryPointFile(tables, {
      schemaImport: options.schemaImport,
      internalImport: `./drizzleloaders/_internal${ext}`,
      tableImportPrefix: "./drizzleloaders/",
      importExtension: ext,
    }),
  );

  return files;
}

/**
 * Adds "../" prefix for imports from inside drizzleloaders/ directory.
 * - "./schema.js" becomes "../schema.js"
 * - "../db/schema.js" becomes "../../db/schema.js"
 * - Package imports like "@myapp/db" are returned unchanged
 */
function adjustSchemaImportPath(schemaImport: string): string {
  if (schemaImport.startsWith("./")) {
    return `../${schemaImport.slice(2)}`;
  }
  if (schemaImport.startsWith("../")) {
    return `../${schemaImport}`;
  }
  return schemaImport;
}
