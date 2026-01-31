import { createPostsLoaders } from "./drizzleloaders/posts.js";
import { type DrizzleDb } from "./drizzleloaders/_internal.js";

export { DrizzleLoaderNotFound } from "./drizzleloaders/_internal.js";

export function createDrizzleLoaders(db: DrizzleDb) {
  return {
    posts: createPostsLoaders(db),
  };
}
