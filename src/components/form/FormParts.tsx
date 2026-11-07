import styles from "./form.module.css";

/** A message about the whole form, announced to screen readers. Renders nothing without a message. */
export function FormAlert({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className={styles.formError}>
      {message}
    </p>
  );
}

/** Material 3 filled button that is disabled and relabelled while the form is submitting. */
export function SubmitButton({ pending, label, pendingLabel }: { pending: boolean; label: string; pendingLabel: string }) {
  return (
    <button type="submit" disabled={pending} className={styles.submit}>
      {pending ? pendingLabel : label}
    </button>
  );
}
