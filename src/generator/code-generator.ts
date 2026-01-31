import type { AnalyzedTable } from "../analyzer/types.js";
import { toPascalCase, toCamelCase } from "../utils/naming.js";

export interface GeneratorOptions {
  schemaImport: string;
}

export function generateLoaderCode(
  tables: AnalyzedTable[],
  options: GeneratorOptions
): string {
  const lines: string[] = [];

  lines.push(generateImports(tables, options));
  lines.push("");

  for (const table of tables) {
    lines.push(generateTableLoaders(table));
    lines.push("");
  }

  lines.push(generateFactory(tables));

  return lines.join("\n");
}

function generateImports(
  tables: AnalyzedTable[],
  options: GeneratorOptions
): string {
  const tableNames = tables.map((t) => t.name).join(", ");

  return `import type { InferSelectModel } from "drizzle-orm";
import { inArray } from "drizzle-orm";
import DataLoader from "dataloader";
import { ${tableNames} } from "${options.schemaImport}";
import { DrizzleLoaderNotFound } from "drizzleloader/runtime";`;
}

function generateTableLoaders(table: AnalyzedTable): string {
  const tablePascal = toPascalCase(table.name);
  const lines: string[] = [];

  lines.push(
    `function create${tablePascal}Loaders(db: DrizzleDb) {`
  );

  const loaders: string[] = [];

  if (table.primaryKey) {
    loaders.push(
      generateUniqueLoader(table, table.primaryKey.column.name, table.primaryKey.column.tsType)
    );
  }

  for (const idx of table.indexes) {
    if (idx.unique) {
      loaders.push(generateUniqueLoader(table, idx.column.name, idx.column.tsType));
    } else {
      loaders.push(generateNonUniqueLoader(table, idx.column.name, idx.column.tsType));
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

function generateUniqueLoader(
  table: AnalyzedTable,
  columnName: string,
  tsType: string
): string {
  const loaderName = `by${toPascalCase(columnName)}`;
  const keysVar = `${toCamelCase(columnName)}s`;
  const tableName = table.name;
  const columnCamel = toCamelCase(columnName);

  return `const ${loaderName} = new DataLoader<${tsType}, InferSelectModel<typeof ${tableName}>>(
  async (${keysVar}) => {
    const rows = await db.select().from(${tableName}).where(inArray(${tableName}.${columnCamel}, [...${keysVar}]));
    const map = new Map(rows.map((row) => [row.${columnCamel}, row]));
    return ${keysVar}.map((key) => map.get(key) ?? new DrizzleLoaderNotFound({ table: "${tableName}", columns: [{ ${columnName}: key }] }));
  }
);`;
}

function generateNonUniqueLoader(
  table: AnalyzedTable,
  columnName: string,
  tsType: string
): string {
  const loaderName = `by${toPascalCase(columnName)}`;
  const keysVar = `${toCamelCase(columnName)}s`;
  const tableName = table.name;
  const columnCamel = toCamelCase(columnName);

  return `const ${loaderName} = new DataLoader<${tsType}, InferSelectModel<typeof ${tableName}>[]>(
  async (${keysVar}) => {
    const rows = await db.select().from(${tableName}).where(inArray(${tableName}.${columnCamel}, [...${keysVar}]));
    const map = new Map<${tsType}, InferSelectModel<typeof ${tableName}>[]>();
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
