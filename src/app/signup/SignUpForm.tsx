"use client";

import Link from "next/link";
import { useActionState } from "react";
import { COUNTRY_OPTIONS } from "@/config/countries";
import type { SignUpState } from "@/lib/signup";
import { signUpAction } from "./actions";
import styles from "./signup.module.css";

type FieldProps = { name: string; label: string; error?: string; children: (describedBy?: string) => React.ReactNode };

function Field({ name, label, error, children }: FieldProps) {
  const errorId = error ? `${name}-error` : undefined;
  return (
    <div className={styles.field}>
      <label htmlFor={name} className={styles.label}>
        {label}
      </label>
      {children(errorId)}
      {error && (
        <p id={errorId} className={styles.fieldError}>
          {error}
        </p>
      )}
    </div>
  );
}

export function SignUpForm() {
  const [state, formAction, pending] = useActionState<SignUpState | null, FormData>(signUpAction, null);
  const failed = state && !state.ok ? state : null;
  const errors = failed?.fieldErrors ?? {};
  const values = failed?.values;

  return (
    <form action={formAction} className={styles.form} noValidate>
      {failed?.message && (
        <p role="alert" className={styles.formError}>
          {failed.message}
        </p>
      )}

      <Field name="email" label="Email" error={errors.email}>
        {(describedBy) => (
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={values?.email}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={describedBy}
            className={styles.input}
          />
        )}
      </Field>

      <Field name="password" label="Password (at least 8 characters)" error={errors.password}>
        {(describedBy) => (
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            aria-invalid={Boolean(errors.password)}
            aria-describedby={describedBy}
            className={styles.input}
          />
        )}
      </Field>

      <Field name="birthDate" label="Date of birth" error={errors.birthDate}>
        {(describedBy) => (
          <input
            id="birthDate"
            name="birthDate"
            type="date"
            autoComplete="bday"
            required
            defaultValue={values?.birthDate}
            aria-invalid={Boolean(errors.birthDate)}
            aria-describedby={describedBy}
            className={styles.input}
          />
        )}
      </Field>

      <Field name="country" label="Country of residence" error={errors.country}>
        {(describedBy) => (
          <select
            id="country"
            name="country"
            required
            defaultValue={values?.country || "US"}
            aria-describedby={describedBy}
            className={styles.input}
          >
            {COUNTRY_OPTIONS.map(({ code, name }) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        )}
      </Field>

      <div className={styles.field}>
        <label className={styles.checkboxRow}>
          <input
            name="agree"
            type="checkbox"
            required
            aria-invalid={Boolean(errors.agree)}
            aria-describedby={errors.agree ? "agree-error" : undefined}
            className={styles.checkbox}
          />
          <span>
            I agree to the <Link href="/rules">official rules</Link>
          </span>
        </label>
        {errors.agree && (
          <p id="agree-error" className={styles.fieldError}>
            {errors.agree}
          </p>
        )}
      </div>

      <button type="submit" disabled={pending} className={styles.submit}>
        {pending ? "Creating account" : "Create account"}
      </button>
    </form>
  );
}
