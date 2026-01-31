import { createUserRolesLoaders } from "./drizzleloaders/userRoles.js";
import { type DrizzleDb } from "./drizzleloaders/_internal.js";

export { DrizzleLoaderNotFound } from "./drizzleloaders/_internal.js";

export function createDrizzleLoaders(db: DrizzleDb) {
  return {
    user_roles: createUserRolesLoaders(db),
  };
}
