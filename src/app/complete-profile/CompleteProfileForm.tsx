"use client";

import { useActionState } from "react";
import { BirthDateInput, CountrySelect, RulesAgreement } from "@/components/form/EligibilityFields";
import { FormAlert, SubmitButton } from "@/components/form/FormParts";
import type { CompleteProfileState } from "@/lib/profileCompletion";
import styles from "@/app/auth/authPage.module.css";
import { completeProfileAction } from "./actions";

export function CompleteProfileForm() {
  const [state, formAction, pending] = useActionState<CompleteProfileState | null, FormData>(
    completeProfileAction,
    null,
  );
  const failed = state && !state.ok ? state : null;
  const errors = failed?.fieldErrors ?? {};

  return (
    <form action={formAction} className={styles.form} noValidate>
      <FormAlert message={failed?.message} />
      <BirthDateInput error={errors.birthDate} defaultValue={failed?.values.birthDate} />
      <CountrySelect error={errors.country} defaultValue={failed?.values.country} />
      <RulesAgreement error={errors.agree} />
      <SubmitButton pending={pending} label="Save and continue" pendingLabel="Saving" />
    </form>
  );
}
