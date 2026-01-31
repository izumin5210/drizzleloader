import type { AnalyzedTable } from "../analyzer/types.js";

export interface GeneratorOptions {
  schemaImport: string;
}

export function generateLoaderCode(
  _tables: AnalyzedTable[],
  _options: GeneratorOptions
): string {
  throw new Error("Not implemented");
}
