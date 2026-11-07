import { z } from "zod";
import { collectFieldErrors, textValue } from "@/lib/forms";

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

export type SignInDeps = {
  /** Signs in and stores the session; true on success. */
  authenticate(email: string, password: string): Promise<boolean>;
};

export async function signIn(formData: FormData, deps: SignInDeps): Promise<SignInState> {
  const raw = { email: formData.get("email") ?? undefined, password: formData.get("password") ?? undefined };
  const values = { email: textValue(raw.email) };
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: collectFieldErrors<Field>(parsed.error.issues), values };

  const { email, password } = parsed.data;
  if (!(await deps.authenticate(email, password))) return { ok: false, message: WRONG_CREDENTIALS, values };
  return { ok: true };
}
