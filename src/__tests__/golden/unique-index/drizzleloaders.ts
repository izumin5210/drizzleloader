import { createUsersLoaders } from "./drizzleloaders/users.js";
import { type DrizzleDb } from "./drizzleloaders/_internal.js";

export { DrizzleLoaderNotFound } from "./drizzleloaders/_internal.js";

export function createDrizzleLoaders(db: DrizzleDb) {
  return {
    users: createUsersLoaders(db),
  };
}
