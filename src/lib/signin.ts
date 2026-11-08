import { z } from "zod";
import { collectFieldErrors, GENERIC_ERROR, textValue } from "@/lib/forms";

/** Deliberately the same message for an unknown email and a wrong password. */
export const WRONG_CREDENTIALS = "Email or password is incorrect";

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  password: z.string("Enter your password.").min(1, "Enter your password."),
});

type Field = keyof z.infer<typeof signInSchema>;

export type SignInState =
  | { ok: true }
  | { ok: false; message?: string; fieldErrors?: Partial<Record<Field, string>>; values: { email: string } };

/** For outages and rate limits, so players are not told their password is wrong. */
export const SIGN_IN_FAILED = GENERIC_ERROR;

export type SignInDeps = {
  /** Signs in and stores the session. */
  authenticate(email: string, password: string): Promise<"ok" | "invalid-credentials" | "error">;
};

export async function signIn(formData: FormData, deps: SignInDeps): Promise<SignInState> {
  const raw = { email: formData.get("email") ?? undefined, password: formData.get("password") ?? undefined };
  const values = { email: textValue(raw.email) };
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: collectFieldErrors<Field>(parsed.error.issues), values };

  const { email, password } = parsed.data;
  const outcome = await deps.authenticate(email, password);
  if (outcome === "invalid-credentials") return { ok: false, message: WRONG_CREDENTIALS, values };
  if (outcome === "error") return { ok: false, message: SIGN_IN_FAILED, values };
  return { ok: true };
}
