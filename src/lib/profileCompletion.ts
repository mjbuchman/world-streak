import { type EligibilityFieldErrors, validateEligibilityFields } from "@/lib/eligibilityFields";
import { GENERIC_ERROR, textValue } from "@/lib/forms";
import { refusalMessage } from "@/lib/signup";

export type CompleteProfileValues = { birthDate: string; country: string };

export type CompleteProfileState =
  | { ok: true }
  | { ok: false; message?: string; fieldErrors?: EligibilityFieldErrors; values: CompleteProfileValues };

export type CompleteProfileDeps = {
  /** Today's date (`YYYY-MM-DD`) for the age check. */
  today: string;
  /** Saves the signed-in player's profile; false when it could not be saved. */
  createProfile(profile: { birthDate: string; country: string }): Promise<boolean>;
};

/**
 * Validates the eligibility details of a signed-in player who has no profile yet (for example
 * after their first Google sign-in) and creates the profile. Ineligible players get no profile.
 */
export async function completeProfile(formData: FormData, deps: CompleteProfileDeps): Promise<CompleteProfileState> {
  const raw = {
    birthDate: formData.get("birthDate") ?? undefined,
    country: formData.get("country") ?? undefined,
    agree: formData.get("agree") ?? undefined,
  };
  const values = { birthDate: textValue(raw.birthDate), country: textValue(raw.country) };

  const eligibility = validateEligibilityFields(raw, deps.today);
  if (eligibility.status === "invalid") return { ok: false, fieldErrors: eligibility.fieldErrors, values };
  if (eligibility.status === "refused") return { ok: false, message: refusalMessage(), values };

  if (!(await deps.createProfile(eligibility.data))) return { ok: false, message: GENERIC_ERROR, values };
  return { ok: true };
}
