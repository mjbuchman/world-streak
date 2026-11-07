"use client";

import { useActionState } from "react";
import { BirthDateInput, CountrySelect, RulesAgreement } from "@/components/form/EligibilityFields";
import { Field, TextInput } from "@/components/form/Field";
import { FormAlert, SubmitButton } from "@/components/form/FormParts";
import type { SignUpState } from "@/lib/signup";
import { signUpAction } from "./actions";
import styles from "./signup.module.css";

export function SignUpForm() {
  const [state, formAction, pending] = useActionState<SignUpState | null, FormData>(signUpAction, null);
  const failed = state && !state.ok ? state : null;
  const errors = failed?.fieldErrors ?? {};
  const values = failed?.values;

  return (
    <form action={formAction} className={styles.form} noValidate>
      <FormAlert message={failed?.message} />

      <Field name="email" label="Email" error={errors.email}>
        {(control) => (
          <TextInput {...control} type="email" autoComplete="email" required defaultValue={values?.email} />
        )}
      </Field>

      <Field name="password" label="Password (at least 8 characters)" error={errors.password}>
        {(control) => <TextInput {...control} type="password" autoComplete="new-password" minLength={8} required />}
      </Field>

      <BirthDateInput error={errors.birthDate} defaultValue={values?.birthDate} />
      <CountrySelect error={errors.country} defaultValue={values?.country} />
      <RulesAgreement error={errors.agree} />

      <SubmitButton pending={pending} label="Create account" pendingLabel="Creating account" />
    </form>
  );
}
