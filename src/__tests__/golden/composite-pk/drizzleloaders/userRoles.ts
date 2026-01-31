import DataLoader from "dataloader";
import { inArray } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import * as __schema from "../schema.js";
import {
  type DrizzleDb,
  DrizzleLoaderNotFound,
  buildLookupMap,
  lookupOrError,
  buildCompositeLookupMap,
  serializeCompositeKey,
  queryCompositeKey,
} from "./_internal.js";

export function createUserRolesLoaders(db: DrizzleDb) {
  const byUserIdAndRoleId = new DataLoader<{ userId: number; roleId: number }, InferSelectModel<typeof __schema.user_roles>, string>(
    async (keys) => {
      const rows = await queryCompositeKey(db, __schema.user_roles, [__schema.user_roles.userId, __schema.user_roles.roleId], ["userId", "roleId"], keys as readonly Record<string, unknown>[]);
      const map = buildCompositeLookupMap(rows, ["userId", "roleId"] as const);
      return keys.map((key) => {
        const found = map.get(serializeCompositeKey(key, ["userId", "roleId"] as const))?.[0];
        return found ?? new DrizzleLoaderNotFound({ table: "user_roles", columns: [{ user_id: key.userId, role_id: key.roleId }] });
      });
    },
    { cacheKeyFn: (key) => serializeCompositeKey(key, ["userId", "roleId"] as const) }
  );
  return { byUserIdAndRoleId };
}
