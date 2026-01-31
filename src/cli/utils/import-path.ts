import { dirname, relative, resolve } from "node:path";

export type ImportExtension = ".js" | "none";

export function computeSchemaImport(
  schemaPath: string,
  outputPath: string,
  extension: ImportExtension = ".js",
): string {
  const schemaAbs = resolve(process.cwd(), schemaPath);
  const outputAbs = resolve(process.cwd(), outputPath);
  const outputDir = dirname(outputAbs);

  let relativePath = relative(outputDir, schemaAbs);
  if (!relativePath.startsWith(".")) {
    relativePath = `./${relativePath}`;
  }

  const replacement = extension === "none" ? "" : extension;
  relativePath = relativePath.replace(/\.ts$/, replacement);

  return relativePath;
}
