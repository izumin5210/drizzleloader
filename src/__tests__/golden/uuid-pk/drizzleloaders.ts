import { createItemsLoaders } from "./drizzleloaders/items.js";
import { type DrizzleDb } from "./drizzleloaders/_internal.js";

export { DrizzleLoaderNotFound } from "./drizzleloaders/_internal.js";

export function createDrizzleLoaders(db: DrizzleDb) {
  return {
    items: createItemsLoaders(db),
  };
}
