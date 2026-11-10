"use client";

import { type ChangeEvent, type FormEvent, useActionState, useLayoutEffect, useRef, useState } from "react";
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
  const value = (name: string) => {
    const field = form.elements.namedItem(name);
    return field instanceof HTMLInputElement ? field.value : "";
  };
  return { password: value("password"), confirm: value("confirmPassword") };
}

export function SignUpForm() {
  const [state, formAction, pending] = useActionState<SignUpState | null, FormData>(signUpAction, null);
  // What was in the password fields at the last submit, so a failed submit keeps them. Held in a
  // ref and written straight back to the inputs: never echoed by the server, and never put in
  // the page's HTML (a defaultValue would show up as a value="" attribute).
  const kept = useRef<Passwords>({ password: "", confirm: "" });
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  // Shown when a submit is stopped for a mismatch; cleared live once the two fields agree.
  const [mismatch, setMismatch] = useState(false);

  const failed = state && !state.ok ? state : null;
  const errors = failed?.fieldErrors ?? {};
  const values = failed?.values;
  const confirmError = mismatch ? PASSWORD_MISMATCH : errors.confirmPassword;

  // React resets the form's fields after an action; put the passwords back once it has (layout
  // effects run after that reset and before the browser paints, so they never flash empty).
  useLayoutEffect(() => {
    if (!failed) return;
    if (passwordRef.current) passwordRef.current.value = kept.current.password;
    if (confirmRef.current) confirmRef.current.value = kept.current.confirm;
  }, [failed]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const passwords = readPasswords(event.currentTarget);
    kept.current = passwords;
    const matches = passwords.password === passwords.confirm;
    setMismatch(!matches);
    if (matches) return;
    // Stop here: nothing is sent, and focus goes to the field that needs fixing.
    event.preventDefault();
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
            ref={passwordRef}
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
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
