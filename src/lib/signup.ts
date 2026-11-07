import { z } from "zod";
import { ALLOWED_COUNTRIES, MIN_AGE } from "@/config/eligibility";
import { GAME_NAME } from "@/config/game";
import { checkEligibility } from "@/lib/eligibility";

const MAX_PLAUSIBLE_AGE = 120;
const GENERIC_ERROR = "Something went wrong. Please try again.";

const signUpSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  // Supabase (bcrypt) accepts at most 72 characters.
  password: z.string().min(8, "Use at least 8 characters.").max(72, "Use at most 72 characters."),
  birthDate: z.string(),
  country: z
    .string("Select your country of residence.")
    .trim()
    .toUpperCase()
    .min(1, "Select your country of residence."),
  agree: z.literal("on", "You need to agree to the official rules."),
});

type Field = keyof z.infer<typeof signUpSchema>;

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
  return `Sorry, ${GAME_NAME} is open only to ${ALLOWED_COUNTRIES.join(" or ")} residents aged ${MIN_AGE} or over.`;
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
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  return { email: text(raw.email), birthDate: text(raw.birthDate), country: text(raw.country) };
}

// Dates of birth more than MAX_PLAUSIBLE_AGE years ago are typos, not players.
function isImplausiblyOld(birthDate: string, today: string): boolean {
  const oldest = `${Number(today.slice(0, 4)) - MAX_PLAUSIBLE_AGE}${today.slice(4)}`;
  return birthDate < oldest;
}

/**
 * Validates a sign-up form and creates the account. Eligibility is checked before any auth
 * user exists, and a user whose profile cannot be written is deleted again.
 */
export async function signUp(formData: FormData, deps: SignUpDeps): Promise<SignUpState> {
  const raw = readForm(formData);
  const values = echoValues(raw);
  const parsed = signUpSchema.safeParse(raw);
  const fieldErrors: Partial<Record<Field, string>> = {};
  for (const issue of parsed.error?.issues ?? []) {
    const field = issue.path[0] as Field;
    fieldErrors[field] ??= issue.message;
  }

  // Eligibility reads the raw text, which checkEligibility parses strictly (exact YYYY-MM-DD,
  // trimmed upper-case country), so it judges the same values that parsed.data later stores.
  const eligibility = checkEligibility({ birthDate: values.birthDate, country: values.country }, deps.today);
  const badDate =
    (!eligibility.eligible && eligibility.reason === "invalid-date") || isImplausiblyOld(values.birthDate, deps.today);
  if (badDate) fieldErrors.birthDate = "Enter a valid date of birth.";

  if (!parsed.success || badDate) return { ok: false, fieldErrors, values };
  if (!eligibility.eligible) return { ok: false, message: refusalMessage(), values };

  const { email, password, birthDate, country } = parsed.data;
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
