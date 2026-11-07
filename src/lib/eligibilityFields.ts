import { z } from "zod";
import { checkEligibility } from "@/lib/eligibility";

// The eligibility part of any form that creates a profile: sign-up, and profile completion
// after Google sign-in.
const eligibilityFieldsSchema = z.object({
  birthDate: z.string(),
  country: z
    .string("Select your country of residence.")
    .trim()
    .toUpperCase()
    .min(1, "Select your country of residence."),
  agree: z.literal("on", "You need to agree to the official rules."),
});

export type EligibilityField = keyof z.infer<typeof eligibilityFieldsSchema>;
export type EligibilityFieldErrors = Partial<Record<EligibilityField, string>>;

export type EligibilityFieldsInput = { birthDate: unknown; country: unknown; agree: unknown };

export type EligibilityFieldsResult = {
  /** Problems the person can fix in the form. */
  fieldErrors: EligibilityFieldErrors;
  /** True when the form is valid but the person is not eligible (underage or region). */
  refused: boolean;
  /** The cleaned values to store, present only when valid and eligible. */
  data: { birthDate: string; country: string } | null;
};

/** Validates date of birth, country and rules agreement, then applies the eligibility rules. */
export function validateEligibilityFields(raw: EligibilityFieldsInput, today: string): EligibilityFieldsResult {
  const parsed = eligibilityFieldsSchema.safeParse(raw);
  const fieldErrors: EligibilityFieldErrors = {};
  for (const issue of parsed.error?.issues ?? []) {
    fieldErrors[issue.path[0] as EligibilityField] ??= issue.message;
  }

  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const eligibility = checkEligibility({ birthDate: text(raw.birthDate), country: text(raw.country) }, today);
  if (!eligibility.eligible && eligibility.reason === "invalid-date") {
    fieldErrors.birthDate = "Enter a valid date of birth.";
  }

  if (!parsed.success || Object.keys(fieldErrors).length > 0) return { fieldErrors, refused: false, data: null };
  if (!eligibility.eligible) return { fieldErrors, refused: true, data: null };
  return { fieldErrors, refused: false, data: { birthDate: parsed.data.birthDate, country: parsed.data.country } };
}
