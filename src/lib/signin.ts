import { z } from "zod";
import { collectFieldErrors, emailSchema, GENERIC_ERROR, readFields, textValue } from "@/lib/forms";

/** Deliberately the same message for an unknown email and a wrong password. */
export const WRONG_CREDENTIALS = "Email or password is incorrect";

const signInSchema = z.object({
  email: emailSchema,
  password: z.string("Enter your password.").min(1, "Enter your password."),
});

type Field = keyof z.infer<typeof signInSchema>;

export type SignInState =
  | { ok: true }
  | { ok: false; message?: string; fieldErrors?: Partial<Record<Field, string>>; values: { email: string } };

/** For outages and rate limits, so players are not told their password is wrong. */
export const SIGN_IN_FAILED = GENERIC_ERROR;

/** Only if email confirmation is ever turned on (it is off: docs/DEPLOYMENT.md §4). */
export const EMAIL_NOT_CONFIRMED = "Confirm your email first: open the link we sent you, then sign in.";

export type SignInDeps = {
  /** Signs in and stores the session. */
  authenticate(email: string, password: string): Promise<"ok" | "invalid-credentials" | "email-not-confirmed" | "error">;
};

export async function signIn(formData: FormData, deps: SignInDeps): Promise<SignInState> {
  const raw = readFields(formData, ["email", "password"]);
  const values = { email: textValue(raw.email) };
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: collectFieldErrors<Field>(parsed.error.issues), values };

  const { email, password } = parsed.data;
  const outcome = await deps.authenticate(email, password);
  if (outcome === "invalid-credentials") return { ok: false, message: WRONG_CREDENTIALS, values };
  if (outcome === "email-not-confirmed") return { ok: false, message: EMAIL_NOT_CONFIRMED, values };
  if (outcome === "error") return { ok: false, message: SIGN_IN_FAILED, values };
  return { ok: true };
}
