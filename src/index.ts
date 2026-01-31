export { analyzeTable } from "./cli/analyzer/table-analyzer.js";
export type {
  AnalyzedColumn,
  AnalyzedIndex,
  AnalyzedPrimaryKey,
  AnalyzedTable,
} from "./cli/analyzer/types.js";
export {
  type GeneratorOptions,
  generateLoaderCode,
} from "./cli/generator/code-generator.js";
export { toCamelCase, toPascalCase } from "./cli/utils/naming.js";
export { mapColumnToTsType } from "./cli/utils/type-mapping.js";
