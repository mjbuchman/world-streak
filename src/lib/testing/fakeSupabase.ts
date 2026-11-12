// A stand-in Supabase client for unit tests (T100), shared instead of a hand-rolled Proxy per file.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type FakeResult = { data: unknown; error: { message: string; code?: string } | null; count?: number | null };

/**
 * Each `from(table)` or `rpc(...)` starts a query whose builder calls are recorded in its own log
 * (the first entry is the from/rpc call itself). Awaiting the query resolves to the next of
 * `answer`'s results, or to what `answer` returns for that first call. `onAwait` sees each log
 * when its query is awaited, for tests about what runs side by side.
 */
export function fakeSupabase(
  answer: FakeResult[] | ((first: unknown[]) => FakeResult | undefined),
  { onAwait }: { onAwait?: (log: unknown[][]) => void } = {},
) {
  const queries: unknown[][][] = [];
  const start = (first: unknown[]) => {
    const log: unknown[][] = [first];
    queries.push(log);
    const result = Array.isArray(answer) ? answer.shift() : answer(first);
    const query: object = new Proxy(
      {},
      {
        get(_, method) {
          if (method === "then")
            return (resolve: (value: unknown) => void) => {
              onAwait?.(log);
              resolve(result);
            };
          return (...args: unknown[]) => {
            log.push([method, ...args]);
            return query;
          };
        },
      },
    );
    return query;
  };
  const db = { from: (table: string) => start(["from", table]), rpc: (...args: unknown[]) => start(["rpc", ...args]) };
  // The fake implements only the calls the code under test makes.
  return { db: db as unknown as SupabaseClient<Database>, queries };
}
