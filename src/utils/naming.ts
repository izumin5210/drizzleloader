export function toPascalCase(str: string): string {
  return str
    .split(/[_-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
}

export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export function toCompositeLoaderName(columnNames: string[]): string {
  return `by${columnNames.map((name) => toPascalCase(name)).join("And")}`;
}
