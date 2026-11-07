// Small helpers shared by server-side form handling.

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
