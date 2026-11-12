"use client";

import { useActionState } from "react";
import { saveSettingsAction } from "@/app/admin/actions";
import { Field, TextInput } from "@/components/form/Field";
import { SubmitButton } from "@/components/form/FormParts";
import type { EditState } from "@/lib/adminEdit";
import styles from "./SettingsForm.module.css";

export type SettingsField = { name: string; label: string; hint: string };

/**
 * Every game setting in one form (T42). Values are typed as text and checked on the server,
 * which answers with the first problem or "Settings saved."
 */
export function SettingsForm({ fields, values }: { fields: SettingsField[]; values: Record<string, string> }) {
  const [state, formAction, pending] = useActionState<EditState | null, FormData>(saveSettingsAction, null);
  return (
    <form action={formAction} className={styles.form}>
      {fields.map((field) => (
        <div key={field.name}>
          <Field name={field.name} label={field.label}>
            {(control) => <TextInput {...control} defaultValue={values[field.name]} aria-describedby={`${field.name}-hint`} />}
          </Field>
          <p id={`${field.name}-hint`} className={styles.hint}>
            {field.hint}
          </p>
        </div>
      ))}
      <SubmitButton pending={pending} label="Save settings" />
      {state && (
        <p role="status" className={state.ok ? styles.saved : styles.refused}>
          {state.message}
        </p>
      )}
    </form>
  );
}
