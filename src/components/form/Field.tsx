import type { InputHTMLAttributes, ReactNode } from "react";
import styles from "./form.module.css";

/** Props every form control receives from its Field, so labels and errors stay wired up. */
export type ControlProps = {
  id: string;
  name: string;
  "aria-invalid": boolean;
  "aria-describedby"?: string;
};

type FieldProps = {
  name: string;
  label: ReactNode;
  error?: string;
  /** "checkbox" puts the control inside its label, on one row, with a 48dp touch target. */
  layout?: "stacked" | "checkbox";
  children: (control: ControlProps) => ReactNode;
};

/** A labelled form control with an error message linked for screen readers. */
export function Field({ name, label, error, layout = "stacked", children }: FieldProps) {
  const errorId = error ? `${name}-error` : undefined;
  const control: ControlProps = { id: name, name, "aria-invalid": Boolean(error), "aria-describedby": errorId };
  const errorText = error && (
    <p id={errorId} className={styles.fieldError}>
      {error}
    </p>
  );

  if (layout === "checkbox") {
    return (
      <div className={styles.field}>
        <label className={styles.checkboxRow}>
          {children(control)}
          <span>{label}</span>
        </label>
        {errorText}
      </div>
    );
  }
  return (
    <div className={styles.field}>
      <label htmlFor={name} className={styles.label}>
        {label}
      </label>
      {children(control)}
      {errorText}
    </div>
  );
}

/** Material 3 outlined text input. Its look comes from the form styles, so it takes no className. */
export function TextInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "className">) {
  return <input {...props} className={styles.input} />;
}
