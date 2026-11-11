import { z } from "zod";

/**
 * A Postgres `numeric` as PostgREST returns it: a JSON number, or a plain decimal string for
 * values it will not risk as a float. Anything else (null, "", "NaN", "1e3") is refused, so a bad
 * row fails loudly instead of turning into 0 or NaN. A NaN pass target, for one, would make
 * every score fail without an error.
 */
export const numericSchema = z
  .union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/).transform(Number)])
  .pipe(z.number().finite());

const integerSchema = z.number().int();

/** The value as it appears in an error message (undefined has no JSON form). */
const shown = (value: unknown) => JSON.stringify(value) ?? String(value);

/** Reads a numeric column; throws naming `field` when the value is not a finite number. */
export function dbNumber(value: unknown, field: string): number {
  const parsed = numericSchema.safeParse(value);
  if (!parsed.success) throw new Error(`Expected a number for ${field}, got ${shown(value)}`);
  return parsed.data;
}

/**
 * Reads an integer column; throws naming `field` otherwise. PostgREST sends `integer` and
 * `bigint` as JSON numbers, so an integer *string* is refused on purpose. A `bigint` beyond 2^53
 * (no column today: seeds stop at 2^32 - 1) would lose precision and needs a different reader.
 */
export function dbInteger(value: unknown, field: string): number {
  const parsed = integerSchema.safeParse(value);
  if (!parsed.success) throw new Error(`Expected a whole number for ${field}, got ${shown(value)}`);
  return parsed.data;
}
