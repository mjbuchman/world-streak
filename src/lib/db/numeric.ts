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

/** Reads a numeric column; throws naming `field` when the value is not a finite number. */
export function dbNumber(value: unknown, field: string): number {
  const parsed = numericSchema.safeParse(value);
  if (!parsed.success) throw new Error(`Expected a number for ${field}, got ${JSON.stringify(value) ?? String(value)}`);
  return parsed.data;
}

/** Reads an integer column (always a JSON number); throws naming `field` otherwise. */
export function dbInteger(value: unknown, field: string): number {
  const parsed = integerSchema.safeParse(value);
  if (!parsed.success) throw new Error(`Expected a whole number for ${field}, got ${JSON.stringify(value) ?? String(value)}`);
  return parsed.data;
}
