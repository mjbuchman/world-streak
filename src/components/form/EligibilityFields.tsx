import Link from "next/link";
import { COUNTRY_OPTIONS } from "@/config/countries";
import { Field, TextInput } from "./Field";
import styles from "./form.module.css";

// The fields every profile-creating form asks for: sign-up and profile completion.

export function BirthDateInput({ error, defaultValue }: { error?: string; defaultValue?: string }) {
  return (
    <Field name="birthDate" label="Date of birth" error={error}>
      {(control) => <TextInput {...control} type="date" autoComplete="bday" required defaultValue={defaultValue} />}
    </Field>
  );
}

export function CountrySelect({ error, defaultValue }: { error?: string; defaultValue?: string }) {
  const value = defaultValue?.toUpperCase() ?? "";
  return (
    <Field name="country" label="Country of residence" error={error}>
      {(control) => (
        <select
          // A select only reads defaultValue when it mounts, so remount it to show a new value
          // (for example after React resets the form following a failed submit). The key comes
          // before the spread: after it, JSX falls back to createElement, whose children React's
          // dev build reports as a list missing keys.
          key={value || "initial"}
          {...control}
          required
          defaultValue={value}
          className={styles.input}
        >
          {/* No preselected country: location is self-declared, so ask rather than assume. */}
          <option value="" disabled>
            Select a country
          </option>
          {COUNTRY_OPTIONS.map(({ code, name }) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function RulesAgreement({ error }: { error?: string }) {
  return (
    <Field
      name="agree"
      layout="checkbox"
      error={error}
      label={
        <>
          I agree to the <Link href="/rules">official rules</Link>
        </>
      }
    >
      {(control) => <input {...control} type="checkbox" required className={styles.checkbox} />}
    </Field>
  );
}
