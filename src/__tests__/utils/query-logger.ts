import type { Logger } from "drizzle-orm/logger";

export interface CapturedQuery {
  sql: string;
  params: unknown[];
}

export class QueryCapture implements Logger {
  readonly queries: CapturedQuery[] = [];

  logQuery(query: string, params: unknown[]): void {
    this.queries.push({ sql: query, params });
  }

  clear(): void {
    this.queries.length = 0;
  }

  get lastQuery(): CapturedQuery | undefined {
    return this.queries.at(-1);
  }
}
