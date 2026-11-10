import { Button } from "@/components/ui/Button";
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

/** The form's main action: shows a spinner and ignores presses while the form is submitting. */
export function SubmitButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <Button type="submit" loading={pending}>
      {label}
    </Button>
  );
}
