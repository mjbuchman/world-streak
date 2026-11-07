import { z } from "zod";
import { GAME_NAME } from "@/config/game";
import { eligibilitySummary } from "@/lib/eligibility";
import { type EligibilityField, validateEligibilityFields } from "@/lib/eligibilityFields";
import { collectFieldErrors, textValue } from "@/lib/forms";

const GENERIC_ERROR = "Something went wrong. Please try again.";

const accountSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  // Supabase (bcrypt) accepts at most 72 characters.
  password: z.string().min(8, "Use at least 8 characters.").max(72, "Use at most 72 characters."),
});

type Field = keyof z.infer<typeof accountSchema> | EligibilityField;

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

export function refusalMessage(): string {
  return `Sorry, ${GAME_NAME} is open only to ${eligibilitySummary()}.`;
}

function readForm(formData: FormData): Record<Field, unknown> {
  const get = (name: Field) => formData.get(name) ?? undefined;
  return {
    email: get("email"),
    password: get("password"),
    birthDate: get("birthDate"),
    country: get("country"),
    agree: get("agree"),
  };
}

function echoValues(raw: Record<Field, unknown>): SignUpValues {
  return { email: textValue(raw.email), birthDate: textValue(raw.birthDate), country: textValue(raw.country) };
}

/**
 * Validates a sign-up form and creates the account. Eligibility is checked before any auth
 * user exists, and a user whose profile cannot be written is deleted again.
 */
export async function signUp(formData: FormData, deps: SignUpDeps): Promise<SignUpState> {
  const raw = readForm(formData);
  const values = echoValues(raw);
  const account = accountSchema.safeParse(raw);
  const eligibility = validateEligibilityFields(raw, deps.today);
  const fieldErrors: Partial<Record<Field, string>> = {
    ...collectFieldErrors<Field>(account.error?.issues ?? []),
    ...(eligibility.status === "invalid" ? eligibility.fieldErrors : {}),
  };

  if (!account.success || eligibility.status === "invalid") return { ok: false, fieldErrors, values };
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
