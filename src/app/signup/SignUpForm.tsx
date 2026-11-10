"use client";

import { type ChangeEvent, type FormEvent, useActionState, useRef, useState } from "react";
import { BirthDateInput, CountrySelect, RulesAgreement } from "@/components/form/EligibilityFields";
import { Field, TextInput } from "@/components/form/Field";
import { FormAlert, SubmitButton } from "@/components/form/FormParts";
import { PASSWORD_MISMATCH } from "@/lib/passwords";
import type { SignUpState } from "@/lib/signup";
import { signUpAction } from "./actions";
import styles from "@/app/auth/authPage.module.css";

type Passwords = { password: string; confirm: string };

/** The two password fields' current values, read from the form itself. */
function readPasswords(form: HTMLFormElement): Passwords {
  const value = (name: string) => (form.elements.namedItem(name) as HTMLInputElement).value;
  return { password: value("password"), confirm: value("confirmPassword") };
}

export function SignUpForm() {
  const [state, formAction, pending] = useActionState<SignUpState | null, FormData>(signUpAction, null);
  // What was in the password fields at the last submit. React resets a form's fields to their
  // defaultValue after an action, so these become the defaults: a failed submit keeps them. They
  // stay in the browser; the server never sends a password back. The fields stay uncontrolled,
  // so typing before hydration is not lost either.
  const [kept, setKept] = useState<Passwords>({ password: "", confirm: "" });
  // Shown when a submit is stopped for a mismatch; cleared live once the two fields agree.
  const [mismatch, setMismatch] = useState(false);
  const confirmRef = useRef<HTMLInputElement>(null);

  const failed = state && !state.ok ? state : null;
  const errors = failed?.fieldErrors ?? {};
  const values = failed?.values;
  const confirmError = mismatch ? PASSWORD_MISMATCH : errors.confirmPassword;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const passwords = readPasswords(event.currentTarget);
    setKept(passwords);
    if (passwords.password === passwords.confirm) return;
    // Stop here: nothing is sent, and focus goes to the field that needs fixing.
    event.preventDefault();
    setMismatch(true);
    confirmRef.current?.focus();
  }

  function onPasswordChange(event: ChangeEvent<HTMLInputElement>) {
    if (!mismatch || !event.currentTarget.form) return;
    const { password, confirm } = readPasswords(event.currentTarget.form);
    setMismatch(password !== confirm);
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className={styles.form} noValidate>
      <FormAlert message={failed?.message} />

      <Field name="email" label="Email" error={errors.email}>
        {(control) => (
          <TextInput {...control} type="email" autoComplete="email" required defaultValue={values?.email} />
        )}
      </Field>

      <Field name="password" label="Password (at least 8 characters)" error={errors.password}>
        {(control) => (
          <TextInput
            {...control}
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            defaultValue={kept.password}
            onChange={onPasswordChange}
          />
        )}
      </Field>

      <Field name="confirmPassword" label="Confirm password" error={confirmError}>
        {(control) => (
          <TextInput
            {...control}
            ref={confirmRef}
            type="password"
            autoComplete="new-password"
            required
            defaultValue={kept.confirm}
            onChange={onPasswordChange}
          />
        )}
      </Field>

      <BirthDateInput error={errors.birthDate} defaultValue={values?.birthDate} />
      <CountrySelect error={errors.country} defaultValue={values?.country} />
      <RulesAgreement error={errors.agree} />

      <SubmitButton pending={pending} label="Create account" />
    </form>
  );
}
