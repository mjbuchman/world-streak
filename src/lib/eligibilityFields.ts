import { z } from "zod";
import { checkEligibility } from "@/lib/eligibility";
import { collectFieldErrors, textValue } from "@/lib/forms";

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

export type EligibilityFieldsResult =
  /** Problems the person can fix in the form. */
  | { status: "invalid"; fieldErrors: EligibilityFieldErrors }
  /** The form is valid but the person is not eligible (underage or region). */
  | { status: "refused" }
  /** Valid and eligible, with the cleaned values to store. */
  | { status: "ok"; data: { birthDate: string; country: string } };

/** Validates date of birth, country and rules agreement, then applies the eligibility rules. */
export function validateEligibilityFields(raw: EligibilityFieldsInput, today: string): EligibilityFieldsResult {
  const parsed = eligibilityFieldsSchema.safeParse(raw);
  const fieldErrors = collectFieldErrors<EligibilityField>(parsed.error?.issues ?? []);

  const eligibility = checkEligibility(
    { birthDate: textValue(raw.birthDate), country: textValue(raw.country) },
    today,
  );
  if (!eligibility.eligible && eligibility.reason === "invalid-date") {
    fieldErrors.birthDate = "Enter a valid date of birth.";
  }

  if (!parsed.success || Object.keys(fieldErrors).length > 0) return { status: "invalid", fieldErrors };
  if (!eligibility.eligible) return { status: "refused" };
  return { status: "ok", data: { birthDate: parsed.data.birthDate, country: parsed.data.country } };
}
