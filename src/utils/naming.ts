export function toPascalCase(str: string): string {
  // If already camelCase (contains lowercase followed by uppercase, no delimiters)
  // just capitalize the first letter
  if (/[a-z][A-Z]/.test(str) && !str.includes("_") && !str.includes("-")) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  // snake_case or kebab-case: split and capitalize each word
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
