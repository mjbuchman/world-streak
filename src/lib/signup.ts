import { z } from "zod";
import { refusalMessage } from "@/lib/eligibility";
import { type EligibilityField, validateEligibilityFields } from "@/lib/eligibilityFields";
import { collectFieldErrors, emailSchema, GENERIC_ERROR, readFields, textValue } from "@/lib/forms";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, PASSWORD_MISMATCH } from "@/lib/passwords";

const accountSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
    .max(MAX_PASSWORD_LENGTH, `Use at most ${MAX_PASSWORD_LENGTH} characters.`),
});

type Field = keyof z.infer<typeof accountSchema> | "confirmPassword" | EligibilityField;

export type SignUpValues = { email: string; birthDate: string; country: string };

export type SignUpState =
  | { ok: true }
  | { ok: false; message?: string; fieldErrors?: Partial<Record<Field, string>>; values: SignUpValues };

export type SignUpDeps = {
  /** Today's date (`YYYY-MM-DD`) for the age check. */
  today: string;
  createUser(email: string, password: string): Promise<{ userId: string } | { error: "email-taken" | "unknown" }>;
  createProfile(profile: { userId: string; birthDate: string; country: string }): Promise<boolean>;
  deleteUser(userId: string): Promise<void>;
  signIn(email: string, password: string): Promise<boolean>;
};

const FIELDS = ["email", "password", "confirmPassword", "birthDate", "country", "agree"] as const satisfies readonly Field[];

function echoValues(raw: Record<Field, unknown>): SignUpValues {
  return { email: textValue(raw.email), birthDate: textValue(raw.birthDate), country: textValue(raw.country) };
}

/**
 * Validates a sign-up form and creates the account. Eligibility is checked before any auth
 * user exists, and a user whose profile cannot be written is deleted again.
 */
export async function signUp(formData: FormData, deps: SignUpDeps): Promise<SignUpState> {
  const raw = readFields(formData, FIELDS);
  const values = echoValues(raw);
  const account = accountSchema.safeParse(raw);
  const eligibility = validateEligibilityFields(raw, deps.today);
  // The form checks this before sending; checking again here keeps the rule in one trusted place.
  const mismatch = textValue(raw.password) !== textValue(raw.confirmPassword);
  const fieldErrors: Partial<Record<Field, string>> = {
    ...collectFieldErrors<Field>(account.error?.issues ?? []),
    ...(mismatch ? { confirmPassword: PASSWORD_MISMATCH } : {}),
    ...(eligibility.status === "invalid" ? eligibility.fieldErrors : {}),
  };

  if (!account.success || mismatch || eligibility.status === "invalid") return { ok: false, fieldErrors, values };
  if (eligibility.status === "refused") return { ok: false, message: refusalMessage(), values };

  const { email, password } = account.data;
  const { birthDate, country } = eligibility.data;
  const created = await deps.createUser(email, password);
  if ("error" in created) {
    return created.error === "email-taken"
      ? { ok: false, fieldErrors: { email: "An account with this email already exists. Try signing in." }, values }
      : { ok: false, message: GENERIC_ERROR, values };
  }

  if (!(await deps.createProfile({ userId: created.userId, birthDate, country }))) {
    await deps.deleteUser(created.userId);
    return { ok: false, message: GENERIC_ERROR, values };
  }

  if (!(await deps.signIn(email, password))) {
    return { ok: false, message: "Your account was created, but we couldn't sign you in. Please sign in.", values };
  }
  return { ok: true };
}
