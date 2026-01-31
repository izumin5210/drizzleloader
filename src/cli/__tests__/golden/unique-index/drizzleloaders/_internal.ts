import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as __schema from "../schema.js";

export type DrizzleDb = PgDatabase<PgQueryResultHKT, typeof __schema>;
