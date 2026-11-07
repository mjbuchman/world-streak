"use client";

import { useActionState } from "react";
import { signInAction } from "@/app/auth/actions";
import { Field, TextInput } from "@/components/form/Field";
import { FormAlert, SubmitButton } from "@/components/form/FormParts";
import type { SignInState } from "@/lib/signin";
import styles from "../signup/signup.module.css";

export function SignInForm() {
  const [state, formAction, pending] = useActionState<SignInState | null, FormData>(signInAction, null);
  const failed = state && !state.ok ? state : null;
  const errors = failed?.fieldErrors ?? {};

  return (
    <form action={formAction} className={styles.form} noValidate>
      <FormAlert message={failed?.message} />

      <Field name="email" label="Email" error={errors.email}>
        {(control) => (
          <TextInput {...control} type="email" autoComplete="email" required defaultValue={failed?.values.email} />
        )}
      </Field>

      <Field name="password" label="Password" error={errors.password}>
        {(control) => <TextInput {...control} type="password" autoComplete="current-password" required />}
      </Field>

      <SubmitButton pending={pending} label="Sign in" pendingLabel="Signing in" />
    </form>
  );
}
