// Small helpers shared by server-side form handling.
import { z } from "zod";

/** An email as sign-up and sign-in compare it: trimmed and lower-case. */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address."));

/** Reads the named fields, with undefined for a missing one, ready for a zod schema. */
export function readFields<N extends string>(formData: FormData, names: readonly N[]): Record<N, unknown> {
  return Object.fromEntries(names.map((name) => [name, formData.get(name) ?? undefined])) as Record<N, unknown>;
}

/** For failures the player cannot fix (outages, rate limits): never blames their input. */
export const GENERIC_ERROR = "Something went wrong. Please try again.";

/** A form value as text: strings pass through, anything else (missing, File) becomes "". */
export function textValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

type Issue = { path: readonly PropertyKey[]; message: string };

/** Maps validation issues to the first message for each top-level field. */
export function collectFieldErrors<F extends string>(issues: readonly Issue[]): Partial<Record<F, string>> {
  const errors: Partial<Record<F, string>> = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (typeof field === "string") errors[field as F] ??= issue.message;
  }
  return errors;
}
